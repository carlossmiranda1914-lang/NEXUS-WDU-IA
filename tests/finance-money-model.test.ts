import assert from 'node:assert/strict';
import { ExactDecimal } from '../src/modules/finance/exact-decimal.ts';
import { Money } from '../src/modules/finance/money.ts';
import { DecimalRatio, ExchangeRate, Percentage } from '../src/modules/finance/finance-rates.ts';
import { distributeMoney, quantizeMoneyCandidate } from '../src/modules/finance/quantization.ts';

const eur = (amount: string) => Money.parse(amount, 'EUR');

// Canonical Money parsing and identity.
assert.equal(eur('001.2300').canonicalAmount(), '1.23');
assert.equal(eur('-0.00').canonicalAmount(), '0');
assert.deepEqual(eur('1.0').serialize(), eur('1.00').serialize());
assert.throws(() => eur('1e3'));
assert.throws(() => eur('1,20'));
assert.throws(() => Money.parse('1.20', 'ZZZ'));
assert.throws(() => eur('1234567890123456789012345678901'));
assert.throws(() => eur('0.1234567890123'));
assert.equal(Money.parse(eur('001.2300').canonicalAmount(), 'EUR').canonicalAmount(), '1.23');

// Same-currency operations are exact; cross-currency operations fail closed.
assert.equal(eur('1.20').add(eur('2.03')).canonicalAmount(), '3.23');
assert.equal(eur('1.20').subtract(eur('2.03')).canonicalAmount(), '-0.83');
assert.equal(eur('1.20').compare(eur('1.2')), 0);
assert.equal(eur('1.20').equals(eur('1.200')), true);
assert.equal(eur('1.20').equals(Money.parse('1.20', 'USD')), false);
assert.throws(() => eur('1').add(Money.parse('1', 'USD')));
assert.throws(() => eur('1').subtract(Money.parse('1', 'USD')));
assert.throws(() => eur('1').compare(Money.parse('1', 'USD')));

// Representation envelopes preserve exact, canonical decimal values.
assert.equal(eur('123456789012345678.123456789012').canonicalAmount(), '123456789012345678.123456789012');
assert.throws(() => eur('1234567890123456789.123456789012'));
assert.equal(DecimalRatio.parse('123456789012.123456789012345678').value.toCanonicalString(), '123456789012.123456789012345678');
assert.throws(() => DecimalRatio.parse('0.1234567890123456789'));
assert.throws(() => DecimalRatio.parse('1234567890123.123456789012345678'));

// Rates are positive, exact and directional.
const eurToAoa = ExchangeRate.create('EUR', 'AOA', '100.5000');
const aoaToEur = ExchangeRate.create('AOA', 'EUR', '100.5');
assert.notDeepEqual(eurToAoa, aoaToEur);
assert.equal(ExchangeRate.create('EUR', 'AOA', '123456789012.123456789012345678').rate.toCanonicalString(), '123456789012.123456789012345678');
assert.throws(() => ExchangeRate.create('EUR', 'AOA', '0.1234567890123456789'));
assert.throws(() => ExchangeRate.create('EUR', 'AOA', '0'));
assert.throws(() => ExchangeRate.create('EUR', 'AOA', '-0.1'));
assert.equal(Percentage.parsePercent('15').toRatio().value.toCanonicalString(), '0.15');

// Quantization and allocation are explicit, deterministic and conserve value.
const candidate = ExactDecimal.parse('1.235', 30, 18);
assert.equal(quantizeMoneyCandidate(candidate, 'EUR', 2, 'half_up').canonicalAmount(), '1.24');
assert.equal(quantizeMoneyCandidate(candidate, 'EUR', 2, 'half_even').canonicalAmount(), '1.24');
assert.equal(quantizeMoneyCandidate(ExactDecimal.parse('1.225', 30, 18), 'EUR', 2, 'half_even').canonicalAmount(), '1.22');
assert.equal(quantizeMoneyCandidate(ExactDecimal.parse('-1.234', 30, 18), 'EUR', 2, 'down').canonicalAmount(), '-1.23');
assert.equal(quantizeMoneyCandidate(ExactDecimal.parse('-1.234', 30, 18), 'EUR', 2, 'up').canonicalAmount(), '-1.24');

const parts = distributeMoney(eur('100.00'), 3, 2, 'half_up');
assert.deepEqual(parts.map((part) => part.canonicalAmount()), ['33.34', '33.33', '33.33']);
assert.equal(parts.reduce((sum, part) => sum.add(part), eur('0')).canonicalAmount(), '100');
assert.equal(parts[0].subtract(parts[2]).canonicalAmount(), '0.01');

console.log('Finance money model: PASS');
