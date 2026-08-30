# STUDENT-EXPERIENCE-02 — Student Record Clarity & Operational Refinement

**Status:** DESIGN APPROVED — IMPLEMENTATION NOT YET AUTHORISED
**Date:** 2026-08-30
**Predecessor:** STUDENT-EXPERIENCE-01

## 1. Purpose

Elevate the existing Student Record from a robust read foundation into a calm, premium and operationally useful institutional workspace without turning it into a dashboard or a new write authority.

The experience must remain simple for school staff: understand the student immediately, identify a factual exception when one genuinely requires attention, and reach the owning domain when a real authorised action exists.

## 2. Product direction

The approved visual/interaction direction is **premium and serene**, not an operational cockpit.

Normal state should feel quiet. Exceptions should feel obvious.

The Student Record must remain minimal, objective and easy to understand. Visual distinction comes from hierarchy, spacing, typography, surfaces, restrained colour, responsive composition and meaningful interaction — not from widget density, decorative dashboards or duplicated information.

The design must remain inside Nexus Aurora and the existing product architecture. Domain personality may exist, but it must not fragment the Nexus visual family.

## 3. Three product laws

### Law 1 — Quiet summary, contextual detail

The Summary may discreetly indicate that something requires attention. The factual detail and any eventual action belong in the owning section/domain.

Do not create a large attention dashboard in the Student Record.

### Law 2 — Attention requires canonical fact + explicit domain rule

An attention item exists only when both are true:

1. an authorised canonical fact exists; and
2. an explicit domain rule says that fact requires human attention.

Missing data, frontend heuristics, visual inference, generic null checks and guessed risk must never create attention.

### Law 3 — See here, resolve at the owner

The Student Record contextualises and routes; the owning domain executes writes.

Student Record remains read-only. If no real authorised owner action exists, no fake action button is shown.

## 4. Canonical data path

All operational presentation follows:

`Canonical PostgreSQL/domain owners -> authorised Student Context projection -> HTTP contract -> UI`

The browser must not become an authority or integration layer.

Forbidden in the frontend:

- tenant/institution authority;
- cross-domain joins;
- permission derivation;
- attention heuristics;
- fake lifecycle interpretation;
- hardcoded product fixtures;
- internal identifiers used as navigation authority.

Replacing UAT fixtures with real institutional data must require no React changes.

## 5. Existing Student Record foundation to preserve

Preserve the accepted STUDENT-EXPERIENCE-01 experience:

- Active Students: one person once;
- opaque `studentRef`;
- dedicated Student Record workspace;
- Entity Context Header;
- Resumo;
- Percurso académico;
- Matrículas;
- Documentos metadata;
- Encarregados;
- current/history distinction;
- read-only purity;
- server-side InstitutionalContext;
- tenant isolation;
- minimum PII;
- loading/empty/partial/error/forbidden/not-found semantics;
- light/dark;
- desktop/mobile;
- visual-regression protection.

No improvement in this mission may regress an already accepted surface.

## 6. Operational refinement

### 6.1 Attention Rule Inventory — mandatory first gate

Before implementation, inventory candidate operational facts already available from authoritative domains.

For each candidate record:

`FACT | CANONICAL OWNER | SOURCE FIELD/STATE | DOMAIN RULE | USER MEANING | OWNING SECTION | REAL ACTION AVAILABLE? | SAFE ROUTE AVAILABLE?`

A candidate is rejected unless its semantics are explicit and supported by current authority.

Examples must not be assumed. A rejected document may be a candidate only if the current Documents/Enrollment document contract proves what `rejected` means operationally. Missing class, guardian or document must not automatically become attention.

If no candidate survives this gate, do not invent attention functionality. Report the gap and preserve the calm read experience.

### 6.2 Backend operational projection

If one or more rules survive the inventory, extend the authorised Student Context minimally with a safe operational projection.

The contract should carry enough semantic information that React only renders it. Exact shape is implementation-owned, but it must not expose internal IDs or require frontend interpretation of raw domain states.

The backend owns:

- factual rule evaluation;
- institution scoping;
- safe human meaning;
- owning section/domain classification;
- action availability;
- safe public navigation reference when such a route actually exists.

The backend must not manufacture a write authority for Student Record.

### 6.3 Active Students — next useful operational fact

Close the existing product-contract gap: Active Students may show at most one useful operational fact when a verified rule requires attention.

Normal rows remain quiet.

Do not create badge walls, scores, risk percentages or multi-alert dashboards.

Priority/order between multiple valid attention items must be explicit and deterministic in backend/domain policy, never visual guesswork in React.

### 6.4 Student Record Summary

The Summary remains identity/context first.

When verified attention exists, show only a restrained indication such as a small attention summary. It must not duplicate full details from owning sections.

When no attention exists, the attention surface should disappear rather than display decorative success noise.

### 6.5 Owning sections

The detailed factual state belongs in its natural section: Matrículas, Documentos, Encarregados or another authorised future owner.

An action is rendered only when:

