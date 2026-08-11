import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDatabaseRuntimePolicy } from '../src/db/database-runtime-policy.ts';

test('production requires a persistent database and never permits memory fallback', () => {
  const policy = resolveDatabaseRuntimePolicy({
    NODE_ENV: 'production',
    ALLOW_IN_MEMORY_FALLBACK: 'true',
  });

  assert.equal(policy.isPersistentDatabaseConfigured, false);
  assert.equal(policy.isInMemoryFallbackAllowed, false);
});

test('a configured DATABASE_URL is persistent and never falls back to memory', () => {
  const policy = resolveDatabaseRuntimePolicy({
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://nexus@localhost:5432/nexus',
    ALLOW_IN_MEMORY_FALLBACK: 'true',
  });

  assert.equal(policy.isPersistentDatabaseConfigured, true);
  assert.equal(policy.isInMemoryFallbackAllowed, false);
});

test('memory fallback requires explicit local development opt-in', () => {
  const policy = resolveDatabaseRuntimePolicy({
    NODE_ENV: 'development',
    ALLOW_IN_MEMORY_FALLBACK: 'true',
  });

  assert.equal(policy.isPersistentDatabaseConfigured, false);
  assert.equal(policy.isInMemoryFallbackAllowed, true);
});
