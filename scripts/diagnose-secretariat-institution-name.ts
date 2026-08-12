import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('[S01B] DATABASE_URL/TEST_DATABASE_URL is not configured.');

const client = new Client({ connectionString });
await client.connect();
try {
  const result = await client.query<{ id: string; name: string; slug: string; status: string }>(
    `SELECT id, name, slug, status
       FROM institutions
      ORDER BY name ASC`,
  );
  const anomalies = result.rows.filter((row) => /\?|ambiente\s+de\s+desenvolvimento/i.test(row.name));
  console.log(`[S01B] Institutions inspected: ${result.rows.length}.`);
  if (anomalies.length === 0) {
    console.log('[S01B] PASS: no institution display-name anomaly matched the known visual symptom.');
  } else {
    console.log('[S01B] REVIEW REQUIRED: anomalous institution names found. No data was changed.');
    console.table(anomalies.map(({ id, name, slug, status }) => ({ id, name, slug, status })));
    process.exitCode = 2;
  }
} finally {
  await client.end();
}
