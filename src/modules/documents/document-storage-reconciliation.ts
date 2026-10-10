import type { Pool } from 'pg';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import type { StorageContentAvailability } from './document-model.ts';

export interface ReconcileStorageBatchOptions {
  pool: Pool;
  storageProvider: ObjectStorageProvider;
  institutionId?: string;
  batchSize?: number;
  startCursor?: string;
  checkBytesIntegrity?: boolean;
}

export interface ReconcileStorageBatchResult {
  processedCount: number;
  availableCount: number;
  unavailableCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Reconciles pre-existing or unknown storage object references in bounded batches
 * using a resumable cursor, without per-row headObject queries during document listings.
 * Enforces byte size / hash integrity verification where requested.
 */
export async function reconcileStorageBatch(
  options: ReconcileStorageBatchOptions,
): Promise<ReconcileStorageBatchResult> {
  const {
    pool,
    storageProvider,
    institutionId,
    batchSize = 100,
    startCursor,
    checkBytesIntegrity = true,
  } = options;

  const client = await pool.connect();
  try {
    const query = `
      SELECT sr.id, sr.institution_id, sr.version_id, sr.storage_provider, sr.storage_bucket, sr.storage_key,
             sr.content_availability, v.byte_size, v.sha256_hash, v.document_id
      FROM document_storage_references sr
      JOIN document_versions v ON v.institution_id = sr.institution_id AND v.id = sr.version_id
      WHERE ($1::uuid IS NULL OR sr.institution_id = $1)
        AND ($2::uuid IS NULL OR sr.id > $2)
        AND sr.content_availability = 'unknown'
      ORDER BY sr.id ASC
      LIMIT $3
    `;

    const res = await client.query<{
      id: string;
      institution_id: string;
      version_id: string;
      storage_provider: string;
      storage_bucket: string;
      storage_key: string;
      content_availability: StorageContentAvailability;
      byte_size: string | number;
      sha256_hash: string;
      document_id: string;
    }>(query, [institutionId || null, startCursor || null, batchSize]);

    if (res.rows.length === 0) {
      return {
        processedCount: 0,
        availableCount: 0,
        unavailableCount: 0,
        nextCursor: null,
        hasMore: false,
      };
    }

    let availableCount = 0;
    let unavailableCount = 0;

    await client.query('BEGIN');

    for (const row of res.rows) {
      let availability: StorageContentAvailability = 'unavailable';
      let reason: string | null = null;

      try {
        const head = await storageProvider.headObject({
          storageBucket: row.storage_bucket,
          storageKey: row.storage_key,
        });

        if (!head.exists) {
          availability = 'unavailable';
          reason = 'Physical storage object missing';
        } else if (checkBytesIntegrity) {
          const expectedSize = Number(row.byte_size);
          const sizeMatches = head.byteSize === expectedSize;
          const hashMatches =
            !head.sha256Hash || !row.sha256_hash ||
            head.sha256Hash.toLowerCase() === row.sha256_hash.toLowerCase();

          if (!sizeMatches || !hashMatches) {
            availability = 'unavailable';
            reason = `Integrity check failed: sizeMatches=${sizeMatches}, hashMatches=${hashMatches}`;
          } else {
            availability = 'available';
          }
        } else {
          availability = 'available';
        }
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errCode = err?.code || '';
        const isMissing =
          errCode === 'ENOENT' ||
          errCode === 404 ||
          errMsg.includes('OBJECT_NOT_FOUND') ||
          errMsg.includes('not found') ||
          errMsg.includes('ENOENT') ||
          errMsg.includes('No such object');

        if (isMissing) {
          availability = 'unavailable';
          reason = `Storage head check confirmed missing: ${errMsg}`;
        } else {
          // Transient failure (e.g., network timeout, EBUSY, connection reset).
          // Do NOT mark as permanently unavailable! Preserve current availability state.
          availability = row.content_availability;
          reason = `Transient check failure (preserved state: ${availability}): ${errMsg}`;
        }
      }

      if (availability === 'available') {
        availableCount++;
      } else if (availability === 'unavailable') {
        unavailableCount++;
      }

      await client.query(
        `UPDATE document_storage_references
            SET content_availability = $1,
                last_checked_at = now(),
                unavailable_reason = $2
          WHERE id = $3`,
        [availability, reason, row.id],
      );
    }

    await client.query('COMMIT');

    const lastRow = res.rows[res.rows.length - 1];
    const hasMore = res.rows.length === batchSize;

    return {
      processedCount: res.rows.length,
      availableCount,
      unavailableCount,
      nextCursor: lastRow.id,
      hasMore,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
