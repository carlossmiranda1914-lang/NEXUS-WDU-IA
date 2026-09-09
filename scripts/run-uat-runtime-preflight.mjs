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

async function backendReachable() {
  try {
    const response = await fetch(CANONICAL_UAT_ORIGIN, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch {
    return false;
  }
}

function expectedServerProcess() {
  if (process.platform !== 'win32') return { running: false, commandMatches: false };
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true });
    const processes = JSON.parse(output || '[]');
    const items = Array.isArray(processes) ? processes : [processes];
    const match = items.find((item) => typeof item.CommandLine === 'string' && item.CommandLine.includes(root) && item.CommandLine.includes('scripts/run-test-server.ts'));
    return { running: Boolean(match), commandMatches: Boolean(match), pid: match?.ProcessId };
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
  const serverProcess = expectedServerProcess();
  const backend = await backendReachable();
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
  const expectedCode = serverProcess.commandMatches && backend;
  const prerequisites = database && migrations && identityFixture;
  const status = {
    UAT_PREFLIGHT: 'FAIL',
    EXPECTED_WORKTREE: serverProcess.commandMatches ? 'PASS' : 'FAIL',
    EXPECTED_HEAD: expectedCode ? 'PASS' : 'FAIL',
    CANONICAL_UAT_ORIGIN,
    BACKEND: backend ? 'PASS' : 'FAIL',
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
