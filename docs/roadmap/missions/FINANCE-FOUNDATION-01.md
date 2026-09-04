# FINANCE-FOUNDATION-01 — Monetary Primitives

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Base SHA:** `13872571bf44dc74ffaaf815992317e8ead50f3f`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 1 from the approved Finance Foundation plan using strict TDD. Do not start Task 2 or later work.

## Required skills / method

Use Superpowers TDD discipline:

1. Write the failing behavior test first.
2. Execute it and verify the failure is caused by missing Finance monetary primitives.
3. Implement the minimum production code required to pass.
4. Execute the targeted tests again and verify GREEN.
5. Run lint/build/diff checks.
6. Commit only after all Task 1 gates pass.

No production code may be written before a valid RED test has been observed.

## Authorized files

Create only:

- `src/modules/finance/exact-decimal.ts`
- `src/modules/finance/money.ts`
- `src/modules/finance/currency-registry.ts`
- `src/modules/finance/finance-rates.ts`
- `src/modules/finance/quantization.ts`
- `tests/finance-money-model.test.ts`

A narrowly necessary test helper may be created only if the existing repository test conventions require it; document why in the execution record.

## Forbidden scope

Do not create or modify:

- Finance PostgreSQL migrations;
- Journal/repository/command code;
- Financial Profile persistence;
- Payment, Allocation, Reconciliation, provider, fiscal, reporting or UI code;
- legacy Finance data;
- server routes;
- runtime DDL;
- unrelated refactors.

## Required interfaces

```ts
export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';

export class ExactDecimal {
  static parse(input: string, maxPrecision: number, maxScale: number): ExactDecimal;
  static fromParts(coefficient: bigint, scale: number, maxPrecision: number, maxScale: number): ExactDecimal;
  toCanonicalString(): string;
  add(other: ExactDecimal): ExactDecimal;
  subtract(other: ExactDecimal): ExactDecimal;
  multiply(other: ExactDecimal, maxPrecision: number, maxScale: number): ExactDecimal;
  quantize(scale: number, mode: RoundingMode): ExactDecimal;
  compare(other: ExactDecimal): -1 | 0 | 1;
}

export interface CurrencyDefinition {
  code: string;
  minorUnit: number;
  status: 'active' | 'historical' | 'special';
  registryVersion: string;
}

export interface CurrencyRegistry {
  require(code: string): CurrencyDefinition;
}

export const canonicalCurrencyRegistry: CurrencyRegistry;

export class Money {
  static parse(amount: string, currency: string, registry?: CurrencyRegistry): Money;
  readonly amount: ExactDecimal;
  readonly currency: string;
  canonicalAmount(): string;
  serialize(): { amount: string; currency: string };
  equals(other: Money): boolean;
  add(other: Money): Money;
  subtract(other: Money): Money;
  compare(other: Money): -1 | 0 | 1;
}

export class DecimalRatio {
  static parse(value: string): DecimalRatio;
  readonly value: ExactDecimal;
}

export class Percentage {
  static parsePercent(value: string): Percentage;
  toRatio(): DecimalRatio;
}

export class ExchangeRate {
  static create(baseCurrency: string, quoteCurrency: string, rate: string, registry?: CurrencyRegistry): ExchangeRate;
}

export function quantizeMoneyCandidate(
  amount: ExactDecimal,
  currency: string,
  scale: number,
  mode: RoundingMode,
  registry?: CurrencyRegistry,
): Money;

export function distributeMoney(total: Money, count: number, scale: number, mode: RoundingMode): Money[];
```

## Exact rules

- Money = exact decimal + explicit recognized currency.
- Never use JavaScript `number` as authoritative monetary arithmetic.
- Internally use bigint coefficient + integer scale or another exact representation that never passes through binary floating point.
- Money max precision/scale: 30/12.
- DecimalRatio and ExchangeRate max precision/scale: 30/18.
- Strict canonical input grammar must reject scientific notation and locale formatting.
- Negative zero canonicalizes to zero.
- Leading zeroes and insignificant trailing zeroes do not affect identity.
- Same-currency add/subtract/compare only.
- Cross-currency arithmetic/comparison fails closed; `equals` across different currencies is false.
- `Money x Money` is not implemented.
- ExchangeRate is directional and strictly positive; reciprocal conversion is never implicit.
- `Percentage.parsePercent('15').toRatio()` represents `0.15`.
- Quantization is explicit.
- Distribution is deterministic and must conserve the original total exactly.
- Currency Registry is controlled and internal; for this mission seed only `EUR`, `AOA`, `USD`, `GBP` with explicit registry version. Recognition does not imply institutional enablement.

## Mandatory RED assertions

The first test file must include behavior equivalent to:

```ts
assert.equal(Money.parse('001.2300', 'EUR').canonicalAmount(), '1.23');
assert.equal(Money.parse('-0.00', 'EUR').canonicalAmount(), '0');
assert.deepEqual(Money.parse('1.0', 'EUR').serialize(), Money.parse('1.00', 'EUR').serialize());
assert.throws(() => Money.parse('1e3', 'EUR'));
assert.throws(() => Money.parse('1,20', 'EUR'));
assert.throws(() => Money.parse('1.20', 'ZZZ'));
assert.throws(() => Money.parse('1234567890123456789012345678901', 'EUR'));
assert.throws(() => Money.parse('0.1234567890123', 'EUR'));
```

Then extend GREEN coverage to prove:

- exact same-currency arithmetic;
- cross-currency add/subtract/compare rejection;
- exact normalized equality;
- normalization idempotency;
- 30/12 Money boundaries;
- 30/18 ratio/rate boundaries;
- zero/negative ExchangeRate rejection;
- direction differentiates EUR/AOA from AOA/EUR;
- percentage conversion is exact;
- explicit rounding modes behave deterministically at tie and non-tie boundaries;
- `distributeMoney(100.00 EUR, 3, 2, ...)` returns parts whose exact sum is 100 EUR and whose difference is at most one quantum.

## Required commands

Before production code:

```bash
npx tsx tests/finance-money-model.test.ts
```

Expected initial state: RED for missing production module/behavior. Record the exact failure in `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`.

After implementation:

```bash
npx tsx tests/finance-money-model.test.ts
npm run lint
npm run build
git diff --check
```

All must PASS before commit.

## Commit

Only after GREEN:

```bash
git add src/modules/finance tests/finance-money-model.test.ts .superpowers/sdd/2026-09-03-finance-foundation/progress.md
git commit -m "feat(finance): add exact monetary primitives"
```

## STOP conditions

Stop without workaround if:

- repository baseline is dirty in a way not caused by this mission;
- tests cannot execute due environment/dependency failure;
- exact arithmetic would require binary floating point authority;
- required API conflicts materially with approved F2 laws;
- implementation requires schema, Journal, provider or product-domain work;
- lint/build failure reveals a broader repository baseline failure not caused by this task.

Report the exact blocker; do not broaden scope.

## DONE definition

`FINANCE-FOUNDATION-01` is DONE only when:

- valid RED was observed and recorded;
- all authorized production files exist and remain within scope;
- all mandatory Money/ratio/rate/quantization behaviors are GREEN;
- `npm run lint` PASS;
- `npm run build` PASS;
- `git diff --check` PASS;
- no forbidden file was modified;
- exact Task 1 commit SHA is recorded;
- Task 2 has not started.
