# FINANCE-F1-01 — Institutional Fee / Emolument Catalogue

**State:** READY_FOR_PRODUCT_OWNER_APPROVAL
**Program:** `FINANCE`
**Stage:** first upper-Finance functional vertical
**Planning branch:** `codex/finance-f1-fee-catalogue-prep`
**Integrated baseline:** `main @ 02b7f0a454df922598b56660ce10216956539939`
**Implementation branch:** not authorized until Product Owner approval

## Mission

Deliver the first real upper-Finance functional vertical after the integrated Finance Foundation: an institution-scoped, server-authoritative **Fee / Emolument Catalogue** that authorized Finance/Institution administrators can create, activate/deactivate, edit through controlled versioned change, list and inspect through the Nexus UI.

The catalogue defines reusable financial charge definitions. It does **not** itself create a student's obligation, receivable, payment, allocation, invoice or Journal economic fact. Those remain later Finance missions.

The mission is complete only as one coherent vertical: domain contract -> PostgreSQL persistence -> authorization/tenant isolation -> HTTP API -> Nexus UI -> behavioral/negative proof -> human UAT -> exact-HEAD review/integration evidence.

## User-visible outcome

An authorized institutional user can open Finance and manage the institution's real fee/emolument catalogue without fake/local browser authority. At minimum the workspace must support:

- list catalogue items for the active institution;
- create a catalogue item with stable code, human name/description, exact Money amount and currency compatible with the institution Financial Profile;
- distinguish a fee/emolument category/type without country-specific fiscal semantics;
- activate/deactivate an item without deleting historical identity;
- change mutable commercial/display attributes without rewriting prior effective history;
- inspect status and effective/version information needed by later obligation rules;
- receive explicit validation/conflict/authorization failures rather than optimistic fake success.

## Domain boundary and authority laws

1. PostgreSQL is authoritative for catalogue state. Browser state, localStorage, fixtures and legacy fee fields are never authority.
2. Every catalogue item belongs to exactly one institution. Institution/tenant identity comes from authenticated server context, never a trusted request-body tenant selector.
3. Money uses the integrated exact Finance Money model. No authoritative JS floating-point amount is permitted.
4. Catalogue currency must be permitted by the institution's authoritative Financial Profile/Currency Registry; missing or invalid Financial Context fails closed.
5. Stable catalogue identity and code are not silently repurposed. Material changes that could alter the meaning of future charges must preserve effective/version history rather than mutate history in place.
6. Deactivation prevents future selection by later charge/obligation creation but does not erase the item or prior versions.
7. A catalogue mutation is administrative configuration, not an economic event. It must not create a confirmed Finance Journal transaction merely because a catalogue item is created/edited/activated/deactivated.
8. Existing `outstandingFees` or equivalent legacy values remain non-canonical and cannot seed, overwrite or derive catalogue authority.
9. All writes are authenticated, capability/role checked server-side, audited/provenanced, tenant-safe and idempotent where request retry can duplicate a mutation.
10. Migration history already integrated is immutable; new schema must use the next canonical migration number discovered from current `main` at execution preflight.

## Minimum canonical model

The implementation must model these concepts explicitly, while matching established repository naming conventions discovered at preflight:

- catalogue item identity;
- institution ownership;
- stable institution-scoped code;
- display name and optional description;
- neutral item kind/category suitable for international core;
- exact amount + ISO currency;
- lifecycle status (`active` / `inactive` minimum);
- effective/version identity sufficient to preserve historical meaning;
- created/updated provenance and audit linkage consistent with Nexus authority patterns.

Do not add Angola-specific tax, invoice, payment-rail or statutory fields to the international core.

## Authorization and tenancy

Implementation must reuse the canonical authenticated Membership/institution context and existing server-side IAM policy patterns. The exact capability names must be derived from current IAM conventions rather than inventing a browser-only role gate.

Mandatory negatives:

- unauthenticated read/write rejected;
- authenticated member without Finance catalogue authority rejected;
- cross-institution read rejected or returns no foreign records according to canonical API convention;
- cross-institution update/deactivate rejected;
- request body/query cannot override authoritative institution context;
- inactive/suspended membership cannot mutate catalogue authority.

## Persistence requirements

Create canonical PostgreSQL schema for the catalogue using the repository migration runner and safety policy. Constraints must enforce, at minimum:

- non-null institution ownership;
- institution-scoped stable-code uniqueness under the chosen lifecycle/version model;
- valid lifecycle state;
- exact decimal amount envelope compatible with Finance Money law;
- explicit currency storage/validation boundary;
- no hard-delete path for normal lifecycle;
- deterministic concurrency behavior for conflicting edits/versions.

If versioning uses separate current/version records, both must remain tenant-scoped and transactionally coherent. If the repository's existing effective-version pattern is reused, prove the same invariants behaviorally.

## HTTP contract

Expose a narrow server-authoritative catalogue API following existing Nexus adapter/controller conventions. Required behavior:

- list active/all catalogue items for current institution;
- fetch one catalogue item/version as needed by the UI;
- create;
- update through the approved version/effective-history mechanism;
- activate/deactivate;
- deterministic validation/conflict responses;
- no endpoint accepts browser-supplied institution authority.

