import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_academic_migration_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const setup = new pg.Pool({ connectionString });

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect();
  try {
    for (const file of (await readdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))).filter((value) => /^\d{4}_.+\.sql$/.test(value)).sort()) {
      await client.query(`SET search_path TO "${schema}"; ${await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations', file), 'utf8')}`);
    }
    for (const table of ['academic_programs', 'academic_levels', 'academic_classes', 'academic_subjects', 'academic_subject_offerings', 'teacher_assignments', 'student_academic_placements', 'academic_events']) {
      const found = await client.query('SELECT to_regclass($1) AS relation', [table]);
      assert.ok(found.rows[0].relation, `${table} must be migration-owned`);
    }
    const versions = await client.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('academic_programs','academic_levels','academic_classes','academic_subjects','teacher_assignments','student_academic_placements') AND column_name='version'");
    assert.equal(versions.rows[0].count, 6);
    console.log('[ACADEMIC-01-MIGRATION] PASS temporal authority schema.');
  } finally { client.release(); }
} finally { await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined); await setup.end(); }
