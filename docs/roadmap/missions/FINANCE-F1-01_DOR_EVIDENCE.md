# FINANCE-F1-01 — Definition of Ready Evidence

**State:** READY_FOR_PRODUCT_OWNER_APPROVAL
**Evidence baseline:** `main @ 02b7f0a454df922598b56660ce10216956539939`
**Mission:** `docs/roadmap/missions/FINANCE-F1-01-FEE-CATALOGUE.md`

## Purpose

This record converts F1 preparation from assumptions into repository-backed readiness evidence. It is not a broad re-audit of Finance Foundation and it does not reopen accepted P0/P1 closure.

## Accepted predecessor truth — not reopened

Finance Foundation Tasks 1–8 are integrated and accepted. The project selector records P0=0/P1=0 and forbids reopening those tasks without concrete regression evidence. This F1 preparation therefore treats Foundation as a protected predecessor and only verifies interfaces F1 must consume.

## AS-IS evidence inspected

| Area | Repository evidence | F1 consequence |
| --- | --- | --- |
| Institutional context | `src/auth/institutional-context.ts` resolves active Membership + active Institution and exposes `personId`, `membershipId`, `institutionId`, `role`. | F1 tenant/actor authority comes only from resolved server context. |
| Canonical roles | `INSTITUTIONAL_ROLES = institution_admin, director, secretariat, financial, teacher, student, parent`. | Use `financial`, never invented `finance`; no legacy `admin` authority. |
| Financial Context | `src/modules/finance/financial-context.ts::requireFinancialContext()` resolves effective institution profile and validates enabled currency. | Catalogue amount currency fails closed through this existing boundary. |
| Finance idempotency | `src/modules/finance/finance-command.ts::executeIdempotentFinanceCommand()` persists `(institution, namespace, key, fingerprint, result_ref)` in `finance_command_results`. | Reuse for catalogue write retry/concurrency; do not invent process-memory idempotency. |
| Finance audit | `finance_audit_records.transaction_id` is nullable in migration `0027`; Journal confirmation already uses the table. | Catalogue administrative audit can remain institution-scoped without fabricating Journal facts or a parallel audit platform. |
| Finance Money schema | Foundation uses `NUMERIC(30,12)` plus explicit exactness constraints added by accepted migrations. | Catalogue Money must reuse the same exact persistence law. |
| Migration history | Repository migrations currently extend through `0030`; search found no `0031`. | `0031_finance_fee_catalogue.sql` is the expected next migration; execution preflight re-confirms. |
| Legacy balance | `students.outstanding_fees` remains a legacy integer field. Foundation Task 8 proved changing it does not change Journal/projection authority. | Never seed or derive catalogue state from it. |
| Legacy invoices/payments | `server.ts` legacy `/api/invoices` and `/api/invoices/pay` return `503 CANONICAL_FINANCE_AUTHORITY_REQUIRED` before persistence. | Do not revive those paths or their legacy `admin`/role model for F1. |
| Legacy migration import | `/api/migration/execute` still materializes legacy students/invoices from imported outstanding fees. | This remains fenced legacy behavior; F1 catalogue must have no dependency on it. |

## Concrete readiness decisions

### D1 — First vertical

Roadmap order after Finance authority/ledger is fee/emolument catalogue, then obligation/charge rules. Therefore F1-01 is catalogue only; it does not assign money due to a student.

### D2 — Role policy

The repository proves the canonical role names but does not contain an accepted Finance catalogue capability matrix. F1 therefore closes that product policy explicitly rather than leaving it to Codex inference:

- `institution_admin`: read/write
- `financial`: read/write
- `director`: read only
- all other canonical roles: deny

This is least privilege for catalogue administration and does not modify the global role vocabulary.

### D3 — Version model

Catalogue item identity/code/lifecycle are separated from effective commercial versions. Editing amount/name/description/kind closes the previous version and creates N+1 atomically. This prevents later obligations from losing the definition they were based on.

### D4 — Administrative, not economic

Catalogue mutation is configuration. It may write catalogue tables, Finance command result and Finance audit provenance, but it must create no confirmed Journal transaction and must not move `finance_position_projection`.

### D5 — Idempotency/concurrency

Catalogue writes use the existing PostgreSQL Finance command identity/fingerprint pattern. Versioned edit additionally uses row lock + expected current version so two conflicting edits cannot both become the current head.

### D6 — Legacy fence

F1 never reads `students.outstanding_fees` or legacy `invoices` as catalogue truth. Existing fenced invoice/payment endpoints remain untouched unless a targeted F1 regression proves accidental coupling.

## P0/P1 status at F1 readiness boundary

There is **no evidence of an unresolved inherited Finance Foundation P0 or P1** at this baseline; governance explicitly records the accepted predecessor as P0=0/P1=0. This preparation did not discover a new Foundation regression and therefore does not reopen Foundation.

The repository did expose two F1 design gaps that would have become implementation ambiguity if left unresolved: the Finance catalogue role matrix was not canonical, and the catalogue version/persistence shape did not yet exist. They are not inherited defects in merged product behavior because F1 has not been implemented; they are readiness decisions. Both are now fixed in the F1 mission contract above.

## Definition of Ready

F1-01 is ready for Product Owner approval because:

- predecessor Foundation authority is accepted and protected;
- exact server tenant/person/role context is known;
- exact canonical role vocabulary is known;
- Financial Context/currency boundary is known;
- Money/idempotency/audit persistence contracts to reuse are known;
- next expected migration is known and has an execution-time collision check;
- legacy Finance paths to keep fenced are identified;
- role policy is fixed;
- catalogue item/version/lifecycle persistence semantics are fixed;
- HTTP/UI outcome, negative tests, PostgreSQL proof and UAT are fixed;
- obligation/payment/invoice scope is explicitly excluded.

No additional broad repository audit is required before writing the implementation plan. A new investigation is justified only by a concrete contradiction found while mapping exact implementation files or by a RED during execution.