# FINANCE-F7 Official Financial Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement official financial/fiscal document issuance over existing Nexus Finance truth without creating a second authority for Obligation, Payment, Allocation, Financial Profile, IAM or tenant context.

**Architecture:** Financial Document is a separate institution-scoped PostgreSQL authority. Issuance resolves the effective Financial Profile and jurisdiction adapter server-side, re-reads authoritative source facts, validates institutional fiscal configuration, allocates a series number atomically, persists immutable snapshots/provenance/audit/outbox in one transaction, and returns an authoritative post-commit projection. Rendering is downstream evidence and never recalculates Finance truth.

**Tech Stack:** TypeScript, Node/Express, PostgreSQL, existing Nexus Finance/IAM/Audit/Outbox patterns, React/Vite, existing test/browser harnesses.

**Spec:** `docs/superpowers/specs/2026-09-08-finance-f7-financial-documents-design.md`

## Global Constraints

- BLOCKED until exact accepted F1-F6 baseline is identified and clean local/remote parity is proven. Current docs branch is based on GitHub `main` `02b7f0a454df922598b56660ce10216956539939`; prior accepted execution evidence referenced a later local SHA. No force-push, destructive reset or history overwrite.
- Preserve existing Finance authorities. Financial Document never mutates Obligation, Payment, Allocation, Adjustment, Discount, Journal or Financial Profile.
- Institutional context, jurisdiction, policy, source facts and authoritative values are server-derived/reloaded. Browser sends intent only.
- Issued documents/snapshots are immutable; correction is append-only/new documentary truth.
- Numbering is PostgreSQL-authoritative, institution/series-scoped, atomic, unique and never browser-generated.
- Idempotency is mandatory; ambiguous retry recovers canonical result rather than blindly reissuing.
- Unsupported jurisdiction/incomplete fiscal config fails closed; no hidden defaults.
- No external network call while canonical Finance transaction/locks are held.
- Artifact rendering consumes immutable snapshot and never recalculates Finance truth.
- All document/source/series/correction/artifact relations are tenant-scoped/server-authorized.
- F7 preview is read-only; issued fiscal documents have no Office editing.
- Microsoft 365 implementation is outside F7; see the approved Document Platform architecture spec.
- A jurisdiction adapter requires current authoritative compliance evidence; generic architecture is not legal compliance.
- TDD: RED -> minimal implementation -> GREEN -> focused commit. Use targeted tests during tasks and aggregate regression only at integration/closure gates.

---

## Task 1: Baseline and repository-fit gate

**Inspect:** Finance domain/repositories/migrations/HTTP/UI/tests, Financial Profile, Money, Journal, idempotency, audit/outbox, IAM/InstitutionalContext and document/storage code on the reconciled baseline.

- [ ] Record `CURRENT_BRANCH`, `LOCAL_SHA`, tracked remote SHA and worktree status.
- [ ] Locate accepted F1-F6 commits/handoff and reconcile the accepted-local-vs-visible-remote discrepancy without destructive history operations.
- [ ] Prove `LOCAL_SHA == REMOTE_SHA` and clean worktree for the execution branch.
- [ ] Map exact existing paths/signatures for Financial Profile resolution, Money, Obligation, Payment, Allocation, Journal, idempotency, audit/outbox, InstitutionalContext, IAM, API errors, Finance routing and PostgreSQL/browser harnesses.
- [ ] Create a repository-fit appendix in this plan containing the exact files/interfaces to be changed by Tasks 2-8. No implementation task starts until this appendix has zero unknown paths/interfaces.
- [ ] Record conflicts as `REPOSITORY_CONFLICT_ID / APPROVED_DESIGN / CURRENT_IMPLEMENTATION / RECOMMENDATION`; stop for Product Owner adjudication if an invariant would be weakened.

**Gate:** `BASELINE_PARITY=PASS`, `WORKTREE_CLEAN=YES`, `UNKNOWN_IMPLEMENTATION_PATHS=0`, `ARCHITECTURAL_CONFLICTS=0`.

## Task 2: Financial Document core authority

**Produces:** institution-scoped document identity/lifecycle, immutable issued snapshot, source/provenance and correction relationship persistence.

- [ ] Identify exact model/repository/migration/test paths from Task 1 appendix.
- [ ] Write domain tests proving `ISSUED` cannot be destructively mutated/deleted and document operations do not mutate Payment/Allocation/Obligation; run and verify RED.
- [ ] Add minimum preparation/issued types, immutable snapshot, source references and correction relationships; run and verify GREEN.
- [ ] Write real-PostgreSQL tests for institution ownership, foreign-source rejection, immutable issued fields, correction referential integrity and rollback; verify RED.
- [ ] Add tenant-safe foreign/unique/check constraints and repository persistence using existing transaction conventions; verify GREEN.
- [ ] Commit `feat(finance): add financial document authority`.

