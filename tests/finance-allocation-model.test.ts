import assert from 'node:assert/strict';
import {
  AllocationValidationError,
  deriveObligationCoveragePosition,
  derivePaymentAllocationPosition,
  normalizeConfirmAllocationInput,
  normalizeReverseAllocationInput,
} from '../src/modules/finance/allocation-model.ts';
import { Money } from '../src/modules/finance/money.ts';
import { validateConfirmation } from '../src/modules/finance/journal-model.ts';

const money = (amount: string, currency = 'EUR') => Money.parse(amount, currency);
const payment = { id: 'payment-1', institutionId: 'institution-1', financialAccountId: 'account-1', currency: 'EUR', remainingAllocatable: money('150.00') };
const obligation = (id: string, remainingCoverable = '100.00', currency = 'EUR', financialAccountId = 'account-1') => ({
  id, institutionId: 'institution-1', financialAccountId, currency, remainingCoverable: money(remainingCoverable, currency),
});

assert.equal(derivePaymentAllocationPosition('150.00', '0.00', 'EUR').state, 'unapplied');
assert.equal(derivePaymentAllocationPosition('150.00', '130.00', 'EUR').state, 'partially_allocated');
assert.equal(derivePaymentAllocationPosition('150.00', '150.00', 'EUR').state, 'fully_allocated');
assert.deepEqual(derivePaymentAllocationPosition('150.00', '130.00', 'EUR'), {
  state: 'partially_allocated', allocated: money('130'), unapplied: money('20'),
});

assert.equal(deriveObligationCoveragePosition('100.00', '0.00', 'EUR').state, 'open');
assert.equal(deriveObligationCoveragePosition('100.00', '40.00', 'EUR').state, 'partially_covered');
assert.equal(deriveObligationCoveragePosition('100.00', '100.00', 'EUR').state, 'covered');
assert.deepEqual(deriveObligationCoveragePosition('100.00', '40.00', 'EUR'), {
  state: 'partially_covered', covered: money('40'), uncovered: money('60'),
});

const normalized = normalizeConfirmAllocationInput({
  payment,
  lines: [
    { obligation: obligation('obligation-a'), amount: money('100.00') },
    { obligation: obligation('obligation-b', '30.00'), amount: money('20.00') },
  ],
  effectiveAt: new Date('2026-09-06T10:00:00.000Z'),
});
assert.equal(normalized.total.canonicalAmount(), '120');
assert.deepEqual(normalized.lines.map(line => line.amount.canonicalAmount()), ['100', '20']);

for (const amount of ['0', '-0.01']) {
  assert.throws(() => normalizeConfirmAllocationInput({ payment, lines: [{ obligation: obligation('obligation-a'), amount: money(amount) }], effectiveAt: new Date() }), AllocationValidationError);
}
assert.throws(() => normalizeConfirmAllocationInput({ payment, lines: [{ obligation: obligation('obligation-a', '100.00', 'USD'), amount: money('1') }], effectiveAt: new Date() }), /currency/i);
assert.throws(() => normalizeConfirmAllocationInput({ payment, lines: [{ obligation: obligation('obligation-a', '200.00'), amount: money('151') }], effectiveAt: new Date() }), /payment.*remaining/i);
assert.throws(() => normalizeConfirmAllocationInput({ payment, lines: [{ obligation: obligation('obligation-a', '99.99'), amount: money('100') }], effectiveAt: new Date() }), /obligation.*remaining/i);
assert.throws(() => normalizeConfirmAllocationInput({ payment, lines: [{ obligation: obligation('obligation-a'), amount: money('1') }, { obligation: obligation('obligation-a'), amount: money('1') }], effectiveAt: new Date() }), /duplicate/i);
assert.throws(() => normalizeConfirmAllocationInput({ payment, lines: [{ obligation: obligation('other-account', '100', 'EUR', 'account-2'), amount: money('1') }], effectiveAt: new Date() }), /account/i);

assert.throws(() => normalizeReverseAllocationInput({ originalAllocationId: 'allocation-1', amount: money('1'), remainingReversible: money('1'), currency: 'EUR', reason: '   ', effectiveAt: new Date() }), /reason/i);
assert.throws(() => normalizeReverseAllocationInput({ originalAllocationId: 'allocation-1', amount: money('2'), remainingReversible: money('1'), currency: 'EUR', reason: 'correction', effectiveAt: new Date() }), /reversible/i);
assert.equal(normalizeReverseAllocationInput({ originalAllocationId: 'allocation-1', amount: money('1'), remainingReversible: money('1'), currency: 'EUR', reason: ' correction ', effectiveAt: new Date() }).reason, 'correction');

assert.equal(validateConfirmation({
  institutionId: 'institution-1', commandId: 'allocation-command', journalType: 'payment_allocation', effectiveAt: new Date(),
  entries: [{ positionType: 'allocated_value', money: money('1'), sourceRef: 'allocation-1' }], actorPersonId: 'actor-1', financialProfileVersion: 1,
}).amount.canonicalAmount(), '1');
assert.equal(validateConfirmation({
  institutionId: 'institution-1', commandId: 'reversal-command', journalType: 'allocation_reversal', effectiveAt: new Date(),
  entries: [{ positionType: 'released_value', money: money('1'), sourceRef: 'allocation-1' }], actorPersonId: 'actor-1', financialProfileVersion: 1,
}).amount.canonicalAmount(), '1');

console.log('Finance Allocation model: PASS');
