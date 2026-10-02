# NEXUS Project State

Updated: 2026-09-22

## Integrated baseline

`main @ 4dfaf8ef3a9d0deea681af89bdc29f5e7cf4b7b9` is the current integrated capability authority. Documents Foundation I1–I8 are integrated via PR #102: Tasks I1–I8 are DONE, P0 = 0, P1 = 0, and I8 status is CLOSED. Finance Foundation is integrated: Tasks 1–8 are DONE, P0 = 0, P1 = 0.

## Documents Foundation — I1–I8 closed & integrated

Documents Foundation Tasks I1–I8 are integrated in `main` through PR #102.

- Integration merge commit: `4dfaf8ef3a9d0deea681af89bdc29f5e7cf4b7b9`
- Scope completed: Core data model, multi-entity association, upload & verification engine, events & activity log, API layer, and UI Workspace.
- Status: IMPLEMENTATION INTEGRATED. This is not, by itself, a claim of
  completed Human UAT or production operation.
- Authority: Documents owns document identity/version/provenance, technical
  state, storage references, retention metadata, and technical audit evidence.
  IAM owns identity/access context; Enrollment owns enrollment decisions and
  existing `enrollment_documents`; Finance owns fiscal-document semantics and
  financial truth.
- Transitional boundary: generic `uploaded_documents`, AI direct generation,
  and browser/local-storage document behavior remain legacy/transitional with
  no new consumers. M365/SharePoint remains deferred.

## Documents Foundation I8C — implementation evidence, operational gate open

- Program: `DOCUMENTS`
- Mission: `DOCUMENTS-FOUNDATION-I8C` (`DOCUMENTS_OPERATIONAL_INFRASTRUCTURE_ENABLEMENT`)
- State: `IMPLEMENTATION_COMPLETE`; `PRODUCTION_OPERATIONAL=NOT_YET_EVIDENCED`;
  `HUMAN_UAT=NOT_YET_EVIDENCED`.
- Active PR: `PR #103` (`feature/documents-foundation-i8c-gcp-operational`)
- Baseline: `4dfaf8ef3a9d0deea681af89bdc29f5e7cf4b7b9`
- Current I8C HEAD: `3ec6848777478a0933e819392975e5cb7d78b3ba`
- Scope: Production GCP runtime integration using official `@google-cloud/storage` SDK (v8.1.0) with Application Default Credentials (ADC), server-mediated streaming, SHA-256 roundtrip persistence via GCS custom metadata, and fail-closed runtime configuration resolution.
- GCP capability is code-level implementation evidence, not proof that an ADC
  identity, bucket, deployment, or production runtime has been validated.
- Next Phase (I9): `NOT AUTHORIZED`

## Finance Foundation — closed

Finance Foundation Tasks 1–8 are integrated in `main` through PR #89.

Accepted exact Finance implementation/review checkpoint before merge:

`74d575a574bb4e3dd3cf9652327c6f1c665f393b`

Integration merge commit:

`3636c5054ce98a1f4f7990a5f7aafdde1ff22bcc`

Accepted outcome:

- P0 = 0
- P1 = 0
- P1-1 outbox tenant scope: CLOSED with explicit A/B PostgreSQL proof
- P1-2 guarded reversal confirmation: CLOSED
- aggregate Finance Foundation gate: PASS
- FND03 tenant regression: PASS
- lint/build/diff: PASS
- PR #89 CI: PASS
- Finance Foundation Integration Sync Gate: COMPLETE

The former Integration Sync Gate is closed. Do not rerun it and do not treat `codex/finance-foundation-01` as active implementation authority.

## Finance F7 capability state — canonical integrated baseline

Canonical baseline: `codex/nexus-integrated-portal-v1 @ 47ad75d549bebfa5aa3409965800ca225f39e218`.

- Finance Foundation and F1–F6: `PROVEN`.
- Finance F7 capability: `PROVEN`.
- Task 7 — Factura-Recibo from Obligation + Payment + valid Settlement Relationship: `PROVEN` / `CLOSED`.
- Task 8 — Evidence-Backed Nota de Crédito: `PROVEN` / `CLOSED`.
- Task 9 — Nota de Débito from explicit policy semantics: `PARTIAL` / `ACTIVE`; its separate issuance, artifact and Human-UAT closure remains governed by `docs/superpowers/plans/2026-09-17-finance-f7-task9-debit-event-basis.md` and `docs/superpowers/specs/2026-09-17-finance-f7-task9-debit-event-basis-design.md`.
- H1 payment-allocation projection: `FIXED`.
- H2 obligation/allocation read-model coherence, H3 payment-to-financial-document discoverability, and H4 relationship/context wiring: `DEFERRED_DEBT`. They do not retroactively reopen Task 7 or Task 8.

Existing Finance evidence includes the F7 coherence plan (`docs/superpowers/plans/2026-09-16-finance-f7-coherence-solidification.md`), the Task 9 design/specification, and the Task 7/8 closure references in `docs/operations/NEXUS_EXECUTION_CONTRACT_PILOT.md`.

## Finance manual payment destination — unintegrated worktree checkpoint

This is a bounded correction checkpoint, not an update to the integrated baseline.

- Scope: new `manual_offline` confirmations require an active financial account of the active institution before financial writes in `payment-service.ts` and `confirmPaymentInCommand` in `payment-repository.ts`.
- Authorization reconciliation (2026-10-02): recorded after the existing correction; it covers only those two guards, the associated frontend flow, and directly affected tests. It is not technical approval, integration approval, or UAT.
- Existing idempotent historical replay, nullable historical reads, and provider-origin treatment remain preserved.
- `INDEPENDENT_REVIEW=PENDING`; `HUMAN_UAT_GREEN=BLOCKED` until the isolated checkpoint is reviewed and formal-UAT conditions are satisfied.

## Deferred / Planned stages

- **Documents I9**: `NOT AUTHORIZED` / `NOT STARTED`.

## Protected domain invariants

### Documents Invariants
- Institutional multi-tenant isolation mandatory on all read and write paths.
- Server-mediated streaming by default with zero browser storage credentials exposure.
- Fail-closed runtime configuration on missing or invalid secrets/buckets.
- SHA-256 digest preservation across write stream, storage metadata, and completion.
- Fail-closed retention, hold, and deletion enforcement.

### Finance Invariants
- Journal remains canonical economic truth.
- Projection remains confirmed-only rebuildable read authority.
- Exact Money and currency separation remain enforced.
- Financial context remains server-authoritative and fail closed.
- Idempotency, concurrency, reversal, recovery, durable outbox and tenant isolation remain PostgreSQL-backed.
- Legacy `outstandingFees` remains non-canonical Finance authority.
- Migration history remains immutable.
- Finance Foundation Tasks 1–8 are not reopened without concrete regression evidence and explicit authorization.

## Engineering governance

Operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**
