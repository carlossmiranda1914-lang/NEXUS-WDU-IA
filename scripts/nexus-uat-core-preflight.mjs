/**
 * scripts/nexus-uat-core-preflight.mjs
 * LOCAL UAT HARNESS v1 — Core Preflight Engine
 *
 * Runs all mandatory checks before UAT start.
 * Reuses project patterns from nexus-test-db-safety.mjs and nexus-preflight.ts.
 * Does NOT duplicate bootstrap or migration logic.
 */

import net from 'node:net';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';

const UAT_PORT = 3000;
/** Intentionally invalid — provokes 400 (origin allowed) or 403 (referrer blocked). */
const FIREBASE_PROBE_EMAIL = 'nexus-uat-origin-probe@invalid.test';
const FIREBASE_PROBE_PASS  = 'probe-unused-nexus-uat-harness';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run core + module preflight checks.
 *
 * @param {object} ctx
 * @param {string}          ctx.worktreePath
 * @param {string}          ctx.branch
 * @param {string}          ctx.head
 * @param {string[]}        ctx.dirtyLines      - output of git status --short, split by line
 * @param {Record<string,string>} ctx.env       - merged env (.env + .env.test.local)
 * @param {object|null}     ctx.moduleConfig    - from nexus-uat-modules.mjs or null
 * @param {string|null}     ctx.expectedBranch
 * @param {string|null}     ctx.expectedHead
 * @returns {Promise<{pass:boolean, checks:object[], failureCodes:string[]}>}
 */
