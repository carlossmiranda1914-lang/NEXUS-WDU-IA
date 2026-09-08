import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentAssociationRepository } from '../src/modules/documents/document-association-repository.ts';
import {
  createDocumentAssociationCommand,
  pinAssociationToVersionCommand,
} from '../src/modules/documents/document-association-command.ts';

await verifyApprovedTestConnection();

const schema = `doc_assoc_neg_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-00000000000a';
const institutionB = '00000000-0000-0000-0000-00000000000b';
const actorA = '00000000-0000-0000-0000-00000000001a';
const actorB = '00000000-0000-0000-0000-00000000001b';

const contextA: InstitutionalContext = {
  institutionId: institutionA,
  institutionName: 'Institution Alpha',
  institutionSlug: 'inst-alpha',
  personId: actorA,
  personName: 'Actor Alpha',
  identityEmail: 'alpha@nexus.edu',
  membershipId: '00000000-0000-0000-0000-00000000002a',
  role: 'institution_admin',
};

const contextB: InstitutionalContext = {
  institutionId: institutionB,
  institutionName: 'Institution Beta',
  institutionSlug: 'inst-beta',
  personId: actorB,
  personName: 'Actor Beta',
  identityEmail: 'beta@nexus.edu',
  membershipId: '00000000-0000-0000-0000-00000000002b',
  role: 'institution_admin',
};

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);

  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(client, migrations);

  // Seed fixture institutions and actors
  await client.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Institution Alpha', 'inst-alpha', 'active')`, [institutionA]);
  await client.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'Institution Beta', 'inst-beta', 'active')`, [institutionB]);
  await client.query(`INSERT INTO people (id, name) VALUES ($1, 'Actor Alpha')`, [actorA]);
  await client.query(`INSERT INTO people (id, name) VALUES ($1, 'Actor Beta')`, [actorB]);

  const docRepo = new PostgresDocumentRepository();
  const assocRepo = new PostgresDocumentAssociationRepository();

  // Institution A: Document D_A1 and Version V_A1
  const docA1 = await docRepo.createDocument(client, { institutionId: institutionA, category: 'identity_proof', createdByPersonId: actorA });
  const { version: verA1 } = await docRepo.createNextVersion(client, {
    institutionId: institutionA,
    documentId: docA1.id,
    mimeType: 'application/pdf',
    byteSize: 1024,
    sha256Hash: 'a'.repeat(64),
    createdByPersonId: actorA,
    provenance: { originType: 'user_upload', sourceDomain: 'portal', method: 'upload' },
  });

  // Institution A: Document D_A2 and Version V_A2
  const docA2 = await docRepo.createDocument(client, { institutionId: institutionA, category: 'academic_record', createdByPersonId: actorA });
  const { version: verA2 } = await docRepo.createNextVersion(client, {
    institutionId: institutionA,
    documentId: docA2.id,
    mimeType: 'application/pdf',
    byteSize: 2048,
    sha256Hash: '2'.repeat(64),
    createdByPersonId: actorA,
    provenance: { originType: 'user_upload', sourceDomain: 'portal', method: 'upload' },
  });

  // Institution B: Document D_B1 and Version V_B1
  const docB1 = await docRepo.createDocument(client, { institutionId: institutionB, category: 'identity_proof', createdByPersonId: actorB });
  const { version: verB1 } = await docRepo.createNextVersion(client, {
    institutionId: institutionB,
    documentId: docB1.id,
    mimeType: 'application/pdf',
    byteSize: 3072,
    sha256Hash: 'b'.repeat(64),
    createdByPersonId: actorB,
    provenance: { originType: 'user_upload', sourceDomain: 'portal', method: 'upload' },
  });

  // Create valid Association in Inst A
  const assocA1 = await assocRepo.createAssociation(client, {
    institutionId: institutionA,
    documentId: docA1.id,
    targetDomain: 'enrollment',
    targetResourceType: 'application',
    targetResourceId: 'app-alpha-1',
    purpose: 'identity_verification',
    createdByPersonId: actorA,
  });

  // 1. NEGATIVE TEST: Inst B attempts to associate Inst A Document D_A1 -> REJECTED
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_associations (
          institution_id, document_id, target_domain, target_resource_type, target_resource_id, purpose, created_by_person_id
        ) VALUES ($1, $2, 'enrollment', 'application', 'app-beta-1', 'hack', $3)`,
        [institutionB, docA1.id, actorB],
      );
    },
    /violates foreign key constraint "document_associations_document_tenant_fk"/,
    'PostgreSQL FK must reject association in Institution B pointing to Document in Institution A',
  );

  // 2. NEGATIVE TEST: Inst A Association attempts to pin Inst B Version V_B1 -> REJECTED
  await assert.rejects(
    async () => {
      await client.query(
        `UPDATE document_associations
            SET pinned_version_id = $1
          WHERE institution_id = $2 AND id = $3`,
        [verB1.id, institutionA, assocA1.id],
      );
    },
    /violates foreign key constraint "document_associations_version_doc_tenant_fk"/,
    'PostgreSQL composite FK must reject pinning a cross-tenant version to an association',
  );

  // 3. NEGATIVE TEST: Association pointing to Document D_A1 attempts to pin Version V_A2 (belonging to Document D_A2) -> REJECTED
  await assert.rejects(
    async () => {
      await client.query(
        `UPDATE document_associations
            SET pinned_version_id = $1
          WHERE institution_id = $2 AND id = $3`,
        [verA2.id, institutionA, assocA1.id],
      );
    },
    /violates foreign key constraint "document_associations_version_doc_tenant_fk"/,
    'PostgreSQL composite FK must reject pinning a version from a different document in the same institution',
  );

  // 4. NEGATIVE TEST: DecisionReference in Inst A referencing Inst B Association -> REJECTED
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_business_decision_references (
          institution_id, association_id, document_id, version_id, authority_domain, decision_type, decision_outcome, external_reference
        ) VALUES ($1, $2, $3, $4, 'enrollment', 'intake', 'accepted', 'ref-01')`,
        [institutionB, assocA1.id, docB1.id, verB1.id],
      );
    },
    /violates foreign key constraint "document_business_decision_references_association_tenant_fk"/,
    'PostgreSQL composite FK must reject decision reference in Institution B targeting Institution A association',
  );

  // 5. NEGATIVE TEST: DecisionReference for Association D_A1 attempts to reference Version V_A2 (belonging to D_A2) -> REJECTED
  await assert.rejects(
    async () => {
      await client.query(
        `INSERT INTO document_business_decision_references (
          institution_id, association_id, document_id, version_id, authority_domain, decision_type, decision_outcome, external_reference
        ) VALUES ($1, $2, $3, $4, 'enrollment', 'intake', 'accepted', 'ref-01')`,
        [institutionA, assocA1.id, docA1.id, verA2.id],
      );
    },
    /violates foreign key constraint "document_business_decision_references_version_doc_tenant_fk"/,
    'PostgreSQL composite FK must reject decision reference specifying a version that does not belong to the document',
  );

  // 6. NEGATIVE TEST: Inst B cannot read Inst A associations via repository
  const docAssocsFromB = await assocRepo.listAssociationsForDocument(client, institutionB, docA1.id);
  assert.strictEqual(docAssocsFromB.length, 0);

  const targetAssocsFromB = await assocRepo.listAssociationsForTarget(client, institutionB, 'enrollment', 'application', 'app-alpha-1');
  assert.strictEqual(targetAssocsFromB.length, 0);

  // 7. NEGATIVE TEST: Command context spoofing rejected
  await assert.rejects(
    async () => {
      await createDocumentAssociationCommand({
        pool,
        context: contextB, // Caller in B
        idempotencyKey: 'key-spoofed-assoc-01',
        input: {
          documentId: docA1.id, // Target in A
          targetDomain: 'enrollment',
          targetResourceType: 'application',
          targetResourceId: 'app-spoofed',
          purpose: 'spoofing_test',
        },
      });
    },
    /violates foreign key constraint "document_associations_document_tenant_fk"/,
  );

  console.log('[DOCUMENTS-ASSOCIATION-MULTI-TENANT-NEGATIVE] PASS: All cross-tenant and cross-document relational negative tests verified.');
} finally {
  try {
    await client.query('RESET search_path');
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  } finally {
    client.release();
    await pool.end();
  }
}
