import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDocumentParties, resolveDocumentaryPartySnapshot, UnsupportedOrganizationRecipientError } from '../src/modules/finance/document-party-resolution.ts';

test('keeps beneficiary, billing party, payer and recipient independent', async () => {
  const db = { query: async () => ({ rows: [{ person_id: 'maria' }] }) };
  const result = await resolveDocumentParties(db, { institutionId: 'tenant', financialAccountId: 'account', beneficiaryPersonId: 'joao', payerPersonId: 'pedro' });
  assert.equal(result.beneficiary?.authorityId, 'joao');
  assert.equal(result.billingParty.authorityId, 'maria');
  assert.equal(result.payer?.authorityId, 'pedro');
  assert.equal(result.recipient.authorityId, 'maria');
});

test('uses the person authority for a human snapshot rather than browser supplied labels', async () => {
  const db = { query: async () => ({ rows: [{ name: 'Maria' }] }) };
  const snapshot = await resolveDocumentaryPartySnapshot(db, { kind: 'person', authorityId: 'maria', resolvedFrom: 'billingParty' });
  assert.equal(snapshot.name, 'Maria');
});

test('fails closed without a billing party and does not fake organizations as people', async () => {
  const db = { query: async () => ({ rows: [] }) };
  await assert.rejects(resolveDocumentParties(db, { institutionId: 'tenant', financialAccountId: 'account' }), /DOCUMENT_RECIPIENT_REQUIRED/);
  await assert.rejects(resolveDocumentParties(db, { institutionId: 'tenant', financialAccountId: 'account', recipientKind: 'organization' }), UnsupportedOrganizationRecipientError);
});
