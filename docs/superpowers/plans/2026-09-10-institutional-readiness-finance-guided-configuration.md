# Institutional Readiness + Finance Guided Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Finance institutionally operable through a server-derived readiness projection and guided configuration UX that lets an authorized administrator resolve missing Finance setup and then complete the real Payment → official Financial Document → private artifact flow.

**Architecture:** Readiness is a derived application projection over existing Finance authorities: InstitutionalContext, effective Financial Profile, effective Fiscal Configuration, effective Financial Document Series, and existing server capabilities. No readiness flag or duplicate Finance configuration authority is persisted. The UI is task-oriented and invokes existing authoritative HTTP commands; all mutations revalidate current server-side context and configuration.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Firebase-authenticated InstitutionalContext, Node test runner/tsx, existing Finance idempotency and Financial Document services.

**Spec:** `docs/superpowers/specs/2026-09-10-institutional-readiness-finance-guided-configuration-design.md`

## Global Constraints

- Firebase proves identity only; institutional authority remains `Identity → Person → Membership → Institution` on the backend.
- Browser never supplies authoritative institution, role, jurisdiction, readiness, official sequence number, settlement truth, or policy result.
- PostgreSQL remains authority for institutional business state.
- Reuse existing Financial Profile, Fiscal Configuration, Financial Document Series, Financial Document, capabilities, idempotency, numbering, and artifact authorities.
- Do not create `finance_ready` or another persisted readiness authority.
- Do not create a second Finance capability taxonomy.
- Do not invent series lifecycle states beyond the current authoritative model.
- Do not implement Angola, Portugal, or other jurisdiction-specific legal rules.
- Prefer no schema changes. If any task proves a migration is necessary, STOP because the Finance/main migration collision remains unresolved.
- Do not modify Documents-owned files.
- `READINESS != AUTHORIZATION` is a P0 invariant.
- Human UAT is mandatory before DONE.

---

## File Structure

Expected focused structure; repository-fit in Task 1 must confirm exact placement before production edits.

- Create: `src/modules/finance/finance-readiness.ts` — pure/application readiness projection and stable requirement codes.
- Create: `src/modules/finance/finance-readiness-http.ts` — tenant-safe read boundary if route registration cannot live cleanly with existing Finance registration.
- Create: `src/modules/finance/finance-readiness-client.ts` — authenticated browser read client using the established bound `window.fetch` pattern.
- Create: `src/components/finance/configuration/FinanceConfigurationWorkspace.tsx` — guided Finance setup surface.
- Create: `src/components/institution/InstitutionConfigurationWorkspace.tsx` — central institutional readiness entry, limited to Finance in this slice.
- Modify: `src/modules/finance/financial-document-http.ts` — only if existing fiscal-configuration/series read/write routes need projection-safe response additions or route registration reuse.
- Modify: `src/components/finance/payments/FinancePaymentsWorkspace.tsx` — contextual incomplete-readiness remediation and return path.
- Modify: `src/components/finance/FinanceWorkspace.tsx` — route/tab integration only.
- Modify: `src/App.tsx` — central configuration navigation only if repository fit proves this is the canonical shell integration point.
- Test: `tests/finance-readiness.test.ts`
- Test: `tests/finance-readiness-http-postgres.test.ts`
- Test: `tests/finance-readiness-client.test.ts`
- Test: `tests/finance-guided-configuration-ui.test.ts`
- Test: existing F7-06/F7-05/F7-04/F7-03/F7-02/F7-01 suites as regressions.

No migration file is planned.

---

### Task 1: Repository Fit + Baseline Lock

**Files:**
- Read: `src/modules/finance/financial-context.ts`
- Read: `src/modules/finance/fiscal-configuration.ts`
- Read: `src/modules/finance/financial-document-series.ts`
- Read: `src/modules/finance/financial-document-http.ts`
- Read: `src/modules/finance/financial-document-policy.ts`
- Read: `src/components/finance/FinanceWorkspace.tsx`
- Read: `src/components/finance/payments/FinancePaymentsWorkspace.tsx`
- Read: `src/App.tsx`
- Read: current Finance F7 tests and UAT preflight scripts.
- Create: no product files.

