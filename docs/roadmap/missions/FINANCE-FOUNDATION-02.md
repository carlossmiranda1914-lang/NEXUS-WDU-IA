# FINANCE-FOUNDATION-02 — Institution Financial Context Minimum

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Predecessor accepted HEAD:** `8202dee1cdc7bb6878cf5b044ad2a17eb29b4798`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 2 from the approved Finance Foundation plan: the minimum server-authoritative Institution Financial Context contract required by later Finance commands.

Task 1 monetary primitives are accepted as the predecessor foundation. Do not modify Task 1 behavior unless a genuine Task 2 integration defect proves that a predecessor contract is broken; if that happens, STOP and report before widening scope.

## Required method

Use strict TDD:

1. Inspect `src/auth/institutional-context.ts` and the approved Task 2 contract.
2. Write `tests/finance-financial-context.test.ts` first.
3. Execute it and observe a valid RED caused by the missing financial-context implementation.
4. Implement the minimum `src/modules/finance/financial-context.ts` needed to satisfy the approved contract.
5. Run targeted GREEN and affected tenant/context regression gates.
6. Commit and push only after all Task 2 gates pass.
7. Stop before Task 3.

## Authorized files

Create:

- `src/modules/finance/financial-context.ts`
- `tests/finance-financial-context.test.ts`

May update:

- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

Read/integrate only unless a proved blocker requires adjudication:

- `src/auth/institutional-context.ts`
- Task 1 Finance monetary primitives

No other production file is authorized for modification by default.

## Required interface

```ts
export interface InstitutionFinancialProfileVersion {
  institutionId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  primaryJurisdiction: string;
  functionalCurrency: string;
  financialTimezone: string;
  monetaryPolicyVersion: string;
  enabledCurrencies: readonly string[];
}

export interface FinancialProfileStore {
  resolveEffective(
    institutionId: string,
    at: Date,
  ): Promise<InstitutionFinancialProfileVersion | null>;
}

export async function requireFinancialContext(input: {
  institutionalContext: {
    institutionId: string;
    personId: string;
    role: string;
  };
  effectiveAt: Date;
  store: FinancialProfileStore;
  requiredCurrency?: string;
}): Promise<InstitutionFinancialProfileVersion>;
```

## Required invariants

- Institution identity comes exclusively from already-resolved server-side `InstitutionalContext`; do not accept a second caller-supplied institution authority.
- Missing profile fails closed.
- Not-yet-effective profile fails closed.
- Expired profile fails closed.
- Profile `institutionId` must match resolved `InstitutionalContext.institutionId`; mismatch fails closed.
- `functionalCurrency` must be recognized by `canonicalCurrencyRegistry`.
- Every enabled currency must be recognized by `canonicalCurrencyRegistry`.
- If `requiredCurrency` is supplied, it must be recognized and enabled for the effective profile.
- No jurisdiction, currency, timezone, policy or provider default is invented.
- Jurisdiction and currency remain separate axes; country/jurisdiction does not imply provider or currency enablement.
- Return the effective profile semantics without mutating it.
- This task does not persist profiles; PostgreSQL schema belongs to Task 3.

## Mandatory RED/GREEN behaviors

The first test must characterize at least:

```text
no profile
=> reject/fail closed

profile institution != InstitutionalContext institution
=> reject/fail closed

profile effectiveFrom after requested effectiveAt
=> reject/fail closed

profile effectiveTo at/before effectiveAt
=> reject/fail closed

unknown functionalCurrency
=> reject/fail closed

unknown enabled currency
=> reject/fail closed

requiredCurrency recognized but not enabled
=> reject/fail closed

matching effective profile + enabled requiredCurrency
=> return profile

same store contains another institution profile
=> resolver still queries only resolved InstitutionalContext.institutionId
```

Add boundary tests for effective intervals. Use a deterministic rule: `effectiveFrom <= at` and `(effectiveTo == null || at < effectiveTo)`.

## Forbidden scope

Do not create or modify:

- Finance PostgreSQL migrations or profile tables;
- Journal/domain repository/Finance command code;
- provider integrations;
- Payment, Allocation, Reconciliation, Fiscal, Reporting or Finance UI;
- client-side institution selection as authority;
- Task 1 monetary behavior merely for convenience;
- unrelated IAM/Enrollment/ALUNOS code;
- runtime DDL;
- historical migrations;
- CI/workflow safeguards.

## Required commands

Before production implementation:

```bash
npx tsx tests/finance-financial-context.test.ts
```

Expected initial state: RED due to missing `financial-context.ts`/behavior. Record the exact RED in the progress record.

After implementation:

```bash
npx tsx tests/finance-financial-context.test.ts
npm run test:fnd03
npm run lint
git diff --check
```

Because this task adds production TypeScript used by later Finance work, also run:

```bash
npm run build
```

All applicable commands must PASS before commit.

## STOP conditions

STOP and report without workaround if:

- `src/auth/institutional-context.ts` does not provide a stable server-authoritative context compatible with the approved Finance contract;
- implementing Task 2 requires a Finance database/profile persistence schema;
- a required currency/jurisdiction/provider default would need to be invented;
- a tenant boundary cannot be proven with the authorized contract;
- Task 1 monetary contract appears materially broken;
- a baseline failure blocks required gates and is not caused by Task 2;
- the smallest correct change requires modifying unrelated IAM/Enrollment authority.

## DONE definition

`FINANCE-FOUNDATION-02` is DONE only when:

- valid RED is observed and recorded;
- all mandatory context policy behaviors are GREEN;
- institution authority remains server-derived and single-source;
- no hidden defaults exist;
- `npm run test:fnd03` PASS;
- `npm run lint` PASS;
- `npm run build` PASS;
- `git diff --check` PASS;
- worktree is clean after commit;
- exact commit SHA is pushed and recorded;
- Task 3 has not started.
