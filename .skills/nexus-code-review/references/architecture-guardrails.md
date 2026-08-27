# Architecture guardrails

Use current repository ADRs and canonical docs as the factual source; this file is a review index, not an alternative architecture.

- Preserve the Identity -> Person -> Membership -> Institution -> Resources separation where applicable.
- Treat PostgreSQL/backend context as authorization authority; browser/client state is never sufficient authorization evidence.
- Treat institutional roles/capabilities as contextual, not global identity attributes.
- Keep Platform Admin and Institution Admin semantics distinct.
- Require explicit tenant/institution ownership on protected resources and server-side enforcement on reads and writes.
- Fail closed when ownership, membership, capability or institutional context is missing/ambiguous.
- Do not introduce a second persistence authority, runtime business DDL, localStorage business truth or mock/demo success paths into production flows.
- Preserve migration/schema authority and existing write fences.
- Do not infer that a Foundation invariant may be weakened because a later feature needs a shortcut.

When a changed surface disagrees with current canonical repository documentation, report the disagreement instead of silently selecting this summary.
