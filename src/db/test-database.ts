import pg from 'pg';

const { Pool } = pg;

const TEST_DATABASE_CONFIRMATION = 'NEXUS_TEST_DATABASE';

export function createTestDatabasePool(): pg.Pool | null {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testDatabaseUrl) {
    return null;
  }

  if (testDatabaseUrl === process.env.DATABASE_URL?.trim()) {
    throw new Error('TEST_DATABASE_URL must never be the same as DATABASE_URL.');
  }

  if (process.env.TEST_DATABASE_CONFIRMATION !== TEST_DATABASE_CONFIRMATION) {
    throw new Error(
      `Set TEST_DATABASE_CONFIRMATION=${TEST_DATABASE_CONFIRMATION} before running database mutation tests.`,
    );
  }

  return new Pool({ connectionString: testDatabaseUrl, connectionTimeoutMillis: 5000 });
}

export function reportSkippedDatabaseTest(testName: string): void {
  console.log(`[${testName}] skipped: TEST_DATABASE_URL is not configured.`);
}
