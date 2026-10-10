import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local'), override: true });

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function run() {
  const baseDir = path.resolve(process.cwd(), '.uat-storage');
  const res = await pool.query(`
    SELECT sr.storage_bucket, sr.storage_key, v.id as version_id,
           CASE WHEN s.completed_version_id IS NOT NULL THEN 'normal_upload' ELSE 'direct_benchmark' END as provenance_type
    FROM public.document_storage_references sr
    JOIN public.document_versions v ON v.id = sr.version_id
    LEFT JOIN public.document_upload_sessions s ON s.completed_version_id = v.id
  `);

  let stats = {
    total: res.rows.length,
    normal_upload: { total: 0, exists: 0, missing: 0, totalBytes: 0 },
    direct_benchmark: { total: 0, exists: 0, missing: 0, totalBytes: 0 },
  };

  for (const r of res.rows) {
    const pType = r.provenance_type;
    stats[pType].total++;
    const sb = r.storage_bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sk = r.storage_key.replace(/[^a-zA-Z0-9._-]/g, '_');
    const p = path.join(baseDir, sb, sk);
    if (fs.existsSync(p)) {
      stats[pType].exists++;
      stats[pType].totalBytes += fs.statSync(p).size;
    } else {
      stats[pType].missing++;
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  await pool.end();
}

run().catch(console.error);
