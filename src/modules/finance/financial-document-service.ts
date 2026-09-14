import { validateDocumentSourceInstitution, validateDocumentSourceType } from './financial-document-model.ts';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createCanonicalFinanceFingerprint, executeIdempotentFinanceCommand } from './finance-command.ts';
import { resolveInvoiceEligibility, resolveReceiptEligibility } from './financial-document-eligibility.ts';
import { FiscalAdapterRegistry, productionFiscalAdapterRegistry, resolveDocumentaryPolicy } from './fiscal-adapter-registry.ts';
import { resolveEffectiveInstitutionLegalProfile } from '../institution/institution-legal-profile.ts';
import { resolveDocumentParties, resolveDocumentaryPartySnapshot } from './document-party-resolution.ts';
import { composeInvoiceDocumentarySnapshotV3, composeInvoiceReceiptDocumentarySnapshotV4, composeReceiptDocumentarySnapshotV2, decodeDocumentarySnapshot } from './documentary-snapshot.ts';
import { composeCreditNoteDocumentarySnapshotV5 } from './financial-document-credit-note.ts';
import { Money } from './money.ts';
import { captureReceiptSettlement } from './documentary-settlement-capture.ts';
import { resolveInvoiceReceiptComposition } from './financial-document-invoice-receipt.ts';
import { validateDocumentaryDocumentType, validateDocumentaryFinancialReconciliation, validateDocumentaryJurisdiction, validateDocumentarySnapshotStructure } from './documentary-snapshot-validation.ts';

export type DocumentarySnapshotValidators = Readonly<{
  structural: typeof validateDocumentarySnapshotStructure;
  financial: typeof validateDocumentaryFinancialReconciliation;
  documentType: typeof validateDocumentaryDocumentType;
  jurisdiction: typeof validateDocumentaryJurisdiction;
}>;

export const canonicalDocumentarySnapshotValidators: DocumentarySnapshotValidators = Object.freeze({ structural: validateDocumentarySnapshotStructure, financial: validateDocumentaryFinancialReconciliation, documentType: validateDocumentaryDocumentType, jurisdiction: validateDocumentaryJurisdiction });

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

export type CreditNoteIssuanceCommand = Readonly<{
  institutionId: string;
  originalDocumentId: string;
  seriesId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
}>;

export type InvoiceIssuanceCommand = Readonly<{
  institutionId: string;
  sourceInstitutionId: string;
  sourceType: 'obligation';
  obligationId: string;
  seriesId: string;
  idempotencyKey: string;
}>;

export type InvoiceReceiptIssuanceCommand = Readonly<{
  institutionId: string;
  sourceInstitutionId: string;
  sourceType: 'payment';
  paymentId: string;
  obligationId: string;
  seriesId: string;
  idempotencyKey: string;
}>;

/** F7-01 command boundary: all source ownership is rejected before any numbering mutation. */
export async function issueFinancialDocumentCommand(_dependencies: unknown, command: FinancialDocumentIssuanceCommand): Promise<never> {
  validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
  throw new Error('FINANCIAL_DOCUMENT_ISSUANCE_REPOSITORY_REQUIRED');
}

export class PostgresFinancialDocumentRepository {
  constructor(private readonly pool: Pool, private readonly fiscalAdapters: FiscalAdapterRegistry = productionFiscalAdapterRegistry, private readonly validators: DocumentarySnapshotValidators = canonicalDocumentarySnapshotValidators) {}

