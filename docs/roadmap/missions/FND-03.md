# FND-03 — Tenant Sweep

**State:** PREPARATION.

## Objective
Prove that every remaining authoritative P0/P1 path derives institution context server-side and cannot cross tenant boundaries.

## Origin
AUD-AI-TENANT-001, AUD-COMM-TENANT-001, ownership-bridge findings and uneven legacy coverage.

## IN
HTTP APIs, repositories, AI tools still enabled, realtime, cache keys, files, reporting and background/event consumers that touch institutional data.

## Required matrix
For each path record: actor role, context source, tenant predicate/constraint, cross-tenant negative test, audit behavior, legacy bridge dependency and remediation status.

## DONE
- all authoritative P0/P1 paths have explicit tenant controls;
- direct ID manipulation cannot expose/mutate another institution;
- realtime and cache are tenant-scoped;
- cross-tenant tests are automated for critical paths;
- unresolved transitional bridges are documented and fenced.

## Stop rules
Do not “fix” tenant isolation by trusting client-supplied institution IDs or UI filtering. Escalate if a domain lacks a canonical institutional owner.
