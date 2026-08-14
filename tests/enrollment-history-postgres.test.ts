import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for enrollment history PostgreSQL tests.');
if (connectionString === process.env.DATABASE_URL?.trim()) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');
if (process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') {
  throw new Error('Set TEST_DATABASE_CONFIRMATION=NEXUS_TEST_DATABASE before running database mutation tests.');
}

const schemaName = `nexus_enrollment_history_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaIdentifier = `"${schemaName}"`;
const bootstrap = new pg.Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaIdentifier}`);

const scopedUrl = new URL(connectionString);
scopedUrl.searchParams.set('options', `-c search_path=${schemaName},public`);
const pool = new pg.Pool({ connectionString: scopedUrl.toString(), max: 2 });
let applicationPool: pg.Pool | undefined;

type Handler = (...args: any[]) => any;
type RegisteredRoute = { method: string; path: string; handlers: Handler[] };
const routes: RegisteredRoute[] = [];
const app = new Proxy({}, {
  get: (_target, method: string) => (routePath: string, ...handlers: Handler[]) => {
    routes.push({ method, path: routePath, handlers });
  },
}) as any;

function context(institutionId: string, personId: string) {
  return {
    personId,
    personName: 'Secretaria Temporal',
    identityEmail: null,
    membershipId: randomUUID(),
    institutionId,
    institutionName: 'Escola Temporal',
    institutionSlug: 'escola-temporal',
    role: 'secretariat',
  };
}

async function invoke(handler: Handler, institutionId: string, personId: string, query: Record<string, unknown>) {
  const response = { statusCode: 200, body: undefined as any };
  const res = {
    status(code: number) { response.statusCode = code; return this; },
    json(body: any) { response.body = body; return this; },
  };
  await handler({ query, institutionalContext: context(institutionId, personId) }, res);
  return response;
}

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(message);
}

try {
  const migrationFiles = (await readdir('src/db/migrations'))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const filename of migrationFiles) {
    await pool.query(await readFile(path.join('src/db/migrations', filename), 'utf8'));
  }

  const ids = {
    institutionA: randomUUID(), institutionB: randomUUID(), actor: randomUUID(),
    currentStudent: randomUUID(), historicalStudent: randomUUID(), externalStudent: randomUUID(),
    activeYearA: randomUUID(), historicalYearA: randomUUID(), activeYearB: randomUUID(),
    currentOfferA: randomUUID(), historicalOfferA: randomUUID(), activeOfferB: randomUUID(),
  };
  await pool.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES
      ($1, 'Escola Temporal A', $2, 'active'), ($3, 'Escola Temporal B', $4, 'active')`,
    [ids.institutionA, `temporal-a-${Date.now()}`, ids.institutionB, `temporal-b-${Date.now()}`],
  );
  await pool.query(
    `INSERT INTO people (id, name) VALUES
      ($1, 'Secretaria Temporal'), ($2, 'Aluno Atual'), ($3, 'Aluno Historico'), ($4, 'Aluno Externo')`,
    [ids.actor, ids.currentStudent, ids.historicalStudent, ids.externalStudent],
  );
  await pool.query(
    `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES
      ($1, $2, '2026/2027', '2026-09-01', '2027-07-31', 'active'),
      ($3, $2, '2025/2026', '2025-09-01', '2026-07-31', 'closed'),
      ($4, $5, '2026/2027', '2026-09-01', '2027-07-31', 'active')`,
    [ids.activeYearA, ids.institutionA, ids.historicalYearA, ids.activeYearB, ids.institutionB],
  );
  await pool.query(
    `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status) VALUES
      ($1, $2, $3, 'Oferta Atual', 'ATUAL', 'active'),
      ($4, $2, $5, 'Oferta Historica', 'HIST', 'closed'),
      ($6, $7, $8, 'Oferta Externa', 'EXT', 'active')`,
    [ids.currentOfferA, ids.institutionA, ids.activeYearA, ids.historicalOfferA, ids.historicalYearA,
      ids.activeOfferB, ids.institutionB, ids.activeYearB],
  );
  await pool.query(
    `INSERT INTO enrollment_applications
      (institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by) VALUES
      ($1, $2, $3, $4, 'active', $5, $5),
      ($1, $6, $7, $8, 'active', $5, $5),
      ($9, $10, $11, $12, 'active', $5, $5)`,
    [ids.institutionA, ids.currentStudent, ids.activeYearA, ids.currentOfferA, ids.actor,
      ids.historicalStudent, ids.historicalYearA, ids.historicalOfferA,
      ids.institutionB, ids.externalStudent, ids.activeYearB, ids.activeOfferB],
  );

  process.env.DATABASE_URL = scopedUrl.toString();
  const { registerEnrollmentRoutes } = await import('../src/modules/enrollments/enrollment.controller.ts');
  const databaseModule = await import('../src/db/index.ts');
  applicationPool = databaseModule.pool;
  registerEnrollmentRoutes(app);
  const listRoutes = routes.filter((route) => route.method === 'get' && route.path === '/api/enrollments');
  assert(listRoutes.length === 1, 'GET /api/enrollments must have one canonical handler.');
  const handler = listRoutes[0].handlers.at(-1)!;

  const compatible = await invoke(handler, ids.institutionA, ids.actor, {});
  assert(compatible.statusCode === 200, 'Unfiltered enrollment listing must preserve its success contract.');
  assert(compatible.body.enrollments.length === 2, 'Unfiltered listing must preserve all institution-owned years.');

  const historical = await invoke(handler, ids.institutionA, ids.actor, { academicYearId: ids.historicalYearA });
  assert(historical.statusCode === 200, 'Historical academic-year filtering must succeed.');
  assert(historical.body.enrollments.length === 1, 'Historical filtering must return only the requested year.');
  assert(historical.body.enrollments[0].student_name === 'Aluno Historico', 'Historical filtering must return year B data.');

  const activeState = await pool.query<{ status: string }>(
    'SELECT status FROM academic_years WHERE id = $1 AND institution_id = $2',
    [ids.activeYearA, ids.institutionA],
  );
  assert(activeState.rows[0].status === 'active', 'Historical reads must not mutate the institution active year.');

  const isolated = await invoke(handler, ids.institutionA, ids.actor, { academicYearId: ids.activeYearB });
  assert(isolated.statusCode === 200, 'Cross-tenant year identifiers must fail closed without existence disclosure.');
  assert(isolated.body.enrollments.length === 0, 'Cross-tenant filtering must not leak enrollment data.');

  const invalid = await invoke(handler, ids.institutionA, ids.actor, { academicYearId: 'not-a-uuid' });
  assert(invalid.statusCode === 400, 'Malformed academicYearId must be rejected explicitly.');
  assert(typeof invalid.body.error === 'string', 'Malformed academicYearId must return a domain-safe error.');

  console.log(`[ENROLLMENT-HISTORY-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await applicationPool?.end().catch(() => undefined);
  await pool.end().catch(() => undefined);
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined);
  await bootstrap.end();
}
