import 'dotenv/config';
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for the S02 schema regression.');

const schemaName = `nexus_s02_schema_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaIdentifier = `"${schemaName}"`;
const migrationsDirectory = path.resolve('src/db/migrations');
const bootstrap = new pg.Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaIdentifier}`);

const scopedUrl = new URL(connectionString);
scopedUrl.searchParams.set('options', `-c search_path=${schemaName},public`);
const pool = new pg.Pool({ connectionString: scopedUrl.toString(), max: 2 });
let applicationPool: pg.Pool | undefined;

type RegisteredRoute = { method: string; path: string; handlers: Array<(...args: any[]) => any> };
const routes: RegisteredRoute[] = [];
const app = new Proxy({}, {
  get: (_target, method: string) => (routePath: string, ...handlers: Array<(...args: any[]) => any>) => {
    routes.push({ method, path: routePath, handlers });
  },
}) as any;

async function invokeResolution(handler: (...args: any[]) => any, institutionId: string, personId: string) {
  const response = { statusCode: 200, body: undefined as any };
  const res = {
    status(code: number) { response.statusCode = code; return this; },
    json(body: any) { response.body = body; return this; },
  };
  const req = {
    body: { student: { name: 'Aluno Existente', studentNumber: 'S02-EXIST-001' } },
    institutionalContext: {
      personId,
      personName: 'Secretaria S02',
      identityEmail: null,
      membershipId: randomUUID(),
      institutionId,
      institutionName: 'Escola S02',
      institutionSlug: 'escola-s02',
      role: 'secretariat',
    },
  };
  await handler(req, res);
  return response;
}

try {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((name) => /^000[1-6]_.+\.sql$/.test(name))
    .sort();
  for (const filename of migrationFiles) {
    await pool.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
  }

  const institutionId = randomUUID();
  const personId = randomUUID();
  await pool.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Escola S02', $2, 'active')`,
    [institutionId, `escola-s02-${Date.now()}`],
  );
  await pool.query(`INSERT INTO people (id, name, phone) VALUES ($1, 'Aluno Existente', '+244923000001')`, [personId]);
  await pool.query(
    `INSERT INTO student_profiles (institution_id, person_id, student_number, status)
     VALUES ($1, $2, 'S02-EXIST-001', 'active')`,
    [institutionId, personId],
  );

  process.env.DATABASE_URL = scopedUrl.toString();
  const { registerEnrollmentRoutes } = await import('../src/modules/enrollments/enrollment.controller.ts');
  const databaseModule = await import('../src/db/index.ts');
  applicationPool = databaseModule.pool;
  registerEnrollmentRoutes(app);
  const route = routes.find((entry) => entry.method === 'post' && entry.path === '/api/enrollments/person-resolution');
  if (!route) throw new Error('Enrollment person-resolution HTTP route was not registered.');
  const handler = route.handlers.at(-1)!;

  const capturedErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  let beforeRepair;
  try {
    console.error = (...args: unknown[]) => { capturedErrors.push(args); };
    beforeRepair = await invokeResolution(handler, institutionId, personId);
  } finally {
    console.error = originalConsoleError;
  }

  if (beforeRepair.statusCode !== 500 || beforeRepair.body?.error !== 'Não foi possível concluir a operação de matrícula.') {
    throw new Error(`Expected generic HTTP 500 before repair, received ${beforeRepair.statusCode}.`);
  }
  if (!capturedErrors.some((entry) => entry.some((value: any) => value?.code === '42703'))) {
    throw new Error('Expected controller log evidence with PostgreSQL SQLSTATE 42703.');
  }

  const birthDateMigration = await readFile(path.join(migrationsDirectory, '0015_s02_existing_student_schema_reconciliation.sql'), 'utf8');
  await pool.query(birthDateMigration);
  await pool.query(birthDateMigration);
  const afterRepair = await invokeResolution(handler, institutionId, personId);
  if (afterRepair.statusCode !== 200 || afterRepair.body?.resolution?.status !== 'LOCAL_MATCH') {
    throw new Error(`Expected HTTP 200 LOCAL_MATCH after repair, received ${afterRepair.statusCode}.`);
  }

  console.log('[S02-SCHEMA-POSTGRES] PASS: legacy schema reproduced HTTP 500 with PostgreSQL SQLSTATE 42703.');
  console.log('[S02-SCHEMA-POSTGRES] PASS: forward-only idempotent repair restored HTTP 200 LOCAL_MATCH.');
} finally {
  await applicationPool?.end().catch(() => undefined);
  await pool.end().catch(() => undefined);
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined);
  await bootstrap.end();
}
