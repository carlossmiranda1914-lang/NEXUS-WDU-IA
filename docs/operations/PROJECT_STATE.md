# NEXUS Project State

Updated: 2026-09-12

## Integrated baseline

`main @ 4dfaf8ef3a9d0deea681af89bdc29f5e7cf4b7b9` is the current integrated capability authority. Documents Foundation I1–I8 are integrated via PR #102: Tasks I1–I8 are DONE, P0 = 0, P1 = 0, and I8 status is CLOSED. Finance Foundation is integrated: Tasks 1–8 are DONE, P0 = 0, P1 = 0.

## Documents Foundation — I1–I8 closed & integrated

Documents Foundation Tasks I1–I8 are integrated in `main` through PR #102.

- Integration merge commit: `4dfaf8ef3a9d0deea681af89bdc29f5e7cf4b7b9`
- Scope completed: Core data model, multi-entity association, upload & verification engine, events & activity log, API layer, and UI Workspace.
- Status: CLOSED

## Current active mission — Documents Foundation I8C

- Program: `DOCUMENTS`
- Mission: `DOCUMENTS-FOUNDATION-I8C` (`DOCUMENTS_OPERATIONAL_INFRASTRUCTURE_ENABLEMENT`)
- State: `IMPLEMENTATION_COMPLETE`
- Active PR: `PR #103` (`feature/documents-foundation-i8c-gcp-operational`)
- Baseline: `4dfaf8ef3a9d0deea681af89bdc29f5e7cf4b7b9`
- Current I8C HEAD: `3ec6848777478a0933e819392975e5cb7d78b3ba`
- Scope: Production GCP runtime integration using official `@google-cloud/storage` SDK (v8.1.0) with Application Default Credentials (ADC), server-mediated streaming, SHA-256 roundtrip persistence via GCS custom metadata, and fail-closed runtime configuration resolution.
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

## Deferred / Planned stages

- **Finance F1**: `PLANNING` / `NOT STARTED` — upper-Finance functional vertical from integrated Foundation awaiting approved contract.
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