**Interfaces:**
- Consumes: approved design spec and current Finance F7 branch.
- Produces: exact file manifest, exact existing route/capability reuse map, no-schema decision, baseline SHA and green-gate evidence.

- [ ] **Step 1: Verify branch/worktree/head and migration collision remains external**

Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
```
Expected: isolated Finance implementation worktree, clean baseline, no accidental `main` execution.

- [ ] **Step 2: Inspect existing authority instead of designing inside implementation**

Confirm exact signatures and response shapes for:
```text
requireFinancialContext(...)
PostgresFiscalConfigurationStore.requireEffective(...)
PostgresFinancialDocumentSeriesStore.requireEffective(...)
canAccessFinancialDocuments(...)
GET/POST /api/finance/fiscal-configurations
GET/POST /api/finance/document-series
GET /api/finance/documents
POST /api/finance/documents/issue
```
Expected: reuse map with no parallel authority.

- [ ] **Step 3: Prove baseline before edits**

Run the currently canonical targeted Finance regression chain available on the branch, at minimum:
```bash
npm run test:finance:f7-06
npm run lint
npm run build
```
If the exact script name differs, resolve it from `package.json`; do not invent a replacement command.
Expected: PASS. If baseline fails for unrelated reasons, classify and stop before product edits.

- [ ] **Step 4: Lock implementation manifest**

Record exact planned creates/modifies. If implementation requires a new migration, new IAM taxonomy, Documents ownership change, or new jurisdiction rule, STOP with the corresponding design stop condition.

- [ ] **Step 5: Commit only if a repository-local execution record is required**

No product commit is required merely for inspection. Preserve clean baseline.

---

### Task 2: Finance Readiness Projection

**Files:**
- Create: `src/modules/finance/finance-readiness.ts`
- Test: `tests/finance-readiness.test.ts`

**Interfaces:**
- Consumes: resolved `institutionId`, effective Financial Profile resolver/store, Fiscal Configuration store, Financial Document Series store, and server-derived capabilities.
- Produces:
```ts
export type FinanceReadinessStatus = 'READY' | 'INCOMPLETE' | 'BLOCKED';
export type FinanceReadinessRequirementCode =
  | 'FINANCIAL_PROFILE'
  | 'FISCAL_CONFIGURATION'
  | 'RECEIPT_SERIES';

export type FinanceReadinessRequirement = Readonly<{
  code: FinanceReadinessRequirementCode;
  state: 'COMPLETE' | 'MISSING' | 'BLOCKED';
}>;

export type FinanceReadinessProjection = Readonly<{
  module: 'FINANCE';
  status: FinanceReadinessStatus;
  requirements: readonly FinanceReadinessRequirement[];
  canManageConfiguration: boolean;
}>;