- a real owner use case exists;
- current authorisation permits it;
- a safe navigation contract exists;
- no internal identifier must be exposed;
- the route preserves student/institution context safely.

Otherwise show the fact only.

## 7. Visual and UX contract

The Student Record must become more refined without becoming denser.

### Visual principles

- premium, serene institutional composition;
- strong but restrained Entity Context Header;
- neutral surfaces as the default;
- Nexus structural greens and existing tokens;
- warning/error accents only for real semantics;
- no new arbitrary palette;
- no decorative gradients/effects that compete with information;
- no card wall;
- no excessive badges;
- no decorative timeline;
- no duplicated current context;
- whitespace must support hierarchy, not create empty dead zones.

### Interaction principles

- one obvious primary reading path;
- current context understood in seconds;
- tabs remain predictable and lightweight;
- attention is discoverable but not dominant;
- detail stays near its domain;
- navigation back to Active Students is obvious;
- keyboard/focus/touch remain first-class;
- mobile is a deliberate full-page composition, not compressed desktop.

### Theme principles

Light and dark must preserve the same information hierarchy and semantic emphasis. Theme must never change meaning.

## 8. Backend/frontend parity contract

For every visible operational element, evidence must identify:

`VISIBLE ELEMENT -> HTTP FIELD -> SERVER PROJECTION -> CANONICAL OWNER/RULE`

No visible attention state may exist only in JSX/CSS logic.

Required A/B proof:

- Student A and Student B have different canonical facts;
- same endpoint and same component render the correct distinct state;
- switching A -> B leaves no stale data;
- cross-tenant reference fails closed;
- no frontend constant changes are required.

## 9. Angola terminology gate

Visible language must be simple and natural for Angolan school administration.

Technical terms may remain in code but not leak to users: Student Context, Student 360, placement, GuardianRelationship, raw lifecycle enums, UUID terminology and similar internal concepts.

Do not invent local terminology without product/domain justification. Prefer familiar school-administration wording and concise labels.

## 10. Security, privacy and failure semantics

Preserve:

`Firebase authentication -> requireAuth -> InstitutionalContext -> opaque studentRef -> tenant-safe authorised reads`

No browser-owned Institution.

Do not expose internal person/profile/enrollment/placement/document/guardian IDs, Firebase UID, membership IDs, storage paths, SQL, stack traces, national ID, address or unauthorised contacts.

Maintain explicit distinction:

- empty != error;
- partial != zero;
- unavailable != empty;
- forbidden/not-found must not leak tenant existence.

## 11. Performance and operational quality

Student Record must remain bounded and predictable:

- no N+1;
- no request storm on tab changes;
- no unnecessary polling;
- no browser materialisation of authoritative state;
- no duplicate refetch caused only by presentation;
- no hidden writes from navigation.

Do not optimise without evidence. Measure the affected read path and correct demonstrated regressions only.

## 12. Explicitly deferred capabilities

This mission does **not** implement:

- physical document upload/replacement/version lifecycle;
- student photograph authority/storage/upload;
- guardian relationship writes;
- Finance projection or writes;
- Assessment;
- Attendance;
- Communication;
- cross-domain final timeline;
- predictive/AI risk scoring;
- new Student aggregate/writer.

These remain future capabilities and must not appear as fake operational UI.

## 13. Schema/authority rule

Expected schema change: **NO**.

If the Attention Rule Inventory proves that a required capability needs a new authority, schema, public reference or owner write contract, stop that capability before implementation and document the prerequisite. Do not opportunistically absorb the missing domain into this mission.

## 14. Validation gates

Before Human UAT, prove fresh:

- canonical Attention Rule Inventory;
- backend/frontend parity trace;
- A/B real-data replacement;
- tenant isolation;
- 401/403/404/non-disclosure;
- privacy/minimum PII;
- read-only purity;
- Active Students regression;
- Student Record 2.1–2.6 regression;
- visual-regression contract;
- loading/empty/partial/error/retry;
- deterministic attention ordering if multiple rules exist;
- bounded request/query behavior;
- desktop/tablet/mobile;
- light/dark;
- keyboard/focus/accessibility;
- terminology Angola;
- typecheck/lint/build;
- secret scan;
- diff check;
- applicable aggregate quality gate.

Human UAT is mandatory before mission closeout.

## 15. Human UAT success criteria

A school secretary should be able to:

1. find one active student without historical duplication;
2. understand who the student is and the current academic context immediately;
3. move through the five existing sections without losing context;
4. notice a genuine operational exception without visual overload;
5. understand the exception in the owning section;
6. use an action only when a real owner flow exists;
7. encounter a quiet interface when nothing needs attention;
8. use the experience in light/dark and desktop/mobile without loss of meaning;
9. never see technical IDs, implementation terminology or fake functionality.

## 16. Definition of success

The mission succeeds when the Student Experience is demonstrably more useful to a real institution while remaining simpler to perceive, not more complex.

The architectural invariant is:

**separated authorities, integrated experience, quiet normal state, obvious factual exceptions.**

No implementation is authorised by this document alone. Implementation requires an explicit approved plan and execution authorisation.