Do not expose generic Journal mutation or raw database semantics through this API.

## UI slice

Add a Finance catalogue workspace inside the existing Nexus shell, following established responsive and light/dark patterns. It must provide a real institutional workflow, not a demo:

- catalogue list with code, name, amount/currency, type/category and status;
- create/edit interaction with server validation;
- activate/deactivate action with explicit result/error state;
- loading, empty, filtered-empty where applicable, retry, forbidden and validation/conflict states;
- immediate refresh from authoritative server result after successful mutation;
- no localStorage or hard-coded catalogue records;
- no payment, obligation or invoice controls in this mission.

## Mandatory proof

Use TDD for new behavior. Fresh proof on the implementation HEAD must include:

1. domain/Money validation RED -> GREEN;
2. PostgreSQL migration/bootstrap/checksum proof;
3. PostgreSQL create/read/update-version/activate/deactivate behavior;
4. same-tenant uniqueness and concurrency conflict behavior;
5. cross-tenant negative read/write proof;
6. authorization negatives including inactive/suspended membership;
7. exact decimal persistence/round-trip proof with no silent rounding;
8. retry/idempotency proof for mutation boundary where applicable;
9. proof catalogue mutations do not create confirmed Journal economic facts;
10. HTTP contract tests for success and negative paths;
11. UI/client tests for real server-backed states and mutation flow;
12. Finance Foundation aggregate regression;
13. FND03 tenant-isolation regression;
14. lint, production build and `git diff --check`;
15. human visual UAT against a real local PostgreSQL-backed fixture through the application.

Structural/source-string checks may supplement but never replace behavioral/PostgreSQL proof for authority, tenant isolation, exact Money or persistence.

## UAT target

Using an authorized local test institution and authenticated institutional user:

1. open Finance -> Fee / Emolument Catalogue;
2. create a real test item, for example an enrollment fee, using the institution's configured currency;
3. observe it persisted after refresh/restart;
4. edit a mutable field/amount through the approved version mechanism and verify history/current state is coherent;
5. deactivate it and verify the UI/server show inactive state without deleting identity/history;
6. confirm an unauthorized or wrong-institution context cannot view/mutate it;
7. confirm no payment/obligation/Journal economic fact was fabricated by catalogue administration.

## Explicitly out of scope

- assigning fees to students/enrollments;
- obligation/charge generation rules;
- receivable balance authority beyond the existing Foundation;
- invoices/receipts/fiscal documents;
- payment providers or payment confirmation;
- payment allocation/reconciliation;
- penalties, discounts or scholarships beyond catalogue base-definition semantics;
- refunds, payables, treasury, statutory GL or fiscal adapters;
- FX conversion/revaluation;
- reporting/BI/automation;
- country-specific payment or tax rails;
- reopening accepted Finance Foundation semantics without concrete regression evidence.

## Execution discipline

This is **one objective-complete implementation mission**, not a sequence of Product Owner micro-prompts. After approval, Codex owns normal preflight -> implementation -> tests -> own-scope fixes -> aggregate gates -> commit/push -> clean/remote-coherent checkpoint. It returns early only for a material STOP condition.

Use one implementation branch/worktree and one writer for this authority unit. Independent review starts READ-ONLY against the exact pushed HEAD after implementation evidence is GREEN.

Resource policy: smallest sufficient context, single implementer, targeted tests during RED/GREEN, aggregate gates once the vertical is coherent. Do not trade tenant isolation, data integrity, authorization, behavioral proof or independent review for credit savings.

## STOP conditions

STOP and report evidence rather than expanding scope if:

- current canonical academic/IAM/Financial Context cannot supply an institution authority required by this mission;
- implementing catalogue authority requires changing accepted Journal/Money/reversal/idempotency semantics rather than consuming them;
- a required canonical migration would conflict with current migration history;
- correct tenant isolation cannot be proved with existing authenticated institution context;
- the vertical requires obligation/payment/invoice semantics to become truthful;
- a blocking regression appears in Finance Foundation or FND03 attributable to this work;
- completion would require weakening a safety/test/CI gate.

## DONE definition

`FINANCE-F1-01` is DONE only when the complete catalogue vertical is real and server-authoritative; PostgreSQL persistence and exact Money behavior pass; auth and cross-tenant negatives pass; lifecycle/version history is proved; HTTP and UI flows are operational; catalogue mutation is proved non-economic with respect to the Journal; Finance Foundation/FND03/lint/build/diff gates are GREEN; human UAT passes; exact implementation HEAD is committed/pushed/clean/remote-coherent; independent exact-HEAD review has P0=0/P1=0 (P2 explicitly adjudicated); and Product Owner authorizes integration.

Passing implementation tests alone does not make the mission integrated. `main` becomes authority only after reviewed merge and canonical project-state update.

## After DONE

The next Finance mission may define **obligation/charge rules tied to canonical academic/enrollment context**, consuming this catalogue and the Finance Foundation. Do not begin it automatically.