import pg from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const REQUIRED_CONFIRMATION = 'NEXUS_TEST_DATABASE';
const EXPECTED_TARGET = Object.freeze({
  user: 'nexus_test_runner',
  host: 'localhost',
  port: '54329',
  database: 'nexus_fnd01_test',
});

export function shouldLoadLocalTestEnvironment(environment = process.env) {
  return environment.CI !== 'true' && environment.TEST_DATABASE_LOCAL_AUTHORIZED === 'true';
}

if (shouldLoadLocalTestEnvironment()) {
  dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.test.local'), override: true, quiet: true });
  if (process.env.TEST_DATABASE_URL) {
    const localUrl = new URL(process.env.TEST_DATABASE_URL);
    if (localUrl.hostname === 'localhost' && (localUrl.port || '5432') === '54329') {
      localUrl.hostname = '127.0.0.1';
      process.env.TEST_DATABASE_URL = localUrl.toString();
    }
  }
}

export function readApprovedTestTarget(environment = process.env) {
  if (environment.CI !== 'true' && environment.TEST_DATABASE_LOCAL_AUTHORIZED !== 'true') {
    throw new Error('Local PostgreSQL tests require TEST_DATABASE_LOCAL_AUTHORIZED=true.');
  }
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

  if (environment.CI === 'true') {
    for (const [key, expectedValue] of Object.entries({ user: 'nexus_ci_runner', host: '127.0.0.1', port: '5432', database: 'nexus_ci_fnd06' })) {
      if (target[key] !== expectedValue) throw new Error(`TEST_DATABASE_URL does not target the approved CI disposable database (${key}).`);
    }
  } else if (target.host !== '127.0.0.1' || target.port !== '54329' || !target.user || !target.database) {
    throw new Error('TEST_DATABASE_URL does not target an approved local disposable database.');
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
    .then(() => {
      console.log('[NEXUS-TEST-DB-SAFETY] PASS local/CI disposable target approved.');
    })
    .catch((error) => {
      console.error(`[NEXUS-TEST-DB-SAFETY] FAIL ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