export async function runCorePreflight(ctx) {
  const { worktreePath, branch, head, dirtyLines, env, moduleConfig, expectedBranch, expectedHead } = ctx;

  const checks       = [];
  const failureCodes = [];

  function add(name, level, detail, code) {
    checks.push({ name, level, detail });
    if (level === 'blocker' && code) failureCodes.push(code);
  }

  // ── 1. Branch identity ─────────────────────────────────────────────────────
  if (!branch) {
    add('git-branch', 'blocker',
      'Detached HEAD or unnamed branch. A named branch is required for Formal Closure UAT.',
      'SOURCE_MISMATCH');
  } else if (expectedBranch && branch !== expectedBranch) {
    add('git-branch', 'blocker',
      `Expected branch '${expectedBranch}' but current branch is '${branch}'.`,
      'SOURCE_MISMATCH');
  } else {
    add('git-branch', 'ok', branch);
  }

  // ── 2. HEAD identity ───────────────────────────────────────────────────────
  if (!head || head === 'unknown') {
    add('git-head', 'blocker', 'HEAD SHA could not be resolved.', 'SOURCE_MISMATCH');
  } else if (expectedHead) {
    // Accept full or short SHA prefix match in either direction
    const normalised = expectedHead.toLowerCase();
    const actual     = head.toLowerCase();
    if (!actual.startsWith(normalised) && !normalised.startsWith(actual)) {
      add('git-head', 'blocker',
        `Expected HEAD '${expectedHead}' but current HEAD is '${head}'.`,
        'SOURCE_MISMATCH');
    } else {
      add('git-head', 'ok', head);
    }
  } else {
    add('git-head', 'ok', head);
  }

  // ── 3. Worktree cleanliness ────────────────────────────────────────────────
  // Block only on tracked modified/deleted/renamed/staged files.
  // Untracked-only files (??  prefix) are allowed in Formal Closure UAT.
  const runtimeDirty = dirtyLines.filter(l => !/^\?\?/.test(l));
  if (runtimeDirty.length > 0) {
    add('git-cleanliness', 'blocker',
      `${runtimeDirty.length} runtime-affecting uncommitted change(s) detected. ` +
      `Commit or stash before Formal Closure UAT:\n    ${runtimeDirty.join('\n    ')}`,
      'EXECUTION_BLOCKED');
  } else if (dirtyLines.length > 0) {
    add('git-cleanliness', 'warning',
      `${dirtyLines.length} untracked file(s) present (not blocking).`);
  } else {
    add('git-cleanliness', 'ok', 'clean');
  }

  // ── 4. Canonical port ownership ────────────────────────────────────────────
  const portOwnership = await checkPortOwnership(UAT_PORT);
  if (portOwnership.status === 'free') {
    add('port-ownership', 'ok', `Port ${UAT_PORT} is free.`);
  } else if (portOwnership.status === 'nexus-uat') {
    add('port-ownership', 'blocker',
      `PORT_CONFLICT: Port ${UAT_PORT} is owned by another Nexus UAT runtime. ` +
      `Stop it first with: npm run nexus:uat:stop (from that worktree).`,
      'PORT_CONFLICT');
  } else {
    add('port-ownership', 'blocker',
      `PORT_CONFLICT_UNKNOWN_OWNER: Port ${UAT_PORT} is occupied by an unknown process. ` +
      `The Harness will not kill it. Free the port before starting UAT.`,
      'PORT_CONFLICT_UNKNOWN_OWNER');
  }

  // ── 5. DATABASE_URL presence and safety ────────────────────────────────────
  const dbUrl = env.DATABASE_URL?.trim();
  let dbUrlSafe = false;

  if (!dbUrl) {
    add('config-database', 'blocker', 'DATABASE_URL is not configured.', 'CONFIGURATION_MISMATCH');
  } else {
    let parsed;
    try { parsed = new URL(dbUrl); } catch (e) {
      add('config-database', 'blocker',
        `DATABASE_URL is malformed: ${e.message}`, 'CONFIGURATION_MISMATCH');
    }
    if (parsed) {
      const host = parsed.hostname;
      const port = parsed.port || '5432';
      const db   = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      const isApprovedTarget =
        (host === '127.0.0.1' || host === 'localhost') && port === '54329';
      if (!isApprovedTarget) {
        add('config-database', 'blocker',
          `DATABASE_URL does not target the approved local test database (127.0.0.1:54329). ` +
          `Got host='${host}' port='${port}'. Refusing to start UAT against non-approved target.`,
          'CONFIGURATION_MISMATCH');
      } else {
        add('config-database', 'ok', `${db}@${host}:${port}`);
        dbUrlSafe = true;
      }
    }
  }

  // ── 6. Database connectivity ───────────────────────────────────────────────
  if (dbUrlSafe) {
    const conn = await checkDatabaseConnectivity(dbUrl);
    if (!conn.ok) {
      add('database-connectivity', 'blocker',
        `Cannot connect to database: ${conn.error}`, 'DEPENDENCY_NOT_READY');
    } else {
      add('database-connectivity', 'ok', `${conn.database} (user=${conn.user})`);
    }
  }

  // ── 7. Auth readiness (Firebase referrer probe) ────────────────────────────
  const fbConfigPath = path.join(worktreePath, 'firebase-applet-config.json');
  if (!existsSync(fbConfigPath)) {
    add('auth-readiness', 'blocker',
      'firebase-applet-config.json not found in worktree root.', 'CONFIGURATION_MISMATCH');
  } else {
    let apiKey, projectId;
    try {
      // createRequire to load JSON from an absolute path in ESM context
      const req  = createRequire(import.meta.url);
      const conf = req(fbConfigPath);
      apiKey     = conf.apiKey;
      projectId  = conf.projectId;
    } catch (e) {
      add('auth-readiness', 'blocker',
        `Failed to parse firebase-applet-config.json: ${e.message}`, 'CONFIGURATION_MISMATCH');
    }

    if (apiKey) {
      const probe = await probeFirebaseAuthOrigin(apiKey, UAT_PORT);
      if (probe.ready) {
        add('auth-readiness', 'ok',
          `Firebase project '${projectId}' — http://localhost:${UAT_PORT}/ is authorised.`);
      } else {
        add('auth-readiness', 'blocker',
          `AUTH_ORIGIN_NOT_READY: Firebase API key refuses requests from http://localhost:${UAT_PORT}/.\n` +
          `    Reason: ${probe.reason}\n` +
          `    ACTION REQUIRED (human): Google Cloud Console → APIs & Services → Credentials\n` +
          `    → Select API key → HTTP referrers → Add: http://localhost:${UAT_PORT}/*`,
          'AUTH_ORIGIN_NOT_READY');
      }
    }
  }

  // ── 8. Module-specific: required env vars ─────────────────────────────────
  if (moduleConfig?.envRequired?.length > 0) {
    const missingEnv = moduleConfig.envRequired.filter(k => !env[k]);
    if (missingEnv.length > 0) {
      add('module-env', 'blocker',
        `Module '${moduleConfig.name}': missing required env var(s): ${missingEnv.join(', ')}`,
        'CONFIGURATION_MISMATCH');
    } else {
      add('module-env', 'ok',
        `Module '${moduleConfig.name}': all ${moduleConfig.envRequired.length} required env var(s) present.`);
    }
  }

  // ── 9. Module-specific: required DB tables ────────────────────────────────
  if (dbUrlSafe && moduleConfig?.dbTablesRequired?.length > 0) {
    const tableCheck = await checkModuleTables(dbUrl, moduleConfig.dbTablesRequired);
    if (!tableCheck.ok) {
      const detail = tableCheck.error
        ? `DB error: ${tableCheck.error}`
        : `Missing table(s): ${tableCheck.missing.join(', ')}`;
      add('module-db-tables', 'blocker',
        `Module '${moduleConfig.name}': ${detail}`, 'DEPENDENCY_NOT_READY');
    } else {
      add('module-db-tables', 'ok',
        `Module '${moduleConfig.name}': all required table(s) present.`);
    }
  }

  const blockers = checks.filter(c => c.level === 'blocker');
  return { pass: blockers.length === 0, checks, failureCodes };
}

