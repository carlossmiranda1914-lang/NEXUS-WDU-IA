import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('[S01B] DATABASE_URL/TEST_DATABASE_URL is not configured.');

function inspectCharacters(value: string) {
  return Array.from(value).map((character, index) => ({
    index,
    character,
    codePoint: `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
  })).filter(({ character }) => !/[A-Za-z0-9 À-ÿ._-]/.test(character));
}

const client = new Client({ connectionString });
await client.connect();
try {
  const result = await client.query<{ id: string; name: string; slug: string; status: string }>(
    `SELECT id, name, slug, status
       FROM institutions
      ORDER BY name ASC`,
  );

  console.log(`[S01B] Institutions inspected: ${result.rows.length}.`);
  for (const row of result.rows) {
    console.log(`[S01B] Institution ${row.slug}: name=${JSON.stringify(row.name)} status=${row.status}`);
    const unusual = inspectCharacters(row.name);
    if (unusual.length) console.table(unusual);
  }

  const anomalies = result.rows.filter((row) => /\?|�|ambiente\s+de\s+desenvolvimento/i.test(row.name));
  if (anomalies.length === 0) {
    console.log('[S01B] PASS: no stored institution name matches the known visual anomaly. If the browser still renders an unexpected glyph, the source is outside institutions.name.');
  } else {
    console.log('[S01B] REVIEW REQUIRED: anomalous institution names found. No data was changed.');
    console.table(anomalies.map(({ id, name, slug, status }) => ({ id, name, slug, status })));
    process.exitCode = 2;
  }
} finally {
  await client.end();
}
