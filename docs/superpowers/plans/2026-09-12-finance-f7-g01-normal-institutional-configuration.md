# F7-G01 — Normal Institutional Configuration

## Fixed architecture

- Keep Fiscal Configuration adapter-governed.  No row, series, sentinel, or
  nullable adapter exists before a production jurisdiction policy is available.
- Configure the institution legal profile and Finance profile through
  tenant-scoped, capability-gated APIs.  The server derives the institution.
- When a profile has an unsupported jurisdiction, readiness is explicitly
  blocked by `JURISDICTION_POLICY_UNAVAILABLE`; it is not represented as an
  incomplete synthetic fiscal setup.
- Preserve `NEXUS_TEST` and `core` exclusively in explicit UAT composition.

## Execution plan

1. Add RED coverage for profile APIs, capability/tenant barriers, versioning,
   and the readiness state machine including supported-registry compatibility.
2. Add minimal profile command/routes and shared policy action semantics.
3. Make readiness resolve legal profile, financial profile, policy availability,
   then fiscal configuration and series in order.
4. Harden series creation so policy/configuration are server-resolved and
   tenant/effectivity checked before insertion.
5. Replace the normal client’s synthetic fiscal request with legal/financial
   profile intents and a safe blocked-state presentation.
6. Run targeted PostgreSQL/HTTP/UI tests, authority regressions, lint, build,
   diff and repository security gates; perform normal authenticated UAT only
   after machine evidence is green.

## Non-goals

No migration, production adapter, Angola rules, PDF work, Aurora redesign,
Documentary Snapshot V2 changes, or browser-owned jurisdiction authority.
