import pg from 'pg';
import { fileURLToPath } from 'node:url';

const REQUIRED_CONFIRMATION = 'NEXUS_TEST_DATABASE';
const EXPECTED_TARGET = Object.freeze({
  user: 'nexus_test_runner',
  host: 'localhost',
  port: '54329',
  database: 'nexus_fnd01_test',
});

export function readApprovedTestTarget(environment = process.env) {
  const connectionString = environment.TEST_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required.');
  }

  if (environment.TEST_DATABASE_CONFIRMATION !== REQUIRED_CONFIRMATION) {
    throw new Error('Explicit test database confirmation is required.');
  }

  const primaryConnectionString = environment.DATABASE_URL?.trim();
  if (primaryConnectionString && connectionString === primaryConnectionString) {
    throw new Error('TEST_DATABASE_URL must never equal DATABASE_URL.');
  }

  const url = new URL(connectionString);
  const target = {
    user: decodeURIComponent(url.username),
    host: url.hostname,
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };

  for (const [key, expectedValue] of Object.entries(EXPECTED_TARGET)) {
    if (target[key] !== expectedValue) {
      throw new Error(`TEST_DATABASE_URL does not target the approved disposable database (${key}).`);
    }
  }

  return { connectionString, target };
}

export async function verifyApprovedTestConnection(environment = process.env) {
  const { connectionString, target } = readApprovedTestTarget(environment);
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 7000 });

  try {
    await client.connect();
    const result = await client.query('SELECT current_user, current_database()');
    const row = result.rows[0];

    if (row?.current_user !== target.user || row?.current_database !== target.database) {
      throw new Error('Database identity did not match the approved test target.');
    }

    return target;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyApprovedTestConnection()
    .then((target) => {
      console.log(`[NEXUS-TEST-DB-SAFETY] PASS ${target.user}@${target.host}:${target.port}/${target.database}`);
    })
    .catch((error) => {
      console.error(`[NEXUS-TEST-DB-SAFETY] FAIL ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