// ─── Port Ownership ───────────────────────────────────────────────────────────

/**
 * @param {number} port
 * @returns {Promise<{status:'free'|'nexus-uat'|'unknown'}>}
 */
async function checkPortOwnership(port) {
  const occupied = await isPortOccupied(port);
  if (!occupied) return { status: 'free' };

  // Try the UAT identity endpoint (only exists when the Harness started the server).
  // 403 = endpoint exists → Nexus UAT runtime.
  try {
    const r1 = await fetch(`http://127.0.0.1:${port}/api/uat-identity`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r1.status === 403) return { status: 'nexus-uat' };
  } catch { /* fall through */ }

  // Fallback: check the homepage for Nexus identity markers.
  // This detects Nexus runtimes that predate the Harness (no /api/uat-identity).
  try {
    const r2 = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(3000),
    });
    const body = await r2.text();
    if (
      body.includes('Nexus Edu') ||
      body.includes('Portal Escolar') ||
      body.includes('nexus-edu')
    ) {
      return { status: 'nexus-uat' };
    }
  } catch { /* fall through */ }

  return { status: 'unknown' };
}

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortOccupied(port) {
  return new Promise(resolve => {
    const conn = net.connect({ port, host: '127.0.0.1' });
    conn.on('connect', () => { conn.destroy(); resolve(true);  });
    conn.on('error',   () =>                  resolve(false) );
    conn.setTimeout(1500, () => { conn.destroy(); resolve(false); });
  });
}

// ─── Firebase Probe ───────────────────────────────────────────────────────────

/**
 * @param {string} apiKey
 * @param {number} port
 * @returns {Promise<{ready:boolean, reason?:string}>}
 */
async function probeFirebaseAuthOrigin(apiKey, port) {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer':      `http://localhost:${port}/`,
          'Origin':       `http://localhost:${port}`,
        },
        body: JSON.stringify({
          email:              FIREBASE_PROBE_EMAIL,
          password:           FIREBASE_PROBE_PASS,
          returnSecureToken:  false,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    // 400 = origin allowed; credentials invalid as intended.
    if (res.status === 400) return { ready: true };
    if (res.status === 403) return { ready: false, reason: 'API_KEY_HTTP_REFERRER_BLOCKED' };
    return { ready: false, reason: `UNEXPECTED_HTTP_${res.status}` };
  } catch (e) {
    return { ready: false, reason: `NETWORK_ERROR: ${e.message}` };
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function checkDatabaseConnectivity(connectionString) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 7000 });
  try {
    await client.connect();
    const r = await client.query('SELECT current_database() AS db, current_user AS usr');
    return { ok: true, database: r.rows[0].db, user: r.rows[0].usr };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkModuleTables(connectionString, tables) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 7000 });
  try {
    await client.connect();
    const r = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
      [tables],
    );
    const found   = new Set(r.rows.map(row => row.table_name));
    const missing = tables.filter(t => !found.has(t));
    return { ok: missing.length === 0, missing };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await client.end().catch(() => {});
  }
}