export async function resolveFinanceReadiness(input: {
  institutionId: string;
  at: Date;
  canManageConfiguration: boolean;
  resolveFinancialProfile: () => Promise<unknown>;
  resolveFiscalConfiguration: () => Promise<unknown>;
  resolveReceiptSeries: () => Promise<unknown>;
}): Promise<FinanceReadinessProjection>;
```
Repository fit may refine adapter signatures while preserving these semantics.

- [ ] **Step 1: Write failing readiness tests**

Cover at minimum:
```ts
// no Financial Profile -> INCOMPLETE + FINANCIAL_PROFILE MISSING
// profile present, fiscal config missing -> INCOMPLETE + FISCAL_CONFIGURATION MISSING
// profile + fiscal config present, receipt series missing -> INCOMPLETE + RECEIPT_SERIES MISSING
// all required authority effective -> READY
// capability false does not make readiness incomplete; canManageConfiguration=false
// resolver throws an unexpected integrity/authority error -> BLOCKED, not fake READY
```

- [ ] **Step 2: Run RED**

Run:
```bash
npx tsx tests/finance-readiness.test.ts
```
Expected: FAIL because `finance-readiness.ts`/behavior does not yet exist.

- [ ] **Step 3: Implement minimal derived projection**

Implementation rules:
```ts
// Do not persist readiness.
// Call only resolved-institution authorities.
// Translate known "not effective/missing" outcomes to MISSING requirements.
// Translate unexpected integrity/authority failures to BLOCKED.
// Do not infer jurisdiction defaults or create configuration.
```

- [ ] **Step 4: Run GREEN**

Run:
```bash
npx tsx tests/finance-readiness.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/finance-readiness.ts tests/finance-readiness.test.ts
git commit -m "feat(finance): derive institutional finance readiness"
```

---

### Task 3: Tenant-safe Readiness HTTP Boundary

**Files:**
- Create: `src/modules/finance/finance-readiness-http.ts` if clean separation is confirmed; otherwise minimally modify the existing Finance route registration file.
- Test: `tests/finance-readiness-http-postgres.test.ts`
- Modify: `server.ts` only for route registration if required by the existing pattern.

**Interfaces:**
- Consumes: `req.institutionalContext`, existing Financial Profile/Fiscal Configuration/Series stores, `canAccessFinancialDocuments` capability policy, `resolveFinanceReadiness`.
- Produces: `GET /api/finance/readiness` or the repository-fit-approved equivalent returning only the resolved institution's projection.

- [ ] **Step 1: Write failing PostgreSQL/HTTP tests**

Required cases:
```text
no auth -> 401
no institutional context -> fail closed
foreign tenant data exists -> ignored/non-disclosive
institution with missing receipt series -> 200 INCOMPLETE
fully configured institution -> 200 READY
financial/director role may read where existing policy permits
institution_admin receives canManageConfiguration=true
role without Finance read authority -> 403
browser-supplied institutionId/query/body cannot switch tenant
```

- [ ] **Step 2: Run RED**

Run:
```bash
npx tsx tests/finance-readiness-http-postgres.test.ts
```
Expected: FAIL because readiness route is absent.

- [ ] **Step 3: Implement minimal route**

Pseudo-contract:
```ts
app.get('/api/finance/readiness', requireAuth, async (req, res) => {
  const context = req.institutionalContext;
  // fail closed if missing
  // authorize existing Finance read policy
  // derive canManageConfiguration from existing fiscal_config_manage/series_manage policy
  // resolve readiness using context.institutionId only
  // return projection
});
```
Do not accept `institutionId` as authority from query/body/headers.

- [ ] **Step 4: Run GREEN and tenant regressions**

Run:
```bash
npx tsx tests/finance-readiness-http-postgres.test.ts
npm run test:fnd03
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/finance-readiness-http.ts tests/finance-readiness-http-postgres.test.ts server.ts
git commit -m "feat(finance): expose tenant-safe finance readiness"
```
Add only files actually changed.

---

### Task 4: Authenticated Readiness Client

**Files:**
- Create: `src/modules/finance/finance-readiness-client.ts`
- Test: `tests/finance-readiness-client.test.ts`

**Interfaces:**
- Consumes: Firebase `auth.currentUser?.getIdToken()` and established bound browser fetch pattern.
- Produces:
```ts
export type FinanceReadinessDto = {
  module: 'FINANCE';
  status: 'READY' | 'INCOMPLETE' | 'BLOCKED';
  canManageConfiguration: boolean;
  requirements: Array<{
    code: 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES';
    state: 'COMPLETE' | 'MISSING' | 'BLOCKED';
  }>;
};

export class FinanceReadinessClient {
  get(): Promise<FinanceReadinessDto>;
}
```

- [ ] **Step 1: Write RED client tests**

Prove:
```text
uses bound/window fetch default, never raw unbound globalThis.fetch
attaches bearer token when present
maps 401/403 safely
returns typed readiness on 200
never sends institutionId as tenant authority
```
Include receiver-sensitive fetch regression to prevent recurrence of the F7-06 `Illegal invocation` defect.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-readiness-client.test.ts
```
Expected: FAIL due to missing client.

- [ ] **Step 3: Implement minimal client**

Use the established safe pattern:
```ts
const defaultFetch: typeof fetch = (input, init) => window.fetch(input, init);
```
with SSR/test fallback only if an existing canonical client already defines one; do not invent a third transport abstraction.

