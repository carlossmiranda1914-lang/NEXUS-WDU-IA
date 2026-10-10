import dotenv from 'dotenv';
import path from 'node:path';
import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';

dotenv.config({ path: path.resolve('.env.test.local'), override: true });
process.env.TEST_DATABASE_LOCAL_AUTHORIZED = 'true';
process.env.TEST_DATABASE_CONFIRMATION = 'NEXUS_TEST_DATABASE';
process.env.DATABASE_URL = 'postgresql://fence_guard:fence_guard@127.0.0.1:54329/fence_guard';

const { connectionString } = readApprovedTestTarget();
const client = new pg.Client({ connectionString });
await client.connect();
const act = await client.query(`
  SELECT pid, state, wait_event_type, wait_event, query, now() - query_start AS duration
  FROM pg_stat_activity
  WHERE datname = 'nexus_fnd01_test' AND pid != pg_backend_pid()
`);
console.log(JSON.stringify(act.rows, null, 2));
await client.end();
