import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function main() {
  const versionsCount = await pool.query('SELECT count(*) FROM public.document_versions');
  const sessCount = await pool.query('SELECT count(*) FROM public.document_upload_sessions');
  const provCount = await pool.query('SELECT count(*) FROM public.document_provenance');
  const storageCount = await pool.query('SELECT count(*) FROM public.document_storage_references');

  console.log('Total document_versions in public:', versionsCount.rows[0].count);
  console.log('Total upload_sessions in public:', sessCount.rows[0].count);
  console.log('Total provenance records in public:', provCount.rows[0].count);
  console.log('Total storage_references in public:', storageCount.rows[0].count);

  // Sample versions without upload sessions (direct SQL inserts from synthetic benchmark)
  const directInserts = await pool.query(
    `SELECT count(*) FROM public.document_versions v
     WHERE NOT EXISTS (
       SELECT 1 FROM public.document_upload_sessions s WHERE s.completed_version_id = v.id
     )`
  );
  console.log('Direct SQL / synthetic benchmark inserts (no upload session):', directInserts.rows[0].count);

  // Sample versions WITH upload session
  const withSession = await pool.query(
    `SELECT count(*) FROM public.document_versions v
     WHERE EXISTS (
       SELECT 1 FROM public.document_upload_sessions s WHERE s.completed_version_id = v.id
     )`
  );
  console.log('Normal uploads (with upload session):', withSession.rows[0].count);

  const sampleDirect = await pool.query(
    `SELECT v.id, v.version_number, v.mime_type, v.byte_size, v.sha256_hash, v.created_at, sr.storage_provider, sr.storage_bucket, sr.storage_key
     FROM public.document_versions v
     LEFT JOIN public.document_storage_references sr ON sr.version_id = v.id
     WHERE NOT EXISTS (SELECT 1 FROM public.document_upload_sessions s WHERE s.completed_version_id = v.id)
     LIMIT 5`
  );
  console.log('Sample direct insert records:', sampleDirect.rows);

  const sampleNormal = await pool.query(
    `SELECT v.id, v.version_number, v.mime_type, v.byte_size, v.sha256_hash, v.created_at, s.declared_filename, sr.storage_provider, sr.storage_bucket, sr.storage_key
     FROM public.document_versions v
     JOIN public.document_upload_sessions s ON s.completed_version_id = v.id
     LEFT JOIN public.document_storage_references sr ON sr.version_id = v.id
     LIMIT 5`
  );
  console.log('Sample normal uploads:', sampleNormal.rows);

  await pool.end();
}

main().catch(console.error);
