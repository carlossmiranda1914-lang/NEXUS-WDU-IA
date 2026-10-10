import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function main() {
  const res = await pool.query(
    `SELECT v.id, v.created_at, s.declared_filename, sr.storage_bucket, sr.storage_key
     FROM public.document_versions v
     JOIN public.document_upload_sessions s ON s.completed_version_id = v.id
     JOIN public.document_storage_references sr ON sr.version_id = v.id`
  );

  const baseDir = path.resolve(process.cwd(), '.uat-storage');
  console.log('Inspecting physical presence in baseDir:', baseDir);

  for (const row of res.rows) {
    const sanitizedBucket = row.storage_bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedKey = row.storage_key.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(baseDir, sanitizedBucket, sanitizedKey);
    const exists = fs.existsSync(filePath);
    let size = 0;
    if (exists) {
      size = fs.statSync(filePath).size;
    }
    console.log({
      filename: row.declared_filename,
      key: row.storage_key,
      diskPath: filePath,
      existsOnDisk: exists,
      byteSizeOnDisk: size,
    });
  }

  // Also check direct benchmark inserts
  const benchSample = await pool.query(
    `SELECT v.id, sr.storage_bucket, sr.storage_key
     FROM public.document_versions v
     LEFT JOIN public.document_storage_references sr ON sr.version_id = v.id
     WHERE NOT EXISTS (SELECT 1 FROM public.document_upload_sessions s WHERE s.completed_version_id = v.id)
     LIMIT 5`
  );
  console.log('\nChecking benchmark sample existence on disk:');
  for (const row of benchSample.rows) {
    const sanitizedBucket = row.storage_bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedKey = row.storage_key.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(baseDir, sanitizedBucket, sanitizedKey);
    console.log({
      key: row.storage_key,
      existsOnDisk: fs.existsSync(filePath),
    });
  }

  await pool.end();
}

main().catch(console.error);


