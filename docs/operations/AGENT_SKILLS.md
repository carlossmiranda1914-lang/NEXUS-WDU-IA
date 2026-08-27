# Nexus Agent Skills

This document governs repository-local agent Skills. Skills improve execution quality; they are not a new source of product or architecture truth.

## Authority

Repository-local Skills are subordinate to, in order: canonical ADRs/architecture; schema/migrations/backend contracts; authorized Mission Pack and acceptance criteria; executable CI/tests/gates; canonical design-system contracts; Skill guidance.

If a Skill conflicts with a higher authority, the higher authority wins and the conflict must be reported. Do not edit an ADR, mission, test or gate merely to make Skill guidance pass.

## Active Skills

### `.skills/nexus-code-review`
Use for evidence-based review of Nexus diffs/PRs/checkpoints, especially IAM, permissions, tenancy, persistence, audit and security-sensitive changes. It complements CI; it does not replace executable gates.

### `.skills/nexus-ui-ux`
Use for creation/change/review of application UI. It consolidates Nexus visual, interaction, accessibility and product-truth guardrails so the project does not accumulate competing design doctrines.

## Standard implementation flow

`authorized mission/scope -> nexus-ui-ux when visual -> implementation -> nexus-code-review -> required tests/quality gate -> evidence -> DONE/BLOCKED`

Apply only the Skills relevant to the changed surface. Do not invoke every Skill mechanically.

## Maintenance rules

- Keep `SKILL.md` concise and move detailed domain guidance to one-level `references/` files.
- Add scripts only for deterministic checks that materially improve reliability; do not add scripts as ceremony.
- Do not duplicate canonical architecture inside Skills. Reference/check it and keep only stable review guardrails in Skill references.
- Update a Skill when repeated real usage proves a rule ambiguous, missing or harmful.
- Review Skill changes like code: bounded scope, explicit rationale, no weakening of higher authorities.
- Never store credentials, PII, environment secrets or production data in a Skill.

## First validation target

Use the IAM/permissions visual implementation as the first production-like validation of both Skills. Any refinement discovered there should remain generic enough to improve subsequent Nexus surfaces rather than encode one screen's accidental structure.
