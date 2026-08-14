import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = new Set(process.argv.slice(2));
const requireDb = args.has('--require-db');
const jsonMode = args.has('--json');

type CheckLevel = 'ok' | 'warning' | 'blocker';
type Check = { name: string; level: CheckLevel; detail: string };

const checks: Check[] = [];
const add = (name: string, level: CheckLevel, detail: string) => checks.push({ name, level, detail });

function git(args: string[], fallback = ''): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return fallback;
  }
}

function safeRead(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function parseActivePriority(projectState: string | null): string | null {
  if (!projectState) return null;
  const match = projectState.match(/^###\s+Priority:\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}

const repoRoot = git(['rev-parse', '--show-toplevel']);
if (!repoRoot) {
  add('repository', 'blocker', 'Current directory is not inside a Git repository.');
  finish();
}

process.chdir(repoRoot);

const branch = git(['branch', '--show-current'], '(detached HEAD)');
const head = git(['rev-parse', '--short=12', 'HEAD'], 'unknown');
const origin = git(['remote', 'get-url', 'origin'], 'origin not configured');
const status = git(['status', '--short']);
const dirtyLines = status ? status.split(/\r?\n/).filter(Boolean) : [];

add('repository', 'ok', `${repoRoot}`);
add('git-head', 'ok', `${branch} @ ${head}`);
add('git-origin', origin === 'origin not configured' ? 'warning' : 'ok', origin);
add(
  'working-tree',
  dirtyLines.length ? 'warning' : 'ok',
  dirtyLines.length ? `${dirtyLines.length} modified/untracked path(s); preserve unrelated work.` : 'clean',
);

const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
if (upstream) {
  const divergence = git(['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
  const [aheadRaw, behindRaw] = divergence.split(/\s+/);
  const ahead = Number(aheadRaw || 0);
  const behind = Number(behindRaw || 0);
  add('upstream', behind > 0 ? 'warning' : 'ok', `${upstream}; ahead=${ahead}; behind=${behind}`);
} else {
  add('upstream', 'warning', 'No upstream configured for current branch.');
}

const requiredDocs = [
  'AGENTS.md',
  'docs/operations/PROJECT_STATE.md',
  'docs/operations/ENGINEERING_PLAYBOOK.md',
  'docs/operations/AGENT_TRAINING_AUTOMATION.md',
];
for (const relative of requiredDocs) {
  add(`doc:${relative}`, existsSync(path.join(repoRoot, relative)) ? 'ok' : 'blocker', existsSync(path.join(repoRoot, relative)) ? 'present' : 'missing');
}

const projectState = safeRead(path.join(repoRoot, 'docs/operations/PROJECT_STATE.md'));
const activePriority = parseActivePriority(projectState);
add('active-priority', activePriority ? 'ok' : 'warning', activePriority || 'No explicit active priority found in PROJECT_STATE.md.');

const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = safeRead(packageJsonPath);
if (!packageJson) {
  add('package.json', 'blocker', 'package.json is missing or unreadable.');
} else {
  try {
    const parsed = JSON.parse(packageJson) as { scripts?: Record<string, string> };
    const scripts = parsed.scripts || {};
    const expectedScripts = ['dev', 'lint', 'build', 'test:migrations:isolated'];
    for (const script of expectedScripts) {
      add(`npm:${script}`, scripts[script] ? 'ok' : 'warning', scripts[script] ? scripts[script] : 'script not defined');
    }
  } catch (error) {
    add('package.json', 'blocker', `Invalid JSON: ${(error as Error).message}`);
  }
}

const migrationsDir = path.join(repoRoot, 'src/db/migrations');
if (!existsSync(migrationsDir)) {
  add('migrations', 'blocker', 'src/db/migrations does not exist.');
} else {
  const migrations = readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  if (!migrations.length) {
    add('migrations', 'blocker', 'No ordered SQL migrations found.');
  } else {
    const ordinals = migrations.map((name) => Number(name.slice(0, 4)));
    const gaps: string[] = [];
    for (let i = 1; i < ordinals.length; i += 1) {
      if (ordinals[i] !== ordinals[i - 1] + 1) gaps.push(`${ordinals[i - 1]}->${ordinals[i]}`);
    }
    add('migrations', gaps.length ? 'warning' : 'ok', `${migrations.length} migration(s); latest=${migrations.at(-1)}${gaps.length ? `; gaps=${gaps.join(',')}` : ''}`);
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  add('database', requireDb ? 'blocker' : 'warning', requireDb ? 'DATABASE_URL is required for this preflight.' : 'DATABASE_URL not configured; DB checks skipped.');
  finish();
}

await checkDatabase(databaseUrl!);
finish();

async function checkDatabase(connectionString: string) {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');

    const identity = await client.query<{ database_name: string; schema_name: string }>(
      'SELECT current_database() AS database_name, current_schema() AS schema_name',
    );
    const databaseName = identity.rows[0]?.database_name || 'unknown';
    const schemaName = identity.rows[0]?.schema_name || 'unknown';
    add('database-connection', 'ok', `${databaseName}; schema=${schemaName}`);

    const requirements: Array<[string, string]> = [
      ['people', 'id'],
      ['people', 'birth_date'],
      ['people', 'phone'],
      ['student_profiles', 'person_id'],
      ['student_profiles', 'institution_id'],
      ['student_profiles', 'student_number'],
      ['student_profiles', 'legacy_student_id'],
      ['enrollment_applications', 'id'],
      ['enrollment_applications', 'institution_id'],
      ['enrollment_applications', 'student_person_id'],
      ['enrollment_applications', 'offer_id'],
      ['enrollment_applications', 'academic_year_id'],
      ['enrollment_applications', 'document_policy_id'],
    ];

    const schemaResult = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])
          AND column_name = ANY($2::text[])`,
      [
        Array.from(new Set(requirements.map(([table]) => table))),
        Array.from(new Set(requirements.map(([, column]) => column))),
      ],
    );
    const available = new Set(schemaResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = requirements.map(([table, column]) => `${table}.${column}`).filter((key) => !available.has(key));
    add(
      'database-schema-critical',
      missing.length ? 'blocker' : 'ok',
      missing.length ? `Missing: ${missing.join(', ')}` : `${requirements.length} critical enrollment schema requirements present.`,
    );

    await client.query('ROLLBACK');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    add('database-connection', 'blocker', (error as Error).message);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function finish(): never {
  const blockers = checks.filter((check) => check.level === 'blocker');
  const warnings = checks.filter((check) => check.level === 'warning');

  if (jsonMode) {
    console.log(JSON.stringify({
      ready: blockers.length === 0,
      requireDb,
      checks,
      summary: { blockers: blockers.length, warnings: warnings.length, total: checks.length },
    }, null, 2));
  } else {
    console.log('\nNEXUS PREFLIGHT');
    console.log('==============');
    for (const check of checks) {
      const marker = check.level === 'ok' ? '[OK]' : check.level === 'warning' ? '[WARN]' : '[BLOCK]';
      console.log(`${marker} ${check.name}: ${check.detail}`);
    }
    console.log('--------------');
    console.log(`Result: ${blockers.length ? 'BLOCKED' : 'READY'} | blockers=${blockers.length} warnings=${warnings.length}`);
    if (blockers.length) console.log('Do not start production changes until blockers are resolved.');
  }

  process.exit(blockers.length ? 1 : 0);
}
