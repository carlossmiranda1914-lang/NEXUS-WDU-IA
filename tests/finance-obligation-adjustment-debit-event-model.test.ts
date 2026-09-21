import assert from 'node:assert/strict';
import {
  createObligationAdjustmentFingerprint,
  normalizeRecordObligationAdjustmentCommand,
} from '../src/modules/finance/obligation-adjustment-model.ts';

const base = {
  obligationId: 'obligation-1',
  direction: 'increase',
  amount: '10.00',
  currency: 'EUR',
  reason: 'Aumento factual',
} as const;

const omittedBasis = normalizeRecordObligationAdjustmentCommand(base);
const explicitGeneral = normalizeRecordObligationAdjustmentCommand({ ...base, basisType: 'general' });
const debitEvent = normalizeRecordObligationAdjustmentCommand({ ...base, basisType: 'debit_event' });

assert.equal(omittedBasis.basisType, 'general');
assert.equal(debitEvent.basisType, 'debit_event');
assert.throws(
  () => normalizeRecordObligationAdjustmentCommand({ ...base, direction: 'decrease', basisType: 'debit_event' }),
  /debit/i,
);
assert.throws(() => normalizeRecordObligationAdjustmentCommand({ ...base, basisType: 'invoice' }), /basis/i);

assert.equal(
  createObligationAdjustmentFingerprint('institution-1', omittedBasis),
  createObligationAdjustmentFingerprint('institution-1', explicitGeneral),
);
assert.notEqual(
  createObligationAdjustmentFingerprint('institution-1', explicitGeneral),
  createObligationAdjustmentFingerprint('institution-1', debitEvent),
);

console.log('FINANCE_OBLIGATION_ADJUSTMENT_DEBIT_EVENT_MODEL=PASS');
