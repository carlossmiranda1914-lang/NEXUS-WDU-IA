import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.test.local'), override: true });

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const target = await verifyApprovedTestConnection();
const testUrl = process.env.TEST_DATABASE_URL!;
const parsedUrl = new URL(testUrl);
const schema = `nexus_cp4_${randomUUID().replaceAll('-', '')}`;
const schemaIdentifier = quoteIdentifier(schema);
const legacySchema = `nexus_cp4_legacy_${randomUUID().replaceAll('-', '')}`;
const legacySchemaIdentifier = quoteIdentifier(legacySchema);

// Keep the production URL absent: the real repository must bind exclusively to
// the approved disposable target through the in-memory derived SQL variables.
delete process.env.DATABASE_URL;
process.env.SQL_HOST = parsedUrl.hostname;
process.env.SQL_PORT = parsedUrl.port || '5432';
process.env.SQL_USER = decodeURIComponent(parsedUrl.username);
process.env.SQL_PASSWORD = decodeURIComponent(parsedUrl.password);
process.env.SQL_DB_NAME = decodeURIComponent(parsedUrl.pathname.slice(1));
process.env.SQL_OPTIONS = `-c search_path=${schema},public`;

const adminPool = new pg.Pool({ connectionString: testUrl, connectionTimeoutMillis: 7000 });
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

async function assert(condition: unknown, message: string): Promise<void> {
  if (!condition) throw new Error(message);
}

async function proveAmbiguousLegacyOwnershipFailsClosed(): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query(`CREATE SCHEMA ${legacySchemaIdentifier}`);
    await client.query(`SET search_path TO ${legacySchemaIdentifier}, public`);
    const allMigrations = await discoverMigrations(migrationsDirectory);
    const preReconciliation = allMigrations.filter(({ filename }) => filename < '0018_');
    await assert((await runMigrations(client, preReconciliation)).length === 17, 'Expected canonical migrations 0001–0017 before the negative fixture.');
    const beforeLedger = await client.query("SELECT filename FROM nexus_schema_migrations WHERE filename = '0018_fnd01_school_tasks_reconciliation.sql'");
    await assert(beforeLedger.rowCount === 0, '0018 must not be present before the negative fixture.');

    // historical pre-migration fixture — not schema authority
    // This is the minimum former runtime-created shape needed to reproduce an
    // unmappable legacy row; it intentionally supplies no ownership defaults.
    await client.query('CREATE TABLE school_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, due_date DATE NOT NULL, limit_date DATE NOT NULL)');
    await client.query("INSERT INTO school_tasks (id, title, description, due_date, limit_date) VALUES ('legacy-unowned', 'Legacy', 'No institutional ownership', DATE '2026-09-01', DATE '2026-09-02')");
    const before = await client.query("SELECT count(*)::int AS count, md5(string_agg(id || '|' || title || '|' || description, ',' ORDER BY id)) AS fingerprint FROM school_tasks");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let failure: unknown;
      try { await runMigrations(client, allMigrations); } catch (error) { failure = error; }
      await assert(String(failure).includes('existing rows lack complete ownership columns'), '0018 must fail closed for ambiguous legacy ownership.');
      const after = await client.query("SELECT count(*)::int AS count, md5(string_agg(id || '|' || title || '|' || description, ',' ORDER BY id)) AS fingerprint FROM school_tasks");
      await assert(JSON.stringify(after.rows[0]) === JSON.stringify(before.rows[0]), 'Failed 0018 must leave the legacy row intact.');
      const ownership = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'school_tasks' AND column_name IN ('tenant_id', 'school_id', 'organization_id')");
      await assert(ownership.rowCount === 0, 'Failed 0018 must leave no partial ownership columns.');
      const versions = await client.query("SELECT to_regclass(current_schema() || '.task_versions') AS relation");
      await assert(versions.rows[0]?.relation === null, 'Failed 0018 must not leave task_versions behind.');
      const ledger = await client.query("SELECT filename FROM nexus_schema_migrations WHERE filename = '0018_fnd01_school_tasks_reconciliation.sql'");
      await assert(ledger.rowCount === 0, 'Failed 0018 must not enter the migration ledger.');
      const preserved = await client.query('SELECT count(*)::int AS count FROM nexus_schema_migrations');
      await assert(preserved.rows[0]?.count === 17, 'Failure must preserve only migrations 0001–0017 in the ledger.');
    }
  } finally {
    try { await client.query(`DROP SCHEMA IF EXISTS ${legacySchemaIdentifier} CASCADE`); } finally { client.release(); }
  }
}