- [ ] **Step 4: Run GREEN**

```bash
npx tsx tests/finance-readiness-client.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/finance-readiness-client.ts tests/finance-readiness-client.test.ts
git commit -m "feat(finance): add readiness client"
```

---

### Task 5: Guided Finance Configuration Workspace

**Files:**
- Create: `src/components/finance/configuration/FinanceConfigurationWorkspace.tsx`
- Test: `tests/finance-guided-configuration-ui.test.ts`
- Modify existing Finance document client only if it already owns fiscal-config/series operations; otherwise add focused methods to the established appropriate Finance client after repository fit.

**Interfaces:**
- Consumes: readiness projection; existing GET/POST fiscal-configuration and document-series endpoints; existing server-derived capabilities.
- Produces: task-oriented UI that explains missing Finance requirements and permits authorized remediation without exposing tenant authority or sequence-number control.

- [ ] **Step 1: Write RED UI contract tests**

Required behavior:
```text
INCOMPLETE + RECEIPT_SERIES missing + canManage=true
  -> explains missing receipt series and shows "Concluir configuração" / series setup action
INCOMPLETE + canManage=false
  -> explains missing configuration but exposes no manage mutation action
READY
  -> shows Finance operationally ready, no fake setup warning
BLOCKED
  -> shows safe actionable blocked state, no fake success
series form never asks for institutionId or next sequence number
successful server create -> refresh readiness from backend, do not locally flip READY
server rejects invalid/ineffective series -> UI remains incomplete and displays safe error
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-guided-configuration-ui.test.ts
```
Expected: FAIL because workspace does not exist.

- [ ] **Step 3: Implement task-oriented UI**

Human-language requirements:
```text
Finance
Configuração necessária
1 requisito por concluir

Os recebimentos estão disponíveis, mas ainda não é possível emitir recibos oficiais.
Falta: Série de recibos
```
Authorized users receive a legitimate configuration action. Unauthorized users receive explanation only.

Do not expose raw database vocabulary or sequence-counter editing.

- [ ] **Step 4: Reuse existing series/fiscal configuration commands**

For receipt series creation, send only the currently authorized command fields already supported by the server contract. Generate idempotency keys client-side using the established Finance client pattern. Never create a new write endpoint merely for UX convenience unless repository fit proves the current endpoint cannot express the approved operation safely.

- [ ] **Step 5: Run GREEN**

```bash
npx tsx tests/finance-guided-configuration-ui.test.ts
npm run lint
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/finance/configuration/FinanceConfigurationWorkspace.tsx tests/finance-guided-configuration-ui.test.ts <actual-client-file>
git commit -m "feat(finance): guide institutional finance configuration"
```

---

### Task 6: Central Institutional Configuration Entry + Contextual Remediation

**Files:**
- Create: `src/components/institution/InstitutionConfigurationWorkspace.tsx`
- Modify: `src/components/finance/FinanceWorkspace.tsx`
- Modify: `src/components/finance/payments/FinancePaymentsWorkspace.tsx`
- Modify: `src/App.tsx` only if this is the proven canonical navigation integration point.
- Test: extend `tests/finance-guided-configuration-ui.test.ts`

**Interfaces:**
- Consumes: `FinanceReadinessClient`, `FinanceConfigurationWorkspace`.
- Produces: central institutional configuration orientation for Finance plus contextual "Concluir configuração" path from Payments/Finance.

- [ ] **Step 1: Extend RED UI tests**

Prove:
```text
central institutional configuration displays Finance readiness only for this slice
Finance incomplete -> central surface shows exact missing requirement count/reason
Payments receipt action is blocked by missing effective series but offers remediation only when manage capability exists
contextual action navigates to Finance configuration, not a duplicate form
Finance READY removes configuration-warning path
no module other than Finance gains fake readiness in this slice
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-guided-configuration-ui.test.ts
```
Expected: FAIL for missing integration.

- [ ] **Step 3: Implement minimal central surface**

