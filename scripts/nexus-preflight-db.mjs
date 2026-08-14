import 'dotenv/config';
import pg from 'pg';
import { inspectS02Schema } from './nexus-db-schema-contract.mjs';

const targetArgument = process.argv.find((value) => value.startsWith('--target='));
const target = targetArgument?.slice('--target='.length) || 'DATABASE_URL';
if (!['DATABASE_URL', 'TEST_DATABASE_URL'].includes(target)) {
  throw new Error('Use --target=DATABASE_URL or --target=TEST_DATABASE_URL.');
}

const connectionString = process.env[target]?.trim();
if (!connectionString) throw new Error(`${target} is required for the Nexus database preflight.`);

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 7000 });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const missing = await inspectS02Schema(client);
  if (missing.length) {
    console.error(`[NEXUS-DB-PREFLIGHT] FAIL ${target}: missing ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`[NEXUS-DB-PREFLIGHT] PASS ${target}: S02 operational schema is compatible.`);
  }
  await client.query('ROLLBACK');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