try {
  await proveAmbiguousLegacyOwnershipFailsClosed();
  const admin = await adminPool.connect();
  try {
    await admin.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await admin.query(`SET search_path TO ${schemaIdentifier}, public`);
    const applied = await runMigrations(admin, await discoverMigrations(migrationsDirectory));
    await assert(applied.length === 18, `Expected migrations 0001–0018; applied ${applied.length}.`);
  } finally {
    admin.release();
  }

  const { SchoolTaskRepository } = await import('../src/modules/school-tasks/school-task.repository.ts');
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const task = await SchoolTaskRepository.create({
    id: `task-${randomUUID()}`,
    title: 'CP4 task',
    description: 'migration-owned persistence',
    dueDate: '2026-09-01',
    limitDate: '2026-09-02',
  }, tenantA, 'school-a', 'org-a', 'actor-a', { requestId: 'cp4-create' });
  const createdHistory = await SchoolTaskRepository.getTaskHistoryTimeline(task.id, tenantA);
  await assert(createdHistory.length === 1 && createdHistory[0].action === 'CREATE', 'Create must persist its first snapshot.');

  const updated = await SchoolTaskRepository.update(task.id, { status: 'Concluída' }, tenantA, 'actor-a');
  await assert(updated.status === 'Concluída', 'Tenant-scoped update failed.');
  const history = await SchoolTaskRepository.getTaskHistoryTimeline(task.id, tenantA);
  await assert(history.length === 2 && history[0].action === 'UPDATE', 'Update must persist a factual snapshot.');
  await assert(await SchoolTaskRepository.findById(task.id, tenantB) === null, 'Tenant B must not read Tenant A task.');
  await assert(await SchoolTaskRepository.delete(task.id, tenantB, 'actor-b') === false, 'Tenant B must not delete Tenant A task.');
  await assert(await SchoolTaskRepository.delete(task.id, tenantA, 'actor-a') === true, 'Tenant A soft-delete failed.');
  const deleted = await SchoolTaskRepository.findByIdIncludingDeleted(task.id, tenantA);
  await assert(deleted?.isDeleted === true && deleted.deletedAt, 'Soft-delete metadata was not persisted.');

  let snapshotFailureObserved = false;
  const failingId = `task-failure-${randomUUID()}`;
  try {
    await SchoolTaskRepository.create({
      id: failingId, title: 'Must rollback', description: 'snapshot failure', dueDate: '2026-09-01', limitDate: '2026-09-02',
    }, tenantA, 'school-a', 'org-a', null as unknown as string);
  } catch {
    snapshotFailureObserved = true;
  }
  await assert(snapshotFailureObserved, 'Snapshot insertion failure must propagate.');
  await assert(await SchoolTaskRepository.findByIdIncludingDeleted(failingId, tenantA) === null, 'Snapshot failure must roll back the task mutation.');

  const rollbackTask = await SchoolTaskRepository.create({
    id: `task-rollback-${randomUUID()}`, title: 'Rollback task', description: 'snapshot failure paths', dueDate: '2026-09-01', limitDate: '2026-09-02',
  }, tenantA, 'school-a', 'org-a', 'actor-a');
  let updateFailureObserved = false;
  try { await SchoolTaskRepository.update(rollbackTask.id, { status: 'Concluída' }, tenantA, null as unknown as string); } catch { updateFailureObserved = true; }
  await assert(updateFailureObserved, 'Update snapshot failure must propagate.');
  await assert((await SchoolTaskRepository.findById(rollbackTask.id, tenantA))?.status === 'Pendente', 'Update snapshot failure must roll back the task mutation.');

  let deleteFailureObserved = false;
  try { await SchoolTaskRepository.delete(rollbackTask.id, tenantA, null as unknown as string); } catch { deleteFailureObserved = true; }
  await assert(deleteFailureObserved, 'Delete snapshot failure must propagate.');
  await assert((await SchoolTaskRepository.findByIdIncludingDeleted(rollbackTask.id, tenantA))?.isDeleted === false, 'Delete snapshot failure must roll back the task mutation.');

  const concurrentTask = await SchoolTaskRepository.create({
    id: `task-concurrent-${randomUUID()}`, title: 'Concurrent task', description: 'version integrity', dueDate: '2026-09-01', limitDate: '2026-09-02',
  }, tenantA, 'school-a', 'org-a', 'actor-a');
  const concurrent = await Promise.allSettled([
    SchoolTaskRepository.update(concurrentTask.id, { status: 'Em curso' }, tenantA, 'actor-a'),
    SchoolTaskRepository.update(concurrentTask.id, { priority: 'Alta' }, tenantA, 'actor-a'),
  ]);
  const concurrentHistory = await SchoolTaskRepository.getTaskHistoryTimeline(concurrentTask.id, tenantA);
  const versions = concurrentHistory.map((entry: any) => entry.version);
  await assert(concurrent.some((result) => result.status === 'fulfilled'), 'At least one concurrent mutation must complete.');
  await assert(new Set(versions).size === versions.length, 'Concurrent mutations must not create duplicate version numbers.');
  await assert(versions.length === 1 + concurrent.filter((result) => result.status === 'fulfilled').length, 'Each committed concurrent mutation must have exactly one snapshot.');

  console.log(`[FND-01-CP4] PASS ${target.database}: migration-only School Tasks persistence, snapshots, soft-delete and tenant isolation.`);
} finally {
  const { pool } = await import('../src/db/index.ts').catch(() => ({ pool: undefined }));
  await pool?.end().catch(() => undefined);
  const client = await adminPool.connect().catch(() => undefined);
  if (client) {
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
      await client.query(`DROP SCHEMA IF EXISTS ${legacySchemaIdentifier} CASCADE`);
    } finally { client.release(); }
  }
  await adminPool.end();
}
