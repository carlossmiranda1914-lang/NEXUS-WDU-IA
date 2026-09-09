import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readApprovedTestTarget, verifyApprovedTestConnection } from './nexus-test-db-safety.mjs';
import { discoverMigrations } from '../src/db/migration-runner.ts';

export const CANONICAL_UAT_ORIGIN = 'http://localhost:3000';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

async function backendReachable(origin = CANONICAL_UAT_ORIGIN) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function runtimeIdentity(origin) {
  try {
    const response = await fetch(`${origin}/__uat/runtime`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;
    const value = await response.json();
    return typeof value?.pid === 'number' && typeof value?.head === 'string' && typeof value?.worktree === 'string' ? value : null;
  } catch {
    return null;
  }
}

function requestedHumanUatOrigin() {
  const index = process.argv.indexOf('--origin');
  if (index === -1) return CANONICAL_UAT_ORIGIN;
  const origin = process.argv[index + 1];
  if (!origin) throw new Error('--origin requires an explicit origin value');
  return new URL(origin).origin;
}

function expectedServerProcess() {
  if (process.platform !== 'win32') return { running: false, commandMatches: false };
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', "$listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop | Select-Object -First 1; Get-CimInstance Win32_Process -Filter \"ProcessId=$($listener.OwningProcess)\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true });
    const listener = JSON.parse(output || '{}');
    const commandMatches = typeof listener.CommandLine === 'string' && listener.CommandLine.includes(root) && listener.CommandLine.includes('scripts/run-test-server.ts');
    return { running: Boolean(listener.ProcessId), commandMatches, pid: listener.ProcessId };
  } catch {
    return { running: false, commandMatches: false };
  }
}

async function migrationsCurrent(connectionString) {
  const expected = await discoverMigrations(path.join(root, 'src', 'db', 'migrations'));
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5_000 });
  try {
    await client.connect();
    const result = await client.query('SELECT filename, checksum FROM nexus_schema_migrations');
    const applied = new Map(result.rows.map((row) => [row.filename, row.checksum]));
    return expected.every((migration) => {
      const rawChecksum = createHash('sha256').update(migration.sql, 'utf8').digest('hex');
      return [migration.checksum, rawChecksum].includes(applied.get(migration.filename));
    });
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const expectedHead = git('rev-parse', 'HEAD');
  const intendedOrigin = requestedHumanUatOrigin();
  const canonicalOriginValid = intendedOrigin === CANONICAL_UAT_ORIGIN;
  const serverProcess = expectedServerProcess();
  const backend = await backendReachable();
  const identity = await runtimeIdentity(CANONICAL_UAT_ORIGIN);
  const expectedWorktree = path.basename(root);
  const runtimeIdentityMatches = Boolean(identity && identity.head === expectedHead && identity.worktree === expectedWorktree && identity.pid === serverProcess.pid);
  const server127Reachable = await backendReachable('http://127.0.0.1:3000');
  if (!canonicalOriginValid) {
    const rejected = {
      UAT_PREFLIGHT: 'FAIL',
      CANONICAL_UAT_ORIGIN,
      INTENDED_HUMAN_UAT_ORIGIN: intendedOrigin,
      AUTHENTICATED_HUMAN_UAT_ORIGIN_VALID: 'NO',
      NON_CANONICAL_AUTH_UAT_ORIGIN_REJECTED: 'YES',
      CODEX_PREVIEW_AUTH_UAT_SUPPORTED: 'NO',
      MANUAL_CANONICAL_BROWSER_ORIGIN_REQUIRED: 'YES',
      BACKEND: backend ? 'PASS' : 'FAIL',
      RUNTIME_IDENTITY_REQUIRED: 'YES',
      RUNTIME_IDENTITY: runtimeIdentityMatches ? 'PASS' : 'FAIL',
      SERVER_127_REACHABLE: server127Reachable ? 'YES' : 'NO',
      AUTH_UAT_127_ALLOWED: 'NO',
      READY_FOR_HUMAN_UAT: 'NO',
    };
    for (const [key, value] of Object.entries(rejected)) console.log(`${key}=${value}`);
    console.error('UAT_PREFLIGHT_BLOCKER=The intended authenticated Human-UAT origin is not canonical. Use http://localhost:3000 manually, never the Codex preview origin.');
    process.exitCode = 1;
    return;
  }
  let database = false;
  let migrations = false;
  let target;
  try {
    target = await verifyApprovedTestConnection();
    database = true;
    migrations = await migrationsCurrent(readApprovedTestTarget().connectionString);
  } catch {
    // The result below is intentionally non-sensitive; connection details are never logged.
  }

  let firebase = false;
  try {
    const config = JSON.parse(await readFile(path.join(root, 'firebase-applet-config.json'), 'utf8'));
    firebase = Boolean(config.projectId && config.authDomain);
  } catch {
    firebase = false;
  }

  const identityFixture = Boolean(process.env.NEXUS_UAT_FIREBASE_UID?.trim());
  const prerequisites = database && migrations && identityFixture;
  const status = {
    UAT_PREFLIGHT: 'FAIL',
    EXPECTED_WORKTREE: serverProcess.commandMatches ? 'PASS' : 'FAIL',
    EXPECTED_HEAD: runtimeIdentityMatches ? 'PASS' : 'FAIL',
    RUNTIME_IDENTITY_REQUIRED: 'YES',
    RUNTIME_IDENTITY: runtimeIdentityMatches ? 'PASS' : 'FAIL',
    CANONICAL_UAT_ORIGIN,
    INTENDED_HUMAN_UAT_ORIGIN: intendedOrigin,
    AUTHENTICATED_HUMAN_UAT_ORIGIN_VALID: 'YES',
    NON_CANONICAL_AUTH_UAT_ORIGIN_REJECTED: 'YES',
    CODEX_PREVIEW_AUTH_UAT_SUPPORTED: 'NO',
    MANUAL_CANONICAL_BROWSER_ORIGIN_REQUIRED: 'YES',
    BACKEND: backend ? 'PASS' : 'FAIL',
    SERVER_127_REACHABLE: server127Reachable ? 'YES' : 'NO',
    AUTH_UAT_127_ALLOWED: 'NO',
    DATABASE: database ? 'PASS' : 'FAIL',
    DATABASE_TARGET: target ? `${target.host}:${target.port}/${target.database}` : 'UNAVAILABLE',
    MIGRATIONS: migrations ? 'PASS' : 'FAIL',
    FIREBASE: firebase ? 'CONFIG_PRESENT' : 'FAIL',
    AUTH: 'EXTERNAL_CONFIGURATION_REQUIRED',
    INSTITUTION_CONTEXT: prerequisites ? 'PREREQUISITES_READY' : 'FIXTURE_PREREQUISITES_MISSING',
    CAPABILITIES: prerequisites ? 'SERVER_DERIVED_PENDING_AUTHENTICATED_SMOKE' : 'PENDING',
    TARGET_HTTP: 'EXTERNAL_CONFIGURATION_REQUIRED',
    READY_FOR_HUMAN_UAT: 'NO',
    EXTERNAL_CONFIGURATION_REQUIRED: 'YES',
  };
  for (const [key, value] of Object.entries(status)) console.log(`${key}=${value}`);
  console.error('UAT_PREFLIGHT_BLOCKER=Firebase Authorized Domains cannot be machine-verified locally; authorize localhost for the configured project, then prove a real authenticated browser session.');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`UAT_PREFLIGHT=FAIL\nPREFLIGHT_ERROR=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
