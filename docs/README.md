# Nexus Edu IA — Documentation Index

**Status:** canonical documentation entrypoint  
**DOC-AUDIT-01:** documentation consolidation baseline  
**Implementation:** frozen; this documentation does not authorize product code changes.

## 1. Purpose

This file is the mandatory entrypoint for anyone — human or agent — planning or implementing work in Nexus Edu IA. The repository must not be interpreted by whichever historical document happens to be found first.

## 2. Authority hierarchy

When sources conflict, stop implementation and resolve the conflict. Use this order:

1. approved product decision / current Master Plan;
2. current TO-BE Architecture and approved architectural decisions;
3. current implementation roadmap and active Mission Pack;
4. security, tenancy and data-authority contracts;
5. current factual audit / project state;
6. active issue and PR evidence;
7. current code as AS-IS evidence;
8. archived missions, old execution logs and historical plans.

Code is evidence of what exists, not automatic evidence of what should exist.

## 3. Current canonical set

| Need | Canonical source |
|---|---|
| Product direction and market benchmark | `docs/product/NEXUS_MASTER_PLAN_V2.md` |
| Target architecture | `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` |
| Architecture principles already established | `docs/ARCHITECTURE_V4.md` until fully absorbed by TO-BE V2 |
| Technical audit / AS-IS baseline | `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` |
| AS-IS → TO-BE legacy decisions | `docs/audit/LEGACY_REPLACEMENT_MAP.md` |
| Implementation order | `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` |
| Active executable missions | `docs/roadmap/missions/` |
| Ready / Done / evidence gates | `docs/DEFINITION_READY_DONE_EVIDENCE.md` |
| Engineering workflow | `docs/operations/ENGINEERING_PLAYBOOK.md` plus active Mission Pack |
| Current project state | `docs/operations/PROJECT_STATE.md` after reconciliation with audit baseline |
| Historical material | `docs/archive/` after archival pass |

## 4. Mandatory traceability

No implementation mission is READY unless it can trace:

`market/operation evidence → ADOPT/ADAPT/REJECT decision → product requirement → architecture contract → AS-IS gap/finding → mission → tests/evidence → DONE`.

A benchmark observation never authorizes implementation by itself.

## 5. Product rules derived from the market study

The observed academic and financial systems are references for operational maturity, not templates to copy. Nexus adopts or adapts: persistent entity context; Student 360 as an authorized projection; explicit Professor × Turma × Disciplina × Ano Letivo assignment; finance as a deep bounded context integrated with the same platform; fee catalogue, obligations, payments, ledger/extracts; contextual and executive BI; dense tables when operationally appropriate.

Nexus rejects: fragmented mandatory portals; repeated search for the same entity; cascades of menu → button panel → operation; long workflows inside modals; decorative dashboards without decisions; duplicated Student/Class/Course data between domains; fake success; mocks presented as operational capability.

## 6. Documentation states

- **CANONICAL** — may govern implementation.
- **SUPPORTING** — useful detail but cannot override canonical sources.
- **HISTORICAL** — evidence of prior work only.
- **SUPERSEDED** — replaced; must not guide new work.
- **PROTOTYPE** — exploratory material; no implementation authority.

## 7. DOC-AUDIT-01 rule

Do not delete historical evidence merely because it is old. First classify it in `docs/audit/DOCUMENTATION_REGISTER.md`. Files that can mislead implementation should be archived or superseded. Permanent deletion is reserved for exact redundancy, generated/transient material, or content with no historical/operational value.

## 8. Current freeze

The enrollment checkpoint and prior implementation work remain audit evidence. Documentation consolidation does not authorize continuing S04, merging the frozen implementation, starting a new module, or making opportunistic UX fixes. Implementation resumes only through an approved Mission Pack and the gates above.
