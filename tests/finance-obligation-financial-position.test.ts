import assert from 'node:assert/strict';
import { Money } from '../src/modules/finance/money.ts';
import { deriveObligationFinancialPosition } from '../src/modules/finance/obligation-financial-position.ts';

const eur = (amount: string) => Money.parse(amount, 'EUR');

// 1. Existing baseline with adjustments and allocations
const pos1 = deriveObligationFinancialPosition({
  original: eur('100'),
  adjustments: [
    { direction: 'decrease' as const, amount: eur('20') },
    { direction: 'increase' as const, amount: eur('10') },
  ],
  discounts: [],
  discountRevocations: [],
  allocations: [eur('50')],
  allocationReversals: [eur('10')],
});
assert.deepEqual(pos1.netAdjustments.serialize(), { amount: '-10', currency: 'EUR' });
assert.deepEqual(pos1.grossDiscounts.serialize(), { amount: '0', currency: 'EUR' });
assert.deepEqual(pos1.revokedDiscounts.serialize(), { amount: '0', currency: 'EUR' });
assert.deepEqual(pos1.netDiscounts.serialize(), { amount: '0', currency: 'EUR' });
assert.deepEqual(pos1.effectiveDue.serialize(), { amount: '90', currency: 'EUR' });
assert.deepEqual(pos1.netCovered.serialize(), { amount: '40', currency: 'EUR' });
assert.deepEqual(pos1.remainingCoverable.serialize(), { amount: '50', currency: 'EUR' });

// 2. Position with applied discount
const pos2 = deriveObligationFinancialPosition({
  original: eur('100'),
  adjustments: [],
  discounts: [{ id: 'd-1', amount: eur('20') }],
  discountRevocations: [],
  allocations: [eur('40')],
  allocationReversals: [],
});
assert.deepEqual(pos2.grossDiscounts.serialize(), { amount: '20', currency: 'EUR' });
assert.deepEqual(pos2.revokedDiscounts.serialize(), { amount: '0', currency: 'EUR' });
assert.deepEqual(pos2.netDiscounts.serialize(), { amount: '20', currency: 'EUR' });
assert.deepEqual(pos2.effectiveDue.serialize(), { amount: '80', currency: 'EUR' });
assert.deepEqual(pos2.netCovered.serialize(), { amount: '40', currency: 'EUR' });
assert.deepEqual(pos2.remainingCoverable.serialize(), { amount: '40', currency: 'EUR' });

// 3. Position after discount revocation (compensating fact)
const pos3 = deriveObligationFinancialPosition({
  original: eur('100'),
  adjustments: [],
  discounts: [{ id: 'd-1', amount: eur('20') }],
  discountRevocations: [{ originalDiscountId: 'd-1', amount: eur('20') }],
  allocations: [eur('40')],
  allocationReversals: [],
});
assert.deepEqual(pos3.grossDiscounts.serialize(), { amount: '20', currency: 'EUR' });
assert.deepEqual(pos3.revokedDiscounts.serialize(), { amount: '20', currency: 'EUR' });
assert.deepEqual(pos3.netDiscounts.serialize(), { amount: '0', currency: 'EUR' });
assert.deepEqual(pos3.effectiveDue.serialize(), { amount: '100', currency: 'EUR' });
assert.deepEqual(pos3.remainingCoverable.serialize(), { amount: '60', currency: 'EUR' });

// 4. Combined adjustments and discounts: 100 original + 10 adjustment - 20 discount = 90 effectiveDue
const pos4 = deriveObligationFinancialPosition({
  original: eur('100'),
  adjustments: [{ direction: 'increase' as const, amount: eur('10') }],
  discounts: [{ id: 'd-1', amount: eur('20') }],
  discountRevocations: [],
  allocations: [eur('30')],
  allocationReversals: [],
});
assert.deepEqual(pos4.effectiveDue.serialize(), { amount: '90', currency: 'EUR' });
assert.deepEqual(pos4.remainingCoverable.serialize(), { amount: '60', currency: 'EUR' });

// 5. Covered floor invariant violation: 70 EUR discount when 40 EUR covered on 100 EUR charge
assert.throws(
  () =>
    deriveObligationFinancialPosition({
      original: eur('100'),
      adjustments: [],
      discounts: [{ id: 'd-1', amount: eur('70') }],
      discountRevocations: [],
      allocations: [eur('40')],
      allocationReversals: [],
    }),
  /covered|below covered/i
);

console.log('finance-obligation-financial-position: PASS');