  async issue(command: FinancialDocumentIssuanceCommand & { documentType: string }) {
    validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
    if (command.documentType === 'invoice_receipt') throw new Error('FINANCIAL_DOCUMENT_INVOICE_RECEIPT_COMMAND_REQUIRED');
    const commandResult = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_issuance', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
      const eligibility = await resolveReceiptEligibility(client, this.fiscalAdapters, { institutionId: command.institutionId, paymentId: command.sourceId, seriesId: command.seriesId, documentType: command.documentType, lock: true });
      if (eligibility.eligible === false) throw new Error(eligibility.reasonCode);
      const sourceRow = eligibility.payment;
      const fiscalAdapter = eligibility.adapter;
      const documentaryPolicy = resolveDocumentaryPolicy(fiscalAdapter, command.documentType);
      if (!sourceRow.financialAccountId) throw new Error('DOCUMENT_RECIPIENT_REQUIRED');
      const issuerProfile = await resolveEffectiveInstitutionLegalProfile(client, command.institutionId, sourceRow.effectiveAt);
      if (!issuerProfile) throw new Error('INSTITUTION_LEGAL_PROFILE_REQUIRED');
      const parties = await resolveDocumentParties(client, {
        institutionId: command.institutionId,
        financialAccountId: sourceRow.financialAccountId,
        paymentId: sourceRow.id,
      });
      const recipient = await resolveDocumentaryPartySnapshot(client, parties.recipient);
      const payer = parties.payer ? await resolveDocumentaryPartySnapshot(client, parties.payer) : undefined;
      const issuedAt = (await client.query<{ issued_at: Date }>('SELECT clock_timestamp() issued_at')).rows[0]!.issued_at;
      const settlement = await captureReceiptSettlement(client, { institutionId: command.institutionId, paymentId: sourceRow.id, paymentAmount: sourceRow.amount, currency: sourceRow.currency, asOf: issuedAt });
      const documentarySnapshot = composeReceiptDocumentarySnapshotV2({
        documentType: command.documentType, issuedAt,
        issuer: { legalName: issuerProfile.legalName, taxIdentifier: issuerProfile.taxIdentifier, address: { countryCode: issuerProfile.registeredAddress.countryCode, line1: issuerProfile.registeredAddress.line1 } },
        recipient: { name: recipient.name, authorityId: recipient.authorityId },
        billingParty: { name: recipient.name, authorityId: recipient.authorityId }, ...(payer ? { payer: { name: payer.name, authorityId: payer.authorityId } } : {}),
        paymentAuthorityId: sourceRow.id, paymentReference: sourceRow.paymentReference, paymentConfirmedAt: sourceRow.effectiveAt, paymentMethod: sourceRow.method, amount: sourceRow.amount, currency: sourceRow.currency,
        jurisdictionCode: fiscalAdapter.key, policyVersion: fiscalAdapter.policy.version, financialProfileVersion: sourceRow.financialProfileVersion, fiscalConfigurationVersion: eligibility.fiscalConfiguration.version, seriesId: command.seriesId, adapterKey: fiscalAdapter.key,
        taxTreatment: documentaryPolicy.taxTreatment, legalMentions: documentaryPolicy.legalMentions,
        obligations: settlement.obligations, allocations: settlement.allocations, ...(settlement.unallocated ? { unallocated: settlement.unallocated } : {}),
      });
      const fiscalPolicySnapshot = { adapterKey: fiscalAdapter.key, documentType: command.documentType, policyVersion: fiscalAdapter.policy.version };
      this.validators.structural(documentarySnapshot);
      this.validators.financial(documentarySnapshot, settlement);
      this.validators.documentType(documentarySnapshot, command.documentType);
      this.validators.jurisdiction(documentarySnapshot, documentaryPolicy);
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
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, sourceSnapshot, documentarySnapshot, documentarySnapshot.snapshotVersion, eligibility.fiscalConfiguration.id, fiscalAdapter.key, fiscalAdapter.policy.version, fiscalPolicySnapshot, {}]);
      await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, command.sourceType, command.sourceId, sourceSnapshot]);
      await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_issued',$2)", [command.institutionId, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_issued',$2,$3)", [command.institutionId, id, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      return { resultRef: id, result: { id, sequenceNumber } };
      },
      loadResult: async (client, id) => { const row = await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]); if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_RESULT_MISSING'); return { id, sequenceNumber: Number(row.rows[0].sequence_number) }; },
    });
    return { ...commandResult.result, replayed: commandResult.replayed };
  }

  /** Invoice issuance freezes only server-resolved obligation facts; it never settles a debt. */
  async issueInvoice(command: InvoiceIssuanceCommand) {
    validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
    validateDocumentSourceType(command.sourceType, 'invoice');
    const commandResult = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_invoice_issuance', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
        const issuedAt = (await client.query<{ issued_at: Date }>('SELECT clock_timestamp() issued_at')).rows[0]!.issued_at;
        const eligibility = await resolveInvoiceEligibility(client, this.fiscalAdapters, { institutionId: command.institutionId, obligationId: command.obligationId, seriesId: command.seriesId, documentType: 'invoice', at: issuedAt, lock: true });
        if (eligibility.eligible === false) throw new Error(eligibility.reasonCode);
        const source = eligibility.obligation;
        const fiscalAdapter = eligibility.adapter;
        const documentaryPolicy = resolveDocumentaryPolicy(fiscalAdapter, 'invoice');
        const issuerProfile = await resolveEffectiveInstitutionLegalProfile(client, command.institutionId, issuedAt);
        if (!issuerProfile) throw new Error('INSTITUTION_LEGAL_PROFILE_REQUIRED');
        const parties = await resolveDocumentParties(client, { institutionId: command.institutionId, financialAccountId: source.financialAccountId, obligationId: source.obligationId });
        const recipient = await resolveDocumentaryPartySnapshot(client, parties.recipient);
        const documentarySnapshot = composeInvoiceDocumentarySnapshotV3({
          issuedAt, dueAt: source.dueAt,
          issuer: { legalName: issuerProfile.legalName, taxIdentifier: issuerProfile.taxIdentifier, address: { countryCode: issuerProfile.registeredAddress.countryCode, line1: issuerProfile.registeredAddress.line1 } },
          recipient: { name: recipient.name, authorityId: recipient.authorityId },
          obligation: { authorityId: source.obligationId, reference: source.reference, amount: source.billableAmount, currency: source.currency, dueAt: source.dueAt.toISOString() },
          line: { description: source.description, quantity: '1', unitPrice: source.preDiscountAmount, discount: source.discountTotal, tax: '0' },
          taxTreatment: documentaryPolicy.taxTreatment, legalMentions: documentaryPolicy.legalMentions,
          jurisdictionCode: fiscalAdapter.key, policyVersion: fiscalAdapter.policy.version, financialProfileVersion: source.financialProfileVersion, fiscalConfigurationVersion: eligibility.fiscalConfiguration.version, seriesId: command.seriesId, adapterKey: fiscalAdapter.key,
        });
        const sequenceNumber = eligibility.series.nextSequenceNumber;
        const sourceSnapshot = { sourceType: 'obligation', sourceId: source.obligationId, obligationReference: source.reference, originalAmount: source.originalAmount, adjustmentTotal: source.adjustmentTotal, discountTotal: source.discountTotal, billableAmount: source.billableAmount, currency: source.currency, dueAt: source.dueAt.toISOString(), financialProfileVersion: source.financialProfileVersion };
        const fiscalPolicySnapshot = { adapterKey: fiscalAdapter.key, documentType: 'invoice', policyVersion: fiscalAdapter.policy.version };
        const id = randomUUID();
        await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
        await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,'invoice','issued',$3,$4,$5,$6,3,$7,$8,$9,$10,$11,now())", [id, command.institutionId, command.seriesId, sequenceNumber, sourceSnapshot, documentarySnapshot, eligibility.fiscalConfiguration.id, fiscalAdapter.key, fiscalAdapter.policy.version, fiscalPolicySnapshot, {}]);
        await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, 'obligation', source.obligationId, sourceSnapshot]);
        await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_issued',$2)", [command.institutionId, { documentId: id, seriesId: command.seriesId, sequenceNumber, documentType: 'invoice' }]);
        await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_issued',$2,$3)", [command.institutionId, id, { documentId: id, seriesId: command.seriesId, sequenceNumber, documentType: 'invoice' }]);
        return { resultRef: id, result: { id, sequenceNumber } };
      },
      loadResult: async (client, id) => { const row = await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]); if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_RESULT_MISSING'); return { id, sequenceNumber: Number(row.rows[0].sequence_number) }; },
    });
    return { ...commandResult.result, replayed: commandResult.replayed };
  }

  /** Factura-Recibo freezes one authoritative obligation/payment settlement relationship. */
  async issueInvoiceReceipt(command: InvoiceReceiptIssuanceCommand) {
    validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
    const commandResult = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_invoice_receipt_issuance', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
        const issuedAt = (await client.query<{ issued_at: Date }>('SELECT clock_timestamp() issued_at')).rows[0]!.issued_at;
        const eligibility = await resolveReceiptEligibility(client, this.fiscalAdapters, { institutionId: command.institutionId, paymentId: command.paymentId, seriesId: command.seriesId, documentType: 'invoice_receipt', lock: true });
        if (eligibility.eligible === false) throw new Error(eligibility.reasonCode);
        const payment = eligibility.payment;
        const composition = await resolveInvoiceReceiptComposition(client, { institutionId: command.institutionId, payment: { id: payment.id, amount: payment.amount, currency: payment.currency }, obligationId: command.obligationId, at: issuedAt });
        const policy = resolveDocumentaryPolicy(eligibility.adapter, 'invoice_receipt');
        if (!payment.financialAccountId) throw new Error('DOCUMENT_RECIPIENT_REQUIRED');
        const issuerProfile = await resolveEffectiveInstitutionLegalProfile(client, command.institutionId, issuedAt);
        if (!issuerProfile) throw new Error('INSTITUTION_LEGAL_PROFILE_REQUIRED');
        const parties = await resolveDocumentParties(client, { institutionId: command.institutionId, financialAccountId: composition.obligation.financialAccountId, obligationId: composition.obligation.obligationId, paymentId: payment.id });
        const recipient = await resolveDocumentaryPartySnapshot(client, parties.recipient);
        const payer = parties.payer ? await resolveDocumentaryPartySnapshot(client, parties.payer) : undefined;
        const snapshot = composeInvoiceReceiptDocumentarySnapshotV4({
          issuedAt, dueAt: composition.obligation.dueAt,
          issuer: { legalName: issuerProfile.legalName, taxIdentifier: issuerProfile.taxIdentifier, address: { countryCode: issuerProfile.registeredAddress.countryCode, line1: issuerProfile.registeredAddress.line1 } },
          recipient: { name: recipient.name, authorityId: recipient.authorityId }, billingParty: { name: recipient.name, authorityId: recipient.authorityId }, ...(payer ? { payer: { name: payer.name, authorityId: payer.authorityId } } : {}),
          obligation: { authorityId: composition.obligation.obligationId, reference: composition.obligation.reference, amount: composition.obligation.billableAmount, currency: composition.obligation.currency, dueAt: composition.obligation.dueAt.toISOString() },
          payment: { authorityId: payment.id, reference: payment.paymentReference, confirmedAt: payment.effectiveAt, method: payment.method, amount: payment.amount, currency: payment.currency },
          allocations: composition.settlement.allocations, ...(composition.settlement.unallocated ? { unallocated: composition.settlement.unallocated } : {}),
          line: { description: composition.obligation.description, quantity: '1', unitPrice: composition.obligation.preDiscountAmount, discount: composition.obligation.discountTotal, tax: '0' },
          taxTreatment: policy.taxTreatment, legalMentions: policy.legalMentions, jurisdictionCode: eligibility.adapter.key, policyVersion: eligibility.adapter.policy.version,
          financialProfileVersion: payment.financialProfileVersion, fiscalConfigurationVersion: eligibility.fiscalConfiguration.version, seriesId: command.seriesId, adapterKey: eligibility.adapter.key,
        });
        const sequenceNumber = eligibility.series.nextSequenceNumber;
        const id = randomUUID();
        const sourceSnapshot = { sourceType: 'invoice_receipt', paymentId: payment.id, paymentReference: payment.paymentReference, obligationId: composition.obligation.obligationId, obligationReference: composition.obligation.reference, paymentAmount: payment.amount, billableAmount: composition.obligation.billableAmount, currency: payment.currency };
        const fiscalPolicySnapshot = { adapterKey: eligibility.adapter.key, documentType: 'invoice_receipt', policyVersion: eligibility.adapter.policy.version };
        await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
        await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,'invoice_receipt','issued',$3,$4,$5,$6,4,$7,$8,$9,$10,$11,now())", [id, command.institutionId, command.seriesId, sequenceNumber, sourceSnapshot, snapshot, eligibility.fiscalConfiguration.id, eligibility.adapter.key, eligibility.adapter.policy.version, fiscalPolicySnapshot, {}]);
        await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, 'payment', payment.id, { paymentReference: payment.paymentReference }]);
        await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, 'obligation', composition.obligation.obligationId, { obligationReference: composition.obligation.reference }]);
        await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_issued',$2)", [command.institutionId, { documentId: id, seriesId: command.seriesId, sequenceNumber, documentType: 'invoice_receipt' }]);
        await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_issued',$2,$3)", [command.institutionId, id, { documentId: id, seriesId: command.seriesId, sequenceNumber, documentType: 'invoice_receipt' }]);
        return { resultRef: id, result: { id, sequenceNumber } };
      },
      loadResult: async (client, id) => { const row = await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]); if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_RESULT_MISSING'); return { id, sequenceNumber: Number(row.rows[0].sequence_number) }; },
    });
    return { ...commandResult.result, replayed: commandResult.replayed };
  }

  async issueCorrection(command: FinancialDocumentCorrectionCommand) {
    if (!['credit_note', 'debit_note'].includes(command.documentType)) throw new Error('DOCUMENT_TYPE_UNSUPPORTED');
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
        const paymentSource = originalSources.rows.find(source => source.source_type === 'payment');
        if (!paymentSource) throw new Error('FINANCIAL_DOCUMENT_CORRECTION_SOURCE_UNSUPPORTED');
        const eligibility = await resolveReceiptEligibility(client, this.fiscalAdapters, { institutionId: command.institutionId, paymentId: paymentSource.source_id, seriesId: command.seriesId, documentType: 'receipt', lock: true });
        if (eligibility.eligible === false) throw new Error(eligibility.reasonCode);
        // The Payment remains provenance only. The corrective type is authorized by its own explicit policy entry.
        const documentaryPolicy = resolveDocumentaryPolicy(eligibility.adapter, command.documentType);
        const sourceRow = eligibility.payment;
        if (!sourceRow.financialAccountId) throw new Error('DOCUMENT_RECIPIENT_REQUIRED');
        const issuerProfile = await resolveEffectiveInstitutionLegalProfile(client, command.institutionId, sourceRow.effectiveAt);
        if (!issuerProfile) throw new Error('INSTITUTION_LEGAL_PROFILE_REQUIRED');
        const parties = await resolveDocumentParties(client, { institutionId: command.institutionId, financialAccountId: sourceRow.financialAccountId, paymentId: sourceRow.id });
        const recipient = await resolveDocumentaryPartySnapshot(client, parties.recipient);
        const payer = parties.payer ? await resolveDocumentaryPartySnapshot(client, parties.payer) : undefined;
        const originalSnapshotVersion = original.rows[0].documentary_snapshot ? decodeDocumentarySnapshot(original.rows[0].documentary_snapshot).snapshotVersion : 1;
        // Correction composition is presently V2-only. Invoice and
        // Factura-Recibo snapshots have their own documentary structures and
        // must fail closed until their independent correction authority exists.
        if (originalSnapshotVersion !== 1 && originalSnapshotVersion !== 2) throw new Error('FINANCIAL_DOCUMENT_CORRECTION_SOURCE_UNSUPPORTED');
        const correctionOriginalSnapshotVersion: 1 | 2 = originalSnapshotVersion;
        const issuedAt = (await client.query<{ issued_at: Date }>('SELECT clock_timestamp() issued_at')).rows[0]!.issued_at;
        const settlement = await captureReceiptSettlement(client, { institutionId: command.institutionId, paymentId: sourceRow.id, paymentAmount: sourceRow.amount, currency: sourceRow.currency, asOf: issuedAt });
        const documentarySnapshot = {
          ...composeReceiptDocumentarySnapshotV2({ documentType: command.documentType, issuedAt, issuer: { legalName: issuerProfile.legalName, taxIdentifier: issuerProfile.taxIdentifier, address: { countryCode: issuerProfile.registeredAddress.countryCode, line1: issuerProfile.registeredAddress.line1 } }, recipient: { name: recipient.name, authorityId: recipient.authorityId }, billingParty: { name: recipient.name, authorityId: recipient.authorityId }, ...(payer ? { payer: { name: payer.name, authorityId: payer.authorityId } } : {}), paymentAuthorityId: sourceRow.id, paymentReference: sourceRow.paymentReference, paymentConfirmedAt: sourceRow.effectiveAt, paymentMethod: sourceRow.method, amount: sourceRow.amount, currency: sourceRow.currency, jurisdictionCode: eligibility.adapter.key, policyVersion: eligibility.adapter.policy.version, financialProfileVersion: sourceRow.financialProfileVersion, fiscalConfigurationVersion: eligibility.fiscalConfiguration.version, seriesId: command.seriesId, adapterKey: eligibility.adapter.key, taxTreatment: documentaryPolicy.taxTreatment, legalMentions: documentaryPolicy.legalMentions, obligations: settlement.obligations, allocations: settlement.allocations, ...(settlement.unallocated ? { unallocated: settlement.unallocated } : {}) }),
          correction: { originalDocumentId: command.originalDocumentId, originalSnapshotVersion: correctionOriginalSnapshotVersion },
        };
        const sourceSnapshot = { sourceType: 'payment', sourceId: sourceRow.id, paymentReference: sourceRow.paymentReference, journalTransactionId: sourceRow.journalTransactionId, amount: sourceRow.amount, currency: sourceRow.currency, effectiveAt: sourceRow.effectiveAt.toISOString(), financialProfileVersion: sourceRow.financialProfileVersion };
        const fiscalPolicySnapshot = { adapterKey: eligibility.adapter.key, documentType: command.documentType, policyVersion: eligibility.adapter.policy.version };
        this.validators.structural(documentarySnapshot);
        this.validators.financial(documentarySnapshot, settlement);
        this.validators.documentType(documentarySnapshot, command.documentType);
        this.validators.jurisdiction(documentarySnapshot, documentaryPolicy);
        const series = await client.query<{ next_sequence_number: string }>(
          "SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) FOR UPDATE",
          [command.institutionId, command.seriesId],
        );
        if (!series.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE');
        const sequenceNumber = Number(series.rows[0].next_sequence_number);
        const id = randomUUID();
        await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
        await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,corrects_document_id,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, sourceSnapshot, documentarySnapshot, 2, command.originalDocumentId, eligibility.fiscalConfiguration.id, eligibility.adapter.key, eligibility.adapter.policy.version, fiscalPolicySnapshot, {}]);
        for (const source of originalSources.rows) {
          await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, source.source_type, source.source_id, sourceSnapshot]);
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

  /** P01: V4 Factura-Recibo corrections have their own immutable credit-note authority. */
  async issueCreditNote(command: CreditNoteIssuanceCommand) {
    const commandResult = await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_credit_note', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
        const originalResult = await client.query<{ id: string; document_type: string; documentary_snapshot: Record<string, unknown> | null; source_snapshot: Record<string, unknown>; series_code: string }>(
          `SELECT d.id,d.document_type,d.documentary_snapshot,d.source_snapshot,s.code series_code
           FROM finance_financial_documents d
           JOIN finance_financial_document_series s ON s.institution_id=d.institution_id AND s.id=d.series_id
           WHERE d.institution_id=$1 AND d.id=$2 AND d.status='issued' FOR UPDATE`,
          [command.institutionId, command.originalDocumentId],
        );
        const originalRow = originalResult.rows[0];
        if (!originalRow) throw new Error('FINANCIAL_DOCUMENT_ORIGINAL_NOT_FOUND');
        if (originalRow.document_type !== 'invoice_receipt' || !originalRow.documentary_snapshot) throw new Error('CREDIT_NOTE_ORIGINAL_INELIGIBLE');
        const decoded = decodeDocumentarySnapshot(originalRow.documentary_snapshot);
        if (decoded.snapshotVersion !== 4 || decoded.snapshot.document.type !== 'invoice_receipt') throw new Error('CREDIT_NOTE_ORIGINAL_INELIGIBLE');
        const priorCredits = await client.query<{ documentary_snapshot: Record<string, unknown> }>(
          "SELECT documentary_snapshot FROM finance_financial_documents WHERE institution_id=$1 AND corrects_document_id=$2 AND document_type='credit_note' AND status='issued' FOR UPDATE",
          [command.institutionId, command.originalDocumentId],
        );
        const originalTotal = Money.parse(decoded.snapshot.totals.documentTotal, decoded.snapshot.totals.currency);
        const priorCreditTotal = priorCredits.rows.reduce((total, row) => {
          const prior = decodeDocumentarySnapshot(row.documentary_snapshot);
          if (prior.snapshotVersion !== 5 || prior.snapshot.document.type !== 'credit_note') throw new Error('CREDIT_NOTE_PRIOR_SNAPSHOT_INVALID');
          return total.add(Money.parse(prior.snapshot.correction.amount, prior.snapshot.correction.currency));
        }, Money.parse('0', originalTotal.currency));
        const remainingCredit = originalTotal.subtract(priorCreditTotal);
        const originalSources = await client.query<{ source_type: string; source_id: string; snapshot: Record<string, unknown> }>(
          'SELECT source_type,source_id,snapshot FROM finance_financial_document_sources WHERE institution_id=$1 AND document_id=$2 FOR UPDATE',
          [command.institutionId, command.originalDocumentId],
        );
        const paymentSource = originalSources.rows.find(source => source.source_type === 'payment');
        if (!paymentSource) throw new Error('CREDIT_NOTE_ORIGINAL_PROVENANCE_MISSING');
        // This is a shared fiscal/series gate only. Composition below takes no
        // live Payment, Obligation or party facts from it.
        const eligibility = await resolveReceiptEligibility(client, this.fiscalAdapters, { institutionId: command.institutionId, paymentId: paymentSource.source_id, seriesId: command.seriesId, documentType: 'credit_note', lock: true });
        if (eligibility.eligible === false) throw new Error(eligibility.reasonCode);
        const policy = resolveDocumentaryPolicy(eligibility.adapter, 'credit_note');
        const issuedAt = (await client.query<{ issued_at: Date }>('SELECT clock_timestamp() issued_at')).rows[0]!.issued_at;
        const snapshot = composeCreditNoteDocumentarySnapshotV5({
          originalDocumentId: command.originalDocumentId,
          originalOfficialNumber: `${originalRow.series_code}/${(await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, command.originalDocumentId])).rows[0]!.sequence_number}`,
          original: decoded.snapshot,
          issuedAt,
          amount: command.amount,
          currency: command.currency,
          permittedAmount: remainingCredit.canonicalAmount(),
          seriesId: command.seriesId,
          policy,
          policyProvenance: { financialProfileVersion: decoded.snapshot.policyProvenance.financialProfileVersion, fiscalConfigurationVersion: eligibility.fiscalConfiguration.version, adapterKey: eligibility.adapter.key, policyVersion: eligibility.adapter.policy.version },
        });
        const id = randomUUID(); const sequenceNumber = eligibility.series.nextSequenceNumber;
        await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
        const sourceSnapshot = { sourceType: 'financial_document_correction', originalDocumentId: command.originalDocumentId, originalDocumentType: 'invoice_receipt', amount: snapshot.correction.amount, currency: snapshot.correction.currency };
        const fiscalPolicySnapshot = { adapterKey: eligibility.adapter.key, documentType: 'credit_note', policyVersion: eligibility.adapter.policy.version };
        await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,corrects_document_id,fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,'credit_note','issued',$3,$4,$5,$6,5,$7,$8,$9,$10,$11,$12,now())", [id, command.institutionId, command.seriesId, sequenceNumber, sourceSnapshot, snapshot, command.originalDocumentId, eligibility.fiscalConfiguration.id, eligibility.adapter.key, eligibility.adapter.policy.version, fiscalPolicySnapshot, {}]);
        for (const source of originalSources.rows) await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, source.source_type, source.source_id, source.snapshot]);
        await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_corrected',$2)", [command.institutionId, { documentId: id, originalDocumentId: command.originalDocumentId, seriesId: command.seriesId, sequenceNumber, documentType: 'credit_note' }]);
        await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_corrected',$2,$3)", [command.institutionId, id, { documentId: id, originalDocumentId: command.originalDocumentId, seriesId: command.seriesId, sequenceNumber, documentType: 'credit_note' }]);
        return { resultRef: id, result: { id, sequenceNumber, originalDocumentId: command.originalDocumentId } };
      },
      loadResult: async (client, id) => {
        const row = await client.query<{ sequence_number: string; corrects_document_id: string }>('SELECT sequence_number,corrects_document_id FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]);
        if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_CREDIT_NOTE_RESULT_MISSING');
        return { id, sequenceNumber: Number(row.rows[0].sequence_number), originalDocumentId: row.rows[0].corrects_document_id };
      },
    });
    return { ...commandResult.result, replayed: commandResult.replayed };
  }
}
