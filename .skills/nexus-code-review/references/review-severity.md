# Review severity

Use severity for defects, not effort estimates.

- **BLOCKER** — unsafe to integrate: credible tenant escape, privilege escalation, secret exposure, destructive/corrupting persistence behavior, or violation that defeats a mandatory Foundation/mission gate.
- **CRITICAL** — material security, authorization, data-integrity or product-truth defect likely to affect protected behavior, but not necessarily an immediate integration-wide blocker.
- **MAJOR** — functional/regression defect, missing required negative path, accessibility barrier to a core task, or important acceptance criterion not satisfied.
- **MINOR** — bounded correctness, maintainability, consistency or usability issue that should be fixed but does not invalidate the core contract.
- **OBSERVATION** — optional improvement or follow-up. Never present it as a defect or use it to expand the authorized scope.

Finding format:
`[SEVERITY] <short title> — <violated invariant>`
Then provide evidence, impact and the smallest safe correction.
