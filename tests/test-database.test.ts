import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestDatabasePool } from '../src/db/test-database.ts';

const keys = ['TEST_DATABASE_URL', 'TEST_DATABASE_CONFIRMATION', 'DATABASE_URL'] as const;

function withEnvironment(values: Record<string, string | undefined>, run: () => void): void {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('database mutation tests skip when no dedicated test database is configured', () => {
  withEnvironment({}, () => assert.equal(createTestDatabasePool(), null));
});

test('database mutation tests reject the production database URL', () => {
  withEnvironment({
    DATABASE_URL: 'postgresql://production.example/postgres',
    TEST_DATABASE_URL: 'postgresql://production.example/postgres',
    TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
  }, () => {
    assert.throws(() => createTestDatabasePool(), /must never be the same/);
  });
});

test('database mutation tests require an explicit safety confirmation', () => {
  withEnvironment({ TEST_DATABASE_URL: 'postgresql://test.example/postgres' }, () => {
    assert.throws(() => createTestDatabasePool(), /TEST_DATABASE_CONFIRMATION/);
  });
});
