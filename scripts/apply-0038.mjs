import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local'), override: true });

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
async function run() {
  const sql = fs.readFileSync('src/db/migrations/0038_documents_storage_content_availability.sql', 'utf8');
  await pool.query(sql);
  console.log('Migration 0038 applied successfully.');
  const check = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'document_storage_references' AND column_name IN ('content_availability', 'last_checked_at', 'unavailable_reason')
  `);
  console.log('Columns added:', check.rows);
  const sample = await pool.query(`SELECT count(*)::text as cnt, content_availability FROM document_storage_references GROUP BY content_availability`);
  console.log('Distribution across 6009 records:', sample.rows);
  await pool.end();
}
run().catch(console.error);
