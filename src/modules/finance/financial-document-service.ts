import { validateDocumentSourceInstitution } from './financial-document-model.ts';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createCanonicalFinanceFingerprint, executeIdempotentFinanceCommand } from './finance-command.ts';
import { resolveReceiptEligibility } from './financial-document-eligibility.ts';
import { FiscalAdapterRegistry, productionFiscalAdapterRegistry } from './fiscal-adapter-registry.ts';
import { resolveEffectiveInstitutionLegalProfile } from '../institution/institution-legal-profile.ts';
import { resolveDocumentParties, resolveDocumentaryPartySnapshot } from './document-party-resolution.ts';
import { composeReceiptDocumentarySnapshot } from './documentary-snapshot.ts';

export type FinancialDocumentIssuanceCommand = {
  institutionId: string;
  sourceInstitutionId: string;
  sourceType: 'payment';
  sourceId: string;
  seriesId: string;
  idempotencyKey: string;
};

export type FinancialDocumentCorrectionCommand = {
  institutionId: string;
  originalDocumentId: string;
  seriesId: string;
  documentType: string;
  idempotencyKey: string;
};

/** F7-01 command boundary: all source ownership is rejected before any numbering mutation. */
export async function issueFinancialDocumentCommand(_dependencies: unknown, command: FinancialDocumentIssuanceCommand): Promise<never> {
  validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
  throw new Error('FINANCIAL_DOCUMENT_ISSUANCE_REPOSITORY_REQUIRED');
}

export class PostgresFinancialDocumentRepository {
  constructor(private readonly pool: Pool, private readonly fiscalAdapters: FiscalAdapterRegistry = productionFiscalAdapterRegistry) {}

