import dotenv from 'dotenv';

dotenv.config();

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

console.log('[TEST SERVER] Connected only to the dedicated test database.');
await import('../server.ts');