## Task 3: Jurisdiction resolution, fiscal configuration and eligibility

**Consumes:** reconciled effective Financial Profile resolver. **Produces:** adapter registry/resolution, effective/versioned fiscal config and server-derived eligible document intents.

- [ ] Write tests proving jurisdiction comes only from effective Financial Profile; currency/provider/browser cannot select adapter; unsupported jurisdiction fails closed. Verify RED.
- [ ] Implement minimal adapter interface/registry and server-side resolver with no country-specific logic in core. Verify GREEN.
- [ ] Write PostgreSQL tests for effective/versioned fiscal config, tenant ownership and incomplete-config failure. Verify RED.
- [ ] Implement minimum fiscal config persistence/adapter validation. Verify GREEN.
- [ ] Write eligibility tests showing allowed intents derive from adapter policy + config + authoritative source state. Verify RED.
- [ ] Implement minimum eligibility service. Verify GREEN.
- [ ] Commit `feat(finance): add fiscal policy and configuration authority`.

## Task 4: Series, numbering, issuance transaction and idempotency

- [ ] Write PostgreSQL tests proving used series history cannot be redefined, `(institution, series, number)` duplicates are DB-prohibited and number assignment occurs only on issuance. Verify RED.
- [ ] Implement minimum series/numbering persistence. Verify GREEN.
- [ ] Write issuance transaction tests for source reload, profile/policy/config provenance, authoritative Money snapshot, document+number+provenance+audit/outbox atomicity and rollback. Verify RED.
- [ ] Implement issuance inside the existing Finance transaction boundary and document one lock order derived from existing Payment/Allocation conventions. Verify GREEN.
- [ ] Write idempotency tests: same scoped command/key -> original result; mismatched fingerprint -> existing Finance rejection semantics. Verify RED, integrate existing idempotency authority, verify GREEN.
- [ ] Write concurrency tests: different docs/same series -> unique valid numbers; same command -> one doc/number; same single-issuance semantic source -> policy-safe one result; concurrent source mutation -> coherent issue or fail closed.
- [ ] Verify concurrency GREEN under the deterministic harness.
- [ ] Commit `feat(finance): add atomic fiscal document issuance`.

## Task 5: HTTP, IAM, read model and correction workflow

- [ ] Reuse existing IAM capability naming; define separate read, issue, correction, fiscal-config read/manage and series read/manage capabilities. No parallel auth framework.
- [ ] Write HTTP tests for unauthenticated, missing capability, authorized success and server-derived institution. Verify RED; implement minimum routes/services; verify GREEN.
- [ ] Write cross-tenant negative tests for foreign Payment, Obligation, Allocation, series, document, correction target and artifact IDs. Verify RED; implement same-institution/non-disclosing validation; verify GREEN.
- [ ] Write correction tests proving original issued document remains stable, corrective document is new authority, relationship is first-class and economic authorities are not rewritten. Verify RED; implement policy-driven correction command; verify GREEN.
- [ ] Add list/detail projection with source provenance/correction navigation and focused tests.
- [ ] Commit `feat(finance): expose authorized financial documents`.

## Task 6: Official artifact rendering and integrity

- [ ] Write tests proving renderer consumes issued snapshot/provenance, not live financial/profile values, and cannot alter authority. Verify RED; implement minimal versioned renderer; verify GREEN.
- [ ] Write artifact persistence tests for `documentId`, `renderVersion`, `templateVersion`, `generatedAt`, `contentHash`, `storageReference`, `mediaType`, `byteSize` and cross-tenant denial. Verify RED; implement persistence/private authorized retrieval; verify GREEN.
- [ ] Test issuance success + artifact generation failure: document remains ISSUED; artifact failure is retryable from immutable snapshot without second document/number. Verify GREEN.
- [ ] Test integrity mismatch/missing artifact without silent replacement.
- [ ] Commit `feat(finance): add official document artifact evidence`.

## Task 7: Minimal operational UX

- [ ] Write UI/client tests proving eligible actions are server-derived and ineligible actions are not presented as valid. Verify RED; implement minimum source-context/workspace integration; verify GREEN.
- [ ] Add read-only preview; no editable authoritative amount/tax/jurisdiction/number fields.
- [ ] Add permission-aware actionable configuration errors and no optimistic fiscal success.
- [ ] Add double-click protection and ambiguous-timeout recovery through idempotent authoritative lookup.
- [ ] Add source->document and document->source/correction navigation.
- [ ] Official financial actions: View/PDF/Print/Provenance/History and policy-authorized correction only; no Word/Excel/PowerPoint editing.
- [ ] Run focused UI/client tests and commit `feat(finance): add financial document workflow`.

