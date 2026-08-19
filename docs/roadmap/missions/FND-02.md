# FND-02 — Legacy Write Authority & Fences

**State:** PREPARATION.

## Objective
Create a complete authoritative-write inventory and prevent legacy paths from competing with vNext domain truth.

## Origin
AUD-IAM-001/003, AUD-DUPLICATE-ROUTES-001 and the legacy aggregate findings.

## IN
Map writes for users/identity, students, teachers, finance, documents, tasks, communication and configuration. For each write classify PRESERVE, TEMPORARY READ-ONLY, REPLACE or REMOVE. Add fences only after the canonical replacement and tests are proven.

## OUT
Do not implement missing future domains merely to delete legacy code. A legacy read may remain temporarily with explicit migration purpose.

## Required evidence
- endpoint/service/repository write inventory;
- source-of-truth owner for each capability;
- callers and UI entrypoints;
- migration/data reconciliation dependency;
- negative tests proving fenced path cannot regain authority.

## DONE
No P0/P1 capability has two undocumented authoritative write paths. Duplicate Tasks/server paths are resolved safely. Legacy user/student/finance/document writes have an explicit transition state. New features are prohibited from adding dependencies on legacy authority.

## Stop rules
Do not delete a legacy path if no canonical replacement exists and deletion would destroy an operational capability; mark it transitional and create the prerequisite mission instead.