The first version must not fabricate readiness for Students/Secretariat/Documents. It may present only Finance under the institutional configuration entry until those modules receive their own canonical readiness contracts.

- [ ] **Step 4: Implement contextual navigation**

From Payments/Finance incomplete state:
```text
missing requirement -> explanation -> "Concluir configuração" -> same FinanceConfigurationWorkspace
```
No duplicated mutation forms.

- [ ] **Step 5: Run GREEN + build**

```bash
npx tsx tests/finance-guided-configuration-ui.test.ts
npm run lint
npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/institution/InstitutionConfigurationWorkspace.tsx src/components/finance/FinanceWorkspace.tsx src/components/finance/payments/FinancePaymentsWorkspace.tsx src/App.tsx tests/finance-guided-configuration-ui.test.ts
git commit -m "feat(finance): connect institutional readiness to operations"
```
Add only files actually changed.

---

### Task 7: Real Persistence + Operational End-to-End UAT Gate

**Files:**
- Modify tests only if a missing regression contract is discovered; otherwise no product changes until UAT exposes a proved defect.
- Use existing UAT preflight/runtime guardrails.

**Interfaces:**
- Consumes: completed Tasks 2–6 and existing Financial Document issuance/artifact pipeline.
- Produces: product-level evidence that an institution can become Finance-ready and issue one official receipt through the real browser.

- [ ] **Step 1: Run canonical UAT preflight**

```bash
npm run uat:preflight
```
Expected: PASS with canonical `http://localhost:3000`, correct listener/worktree/head, safe PostgreSQL target and authenticated prerequisites. `HTTP 200` alone is insufficient.

- [ ] **Step 2: Start canonical local UAT runtime**

Use the existing approved UAT bootstrap/server path. Do not use `127.0.0.1` preview for authenticated UAT.

- [ ] **Step 3: Human UAT — incomplete to ready**

Perform in the real browser:
```text
1. Login as authorized institution administrator.
2. Open institutional configuration / Finance.
3. Confirm Finance reports INCOMPLETE with exact missing receipt-series requirement.
4. Click Concluir configuração.
5. Configure a valid effective receipt series using the Nexus UI.
6. Refresh.
7. Confirm Finance readiness is now READY from a new backend query.
```
Expected: no SQL/manual fixture mutation after UAT start.

- [ ] **Step 4: Human UAT — Payment to official document**

Perform:
```text
1. Open confirmed eligible Payment.
2. Issue official receipt.
3. Verify one authoritative Financial Document is returned.
4. Open Financial Documents.
5. Verify the same document appears with series/number/provenance.
6. Open/generate private PDF artifact.
```
Expected: one document, one number, authorized private artifact.

- [ ] **Step 5: Human UAT — persistence**

Perform:
```text
Ctrl+R
logout/login
controlled runtime restart
```
After each boundary, confirm the series/configuration/readiness and issued document remain authoritative and visible.

- [ ] **Step 6: Human UAT — idempotency and negative boundaries**

Prove:
```text
double-click/retry -> same canonical issuance result; no second number
user without manage capability -> no configuration mutation action and server denies forced mutation
user without issue capability -> no issue action and server denies forced issue
foreign tenant -> cannot read/use series/configuration/document
ineffective/missing series -> issuance fails closed
```

- [ ] **Step 7: If UAT exposes a defect, stop and classify before editing**

Use systematic debugging:
```text
IN-SCOPE DEFECT
BLOCKER
PREREQUISITE
FUTURE SCOPE
```
Only IN-SCOPE defects may be fixed under this plan. Root cause must be proven before changes.

---

### Task 8: Full Regression, Documentation Alignment, and Closure

**Files:**
- Modify: execution/progress evidence file if the repository has an established Finance progress record.
- Do not modify canonical architecture unless implementation discovered a separately approved architectural decision.

**Interfaces:**
- Consumes: all completed tasks and UAT evidence.
- Produces: closure SHA, remote parity, clean worktree, no hidden P0/P1 inside slice.

- [ ] **Step 1: Run fresh targeted suites**

