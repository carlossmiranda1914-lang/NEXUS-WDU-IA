/**
 * scripts/nexus-uat-stop.mjs
 * LOCAL UAT HARNESS v1 — Official UAT Stop
 *
 * Official command:
 *   npm run nexus:uat:stop
 *
 * Terminates only the runtime whose ownership matches the Harness ephemeral state
 * (.nexus-uat.pid) in the current worktree directory.
 *
 * INVARIANTS (contract §5):
 *   - Will NOT kill all Node processes.
 *   - Will NOT kill by generic process name.
 *   - Will NOT kill another worktree's runtime automatically.
 *   - Will NOT kill an unknown process.
 *   - If ownership cannot be proven → FAIL CLOSED.
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync }                          from 'node:child_process';
import { fileURLToPath }                         from 'node:url';
import path, { resolve }                         from 'node:path';
import net                                       from 'node:net';

const PID_FILE      = '.nexus-uat.pid';
const DRAIN_TIMEOUT = 10_000;  // ms to wait for port to free after SIGTERM

await main().catch(err => {
  console.error('[NEXUS UAT STOP] Unexpected error:', err?.message ?? err);
  process.exit(1);
});

async function main() {
  const worktreePath = process.cwd();
  const pidFilePath  = resolve(worktreePath, PID_FILE);

  if (!existsSync(pidFilePath)) {
    console.log(
      '[NEXUS UAT STOP] No .nexus-uat.pid found in this worktree. ' +
      'No harness-managed runtime to stop.',
    );
    process.exit(0);
  }

  // ── Read harness state ────────────────────────────────────────────────────
  let state;
  try {
    state = JSON.parse(readFileSync(pidFilePath, 'utf8'));
  } catch (e) {
    console.error(`[NEXUS UAT STOP] Cannot parse .nexus-uat.pid: ${e.message}`);
    process.exit(1);
  }

  const { pid, port, worktree, branch, head } = state;

  // ── Verify PID file belongs to this worktree ──────────────────────────────
  if (worktree !== worktreePath) {
    console.error(
      `[NEXUS UAT STOP] FAIL CLOSED: .nexus-uat.pid records worktree\n` +
      `  recorded: ${worktree}\n  current:  ${worktreePath}\n` +
      `These do not match. Not killing.`,
    );
    process.exit(1);
  }

  // ── Verify process is alive ───────────────────────────────────────────────
  if (!isProcessAlive(pid)) {
    console.log(
      `[NEXUS UAT STOP] PID ${pid} is no longer running. Cleaning up stale harness state.`,
    );
    safeUnlink(pidFilePath);
    process.exit(0);
  }

  // ── Verify it is a Node.js process (best-effort, platform-specific) ───────
  if (!isNodeProcess(pid)) {
    console.error(
      `[NEXUS UAT STOP] FAIL CLOSED: PID ${pid} is alive but does not appear to be ` +
      `a Node.js process. Not killing.`,
    );
    process.exit(1);
  }

  // ── Terminate ─────────────────────────────────────────────────────────────
  console.log(
    `[NEXUS UAT STOP] Stopping Nexus UAT runtime:\n` +
    `  WORKTREE=${worktree}\n  BRANCH=${branch}\n  HEAD=${head}\n  PID=${pid}`,
  );

  try {
    process.kill(pid, 'SIGTERM');
  } catch (e) {
    if (e.code === 'ESRCH') {
      // Process just died between the alive check and the kill — that is fine.
      console.log(`[NEXUS UAT STOP] PID ${pid} exited before SIGTERM could be sent.`);
    } else {
      console.error(`[NEXUS UAT STOP] Failed to send SIGTERM to PID ${pid}: ${e.message}`);
      safeUnlink(pidFilePath);
      process.exit(1);
    }
  }

  // ── Wait for port to free ─────────────────────────────────────────────────
  const freed = await waitForPortFree(port, DRAIN_TIMEOUT);
  safeUnlink(pidFilePath);

  if (freed) {
    console.log(`[NEXUS UAT STOP] Runtime stopped. Port ${port} is free.`);
    process.exit(0);
  } else {
    console.warn(
      `[NEXUS UAT STOP] SIGTERM sent to PID ${pid} but port ${port} is still ` +
      `occupied after ${DRAIN_TIMEOUT / 1000}s. The process may still be shutting down.`,
    );
    process.exit(0);  // Not an error — SIGTERM accepted; drain may continue.
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);  // Signal 0 checks existence without killing.
    return true;
  } catch (e) {
    return e.code !== 'ESRCH';  // ESRCH = no such process.
  }
}

/**
 * Best-effort check that pid is a Node.js process.
 * Prevents accidentally killing a recycled PID.
 * Returns true when we cannot determine (fail-open is acceptable here because
 * the worktree + PID match is already strong identity evidence).
 */
function isNodeProcess(pid) {
  try {
    if (process.platform === 'win32') {
      // tasklist /FI "PID eq N" /FO CSV /NH — check for node.exe
      const out = execFileSync(
        'tasklist',
        ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      return out.toLowerCase().includes('node');
    } else {
      // POSIX: ps -p PID -o comm=
      const out = execFileSync(
        'ps', ['-p', String(pid), '-o', 'comm='],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim();
      return out.toLowerCase().includes('node');
    }
  } catch {
    // If process-inspection fails for any reason, trust the PID-file identity.
    return true;
  }
}

function waitForPortFree(port, timeoutMs) {
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const conn = net.connect({ port, host: '127.0.0.1' });
      conn.on('connect', () => {
        conn.destroy();
        if (Date.now() < deadline) setTimeout(poll, 500);
        else resolve(false);
      });
      conn.on('error', () => resolve(true));  // connection refused = port free
      conn.setTimeout(1000, () => { conn.destroy(); resolve(false); });
    };
    poll();
  });
}

function safeUnlink(filePath) {
  try { unlinkSync(filePath); } catch { /* best-effort */ }
}