## Task 8: Jurisdiction adapter v1 compliance gate

**Precondition:** Product Owner selects first enabled jurisdiction scope after current authoritative legal evidence is assembled.

- [ ] Produce evidence matrix with authority, publication/effective date, access date, requirement mapping and unresolved ambiguity. Memory/generic articles are not compliance evidence.
- [ ] Obtain explicit Product Owner approval of enabled adapter scope.
- [ ] Translate only evidenced requirements into supported types, required fields, series/number rules, eligibility, correction/cancellation, gap rules and mandatory artifact content.
- [ ] Write failing adapter tests linked to evidence IDs; verify RED; implement minimal adapter policy; verify GREEN.
- [ ] Prove unsupported/unconfigured jurisdictions fail closed.
- [ ] Commit adapter and evidence together: `feat(finance): add evidenced fiscal jurisdiction adapter`.

## Task 9: Integrated persistence, security and Product UAT

- [ ] UAT-01 Real issuance through normal UI. Prove I01/I03/I04/I05/I08/I09/I19.
- [ ] UAT-02 Refresh, logout/login and application restart recover same identity/series/number/snapshot/provenance. Prove I02/I10/I11/I20.
- [ ] UAT-03 Incomplete config fails closed with actionable recovery and no fake success. Prove I03/I04/I19.
- [ ] UAT-04 Distinct capabilities prove read does not imply issue/correct/configure and tampering cannot bypass server. Prove I14/I19.
- [ ] UAT-05 Double-click, same idempotency key, concurrent series issuance and ambiguous timeout preserve exactly-once semantics. Prove I05/I06/I07/I09/I19.
- [ ] UAT-06 Institution A cannot use/read B's Payment/Obligation/Allocation/series/document/correction/artifact. Prove I13/I14.
- [ ] UAT-07 Later legitimate financial change never rewrites original; policy consequence/correction chain is visible. Prove I01/I02/I10/I11/I12.
- [ ] UAT-08 Visually inspect real PDF: issuer/institution, recipient, type, series/number, date, currency, lines/descriptions, values, required fiscal information, correction refs and professional legibility; verify hash and immutable-snapshot rendering. Prove I15/I16/I17/I18.
- [ ] Run Finance aggregate regression once, then Foundation regression, lint and production build.
- [ ] Record exact command/result/SHA evidence for every invariant/UAT. Test names, HTTP 200, screenshots or PDF byte counts alone are insufficient.
- [ ] Obtain explicit Human UAT acceptance.

## Task 10: Closure

Required closure report:

```text
FINANCE_F7_01_IMPLEMENTATION=DONE
TRACEABILITY_MATRIX=PASS
DECISIONS_TRACEABLE=13/13
INVARIANTS_PROVEN=20/20
CANONICAL_UAT=8/8
DOMAIN_INVARIANTS=PASS
POSTGRESQL_AUTHORITY=PASS
ISSUANCE_ATOMICITY=PASS
IMMUTABILITY=PASS
IDEMPOTENCY=PASS
NUMBERING_INTEGRITY=PASS
CONCURRENCY=PASS
FINANCIAL_TRUTH_PRESERVATION=PASS
DOCUMENT_PROVENANCE=PASS
CORRECTION_CHAIN=PASS
IAM_AUTHORIZATION=PASS
TENANT_ISOLATION=PASS
NEGATIVE_SECURITY=PASS
FISCAL_PROFILE_INTEGRATION=PASS
JURISDICTION_POLICY=PASS
FISCAL_CONFIGURATION=PASS
ARTEFACT_INTEGRITY=PASS
REAL_PDF_GATE=PASS
PERSISTENCE_RESTART_GATE=PASS
HTTP_OPERATIONAL_GATE=PASS
REAL_BROWSER_GATE=PASS
FINANCE_REGRESSION=PASS
FOUNDATION_REGRESSION=PASS
LINT=PASS
BUILD=PASS
UNPROVEN_INVARIANTS=0
UNMAPPED_IMPLEMENTATION=0
PASS_WITHOUT_EVIDENCE=0
P0_OPEN=0
P1_OPEN=0
HUMAN_UAT=ACCEPTED
FINANCE_F7_01=CLOSED
```

Normal flow may not require SQL, Postman, DevTools or test helpers. Technical PASS with failed Product UAT is NOT CLOSED.

## Execution handoff

This plan is **PRE-EXECUTION** until Task 1 resolves the baseline discrepancy and adds exact repository paths/interfaces. This is a hard safety gate, not permission for an implementer to guess. After Task 1 passes, Tasks 2-9 execute with TDD, focused commits and review gates. Any second authority, destructive historical mutation, hidden jurisdiction default, network call inside Finance locks or unsupported legal assumption is a STOP condition requiring Product Owner adjudication.
