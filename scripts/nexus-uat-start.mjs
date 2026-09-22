/**
 * scripts/nexus-uat-start.mjs
 * LOCAL UAT HARNESS v1 — Official UAT Start
 *
 * Official command:
 *   npm run nexus:uat:start -- --module=<MODULE>
 *
 * Required sequence (contract §4):
 *   SOURCE IDENTITY → EXPECTED SOURCE VALIDATION → CANONICAL PORT OWNERSHIP
 *   → CORE PREFLIGHT → MODULE PREFLIGHT → START EXISTING RUNTIME
 *   → READINESS → RUNTIME IDENTITY VERIFICATION → MANIFEST → UAT_READY=YES
 *
 * Canonical UAT origin: http://localhost:3000
 * This script may be run from any worktree directory using its absolute path.
 * process.cwd() determines the target worktree.
 */

import { execFileSync }                      from 'node:child_process';
import { existsSync, readFileSync,
         writeFileSync, unlinkSync }         from 'node:fs';
import { spawn }                             from 'node:child_process';
import { fileURLToPath }                     from 'node:url';
import path, { resolve, dirname }            from 'node:path';
import { pathToFileURL }                     from 'node:url';
import crypto                                from 'node:crypto';

// ─── Constants ────────────────────────────────────────────────────────────────
const UAT_PORT          = 3000;
const HARNESS_VERSION   = 'v1';
const MODE              = 'FORMAL_CLOSURE_UAT';
const PID_FILE          = '.nexus-uat.pid';
const READINESS_TIMEOUT = 90_000;   // ms
const READINESS_POLL    = 500;      // ms

const __filename = fileURLToPath(import.meta.url);
const __scriptDir = dirname(__filename);

// ─── Entry point ──────────────────────────────────────────────────────────────
await main().catch(err => {
  console.error('[NEXUS UAT] Unexpected error:', err?.message ?? err);
  process.exit(1);
});