  async issue(command: FinancialDocumentIssuanceCommand & { documentType: string }) {
    validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
    const commandResult = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_issuance', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
      const eligibility = await resolveReceiptEligibility(client, this.fiscalAdapters, { institutionId: command.institutionId, paymentId: command.sourceId, seriesId: command.seriesId, documentType: command.documentType, lock: true });
      if (eligibility.eligible === false) throw new Error(eligibility.reasonCode);
      const sourceRow = eligibility.payment;
      const fiscalAdapter = eligibility.adapter;
      if (!sourceRow.financialAccountId) throw new Error('DOCUMENT_RECIPIENT_REQUIRED');
      const issuerProfile = await resolveEffectiveInstitutionLegalProfile(client, command.institutionId, sourceRow.effectiveAt);
      if (!issuerProfile) throw new Error('INSTITUTION_LEGAL_PROFILE_REQUIRED');
      const parties = await resolveDocumentParties(client, {
        institutionId: command.institutionId,
        financialAccountId: sourceRow.financialAccountId,
        paymentId: sourceRow.id,
      });
      const recipient = await resolveDocumentaryPartySnapshot(client, parties.recipient);
      const documentarySnapshot = composeReceiptDocumentarySnapshot({
        issuer: { legalName: issuerProfile.legalName, taxIdentifier: issuerProfile.taxIdentifier, address: { countryCode: issuerProfile.registeredAddress.countryCode, line1: issuerProfile.registeredAddress.line1 } },
        recipient: { name: recipient.name, authorityId: recipient.authorityId },
        paymentReference: sourceRow.paymentReference,
        amount: sourceRow.amount,
        currency: sourceRow.currency,
        jurisdictionCode: fiscalAdapter.key,
        policyVersion: fiscalAdapter.policy.version,
      });
      const fiscalPolicySnapshot = { adapterKey: fiscalAdapter.key, documentType: command.documentType, policyVersion: fiscalAdapter.policy.version };
      const sourceSnapshot = {
        sourceType: command.sourceType,
        sourceId: sourceRow.id,
        paymentReference: sourceRow.paymentReference,
        journalTransactionId: sourceRow.journalTransactionId,
        amount: sourceRow.amount,
        currency: sourceRow.currency,
        effectiveAt: sourceRow.effectiveAt.toISOString(),
        financialProfileVersion: sourceRow.financialProfileVersion,
      };
      const sequenceNumber = eligibility.series.nextSequenceNumber;
      const id = randomUUID();
      await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, sourceSnapshot, documentarySnapshot, documentarySnapshot.schemaVersion, eligibility.fiscalConfiguration.id, fiscalAdapter.key, fiscalAdapter.policy.version, fiscalPolicySnapshot, {}]);
      await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, command.sourceType, command.sourceId, sourceSnapshot]);
      await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_issued',$2)", [command.institutionId, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_issued',$2,$3)", [command.institutionId, id, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      return { resultRef: id, result: { id, sequenceNumber } };
      },
      loadResult: async (client, id) => { const row = await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]); if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_RESULT_MISSING'); return { id, sequenceNumber: Number(row.rows[0].sequence_number) }; },
    });
    return { ...commandResult.result, replayed: commandResult.replayed };
  }

  async issueCorrection(command: FinancialDocumentCorrectionCommand) {
    const commandResult = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_correction', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
        // Lock the original fact and its provenance before the new series counter.
        const original = await client.query<{ id: string; source_snapshot: Record<string, unknown>; documentary_snapshot: Record<string, unknown> | null; documentary_snapshot_schema_version: number | null; fiscal_configuration_id: string | null; fiscal_adapter_key: string | null; fiscal_policy_version: string | null; fiscal_policy_snapshot: Record<string, unknown>; jurisdiction_extension_data: Record<string, unknown> }>(
          "SELECT id,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data FROM finance_financial_documents WHERE institution_id=$1 AND id=$2 AND status='issued' FOR UPDATE",
          [command.institutionId, command.originalDocumentId],
        );
        if (!original.rows[0]) throw new Error('FINANCIAL_DOCUMENT_ORIGINAL_NOT_FOUND');
        const originalSources = await client.query<{ source_type: string; source_id: string; snapshot: Record<string, unknown> }>(
          'SELECT source_type,source_id,snapshot FROM finance_financial_document_sources WHERE institution_id=$1 AND document_id=$2 FOR UPDATE',
          [command.institutionId, command.originalDocumentId],
        );
        if (originalSources.rows.length === 0) throw new Error('FINANCIAL_DOCUMENT_ORIGINAL_PROVENANCE_MISSING');
        const series = await client.query<{ next_sequence_number: string }>(
          "SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) FOR UPDATE",
          [command.institutionId, command.seriesId],
        );
        if (!series.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE');
        const sequenceNumber = Number(series.rows[0].next_sequence_number);
        const id = randomUUID();
        await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
        await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,corrects_document_id,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, original.rows[0].source_snapshot, original.rows[0].documentary_snapshot, original.rows[0].documentary_snapshot_schema_version, command.originalDocumentId, original.rows[0].fiscal_configuration_id, original.rows[0].fiscal_adapter_key, original.rows[0].fiscal_policy_version, original.rows[0].fiscal_policy_snapshot, original.rows[0].jurisdiction_extension_data]);
        for (const source of originalSources.rows) {
          await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, source.source_type, source.source_id, source.snapshot]);
        }
        await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_corrected',$2)", [command.institutionId, { documentId: id, originalDocumentId: command.originalDocumentId, seriesId: command.seriesId, sequenceNumber }]);
        await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_corrected',$2,$3)", [command.institutionId, id, { documentId: id, originalDocumentId: command.originalDocumentId, seriesId: command.seriesId, sequenceNumber }]);
        return { resultRef: id, result: { id, sequenceNumber, originalDocumentId: command.originalDocumentId } };
      },
      loadResult: async (client, id) => {
        const row = await client.query<{ sequence_number: string; corrects_document_id: string }>('SELECT sequence_number,corrects_document_id FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]);
        if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_CORRECTION_RESULT_MISSING');
        return { id, sequenceNumber: Number(row.rows[0].sequence_number), originalDocumentId: row.rows[0].corrects_document_id };
      },
    });
    return { ...commandResult.result, replayed: commandResult.replayed };
  }
}
