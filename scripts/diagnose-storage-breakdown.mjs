import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54329/nexus_fnd01_test',
});

async function main() {
  const schemas = await pool.query(
    `SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema') ORDER BY nspname`
  );
  console.log('SCHEMAS:', schemas.rows.map(r => r.nspname));

  for (const s of schemas.rows) {
    const tableCheck = await pool.query(
      `SELECT count(*)::text AS cnt FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'documents'`,
      [s.nspname]
    );
    if (Number(tableCheck.rows[0].cnt) > 0) {
      const docs = await pool.query(`SELECT count(*)::text AS cnt FROM "${s.nspname}".documents`);
      const vers = await pool.query(`SELECT count(*)::text AS cnt FROM "${s.nspname}".document_versions`);
      const sess = await pool.query(`SELECT count(*)::text AS cnt FROM "${s.nspname}".document_upload_sessions`);
      const stor = await pool.query(`SELECT count(*)::text AS cnt FROM "${s.nspname}".document_storage_references`);
      console.log(`Schema "${s.nspname}": documents=${docs.rows[0].cnt}, versions=${vers.rows[0].cnt}, upload_sessions=${sess.rows[0].cnt}, storage_refs=${stor.rows[0].cnt}`);

      const prov = await pool.query(
        `SELECT origin_type, source_domain, method, count(*)::int AS cnt FROM "${s.nspname}".document_provenance GROUP BY origin_type, source_domain, method`
      );
      console.log(`Provenance for "${s.nspname}":`, prov.rows);
    }
  }

  await pool.end();
}

main().catch(console.error);
