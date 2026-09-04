# FINANCE-F1-01 — Institutional Fee / Emolument Catalogue

**State:** READY_FOR_PRODUCT_OWNER_APPROVAL
**Program:** `FINANCE`
**Stage:** first upper-Finance functional vertical
**Planning branch:** `codex/finance-f1-fee-catalogue-prep`
**Integrated planning baseline:** `main @ 02b7f0a454df922598b56660ce10216956539939`
**Implementation branch:** not authorized until Product Owner approval
**DoR evidence:** `docs/roadmap/missions/FINANCE-F1-01_DOR_EVIDENCE.md`
**Implementation plan:** `docs/superpowers/plans/2026-09-04-finance-f1-fee-catalogue.md`

## Mission

Deliver the first real upper-Finance functional vertical after the integrated Finance Foundation: an institution-scoped, server-authoritative **Fee / Emolument Catalogue** that authorized institutional users can manage through PostgreSQL-backed API and Nexus UI.

The catalogue defines reusable charge definitions. It does **not** itself create a student's obligation, receivable, payment, allocation, invoice or Journal economic fact. Those remain later Finance missions.

The mission is complete only as one coherent vertical: domain contract -> PostgreSQL persistence -> authorization/tenant isolation -> HTTP API -> Nexus UI -> behavioral/negative proof -> human UAT -> exact-HEAD review/integration evidence.

## Verified repository contracts consumed by this mission

The mission is written against the integrated repository, not against assumed interfaces:

- Canonical active institutional context is `InstitutionalContext` from `src/auth/institutional-context.ts`; institution comes from active Membership resolution, not request-body authority.
- Canonical institutional roles are exactly `institution_admin`, `director`, `secretariat`, `financial`, `teacher`, `student`, `parent`. There is no canonical role named `finance`.
- Canonical Finance context is `requireFinancialContext()` from `src/modules/finance/financial-context.ts`; currency must be present in the effective profile's enabled currencies and the profile must match the resolved institution.
- Exact Money uses the integrated Finance Money/exact-decimal contract; authoritative amounts must not use JS floating-point arithmetic.
- `executeIdempotentFinanceCommand()` and `finance_command_results` are the existing PostgreSQL-backed Finance retry/concurrency boundary for administrative Finance commands that need idempotency.
- `finance_audit_records` already permits institution-scoped Finance audit records without requiring a Journal transaction (`transaction_id` is nullable); catalogue administrative events may reuse this authority with actor/provenance in metadata rather than creating a parallel audit platform.
- Current Finance schema has no catalogue authority. Integrated Finance migrations end at `0030`; `0031` is the next free migration number at this planning baseline and must be re-confirmed at implementation preflight.
- Legacy `students.outstanding_fees` and legacy `invoices` remain non-canonical. Legacy invoice/payment HTTP paths are fenced with `503 CANONICAL_FINANCE_AUTHORITY_REQUIRED`; they are not catalogue authority and must not be reused as such.

## User-visible outcome

An authorized institutional user can open Finance and manage the institution's real fee/emolument catalogue without fake/local browser authority. At minimum the workspace supports:

- list catalogue items for the active institution;
- create a catalogue item with stable code, human name/description, exact Money amount and enabled currency;
- distinguish a neutral fee/emolument kind without country-specific fiscal semantics;
- activate/deactivate without deleting historical identity;
- edit commercial/display attributes through a new effective version rather than rewriting prior history;
- inspect current status, current version and effective history needed by later obligation rules;
- receive explicit validation/conflict/authorization failures rather than optimistic fake success.

## Authorization matrix — fixed for this mission

Least-privilege policy for the first catalogue vertical:

| Role | Read catalogue | Create/edit/activate/deactivate |
| --- | --- | --- |
| `institution_admin` | allow | allow |
| `financial` | allow | allow |
| `director` | allow | deny |
| `secretariat` | deny | deny |
| `teacher` | deny | deny |
| `student` | deny | deny |
| `parent` | deny | deny |

Only active Memberships in the active institution qualify. Browser role labels, legacy `admin`, Platform Admin notions and payload-supplied institution identifiers never grant authority.

## Canonical persistence model — fixed for this mission

Use the next available append-only migration, expected `0031_finance_fee_catalogue.sql` at the accepted baseline, with two institution-scoped tables:

### `finance_fee_catalogue_items`