Run the exact scripts present on the implementation branch for:
```text
INSTITUTIONAL-READINESS-01 targeted tests
F7-06
F7-05
F7-04
F7-03
F7-02
F7-01
F6
F5
F4
F3
Foundation
lint
build
git diff --check
```
Do not substitute stale prior output. If runner names differ, resolve them from `package.json` and record exact commands.

- [ ] **Step 2: Verify no forbidden authority was introduced**

Search/diff proof must establish:
```text
NO finance_ready persisted flag
NO browser institution authority
NO next-sequence editing
NO new Finance capability taxonomy
NO country-specific branch in shared readiness/UI
NO Documents-owned file changes
NO new migration
```

- [ ] **Step 3: Verify Git integrity**

```bash
git status --short
git log --oneline --decorate -10
git rev-parse HEAD
git rev-parse origin/$(git branch --show-current)
```
Expected: clean worktree and remote parity after normal fast-forward push.

- [ ] **Step 4: Final closure report**

Required output:
```text
INSTITUTIONAL_READINESS_01=PASS|BLOCKED

FINAL_SHA=
REMOTE_SHA=
REMOTE_PARITY=
WORKTREE_CLEAN=

FINANCE_READINESS_DERIVED=PASS
DUPLICATE_READINESS_AUTHORITY_CREATED=NO
DUPLICATE_FINANCE_CONFIGURATION_AUTHORITY_CREATED=NO
READINESS_GRANTS_AUTHORIZATION=NO

FINANCIAL_PROFILE_REUSED=YES
FISCAL_CONFIGURATION_REUSED=YES
DOCUMENT_SERIES_REUSED=YES
EXISTING_CAPABILITY_MODEL_REUSED=YES

CENTRAL_INSTITUTIONAL_CONFIGURATION=PASS
CONTEXTUAL_FINANCE_REMEDIATION=PASS
AUTHORIZED_SERIES_CONFIGURATION=PASS
FINANCE_INCOMPLETE_TO_READY=PASS

REAL_PAYMENT_TO_RECEIPT=PASS
OFFICIAL_DOCUMENT_PERSISTED=PASS
PRIVATE_ARTIFACT=PASS
REFRESH_PERSISTENCE=PASS
LOGOUT_LOGIN_PERSISTENCE=PASS
RUNTIME_RESTART_PERSISTENCE=PASS
DOUBLE_CLICK_IDEMPOTENCY=PASS

CROSS_TENANT_NEGATIVE=PASS
CAPABILITY_NEGATIVE=PASS
INEFFECTIVE_SERIES_FAIL_CLOSED=PASS

NEW_MIGRATION_CREATED=NO
DOCUMENTS_FILES_CHANGED=0
JURISDICTION_SPECIFIC_RULES_ADDED=0

TARGETED=PASS
F7_06=PASS
F7_05=PASS
F7_04=PASS
F7_03=PASS
F7_02=PASS
F7_01=PASS
F6=PASS
F5=PASS
F4=PASS
F3=PASS
FOUNDATION=PASS
LINT=PASS
BUILD=PASS

HUMAN_UAT=PASS

P0_OPEN=
P1_OPEN=

MIGRATION_ADJUDICATION_PENDING=YES
STATIC_INSTITUTIONAL_SEARCH_PLACEHOLDER=YES

READY_FOR_NEXT_CANONICAL_PRIORITY=YES|NO
```

Do not start the next priority automatically.

---

## Plan Self-Review

- Spec coverage: readiness derivation, no duplicated authority, progressive guided setup, contextual remediation, existing capabilities, tenant/security invariants, persistence, idempotency, multi-jurisdiction neutrality, Human UAT and stop rules are mapped to Tasks 1–8.
- Placeholder scan: no TBD/TODO implementation placeholders remain; repository-fit decisions are explicit stop/resolve actions rather than unspecified implementation.
- Type consistency: readiness status/requirement names are defined in Task 2 and reused consistently by Tasks 3–6.
- Scope check: only Finance is the first readiness consumer; generic readiness for other modules remains future scope.
- Migration safety: no migration is planned; any proved need for schema change is a hard stop pending existing migration adjudication.
