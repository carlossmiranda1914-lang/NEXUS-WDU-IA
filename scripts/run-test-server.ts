import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.test.local'), override: true, quiet: true });
process.env.TEST_DATABASE_LOCAL_AUTHORIZED = 'true';

const productionUrl = process.env.DATABASE_URL;
const { connectionString: testUrl } = readApprovedTestTarget();

if (!testUrl) {
  throw new Error('[TEST SERVER] TEST_DATABASE_URL is required. The server was not started.');
}

if (productionUrl && productionUrl === testUrl) {
  throw new Error('[TEST SERVER] Refusing to start: TEST_DATABASE_URL must be different from DATABASE_URL.');
}

// The safety authority also normalizes reserved URL characters so node-postgres
// receives an unambiguous hostname rather than interpreting credentials as one.
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'development';
process.env.NEXUS_SERVER_MANAGED_STARTUP = 'true';

console.log('[TEST SERVER] Connected only to the dedicated test database.');
const { startServer } = await import('../server.ts');
await startServer();
