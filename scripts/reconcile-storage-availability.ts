import pg from 'pg';
import path from 'node:path';
import dotenv from 'dotenv';
import { LocalUatObjectStorageProvider } from '../src/modules/documents/local-uat-storage-provider.ts';
import { reconcileStorageBatch } from '../src/modules/documents/document-storage-reconciliation.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test.local'), override: true });

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function main() {
  const baseDir = process.env.DOCUMENTS_LOCAL_UAT_STORAGE_DIR || path.resolve(process.cwd(), '.uat-storage');
  const storageProvider = new LocalUatObjectStorageProvider(baseDir);

  console.log(`Starting storage content availability reconciliation...`);
  console.log(`Storage base directory: ${storageProvider.getEffectiveBaseDir()}`);

  let totalProcessed = 0;
  let totalAvailable = 0;
  let totalUnavailable = 0;
  let cursor: string | undefined = undefined;
  let batchNum = 1;

  while (true) {
    const result = await reconcileStorageBatch({
      pool,
      storageProvider,
      batchSize: 500,
      startCursor: cursor,
      checkBytesIntegrity: true,
    });

    if (result.processedCount === 0) break;

    totalProcessed += result.processedCount;
    totalAvailable += result.availableCount;
    totalUnavailable += result.unavailableCount;
    cursor = result.nextCursor ?? undefined;

    console.log(
      `Batch ${batchNum++}: processed=${result.processedCount}, available=${result.availableCount}, unavailable=${result.unavailableCount}, cursor=${cursor}`,
    );

    if (!result.hasMore) break;
  }

  console.log('\n=== RECONCILIATION SUMMARY ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total available: ${totalAvailable}`);
  console.log(`Total unavailable: ${totalUnavailable}`);

  const check = await pool.query(
    `SELECT content_availability, count(*)::text as cnt FROM document_storage_references GROUP BY content_availability`,
  );
  console.log('\nFinal DB distribution:', check.rows);

  await pool.end();
}

main().catch((err) => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
