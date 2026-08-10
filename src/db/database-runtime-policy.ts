export interface DatabaseRuntimeEnvironment {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  SQL_HOST?: string;
  ALLOW_IN_MEMORY_FALLBACK?: string;
  DISABLE_DB_FALLBACK?: string;
}

export interface DatabaseRuntimePolicy {
  isPersistentDatabaseConfigured: boolean;
  isInMemoryFallbackAllowed: boolean;
}

/**
 * Production is always fail-closed. Development may use in-memory data only
 * when explicitly opted in and only when no persistent database is configured.
 */
export function resolveDatabaseRuntimePolicy(
  environment: DatabaseRuntimeEnvironment = process.env,
): DatabaseRuntimePolicy {
  const isPersistentDatabaseConfigured = Boolean(
    environment.DATABASE_URL?.trim() || environment.SQL_HOST?.trim(),
  );
  const isInMemoryFallbackAllowed =
    !isPersistentDatabaseConfigured &&
    environment.NODE_ENV !== 'production' &&
    environment.ALLOW_IN_MEMORY_FALLBACK === 'true' &&
    environment.DISABLE_DB_FALLBACK !== 'true';

  return { isPersistentDatabaseConfigured, isInMemoryFallbackAllowed };
}