- `id UUID PRIMARY KEY`
- `institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT`
- `code TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('active','inactive'))`
- `current_version INTEGER NOT NULL CHECK (current_version > 0)`
- `created_by_person_id UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `UNIQUE (institution_id, code)`
- `UNIQUE (institution_id, id)` for tenant-safe composite references

### `finance_fee_catalogue_versions`

- `id UUID PRIMARY KEY`
- `institution_id UUID NOT NULL`
- `item_id UUID NOT NULL`
- `version INTEGER NOT NULL CHECK (version > 0)`
- `name TEXT NOT NULL`
- `description TEXT NULL`
- `kind TEXT NOT NULL`
- `amount NUMERIC(30,12) NOT NULL` with the same explicit no-silent-rounding envelope used by Finance Money persistence
- `currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$')`
- `effective_from TIMESTAMPTZ NOT NULL`
- `effective_to TIMESTAMPTZ NULL`
- `created_by_person_id UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- tenant-safe FK `(institution_id,item_id)` -> catalogue item
- `UNIQUE (institution_id,item_id,version)`
- effective interval check `effective_to IS NULL OR effective_from < effective_to`

Creation inserts item + version 1 atomically. Edit locks the current item, verifies expected version, closes the prior version at the new effective time, inserts version N+1 and advances `current_version` in one transaction. Activation/deactivation changes item lifecycle only; it never rewrites historical versions. There is no normal hard-delete path.

## Domain and authority laws

1. PostgreSQL is authoritative for catalogue state. Browser state, localStorage, fixtures and legacy fee fields are never authority.
2. Every catalogue item belongs to exactly one institution. Institution identity comes from authenticated server context.
3. Money uses the integrated exact Finance Money model and `NUMERIC(30,12)` persistence envelope with explicit rejection of over-scale values.
4. Catalogue currency must be enabled by the effective `FinancialProfile`; missing/invalid Financial Context fails closed.
5. Stable catalogue code is institution-scoped and is never silently repurposed.
6. Material edits create a new effective version; prior versions remain historically readable.
7. Deactivation prevents future selection by later obligation missions but does not erase identity/history.
8. Catalogue mutation is administrative configuration, not an economic event. It must create **zero** confirmed Journal transactions and zero projection movement.
9. Writes are authenticated, role checked server-side, tenant-safe, audited and idempotent through the existing Finance command boundary.
10. Legacy `outstanding_fees`, legacy invoices and legacy payment routes cannot seed/overwrite/derive catalogue authority.
11. Migration history `0001`–`0030` is immutable.

## Command/API contract — fixed for implementation

Server endpoints, all resolved against authenticated institutional context:

- `GET /api/finance/fee-catalogue?status=active|inactive|all`
- `GET /api/finance/fee-catalogue/:id`
- `POST /api/finance/fee-catalogue`
- `PUT /api/finance/fee-catalogue/:id`
- `POST /api/finance/fee-catalogue/:id/activate`
- `POST /api/finance/fee-catalogue/:id/deactivate`

Write requests require an idempotency key and an expected version where concurrency matters. The server constructs the Finance command identity from authenticated `institutionId`, operation namespace, idempotency key and canonical request fingerprint. Payload/query must not select another institution.

Stable error classes:

- `401` unauthenticated;
- `403` authenticated but role/membership not authorized;
- `404` missing same-tenant resource without cross-tenant disclosure;
- `409` duplicate institution code, stale expected version or fingerprint/idempotency conflict;
- `422` domain/Money/currency/effective-time validation failure.

## UI slice

Add a Finance catalogue workspace inside the existing Nexus shell, responsive and light/dark compatible. It must provide:

- list with code, name, amount/currency, kind and status;
- create/edit interaction backed by the real API;
- activate/deactivate with explicit confirmation/result/error state;
- loading, empty, filtered-empty, retry, forbidden, validation and conflict states;
- authoritative refresh after mutation;
- current version/effective information visible enough for operational confidence;
- no localStorage or hard-coded catalogue records;
- no payment, obligation or invoice controls in this mission.

## Mandatory RED/GREEN and proof matrix

Fresh evidence on the implementation HEAD must prove:

1. missing catalogue schema/repository contract produces the initial RED;
2. migration/bootstrap creates exactly the new tenant-safe catalogue authority and preserves migration checksum/history;
3. create/read and current/history reads are PostgreSQL-backed;
4. versioned edit preserves version N and creates N+1 atomically;
5. same institution duplicate code and stale version produce deterministic conflict;
6. concurrent conflicting edits produce one accepted version progression, never divergent current heads;
7. cross-tenant direct-ID read/write returns no foreign authority and creates no side effect;
8. role matrix above is enforced for active Memberships; suspended/revoked/missing Membership cannot mutate;
9. amount round-trips exactly and over-scale input is rejected rather than silently rounded;
10. unsupported/disabled currency fails through `requireFinancialContext()`;
11. replay of the same idempotency key/fingerprint returns one catalogue fact; mismatched fingerprint conflicts;
12. catalogue create/edit/activate/deactivate create zero confirmed Journal transactions and do not change `finance_position_projection`;
13. HTTP success + 401/403/404/409/422 contracts are real Express behavior;
14. UI/client tests prove server-backed list/create/edit/lifecycle/error states;
15. Finance Foundation aggregate remains GREEN;
16. FND03 remains GREEN;
17. migrations isolated, lint, build, `git diff --check` and repository quality gate remain GREEN;
18. human UAT passes against local authorized PostgreSQL and authenticated institutional context.

Structural/source-string checks may supplement but never replace behavioral/PostgreSQL proof for authority, tenant isolation, exact Money, idempotency or persistence.

## Human UAT target

Using an authorized local test institution:

1. sign in as `financial` and open Finance -> Fee / Emolument Catalogue;
2. create `MATRICULA-BASE` (or another neutral test code) in the institution's enabled currency;
3. refresh/restart and prove persistence;
4. edit amount/name through expected-version flow and verify prior version remains inspectable;
5. deactivate and reactivate without deleting history;
6. sign in/use context as `director` and prove read allowed / mutation denied;
7. prove wrong-institution and suspended Membership cannot read foreign or mutate authority;
8. verify Journal count/projection are unchanged by catalogue administration.

## Explicitly out of scope

- assigning catalogue items to students/enrollments;
- obligation/charge generation rules;
- invoices/receipts/fiscal documents;
- payment providers, confirmation, allocation or reconciliation;
- penalties, discounts, scholarships, refunds;
- payables, treasury, statutory GL/fiscal adapters;
- FX conversion/revaluation;
- reporting/BI/automation;
- country-specific payment/tax rails;
- reopening accepted Foundation semantics without concrete regression evidence.

## Execution discipline

This is one objective-complete implementation mission. After Product Owner approval, one Codex writer owns normal preflight -> TDD -> implementation -> own-scope fixes -> aggregate gates -> commit/push -> clean remote-coherent checkpoint. Do not return Product Owner micro-checkpoints for normal task boundaries.

Independent review begins READ-ONLY against the exact pushed implementation HEAD only after the full vertical evidence is GREEN.

## Material STOP conditions only

STOP rather than expand scope if and only if fresh evidence proves one of these conditions:

- the accepted active Membership context cannot supply institution/person/role authority required above;
- `requireFinancialContext()` cannot resolve a valid effective profile for the authorized local UAT institution;
- next migration number `0031` is no longer free at execution preflight;
- correct implementation requires changing accepted Journal/Money/reversal/idempotency semantics instead of consuming them;
- tenant isolation cannot be achieved with canonical context without a broader IAM change;
- truthful catalogue semantics require obligation/payment/invoice behavior;
- a blocking Foundation/FND03 regression is caused by this vertical;
- completion requires weakening a safety/test/CI gate.

Timeout, long-running gates, formatting, expected REDs, normal own-scope compile/test failures and ordinary implementation work are not Product Owner STOP conditions; persist evidence and continue within the mission.

## DONE definition

`FINANCE-F1-01` is DONE only when the complete catalogue vertical is real and server-authoritative; PostgreSQL exact Money/version/lifecycle behavior passes; the fixed role matrix and tenant negatives pass; HTTP and UI flows are operational; catalogue mutation is proved non-economic with respect to Journal/projection; Foundation/FND03/migration/lint/build/diff/quality gates are GREEN; human UAT passes; exact implementation HEAD is committed/pushed/clean/remote-coherent; independent exact-HEAD review has P0=0/P1=0 with P2 explicitly adjudicated; and Product Owner authorizes integration.

Passing implementation tests alone does not make the mission integrated. `main` becomes authority only after reviewed merge and canonical state update.

## After DONE

The next Finance mission is **obligation/charge rules tied to canonical academic/enrollment context**, consuming this catalogue and the Finance Foundation. Do not begin it automatically.