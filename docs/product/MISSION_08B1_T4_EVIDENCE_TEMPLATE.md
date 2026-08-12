# MISSÃO 08B.1 — T4 Evidence Checklist

## Required gates
- [ ] `npm run test:person-resolution`
- [ ] `npm run test:person-resolution-access`
- [ ] `npm run test:enrollment-intake`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] PostgreSQL disposable migration check includes `0008_vnext_enrollment_intake_idempotency.sql`

## Security evidence
- [ ] `reuse_person` without local `student_profiles` row fails closed.
- [ ] idempotency key mismatch rolls back.
- [ ] retry with same fingerprint does not insert Person/Profile/Enrollment again.
- [ ] simulated failure after Person/Profile insertion triggers rollback.
- [ ] no HTTP route added in T4.

## Diff gate
Expected files only:
- `src/db/migrations/0008_vnext_enrollment_intake_idempotency.sql`
- `src/modules/enrollments/enrollment-intake.ts`
- `tests/enrollment-intake.test.ts`
- `package.json`
- T4 documentation/evidence files.
