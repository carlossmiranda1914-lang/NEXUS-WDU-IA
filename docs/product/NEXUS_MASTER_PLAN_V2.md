# Nexus Edu IA — Master Plan v2

**Status:** CANONICAL product direction  
**Basis:** updated market study, current planning, TO-BE architecture direction and AUDIT-01 findings  
**Scope:** product, operation, experience and governance. It does not authorize code by itself.

## 1. Product mandate

Nexus Edu IA must evolve as one integrated institutional operating platform, not a collection of disconnected pages or portals. Domains remain separated by responsibility, but the user's context must continue across related work.

The practical study of a real academic system and a separate financial portal from the same supplier showed useful operational depth together with fragmentation, dense navigation, repeated entity search and portal switching. Nexus will use that evidence to adopt operational strengths without reproducing those weaknesses.

## 2. Non-negotiable product principles

1. **Flow before module.** Represent the school's real work, not the software's internal structure.
2. **Context before menus.** Student, class, teacher, process and financial account remain in context across authorized actions.
3. **One person, one history.** Roles and institutional relationships do not create duplicate people.
4. **Separated domains, integrated experience.** Finance, Academic, Enrollment and other bounded contexts do not become isolated products.
5. **Backend authority.** Critical state, authorization and persistence are server decisions.
6. **Evidence over appearance.** No critical operation is shown as complete before real confirmation.
7. **History over destructive state.** Important changes are reconstructible and auditable.
8. **Mobile is a product requirement.** It is not a later visual patch.
9. **BI near the decision.** Operational indicators appear in context; executive BI complements rather than replaces workflows.
10. **No implementation by imitation.** Market features enter only through ADOPT / ADAPT / KEEP NEXUS / REJECT / INVESTIGATE.

## 3. Market decision register

| Observation | Decision | Nexus consequence |
|---|---|---|
| Central student profile across operations | ADOPT | Student 360 becomes an authorized read projection over canonical domains. |
| Repeated student search between modules | REJECT | Preserve entity context across related domains. |
| Teacher, class and subject are explicit operational objects | ADOPT | Model Professor × Turma × Disciplina × Ano Letivo before grades/attendance. |
| Grade entry and publication are separated | ADAPT | Assessment lifecycle separates configuration, entry, validation and publication. |
| Dense administrative tables | ADOPT when justified | Use tables for operational density; not every screen becomes cards. |
| Large intermediate button panels | REJECT | Prefer task-first workspaces and direct contextual actions. |
| Long workflows in modals | REJECT | Complex processes receive dedicated workspaces. |
| Financial portal has deep school-specific capabilities | ADOPT domain depth | Finance is a bounded context with fees, obligations, invoices/documents, payments, adjustments and ledger. |
| Finance exists as a separate portal | ADAPT | Keep technical separation but integrate it in the same Nexus shell/context. |
| Fee/emolument catalogue | ADOPT | Configurable fee catalogue tied to academic/institutional context. |
| Penalties and discounts | ADAPT | Rules and adjustments are explicit, attributable and ledger-backed. |
| Student financial profile and extract | ADOPT | Authorized Student 360 financial projection plus finance workspace. |
| Multiple isolated dashboards | REJECT | Contextual BI plus executive institutional BI with drill-down. |
| Power BI for deeper analytics | ADAPT | Power BI complements historical/executive analysis; operational facts remain in Nexus. |

## 4. Functional spine

`Identity & Access → Institution → Academic Year → Enrollment → Student institutional activation → Academic Core → Student 360 → Finance / Teaching / Assessment / Attendance / Documents / Communication → BI → AI & Automation`

Downstream modules may not invent their own Student, Class, Course, identity or tenant authority.

## 5. Canonical enrollment direction

`Application → identity resolution → registration/relationships → academic context → document policy and evidence → validation → decision → activation → downstream institutional processes`.

Student 360 is not a database or write owner. It is a contextual authorized projection over the person's and student's real sources.

## 6. Academic Core prerequisite

Before Assessment or Attendance becomes canonical, Nexus needs explicit temporal academic structure: AcademicYear, program/course, class/level, subject and teacher assignment. The key operational relation is:

`Teacher × Class × Subject × AcademicYear`.

Permissions for grade entry, attendance and assigned-student access should derive from real assignments rather than JSON arrays or client assumptions.

## 7. Finance target

Finance is a deep bounded context integrated into Nexus. Minimum conceptual separation:

- fee/emolument catalogue;
- obligation/charge;
- invoice or fiscal/administrative document where applicable;
- payment;
- allocation;
- penalty/discount/credit/adjustment;
- reversal/refund where applicable;
- immutable financial movements/ledger;
- authorized balance and extract projections.

Balance is derived from movements, not manually edited as the source of truth. Finance references canonical Student and Academic context; it does not clone them.

## 8. Experience target

### Task-first
Every workspace starts from the user's task, exception or next decision.

### Context-first
When the user opens a student, class, teacher or process, related authorized actions preserve that context.

### Interface rules
- one clear primary action per state where possible;
- dense tables for administrative operations when justified;
- short confirmation/edit actions may use modals; long workflows do not;
- dashboards emphasize pending work, risks, exceptions and decisions;
- technical IDs do not dominate user language;
- loading, empty, error, conflict, no-permission and confirmed states are explicit;
- desktop, tablet and mobile behavior is specified before DONE.

## 9. BI direction

BI has two complementary forms:

- **contextual BI:** indicators inside Student, Class, Enrollment, Finance and other workspaces;
- **executive BI:** institution-wide performance with authorized drill-down to real sources.

Metrics must be derivable from canonical facts. Hardcoded or fabricated predictions are not BI.

## 10. AI and automation direction

AI operates only after domain authority is clear. Mandatory conceptual pipeline:

`authorized context → policy → retrieval → generation/recommendation → validation → human confirmation when sensitive → authorized use case → execution → audit`.

LLM tools never become an alternative authorization path or direct arbitrary table-write layer.

## 11. Scope governance

A capability may enter implementation only when the active Mission Pack answers:

- What real problem does it solve?
- Which market observation or institutional need supports it?
- ADOPT, ADAPT, KEEP NEXUS, REJECT or INVESTIGATE?
- Who uses it and in which context?
- Which domain owns it?
- Which canonical data does it reference?
- Which states and invariants exist?
- Who may execute/read it?
- How does it fail and recover?
- Which AS-IS finding/gap does it close?
- Which tests and evidence prove DONE?
- Why is it the priority now?

## 12. Current implementation position

The next implementation cycle is not feature expansion. It begins with Foundation Authority Convergence because AUDIT-01 found competing schema/write/audit/product-truth authorities and legacy paths that can undermine new domains. See `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md`.
