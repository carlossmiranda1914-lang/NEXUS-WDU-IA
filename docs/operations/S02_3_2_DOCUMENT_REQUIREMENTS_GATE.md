# S02.3.2 — Document Requirements Gate

Status: in validation.

## Invariants

- Document requirements are versioned per enrollment offer.
- At most one policy version is active for an offer.
- Enrollment intake captures the active policy inside the intake transaction.
- Captured requirements are materialized on the enrollment as historical snapshot data.
- No active policy is distinct from an explicitly configured policy with zero requirements.
- Transition to `validated` fails closed when no policy was captured.
- Transition to `validated` fails while any required document is not `verified`.
- Optional documents do not block validation.
- Existing enrollment identity, institutional isolation, idempotency, lifecycle and document gates remain regression-protected.

## Automated evidence

`.github/workflows/secretariat-ci.yml` runs the S02.3.2 policy, integration, PostgreSQL versioning, S02.3.1 document regression, intake/lifecycle regression, isolated migrations, TypeScript and production build gates on relevant pushes and pull requests.
