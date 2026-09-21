import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFinanceMoney } from '../src/modules/finance/money-presentation.ts';

test('formats exact canonical money for supported currencies without float conversion', () => {
  assert.equal(formatFinanceMoney({ amount: '0', currency: 'AOA' }), '0,00 AOA');
  assert.equal(formatFinanceMoney({ amount: '40', currency: 'AOA' }), '40,00 AOA');
  assert.equal(formatFinanceMoney({ amount: '40.5', currency: 'AOA' }), '40,50 AOA');
  assert.equal(formatFinanceMoney({ amount: '40000', currency: 'AOA' }), '40.000,00 AOA');
  assert.equal(formatFinanceMoney({ amount: '9999999999999.99', currency: 'USD' }), '9.999.999.999.999,99 USD');
  assert.equal(formatFinanceMoney({ amount: '40', currency: 'EUR' }), '40,00 EUR');
  assert.equal(formatFinanceMoney({ amount: '40', currency: 'USD' }), '40,00 USD');
});

test('preserves authoritative precision instead of rounding monetary truth for presentation', () => {
  assert.equal(formatFinanceMoney({ amount: '40.125', currency: 'AOA' }), '40,125 AOA');
});

console.log('FINANCE_MONEY_PRESENTATION=PASS');
