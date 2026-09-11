import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentPartyResolutionError, resolveDocumentParties, resolveDocumentaryPartySnapshot, UnsupportedOrganizationRecipientError } from '../src/modules/finance/document-party-resolution.ts';

const resolutionDb = (rows: unknown[][]) => {
  let calls = 0;
  return { query: async <T>() => ({ rows: rows[calls++] as T[] }) };
};

test('keeps beneficiary, billing party, payer and recipient independent when Finance source facts prove each relation', async () => {
  const db = resolutionDb([[{ person_id: 'maria' }], [{ beneficiary_person_id: 'joao' }], [{ payer_person_id: 'pedro' }]]);
  const result = await resolveDocumentParties(db, { institutionId: 'tenant', financialAccountId: 'account', obligationId: 'obligation', paymentId: 'payment' });
  assert.equal(result.beneficiary?.authorityId, 'joao');
  assert.equal(result.billingParty.authorityId, 'maria');
  assert.equal(result.payer?.authorityId, 'pedro');
  assert.equal(result.recipient.authorityId, 'maria');
});

test('permits same-person adult facts without assuming that parties are always equal', async () => {
  const result = await resolveDocumentParties(resolutionDb([[{ person_id: 'ana' }], [{ beneficiary_person_id: 'ana' }], [{ payer_person_id: 'ana' }]]), { institutionId: 'tenant', financialAccountId: 'account', obligationId: 'obligation', paymentId: 'payment' });
  assert.equal(result.beneficiary?.authorityId, 'ana');
  assert.equal(result.billingParty.authorityId, 'ana');
  assert.equal(result.payer?.authorityId, 'ana');
  assert.equal(result.recipient.authorityId, 'ana');
});

test('does not turn payer, authenticated user, or a missing payer into the recipient', async () => {
  const payerDifferent = await resolveDocumentParties(resolutionDb([[{ person_id: 'maria' }], [{ payer_person_id: 'pedro' }]]), { institutionId: 'tenant', financialAccountId: 'account', paymentId: 'payment' });
  assert.equal(payerDifferent.payer?.authorityId, 'pedro');
  assert.equal(payerDifferent.recipient.authorityId, 'maria');
  const payerAbsent = await resolveDocumentParties(resolutionDb([[{ person_id: 'maria' }], [{ payer_person_id: null }]]), { institutionId: 'tenant', financialAccountId: 'account', paymentId: 'payment' });
  assert.equal(payerAbsent.payer, null);
  assert.equal(payerAbsent.recipient.authorityId, 'maria');
});

test('fails closed for an account or source outside the institution', async () => {
  await assert.rejects(
    resolveDocumentParties(resolutionDb([[]]), { institutionId: 'tenant-a', financialAccountId: 'tenant-b-account' }),
    (error: unknown) => error instanceof DocumentPartyResolutionError && error.code === 'DOCUMENT_RECIPIENT_REQUIRED',
  );
  await assert.rejects(
    resolveDocumentParties(resolutionDb([[{ person_id: 'maria' }], []]), { institutionId: 'tenant-a', financialAccountId: 'account-a', paymentId: 'tenant-b-payment' }),
    (error: unknown) => error instanceof DocumentPartyResolutionError && error.code === 'DOCUMENT_PARTY_SOURCE_NOT_FOUND',
  );
});

test('is deterministic for identical persisted facts and has an explicit organization capability gap', async () => {
  const input = { institutionId: 'tenant', financialAccountId: 'account', paymentId: 'payment' };
  const left = await resolveDocumentParties(resolutionDb([[{ person_id: 'maria' }], [{ payer_person_id: 'pedro' }]]), input);
  const right = await resolveDocumentParties(resolutionDb([[{ person_id: 'maria' }], [{ payer_person_id: 'pedro' }]]), input);
  assert.deepEqual(left, right);
  await assert.rejects(resolveDocumentParties(resolutionDb([]), { ...input, recipientKind: 'organization' }), UnsupportedOrganizationRecipientError);
});

test('uses the person authority for a human snapshot rather than browser supplied labels', async () => {
  const db = { query: async <T>() => ({ rows: [{ name: 'Maria' }] as T[] }) };
  const snapshot = await resolveDocumentaryPartySnapshot(db, { kind: 'person', authorityId: 'maria', resolvedFrom: 'billingParty' });
  assert.equal(snapshot.name, 'Maria');
});

test('fails closed without a billing party and does not fake organizations as people', async () => {
  const db = { query: async <T>() => ({ rows: [] as T[] }) };
  await assert.rejects(resolveDocumentParties(db, { institutionId: 'tenant', financialAccountId: 'account' }), /DOCUMENT_RECIPIENT_REQUIRED/);
  await assert.rejects(resolveDocumentParties(db, { institutionId: 'tenant', financialAccountId: 'account', recipientKind: 'organization' }), UnsupportedOrganizationRecipientError);
});