async function main() {
  // process.cwd() determines the target worktree — not __dirname.
  const worktreePath = process.cwd();

  // ── Parse arguments ────────────────────────────────────────────────────────
  const args           = process.argv.slice(2);
  const moduleArg      = argValue(args, '--module')          ?? 'core';
  const expectedBranch = argValue(args, '--expected-branch') ?? null;
  const expectedHead   = argValue(args, '--expected-head')   ?? null;

  // ── SOURCE IDENTITY ────────────────────────────────────────────────────────
  console.log('\n[NEXUS UAT] ─── SOURCE IDENTITY ──────────────────────────────────');
  const branch     = git(['branch', '--show-current'],     worktreePath);
  const head       = git(['rev-parse', 'HEAD'],            worktreePath);
  const statusRaw  = git(['status', '--short'],            worktreePath);
  const dirtyLines = statusRaw ? statusRaw.split(/\r?\n/).filter(Boolean) : [];

  if (!branch || !head) {
    fatal('SOURCE_MISMATCH',
      'Cannot resolve Git branch or HEAD. Is this a valid Git worktree?');
  }
  console.log(`  WORKTREE=${worktreePath}`);
  console.log(`  BRANCH=${branch}`);
  console.log(`  HEAD=${head}`);

  // ── MODULE RESOLUTION ──────────────────────────────────────────────────────
  const { resolveModule, listModules } = await import(
    pathToFileURL(resolve(__scriptDir, 'nexus-uat-modules.mjs')).href
  );
  const moduleConfig = resolveModule(moduleArg);
  if (!moduleConfig) {
    fatal('CONFIGURATION_MISMATCH',
      `Unknown module '${moduleArg}'. Known modules: ${listModules().join(', ')}`);
  }

  // ── LOAD ENVIRONMENT ───────────────────────────────────────────────────────
  const baseEnv = loadEnvFile(resolve(worktreePath, '.env'));
  const testEnv = loadEnvFile(resolve(worktreePath, '.env.test.local'));
  const mergedEnv = { ...baseEnv, ...testEnv };
  // Prefer TEST_DATABASE_URL (from .env.test.local) as DATABASE_URL if base env lacks one.
  if (testEnv.TEST_DATABASE_URL && !baseEnv.DATABASE_URL) {
    mergedEnv.DATABASE_URL = testEnv.TEST_DATABASE_URL;
  }

  // ── CORE & MODULE PREFLIGHT ────────────────────────────────────────────────
  console.log('[NEXUS UAT] ─── CORE PREFLIGHT ───────────────────────────────────');
  const { runCorePreflight } = await import(
    pathToFileURL(resolve(__scriptDir, 'nexus-uat-core-preflight.mjs')).href
  );
  const preflight = await runCorePreflight({
    worktreePath, branch, head, dirtyLines, env: mergedEnv,
    moduleConfig, expectedBranch, expectedHead,
  });

  for (const chk of preflight.checks) {
    const marker = chk.level === 'ok' ? '[OK  ]' : chk.level === 'warning' ? '[WARN]' : '[BLOCK]';
    console.log(`  ${marker} ${chk.name}: ${chk.detail}`);
  }

  if (!preflight.pass) {
    console.error('\n[NEXUS UAT] PREFLIGHT FAILED');
    for (const code of preflight.failureCodes) {
      console.error(`  → ${code}`);
    }
    process.exit(1);
  }
  console.log('[NEXUS UAT] Preflight: PASS');

  // ── GENERATE HARNESS TOKEN ─────────────────────────────────────────────────
  const harnessToken = crypto.randomBytes(32).toString('hex');
  const startedAt    = new Date().toISOString();

  // ── BUILD PROCESS ENVIRONMENT ──────────────────────────────────────────────
  const uatEnv = {
    ...process.env,
    ...mergedEnv,
    PORT:                          String(UAT_PORT),
    NODE_ENV:                      'development',
    NEXUS_UAT_WORKTREE_PATH:       worktreePath,
    NEXUS_UAT_BRANCH:              branch,
    NEXUS_UAT_HEAD:                head,
    NEXUS_UAT_HARNESS_TOKEN:       harnessToken,
    NEXUS_UAT_STARTED_AT:          startedAt,
    NEXUS_SERVER_MANAGED_STARTUP:  'true',
    TEST_DATABASE_LOCAL_AUTHORIZED: 'true',
  };
  // Use TEST_DATABASE_URL as DATABASE_URL when available (finance / .env.test.local worktrees).
  if (testEnv.TEST_DATABASE_URL) {
    uatEnv.DATABASE_URL = testEnv.TEST_DATABASE_URL;
  }

  // ── START EXISTING RUNTIME ─────────────────────────────────────────────────
  console.log(`\n[NEXUS UAT] ─── STARTING RUNTIME on http://localhost:${UAT_PORT} ──`);
  const serverProc = spawnServer(uatEnv, worktreePath);

  let pidWritten = false;
  const pidFilePath = resolve(worktreePath, PID_FILE);

  // Cleanup handler — runs on ctrl+c or when server process exits.
  const cleanupAndExit = (code = 0) => {
    if (pidWritten && existsSync(pidFilePath)) {
      try { unlinkSync(pidFilePath); } catch { /* best-effort */ }
    }
    process.exit(code);
  };

  process.on('SIGINT',  () => { try { serverProc.kill('SIGTERM'); } catch {} cleanupAndExit(0); });
  process.on('SIGTERM', () => { try { serverProc.kill('SIGTERM'); } catch {} cleanupAndExit(0); });

  serverProc.on('error', err => {
    console.error(`[NEXUS UAT] Failed to start server process: ${err.message}`);
    cleanupAndExit(1);
  });
  serverProc.on('exit', (code) => {
    if (pidWritten && existsSync(pidFilePath)) {
      try { unlinkSync(pidFilePath); } catch { /* best-effort */ }
    }
    if (code !== 0 && code !== null) {
      console.error(`\n[NEXUS UAT] Server process exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });

  // ── READINESS ──────────────────────────────────────────────────────────────
  console.log('[NEXUS UAT] Waiting for server readiness...');
  const readiness = await waitForReadiness(UAT_PORT, harnessToken, READINESS_TIMEOUT);
  if (!readiness.ready) {
    try { serverProc.kill('SIGTERM'); } catch {}
    fatal('RUNTIME_START_FAILED',
      `Server did not become ready within ${READINESS_TIMEOUT / 1000}s: ${readiness.reason}`);
  }

  // ── RUNTIME IDENTITY VERIFICATION ─────────────────────────────────────────
  const id = readiness.identity;
  if (
    id.worktree !== worktreePath ||
    id.branch   !== branch       ||
    id.head     !== head
  ) {
    try { serverProc.kill('SIGTERM'); } catch {}
    fatal('EXECUTION_BLOCKED',
      `Runtime identity mismatch!\n` +
      `  Expected worktree: ${worktreePath}\n  Got: ${id.worktree}\n` +
      `  Expected branch:   ${branch}\n  Got: ${id.branch}\n` +
      `  Expected HEAD:     ${head}\n  Got: ${id.head}`);
  }
  console.log('[NEXUS UAT] Runtime identity: PROVEN');

  // ── WRITE HARNESS STATE (no secrets) ──────────────────────────────────────
  const pidState = {
    pid: serverProc.pid, port: UAT_PORT,
    worktree: worktreePath, branch, head, startedAt,
  };
  writeFileSync(pidFilePath, JSON.stringify(pidState, null, 2), 'utf8');
  pidWritten = true;

  // ── PRINT MANIFEST ─────────────────────────────────────────────────────────
  const cleanStr = dirtyLines.length === 0
    ? 'YES'
    : `NO (${dirtyLines.length} file(s) — see preflight log)`;
  let dbTarget = 'N/A';
  try {
    const u = new URL(uatEnv.DATABASE_URL ?? '');
    dbTarget = `${decodeURIComponent(u.pathname.replace(/^\//, ''))}@${u.hostname}:${u.port}`;
  } catch { /* non-blocking */ }
  const configSources = [
    existsSync(resolve(worktreePath, '.env'))             ? '.env'           : null,
    existsSync(resolve(worktreePath, '.env.test.local'))  ? '.env.test.local': null,
  ].filter(Boolean).join(' + ') || 'none';
  const modDeps = moduleConfig.dbTablesRequired.length > 0
    ? moduleConfig.dbTablesRequired.join(', ')
    : 'none';
  const fbProjectId = getFirebaseProjectId(worktreePath);

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  NEXUS LOCAL UAT HARNESS v1 — IDENTITY MANIFEST');
  console.log('══════════════════════════════════════════════════════');
  console.log(`NEXUS_LOCAL_UAT_HARNESS=${HARNESS_VERSION}`);
  console.log(`MODE=${MODE}`);
  console.log(`MODULE=${moduleConfig.name}`);
  console.log(`WORKTREE=${worktreePath}`);
  console.log(`BRANCH=${branch}`);
  console.log(`HEAD=${head}`);
  console.log(`WORKTREE_CLEAN=${cleanStr}`);
  console.log(`ORIGIN=http://localhost:${UAT_PORT}`);
  console.log(`CONFIG_SOURCE=${configSources}`);
  console.log(`DATABASE_TARGET=${dbTarget}`);
  console.log(`AUTH_READINESS=PASS`);
  console.log(`MODULE_DEPENDENCIES=${modDeps}`);
  console.log(`FIREBASE_PROJECT=${fbProjectId ?? 'N/A'}`);
  console.log(`SOURCE_IDENTITY=PROVEN`);
  console.log(`RUNTIME_IDENTITY=PROVEN`);
  console.log(`READINESS=PASS`);
  console.log(`STARTED_AT=${startedAt}`);
  console.log(`UAT_READY=YES`);
  console.log('══════════════════════════════════════════════════════');
  console.log(`[NEXUS UAT] Open: http://localhost:${UAT_PORT}`);
  console.log('[NEXUS UAT] Press Ctrl+C or run: npm run nexus:uat:stop');
  console.log('');

  // Keep the start script alive — server output is inherited; ctrl+c kills cleanly.
  // (serverProc 'exit' handler above will fire on natural termination.)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Spawn the existing server runtime with UAT env vars set. */
function spawnServer(env, cwd) {
  // Use npx tsx — cross-platform, matches the project's npm run dev mechanism.
  // shell:true is required on Windows when invoking .cmd shims (npx.cmd) without a shell.
  const isWin = process.platform === 'win32';
  return spawn(
    isWin ? 'npx.cmd' : 'npx',
    ['tsx', 'server.ts'],
    { env, cwd, stdio: 'inherit', shell: isWin },
  );
}

/** Poll /api/uat-identity until the server is ready and identity is confirmed. */
async function waitForReadiness(port, token, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/uat-identity`, {
        headers: { 'X-Nexus-UAT-Token': token },
        signal: AbortSignal.timeout(2000),
      });
      if (res.status === 200) {
        const identity = await res.json();
        return { ready: true, identity };
      }
    } catch { /* server not yet up — keep polling */ }
    await sleep(READINESS_POLL);
  }
  return { ready: false, reason: `Timeout after ${timeoutMs / 1000}s` };
}

/** Parse --key=value style arg. */
function argValue(args, key) {
  const prefix = `${key}=`;
  const found  = args.find(a => a === key || a.startsWith(prefix));
  if (!found) return null;
  return found.includes('=') ? found.slice(prefix.length) : null;
}

/** Load a .env file into a plain object. Does not mutate process.env. */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let   v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** Run a git command in the given working directory. */
function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/** Read Firebase projectId from firebase-applet-config.json (non-blocking). */
function getFirebaseProjectId(worktreePath) {
  try {
    const raw = readFileSync(resolve(worktreePath, 'firebase-applet-config.json'), 'utf8');
    return JSON.parse(raw).projectId ?? null;
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fatal(code, message) {
  console.error(`\n[NEXUS UAT] ${code}: ${message}`);
  process.exit(1);
}
