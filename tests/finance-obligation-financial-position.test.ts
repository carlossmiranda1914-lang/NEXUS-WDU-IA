import assert from 'node:assert/strict';
import { Money } from '../src/modules/finance/money.ts';
import { deriveObligationFinancialPosition } from '../src/modules/finance/obligation-financial-position.ts';

const eur = (amount: string) => Money.parse(amount, 'EUR');
const position = deriveObligationFinancialPosition({
  original: eur('100'),
  adjustments: [{ direction: 'decrease' as const, amount: eur('20') }, { direction: 'increase' as const, amount: eur('10') }],
  allocations: [eur('50')],
  allocationReversals: [eur('10')],
});
assert.deepEqual(position.netAdjustments.serialize(), { amount: '-10', currency: 'EUR' });
assert.deepEqual(position.effectiveDue.serialize(), { amount: '90', currency: 'EUR' });
assert.deepEqual(position.netCovered.serialize(), { amount: '40', currency: 'EUR' });
assert.deepEqual(position.remainingCoverable.serialize(), { amount: '50', currency: 'EUR' });
assert.throws(() => deriveObligationFinancialPosition({ original: eur('100'), adjustments: [{ direction: 'decrease' as const, amount: eur('70') }], allocations: [eur('40')], allocationReversals: [] }), /covered/i);
console.log('finance-obligation-financial-position: PASS');
