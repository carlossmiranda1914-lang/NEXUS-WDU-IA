import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();
if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED === 'true') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local'), override: true });
}

const productionUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error('[TEST SERVER] TEST_DATABASE_URL is required. The server was not started.');
}

if (productionUrl && productionUrl === testUrl) {
  throw new Error('[TEST SERVER] Refusing to start: TEST_DATABASE_URL must be different from DATABASE_URL.');
}

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'development';
process.env.NEXUS_UAT_RUNTIME_IDENTITY ??= 'true';
process.env.NEXUS_UAT_SYNTHETIC_FISCAL_ADAPTERS = 'true';

console.log('[TEST SERVER] Connected only to the dedicated test database.');
await import('../server.ts');
