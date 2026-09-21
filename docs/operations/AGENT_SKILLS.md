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

### `.skills/nexus-frontend-implementation`
Use when implementing or maturing an approved Nexus frontend surface. It forces `observe -> map -> plan -> approve -> implement -> verify -> Human UAT`, checks cross-entity information architecture before JSX/CSS, preserves domain meaning, prevents generic card/button proliferation, requires existing design-system reuse, and forbids frontend inventions for missing backend contracts.

## External source audit

The external repository `rtadewald/skills` was reviewed as a pattern source, not copied wholesale. Useful ideas adopted:
- `plan-screen`: plan the screen/flow before implementation and use explicit approval gates;
- `extract-ds`: treat a design system as reusable implementation truth rather than page-by-page styling;
- `img-to-html`: implement in staged gates and compare/review before advancing.

Ideas intentionally NOT adopted as Nexus defaults:
- social-media-oriented visual spectacle;
- mandatory three-concept exploration;
- framework-independent static HTML reconstruction;
- OpenRouter/image-generation dependencies;
- project-specific external tooling assumptions.

Nexus keeps its own product, architecture, security, accessibility and product-truth authority.

## Standard implementation flow

`authorized mission/scope -> nexus-ui-ux -> nexus-frontend-implementation -> implementation -> visual/behavioral gate -> nexus-code-review -> required tests/quality gate -> Human UAT -> evidence -> DONE/BLOCKED`

Apply only the Skills relevant to the changed surface. Do not invoke every Skill mechanically.

## Maintenance rules

- Keep `SKILL.md` concise and move detailed domain guidance to one-level `references/` files.
- Add scripts only for deterministic checks that materially improve reliability; do not add scripts as ceremony.
- Do not duplicate canonical architecture inside Skills. Reference/check it and keep only stable review guardrails in Skill references.
- Update a Skill when repeated real usage proves a rule ambiguous, missing or harmful.
- Review Skill changes like code: bounded scope, explicit rationale, no weakening of higher authorities.
- Never store credentials, PII, environment secrets or production data in a Skill.
- External Skills must be audited before adoption; do not vendor an external repository blindly.
- Prefer adapting external workflow ideas into Nexus-specific Skills over importing conflicting execution assumptions.

## Validation target

Use the Finance coherence work as the next production-like validation of `nexus-frontend-implementation`. The first target is cross-entity traceability and information architecture across Obligation -> Invoice -> Payment -> Allocation -> Receipt -> Financial Document, without changing domain authority unless the read-contract gap is proven.
