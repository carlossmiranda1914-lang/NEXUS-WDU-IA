---
name: nexus-code-review
description: Review Nexus Edu IA code, diffs, pull requests and implementation checkpoints against canonical architecture, tenant isolation, authorization, persistence, audit, product-truth and regression invariants. Use before merge, after meaningful implementation, for security-sensitive IAM/permissions changes, or whenever a Nexus change needs evidence-based engineering review. This skill reviews; it never overrides ADRs, missions, schema authority, CI or tests.
---

# Nexus Code Review

Review the change as a Nexus engineering gate, not as a generic style review.

## Authority order

Resolve conflicts in this order:
1. Current canonical ADRs and architecture documentation.
2. Canonical schema, migrations and backend contracts.
3. Active authorized Mission Pack, acceptance criteria and explicit scope.
4. Executable CI, tests and quality gates.
5. Current Nexus design-system contracts when the change is visual.
6. This skill.

Never weaken a higher authority to make a change pass. If authorities conflict or are stale, report the conflict and stop the affected conclusion.

## Review workflow

1. Establish the exact baseline, target diff and authorized mission/scope. Do not review an inferred diff.
2. Read only the canonical references needed for the changed surface. Prefer repository evidence over remembered project context.
3. Trace changed behavior end-to-end: UI/client -> API -> authorization/context -> domain/service -> persistence -> audit/observable result.
4. Review negative paths, not only the happy path.
5. Verify tests/gates that prove each material claim. Never convert NOT RUN, skipped, unavailable or unverified into PASS.
6. Report findings by severity with file/line or exact evidence where available.
7. Separate defects from optional improvements. Do not expand scope through review comments.

## Mandatory invariants

For IAM, permissions, membership, institution or tenant-sensitive work, load `references/architecture-guardrails.md` and `references/security-checklist.md`.

For test sufficiency and completion claims, load `references/testing-expectations.md`.

For severity classification and output format, load `references/review-severity.md`.

At minimum verify when applicable:
- backend authority is not delegated to browser state;
- institution/tenant context is server-resolved and enforced;
- institutional role/capability belongs to the appropriate Membership/context contract;
- Platform Admin is not silently treated as Institution Admin;
- reads and writes cannot cross tenant boundaries;
- privilege changes fail closed and cannot self-elevate accidentally;
- writes use canonical persistence authority and migrations rather than runtime DDL or shadow storage;
- security/audit-sensitive mutations have the required durable audit behavior;
- UI truth matches backend capability and persistence truth;
- failure, loading, empty and denied states do not claim success;
- tests include meaningful negative/regression coverage for the changed invariant;
- existing Foundation gates remain intact.

## Review output

Lead with findings, ordered BLOCKER -> CRITICAL -> MAJOR -> MINOR. For every material finding include: severity, violated invariant, concrete evidence, impact, and smallest safe correction. Then state verification performed and residual unknowns.

If no material defect is found, say so explicitly but still list what was verified and what was not run or could not be established.

Do not approve based on appearance, intent, comments or documentation alone when executable evidence is required.
