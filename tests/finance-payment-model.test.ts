import assert from 'node:assert/strict';
import { Money } from '../src/modules/finance/money.ts';
import {
  PaymentValidationError,
  normalizeConfirmIncomingPaymentIntent,
  type ConfirmIncomingPaymentIntent,
  type Payment,
} from '../src/modules/finance/payment-model.ts';
import { canAccessPayments, requirePaymentRole } from '../src/modules/finance/payment-policy.ts';

const validInstitutionId = '00000000-0000-0000-0000-000000000001';
const validActorId = '00000000-0000-0000-0000-000000000002';
const validFinancialAccountId = '00000000-0000-0000-0000-000000000003';
const validPayerPersonId = '00000000-0000-0000-0000-000000000004';

const validFinancialContext = {
  institutionId: validInstitutionId,
  financialProfileVersion: 1,
  functionalCurrency: 'EUR',
  enabledCurrencies: ['EUR', 'USD', 'AOA'],
  financialTimezone: 'Europe/Lisbon',
};

// 1. Manual Cash Payment Intent Normalization
{
  const input = {
    sourceType: 'manual_offline',
    method: 'cash',
    amount: '150.00',
    currency: 'EUR',
    effectiveAt: new Date('2026-09-05T10:00:00Z'),
    financialAccountId: validFinancialAccountId,
    payerPersonId: validPayerPersonId,
    notes: 'Pagamento em numerário na secretaria',
  };

  const intent = normalizeConfirmIncomingPaymentIntent(input, validFinancialContext, validActorId);
  assert.equal(intent.institutionId, validInstitutionId);
  assert.equal(intent.sourceType, 'manual_offline');
  assert.equal(intent.method, 'cash');
  assert.equal(intent.money.canonicalAmount(), '150');
  assert.ok(intent.money.equals(Money.parse('150.00', 'EUR')));
  assert.equal(intent.money.currency, 'EUR');
  assert.equal(intent.financialAccountId, validFinancialAccountId);
  assert.equal(intent.payerPersonId, validPayerPersonId);
  assert.equal(intent.actorPersonId, validActorId);
  assert.equal(intent.financialProfileVersion, 1);
  assert.equal(intent.notes, 'Pagamento em numerário na secretaria');
  assert.equal(intent.providerKey, undefined);
  assert.equal(intent.providerEventId, undefined);
}

// 2. Manual Bank Transfer with Evidence Reference
{
  const input = {
    sourceType: 'manual_offline',
    method: 'bank_transfer',
    amount: '250000.00',
    currency: 'AOA',
    effectiveAt: new Date('2026-09-05T09:00:00Z'),
    manualEvidenceRef: 'TRF-BFA-998822',
  };

  const intent = normalizeConfirmIncomingPaymentIntent(input, { ...validFinancialContext, functionalCurrency: 'AOA' }, validActorId);
  assert.equal(intent.sourceType, 'manual_offline');
  assert.equal(intent.method, 'bank_transfer');
  assert.equal(intent.manualEvidenceRef, 'TRF-BFA-998822');
  assert.equal(intent.money.currency, 'AOA');
}

// 3. Provider Payment Normalization (e.g. Adyen)
{
  const input = {
    sourceType: 'provider',
    providerKey: 'adyen',
    method: 'card',
    amount: '45.50',
    currency: 'EUR',
    effectiveAt: new Date('2026-09-05T12:00:00Z'),
    providerEventId: 'adyen-evt-12345',
    providerTransactionRef: 'PSPREF-99887766',
    providerOccurredAt: new Date('2026-09-05T11:59:50Z'),
  };

  const intent = normalizeConfirmIncomingPaymentIntent(input, validFinancialContext, validActorId);
  assert.equal(intent.sourceType, 'provider');
  assert.equal(intent.providerKey, 'adyen');
  assert.equal(intent.providerEventId, 'adyen-evt-12345');
  assert.equal(intent.providerTransactionRef, 'PSPREF-99887766');
  assert.ok(intent.providerOccurredAt instanceof Date);
}

// 4. Money Validation & Invariants
{
  // Zero amount rejected
  assert.throws(
    () => normalizeConfirmIncomingPaymentIntent({ sourceType: 'manual_offline', method: 'cash', amount: '0.00', currency: 'EUR', effectiveAt: new Date() }, validFinancialContext, validActorId),
    (err: any) => err instanceof PaymentValidationError && /positivo/i.test(err.message)
  );

  // Negative amount rejected
  assert.throws(
    () => normalizeConfirmIncomingPaymentIntent({ sourceType: 'manual_offline', method: 'cash', amount: '-50.00', currency: 'EUR', effectiveAt: new Date() }, validFinancialContext, validActorId),
    (err: any) => err instanceof PaymentValidationError && /positivo/i.test(err.message)
  );

  // Currency not enabled in financial profile rejected
  assert.throws(
    () => normalizeConfirmIncomingPaymentIntent({ sourceType: 'manual_offline', method: 'cash', amount: '10.00', currency: 'GBP', effectiveAt: new Date() }, validFinancialContext, validActorId),
    (err: any) => err instanceof PaymentValidationError && /moeda.*não habilitada/i.test(err.message)
  );
}

// 5. Invariant: Manual offline rejects missing or invalid manual methods
{
  assert.throws(
    () => normalizeConfirmIncomingPaymentIntent({ sourceType: 'manual_offline', method: 'invalid_method', amount: '10.00', currency: 'EUR', effectiveAt: new Date() }, validFinancialContext, validActorId),
    (err: any) => err instanceof PaymentValidationError
  );
}

// 6. Invariant: Provider source requires providerKey, providerEventId, providerTransactionRef
{
  assert.throws(
    () => normalizeConfirmIncomingPaymentIntent({ sourceType: 'provider', method: 'card', amount: '10.00', currency: 'EUR', effectiveAt: new Date() }, validFinancialContext, validActorId),
    (err: any) => err instanceof PaymentValidationError && /providerKey/i.test(err.message)
  );

  assert.throws(
    () => normalizeConfirmIncomingPaymentIntent({ sourceType: 'provider', providerKey: 'adyen', method: 'card', amount: '10.00', currency: 'EUR', effectiveAt: new Date() }, validFinancialContext, validActorId),
    (err: any) => err instanceof PaymentValidationError && /providerEventId/i.test(err.message)
  );
}

// 7. Policy checks
{
  assert.equal(canAccessPayments('institution_admin', 'read'), true);
  assert.equal(canAccessPayments('financial', 'read'), true);
  assert.equal(canAccessPayments('director', 'read'), true);
  assert.equal(canAccessPayments('teacher', 'read'), false);
  assert.equal(canAccessPayments('student', 'read'), false);
  assert.equal(canAccessPayments('parent', 'read'), false);

  assert.equal(canAccessPayments('institution_admin', 'write'), true);
  assert.equal(canAccessPayments('financial', 'write'), true);
  assert.equal(canAccessPayments('director', 'write'), false);

  assert.equal(canAccessPayments('institution_admin', 'provider_admin'), true);
  assert.equal(canAccessPayments('financial', 'provider_admin'), true);
  assert.equal(canAccessPayments('director', 'provider_admin'), false);

  assert.doesNotThrow(() => requirePaymentRole('financial', 'write'));
  assert.throws(() => requirePaymentRole('director', 'write'), /permissão/i);
  assert.throws(() => requirePaymentRole('student', 'read'), /permissão/i);
}

console.log('Finance Payment Model & Policy Domain: PASS');
