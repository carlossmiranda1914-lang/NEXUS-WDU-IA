# FINANCE-F6-01 — Institutional Discount Policy & Contextual Obligation Concession v1 Design

## 1. Status / Authority

- **Status:** SPECIFICATION — NOT IMPLEMENTATION AUTHORITY.
- **Governing Architecture:** Nexus Finance Core Constitution (`docs/finance/FINANCE_FOUNDATION_PREPARATION.md`, F0-D01 to F0-D10), Nexus Master Plan v2 (`docs/product/NEXUS_MASTER_PLAN_V2.md`), and Engineering Playbook (`docs/operations/ENGINEERING_PLAYBOOK.md`).
- **Preceding Baseline:** Finance Foundation (Tasks 1–8), F1 Fee Catalogue, F2 Financial Account & Obligation, F3 Payment Core, F4 Allocation, and F5 Obligation Adjustment & UX V2 (integrated and verified at commit `06d04d5e77251db653c597c5bba0ae6c55537a87`).
- **Implementation Gate:** Implementation is **strictly blocked** until Product Owner approval of this specification.

---

## 2. Product Outcome

An authorized `financial` or `institution_admin` operator can define institutional Discount Policies (percentage rate or fixed amount) with immutable versioning and apply an authorized policy concession to any open, eligible Financial Obligation within the authenticated institution.

Key user-facing outcomes:
1. **Governed Institutional Concessions:** Schools eliminate ad-hoc, untracked price reductions by enforcing versioned, auditable institutional Discount Policies (e.g. *Bolsa de Mérito 20%*, *Desconto de Irmãos 10%*, *Pronto Pagamento 25 EUR*).
2. **Contextual Financial Account Experience:** Concessions are applied and revoked directly from the Financial Account operational workspace through a dedicated contextual drawer (`Cobrança → ... → Aplicar desconto`), maintaining full visibility of the account in the background.
3. **Immutable History & Economic Integrity:** The original Obligation amount remains immutable. Concessions produce distinct, append-only financial facts in the authoritative Financial Journal, update derived balance projections instantly, respect the covered floor (concessions cannot reduce effective debt below what is already paid/covered), and support auditable total revocation.

---

## 3. Economic Semantics

### The Fundamental Distinction: Discount vs Adjustment

| Dimension | Adjustment (F5) | Discount (F6) |
| :--- | :--- | :--- |
| **Economic Meaning** | **Correction of error/defect:** An administrative fix for clerical errors, wrong price items, or contested invoice amounts. | **Policy-governed concession/entitlement:** An authorized reduction granted under defined institutional policies (scholarship, family, merit, prompt payment). |
| **Origin & Nature** | Ad-hoc or reasoned correction targeting a specific mistake. | Standardized institutional policy entitlement. |
| **Direction** | Bidirectional (`increase` or `decrease`). | Strictly **reduction** of payable obligation debt. |
| **Reference Authority** | Justification reason + optional compensation link to prior Adjustment. | Exact immutable Discount Policy Version (`finance_discount_policy_versions`). |
| **Journal Position** | `obligation_due_increased` / `obligation_due_decreased` | `obligation_discount_applied` / `obligation_discount_revoked` |

**Normative Rule:** Discount is **never** an alias or UI re-skin of Adjustment. They represent separate economic authorities, separate Journal positions, and separate analytical streams in institutional reporting.

---

## 4. Explicit Non-Goals (Out of Scope for F6 v1)

The following capabilities are strictly out of scope for F6 v1:
- **Automatic rule engines:** Automated demographic, academic merit, or sibling relationship evaluation engines.
- **Multiple discount stacking / compounding:** Compounding multiple discounts on a single obligation (e.g., 10% sibling + 5% early payment).
- **Partial revocation:** Revoking only a portion of an applied discount fact.
- **Penalty policy:** Late payment surcharges or interest calculations (reserved for F7).
- **Credit balances / credit notes:** Customer deposit credits or overpayment hold accounts (reserved for F8).
- **Cash refunds / disbursements:** Outgoing cash returns to payers (reserved for F9).
- **Bank reconciliation & external payment rails:** Provider transaction matching or automated bank statement feeds.
- **Autonomous AI execution:** AI models independently approving or applying financial concessions without human operator execution.
- **Cross-currency multi-FX recalculation:** Foreign exchange gain/loss accounting across differing currencies.

---

## 5. Existing Authorities Consumed

F6 consumes and builds upon the following frozen, verified capabilities without modification:
1. **Money Authority (`src/modules/finance/money.ts`, `exact-decimal.ts`):** Exact 12-decimal integer fixed-point arithmetic, currency isolation, deterministic rounding (`round_half_up`), and serialized Money envelopes (`{ amount: string, currency: string }`).
2. **Journal Authority (`src/modules/finance/journal-repository.ts`, `journal-model.ts`):** Authoritative double-entry-ready subledger transactions with composite tenant isolation and atomic commit semantics.
3. **Financial Account & Obligation Authority (`src/modules/finance/financial-account-repository.ts`, `financial-obligation-repository.ts`):** Tenant-scoped accounts, primary debtor person binding, obligation issuance, and lifecycle tracking.
4. **Allocation & Reversal Authority (`src/modules/finance/allocation-repository.ts`):** Payment settlement against obligations, locked concurrency control, and allocation reversals.
5. **Adjustment Authority (`src/modules/finance/obligation-adjustment-repository.ts`):** Compensating billing corrections and root compensation linkages.
6. **Institutional Context & Multi-Tenant Middleware (`src/auth/institutional-context.ts`, `src/middleware/multi-tenant.ts`):** Fail-closed server-authoritative institutional scope.

---

## 6. Discount Policy Model (Stable Identity)

Discount policies separate stable administrative identity from immutable economic versions.

### 6.1 Stable Policy Identity (`finance_discount_policies`)

Represents the durable institutional existence of a named policy:

```typescript
export type DiscountPolicyStatus = 'active' | 'archived';

export interface DiscountPolicy {
  readonly id: string;
  readonly institutionId: string;
  readonly code: string; // e.g. "BOLSA-20", "IRMAOS-10"
  readonly status: DiscountPolicyStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### Policy Identity Invariants
1. **Code Uniqueness:** `UNIQUE (institution_id, code)` is strictly enforced per institution.
2. **Stable Reference:** The `id` never changes over the lifetime of the policy.
3. **Archival:** Archiving a policy (`status = 'archived'`) prevents any new version creation or application, but leaves all historical versions and applied discounts intact.

---

## 7. Policy Versioning (Immutable Economic Authority)

Economic terms of a discount policy are stored in immutable, append-only version rows.

### 7.1 Immutable Policy Version (`finance_discount_policy_versions`)

```typescript
export type DiscountCalculationMode = 'percentage' | 'fixed_amount';

export interface DiscountPolicyVersion {
  readonly id: string;
  readonly institutionId: string;
  readonly policyId: string;
  readonly version: number; // 1, 2, 3...
  readonly name: string;
  readonly description: string | null;
  readonly calculationMode: DiscountCalculationMode;
  readonly value: string; // Rate (e.g. "20.00" for 20%) or Fixed amount ("25.00")
  readonly currency: string | null; // Required for fixed_amount, NULL for percentage
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly createdAt: Date;
  readonly actorPersonId: string | null;
}
```

### Policy Versioning Invariants
1. **Append-Only Immutability:** A policy version row is **never updated or deleted**.
2. **Unique Version Sequence:** `UNIQUE (institution_id, policy_id, version)` ensures sequential, non-colliding versions.
3. **Non-Overlapping Effective Intervals (P1-03 Fix):** For one active policy identity and one `applicationInstant`, **at most one** policy version may be economically applicable. Version effective windows `[effectiveFrom, effectiveTo]` for a policy **may not overlap**. Creating a new version with an overlapping effective window is strictly rejected (`OVERLAPPING_VERSION_INTERVAL`).
4. **Future Versions Supported:** A future version may coexist alongside the current version if their effective intervals do not overlap (`future.effectiveFrom > current.effectiveTo`). It does not become applicable until `applicationInstant >= future.effectiveFrom`.
5. **Exact Version Binding:** Applied discounts link directly to the specific `policy_version_id`, guaranteeing that historical concessions are never altered by future policy changes.

### 7.2 Deterministic Version Resolution: `CURRENT_APPLICABLE_VERSION`

$$\text{CURRENT\_APPLICABLE\_VERSION}(\text{policyId}, \text{applicationInstant}) \to \text{DiscountPolicyVersion} \mid \text{null}$$

Resolution rule:
1. Find all versions $V$ belonging to `(institution_id, policy_id)` where:
   $$(V.\text{effectiveFrom} \text{ IS NULL} \lor V.\text{effectiveFrom} \le \text{applicationInstant}) \land (V.\text{effectiveTo} \text{ IS NULL} \lor V.\text{effectiveTo} \ge \text{applicationInstant})$$
2. If exactly $1$ version matches: return that version.
3. If $0$ versions match: the policy is not currently applicable (application fails closed with `DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE`).
4. If $> 1$ versions match: structurally prevented by interval validation on creation; fails closed if detected.

### 7.3 Read Semantics Distinction
Read models explicitly distinguish:
- `latestVersion`: The greatest version number created (for administrative inspection of draft/future versions).
- `currentApplicableVersion`: The unique version currently active at query time (`applicationInstant`), or `null` if future-scheduled or expired. The greatest version number is **never** conflated with the currently active version.

---

## 8. Applied Discount Fact (Append-Only)

An applied discount is an **immutable economic fact** recording an authorized concession granted on an open obligation.

### 8.1 Domain Model (`ObligationDiscount`)

```typescript
export interface ObligationDiscount {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly obligationId: string;
  readonly policyId: string;
  readonly policyVersionId: string;
  readonly policyCode: string;
  readonly policyName: string;
  readonly policyVersion: number;
  readonly calculationMode: DiscountCalculationMode;
  readonly policyValue: string;
  readonly amount: Money; // Authoritative calculated Money amount (snapshot)
  readonly currency: string;
  readonly reason: string;
  readonly journalTransactionId: string;
  readonly appliedAt: Date;
  readonly actorPersonId: string | null;
}
```

### 8.2 Pure Append-Only Economic Authority (P1-01 Fix)
- The table `finance_obligation_discounts` has **NO mutable economic status column** (`status = 'applied' | 'revoked'` is removed from the canonical truth layer).
- Once inserted, an `ObligationDiscount` fact is **strictly immutable**.
- The concept of "active vs revoked" is a **derived projection**, computed deterministically as:
  $$\text{IsActive}(D) \iff \text{No matching record exists in } \text{finance\_obligation\_discount\_revocations for } D.\text{id}$$

---

## 9. Discount Revocation Fact (Separate Compensating Fact)

Revocation of a discount is represented solely by an independent, append-only **compensating fact**.

### 9.1 Domain Model (`ObligationDiscountRevocation`)

```typescript
export interface ObligationDiscountRevocation {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly obligationId: string;
  readonly originalDiscountId: string; // Links to target discount fact
  readonly amount: Money; // Exactly equals originalDiscount.amount
  readonly currency: string;
  readonly reason: string; // Mandatory non-empty justification
  readonly journalTransactionId: string;
  readonly revokedAt: Date;
  readonly actorPersonId: string | null;
}
```

### 9.2 Revocation Invariants
1. **Separate Compensating Fact:** Revocation does not mutate, soft-delete, or overwrite the target discount row.
2. **Single Revocation Constraint:** An applied discount may be revoked **at most once**:
   $$\text{UNIQUE} (\text{institution\_id},\; \text{original\_discount\_id})$$
3. **Exact Amount Reversal:** The revoked amount is identically equal to the target discount's calculated Money amount.
4. **Total Revocation Only:** Partial revocation is strictly out of scope.
5. **Restoration of Payable Capacity:** Revoking an active discount restores the obligation's payable balance, allowing subsequent allocation or a new discount application.

---

## 10. Money & Percentage Calculation

All calculations are strictly server-authoritative using canonical `Money` exact decimal arithmetic.

### 10.1 Percentage Calculation Base

$$\text{PreDiscountDue} = \text{OriginalObligationMoney} + \text{NetAdjustments}$$

Where:
$$\text{NetAdjustments} = \sum(\text{Adjustment increases}) - \sum(\text{Adjustment decreases})$$

$$\text{CalculatedDiscountAmount} = \text{Quantize}\left(\text{PreDiscountDue} \times \frac{\text{PercentageRate}}{100},\; \text{CurrencyScale},\; \text{round\_half\_up}\right)$$

### 10.2 Snapshot Immutability
- Applying a 20% discount on a pre-discount due of $100.00\text{ EUR}$ creates an immutable discount fact of $20.00\text{ EUR}$.
- If an administrative adjustment is later posted (e.g. $+10.00\text{ EUR}$), the historical discount fact **remains exactly $20.00\text{ EUR}$**.
- Historical discounts are **never** retroactively recalculated.

### 10.3 Fixed Amount Calculation
- For fixed amount policies, $\text{CalculatedDiscountAmount} = \text{PolicyFixedMoney}$.
- If $\text{PolicyFixedMoney} > (\text{effectiveDue} - \text{netCovered})$, the application is **strictly rejected** with a floor violation error (`422/409`). It is never silently clamped.

---

## 11. Derived Obligation Financial Position

The server maintains **one unified, canonical derived position calculation** for an obligation across all financial operations.

### Canonical Formula Derived from Facts (P1-01 Fix)

```typescript
export interface ObligationFinancialPositionInput {
  readonly original: Money;
  readonly adjustments: readonly { readonly direction: 'increase' | 'decrease'; readonly amount: Money }[];
  readonly discounts: readonly { readonly id: string; readonly amount: Money }[];
  readonly discountRevocations: readonly { readonly originalDiscountId: string; readonly amount: Money }[];
  readonly allocations: readonly Money[];
  readonly allocationReversals: readonly Money[];
}

export interface ObligationFinancialPosition {
  readonly netAdjustments: Money;
  readonly grossDiscounts: Money;
  readonly revokedDiscounts: Money;
  readonly netDiscounts: Money;
  readonly effectiveDue: Money;
  readonly netCovered: Money;
  readonly remainingCoverable: Money;
}
```

$$\text{netAdjustments} = \sum \text{adjustment increases} - \sum \text{adjustment decreases}$$

$$\text{grossDiscounts} = \sum_{D \in \text{discounts}} D.\text{amount}$$

$$\text{revokedDiscounts} = \sum_{R \in \text{discountRevocations}} R.\text{amount}$$

$$\text{netDiscounts} = \text{grossDiscounts} - \text{revokedDiscounts}$$

$$\text{effectiveDue} = \text{original} + \text{netAdjustments} - \text{netDiscounts}$$

$$\text{netCovered} = \sum \text{allocations} - \sum \text{allocationReversals}$$

$$\text{remainingCoverable} = \text{effectiveDue} - \text{netCovered}$$

### Mandatory Invariants Enforced by Position Engine
1. $\text{effectiveDue} \ge \text{netCovered}$
2. $\text{remainingCoverable} \ge 0.00$
3. $\text{netDiscounts} \ge 0.00$
4. Currency match across all components.

---

## 12. Journal Semantics

The typed Financial Journal is extended with distinct economic subledger movements.

```typescript
// Transaction Type Extension
export type DiscountJournalType = 'obligation_discount';
export type JournalTransactionType = 
  | FoundationJournalType 
  | AllocationJournalType 
  | ObligationAdjustmentJournalType 
  | DiscountJournalType;

// Position Type Extension
export type DiscountPositionType = 
  | 'obligation_discount_applied' 
  | 'obligation_discount_revoked';

export type JournalPositionType = 
  | FoundationPositionType 
  | AllocationPositionType 
  | ObligationAdjustmentPositionType 
  | DiscountPositionType;
```

### Journal Booking Rules
1. **Discount Application:** Entry `{ positionType: 'obligation_discount_applied', money: discountAmount, sourceRef: obligationId }`.
2. **Discount Revocation:** Entry `{ positionType: 'obligation_discount_revoked', money: discountAmount, sourceRef: obligationId }`.

---

## 13. Persistence & Tenant Isolation (Tenant-Safe Composite FKs)

All relationships enforce multi-tenant composite foreign keys (`(institution_id, ...)`) to structurally prevent cross-institution references (P1-03 Fix).

### Schema Blueprint (`src/db/schema.ts`)

```sql
-- 1. Stable Policy Identity
CREATE TABLE finance_discount_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_finance_discount_policies_tenant_id UNIQUE (institution_id, id),
  CONSTRAINT uq_finance_discount_policies_code UNIQUE (institution_id, code)
);

-- 2. Immutable Policy Versions
CREATE TABLE finance_discount_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  calculation_mode VARCHAR(32) NOT NULL CHECK (calculation_mode IN ('percentage', 'fixed_amount')),
  value NUMERIC(30, 12) NOT NULL CHECK (value > 0),
  currency VARCHAR(3) CHECK (currency IS NULL OR length(currency) = 3),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_person_id UUID,
  CONSTRAINT uq_discount_policy_versions_tenant_id UNIQUE (institution_id, id),
  CONSTRAINT uq_discount_policy_version_seq UNIQUE (institution_id, policy_id, version),
  CONSTRAINT fk_policy_versions_policy FOREIGN KEY (institution_id, policy_id)
    REFERENCES finance_discount_policies(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT chk_discount_policy_mode_currency CHECK (
    (calculation_mode = 'percentage' AND currency IS NULL AND value <= 100) OR
    (calculation_mode = 'fixed_amount' AND currency IS NOT NULL)
  ),
  CONSTRAINT chk_discount_policy_effective_window CHECK (
    effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to
  )
);

-- 3. Obligation Applied Discounts (Append-Only Fact)
CREATE TABLE finance_obligation_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  obligation_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  policy_version_id UUID NOT NULL,
  policy_code VARCHAR(64) NOT NULL,
  policy_name VARCHAR(255) NOT NULL,
  policy_version INTEGER NOT NULL,
  calculation_mode VARCHAR(32) NOT NULL CHECK (calculation_mode IN ('percentage', 'fixed_amount')),
  policy_value NUMERIC(30, 12) NOT NULL,
  amount NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  journal_transaction_id UUID NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_kind VARCHAR(32) NOT NULL DEFAULT 'human',
  actor_person_id UUID,
  CONSTRAINT uq_obligation_discounts_tenant_id UNIQUE (institution_id, id),
  CONSTRAINT fk_obligation_discounts_policy FOREIGN KEY (institution_id, policy_id)
    REFERENCES finance_discount_policies(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_policy_version FOREIGN KEY (institution_id, policy_version_id)
    REFERENCES finance_discount_policy_versions(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_account FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_obligation FOREIGN KEY (institution_id, obligation_id)
    REFERENCES finance_obligations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_obligation_discounts_journal FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

-- 4. Obligation Discount Revocations (Append-Only Compensating Fact)
CREATE TABLE finance_obligation_discount_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL,
  obligation_id UUID NOT NULL,
  original_discount_id UUID NOT NULL,
  amount NUMERIC(30, 12) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  journal_transaction_id UUID NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_kind VARCHAR(32) NOT NULL DEFAULT 'human',
  actor_person_id UUID,
  CONSTRAINT uq_discount_single_revocation UNIQUE (institution_id, original_discount_id),
  CONSTRAINT fk_discount_revocations_discount FOREIGN KEY (institution_id, original_discount_id)
    REFERENCES finance_obligation_discounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_discount_revocations_account FOREIGN KEY (institution_id, financial_account_id)
    REFERENCES finance_financial_accounts(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_discount_revocations_obligation FOREIGN KEY (institution_id, obligation_id)
    REFERENCES finance_obligations(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_discount_revocations_journal FOREIGN KEY (institution_id, journal_transaction_id)
    REFERENCES finance_journal_transactions(institution_id, id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_discount_policies_tenant ON finance_discount_policies(institution_id, status);
CREATE INDEX idx_discount_policy_versions_tenant ON finance_discount_policy_versions(institution_id, policy_id, version);
CREATE INDEX idx_obligation_discounts_lookup ON finance_obligation_discounts(institution_id, obligation_id);
CREATE INDEX idx_obligation_discounts_account ON finance_obligation_discounts(institution_id, financial_account_id);
CREATE INDEX idx_discount_revocations_lookup ON finance_obligation_discount_revocations(institution_id, obligation_id);
```

---

## 14. Authorization

| Role | Policy Create/Version/Archive | Apply Discount | Revoke Discount | Read / View Context |
| :--- | :---: | :---: | :---: | :---: |
| `institution_admin` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** |
| `financial` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** |
| `director` | *DENIED* (403) | *DENIED* (403) | *DENIED* (403) | **ALLOWED** |
| `secretariat` | *DENIED* (403) | *DENIED* (403) | *DENIED* (403) | *DENIED* (403) |
| `teacher` / `student` / `parent` | *DENIED* (403) | *DENIED* (403) | *DENIED* (403) | *DENIED* (403) |

---

## 15. Idempotency

All write commands execute through `executeIdempotentFinanceCommand`:
- `finance.discount.policy.create`
- `finance.discount.policy.version`
- `finance.obligation.discount.apply`
- `finance.obligation.discount.revoke`

Fingerprints compute canonical SHA-256 over institutional context and payload. Identical key + identical payload replays `200 OK`; differing payload returns `409 Conflict`.

---

## 16. Concurrency & Lock Order

Global Finance Lock Hierarchy:

$$\begin{aligned}
\text{Step 1: } & \text{LOCK Financial Account (FOR UPDATE)} \\
\text{Step 2: } & \text{LOCK Obligation (FOR UPDATE)} \\
\text{Step 3: } & \text{LOCK Existing Allocations \& Reversals (FOR UPDATE)} \\
\text{Step 4: } & \text{LOCK Existing Adjustments (FOR UPDATE)} \\
\text{Step 5: } & \text{LOCK Existing Discounts \& Revocations (FOR UPDATE)} \\
\text{Step 6: } & \text{Re-derive Position \& Verify Floor Constraint Invariant} \\
\text{Step 7: } & \text{Insert Journal Entry \& Fact Record}
\end{aligned}$$

---

## 17. HTTP Contracts

### 17.1 Policy Management Endpoints

#### `GET /api/finance/discount-policies`
Returns policy definitions with both `latestVersion` (administrative greatest sequence) and `currentApplicableVersion` (unique version effective at server query instant, or `null` if not currently effective).
- **Response Shape:**
```json
[
  {
    "id": "e8b2f913-64a1-4328-8d01-e23f03a6bc41",
    "institutionId": "inst-1",
    "code": "BOLSA-20",
    "status": "active",
    "latestVersion": {
      "id": "ver-2",
      "version": 2,
      "name": "Bolsa de Mérito 25%",
      "calculationMode": "percentage",
      "value": "25.00",
      "effectiveFrom": "2027-09-01T00:00:00.000Z",
      "effectiveTo": "2028-08-31T23:59:59.999Z"
    },
    "currentApplicableVersion": {
      "id": "ver-1",
      "version": 1,
      "name": "Bolsa de Mérito 20%",
      "calculationMode": "percentage",
      "value": "20.00",
      "effectiveFrom": "2026-09-01T00:00:00.000Z",
      "effectiveTo": "2027-08-31T23:59:59.999Z"
    }
  }
]
```

#### `POST /api/finance/discount-policies`
Creates a new policy identity + version 1.
- **Request Body:**
```json
{
  "code": "BOLSA-20",
  "name": "Bolsa de Mérito 20%",
  "description": "Bolsa de mérito académico",
  "calculationMode": "percentage",
  "value": "20.00",
  "currency": null,
  "effectiveFrom": "2026-09-01T00:00:00.000Z",
  "effectiveTo": "2027-08-31T23:59:59.999Z"
}
```
- **Response:** `201 Created`

#### `POST /api/finance/discount-policies/:id/versions` (P1-02 / P1-03 Fix)
Creates a new immutable economic version for an existing policy. Fails with `422 DISCOUNT_POLICY_OVERLAPPING_INTERVAL` if `[effectiveFrom, effectiveTo]` overlaps with any existing version of the policy.
- **Request Body:**
```json
{
  "name": "Bolsa de Mérito 25%",
  "description": "Atualização da bolsa para 25%",
  "calculationMode": "percentage",
  "value": "25.00",
  "currency": null,
  "effectiveFrom": "2027-09-01T00:00:00.000Z",
  "effectiveTo": "2028-08-31T23:59:59.999Z"
}
```
- **Response:** `201 Created` with `{ policyId, version: 2, ... }`

#### `PATCH /api/finance/discount-policies/:id/archive`
Sets `status = 'archived'`.

---

### 17.2 Obligation Concession Endpoints

#### `POST /api/finance/obligations/:obligationId/discounts`
Applies the policy version. If `discountPolicyId` is passed, the server automatically resolves `CURRENT_APPLICABLE_VERSION(policyId, applicationInstant)`; if explicit `discountPolicyVersionId` is passed, the server verifies it matches the applicable version at `applicationInstant`.
- **Request Body:**
```json
{
  "discountPolicyVersionId": "7b0a8806-031e-42c2-8414-b6d85915d311",
  "reason": "Atribuição de Bolsa de Mérito."
}
```
- **Response:** `201 Created` with applied discount fact and updated position.

#### `POST /api/finance/obligations/:obligationId/discounts/:discountId/revoke`
- **Request Body:**
```json
{
  "reason": "Perda de elegibilidade por transferência."
}
```
- **Response:** `200 OK` with revocation fact and restored position.

---

## 18. Policy Management UX

- **Location:** `FinanceWorkspace` → Sub-tab `Catálogo de Emolumentos & Políticas` → Section `Políticas de Desconto`.
- **Interface:** Clean, compact table showing Policy Code, Name, Current Version, Mode/Value badge, Validity Window, and Actions (`Nova Versão`, `Arquivar`).

---

## 19. Contextual Application / Revocation UX

- **Location:** `FinanceOperationalContextWorkspace` (Financial Account view retained in background).
- **Entry Points:**
  - Charge row `...` menu → `Aplicar desconto institucional` (if no active discount).
  - Charge row `...` menu → `Revogar desconto` (if active discount present).
- **Drawer Elements:** Charge context header, Policy selection dropdown, before → discount → after financial preview, reason input, floor validation banner, and submit CTA.

---

## 20. Adaptive Nexus Boundaries

- **Permitted Guidance:** Suggest eligible active policies, auto-derive live preview, flag floor boundary capacity.
- **Forbidden Action:** Never silently apply discounts, never override covered floors, never auto-approve concessions without human operator confirmation.

---

## 21. Error Model

| Error Code | Status | Condition | Operator Message |
| :--- | :---: | :--- | :--- |
| `DISCOUNT_UNAUTHORIZED` | 401 | Missing authentication | Sessão expirada. Inicie sessão novamente. |
| `DISCOUNT_FORBIDDEN` | 403 | Unauthorized role | Não tem permissões para gerir descontos financeiros. |
| `DISCOUNT_NOT_FOUND` | 404 | Obligation or Policy Version ID missing | Obrigação ou versão de política de desconto não encontrada. |
| `DISCOUNT_ALREADY_ACTIVE` | 409 | Active discount already present | Esta cobrança já possui um desconto ativo. Revogue-o antes de aplicar um novo. |
| `DISCOUNT_ALREADY_REVOKED` | 409 | Target discount is already revoked | Este desconto já se encontra revogado. |
| `DISCOUNT_FLOOR_VIOLATION` | 422 | Discount exceeds available unallocated debt | O desconto não pode reduzir o valor devido abaixo do montante já liquidado. |
| `DISCOUNT_INACTIVE_POLICY` | 422 | Policy archived | A política de desconto selecionada encontra-se arquivada. |
| `DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE` | 422 | No version effective at applicationInstant | A política de desconto não possui nenhuma versão em vigor nesta data. |
| `DISCOUNT_POLICY_OVERLAPPING_INTERVAL` | 422 | Proposed version interval overlaps existing version | O intervalo de vigência da versão sobrepõe-se a uma versão existente. |
| `DISCOUNT_CURRENCY_MISMATCH`| 422 | Policy currency != Obligation currency | A moeda da política de desconto não coincide com a cobrança. |
| `DISCOUNT_CONFLICT` | 409 | Idempotency fingerprint conflict | Conflito de submissão na operação de desconto. |

---

## 22. Accessibility, Theme, Responsive & Motion

- **Accessibility:** WCAG 2.1 AA dialog role, focus trap, Escape key close, focus restoration.
- **Themes:** Dedicated Nexus Aurora light and dark tokens, contrast $\ge 4.5:1$.
- **Responsive:** Fluid transition to full width on mobile viewports ($<640\text{px}$) with no horizontal overflow.
- **Motion:** Microinteractions $\le 150\text{ms}$, disabled under `prefers-reduced-motion: reduce`.

---

## 23. UAT Fixture

Extended in `scripts/provision-local-finance-uat.ts`:
- **Account:** `UAT — Finance Discount 100-40-60`
- **Obligation:** `UAT-F6-DISCOUNT-100-40-60` (Original: `100.00 EUR`, Covered: `40.00 EUR`, Remaining: `60.00 EUR`, 0 Discounts).
- **Policies:**
  1. `BOLSA-20` (v1: `20.00%` percentage)
  2. `IRMAOS-10` (v1: `10.00 EUR` fixed)
  3. `EXCEDENTE-70` (v1: `70.00 EUR` fixed — for floor violation testing)

---

## 24. Comprehensive Behavioral, PostgreSQL & Browser Proof Matrix (P1-04 Fix)

### 24.1 MONEY / POLICY PROOFS
- **Percentage calculation exactness:** Verifies `Quantize(100.00 * 20% = 20.00)` and non-trivial fractions with `round_half_up`.
- **Fixed amount exactness:** Verifies exact `10.00 EUR` deduction.
- **Canonical Money rounding reuse:** Reuses `exact-decimal.ts` / `money.ts` without custom rounding hacks.
- **Policy version immutability:** Verifies creating version 2 preserves version 1 without row mutation.
- **Overlapping version interval rejection:** Verifies creating a version whose `[effectiveFrom, effectiveTo]` overlaps with an existing version fails closed with `422 DISCOUNT_POLICY_OVERLAPPING_INTERVAL`.
- **Future version does not become applicable early:** Verifies a version with future `effectiveFrom` cannot be applied before its effective window even if it is the highest version sequence number.
- **Current version resolves correctly:** Verifies applying a policy resolves the unique immutable version effective at `applicationInstant`.
- **No-version-applicable fails closed:** Verifies applying a policy with no version currently in effect at `applicationInstant` fails closed with `422 DISCOUNT_POLICY_NOT_CURRENTLY_APPLICABLE`.
- **Archived policy rejection:** Fails application attempt when policy `status = 'archived'`.
- **Out-of-effective-window rejection:** Fails when transaction time is outside `[effectiveFrom, effectiveTo]`.
- **Currency semantics:** Rejects fixed discount policy in `USD` against an `EUR` obligation.

### 24.2 AUTHORITY / TENANCY PROOFS
- **Foreign-tenant policy rejection:** Fails closed if policy belongs to another institution.
- **Foreign-tenant policy version rejection:** Fails closed if policy version belongs to another institution.
- **Foreign-tenant account & obligation rejection:** Cross-tenant IDs fail closed without data disclosure.
- **Cross-tenant Journal reference negative proof (PostgreSQL):** Explicit test verifies that inserting a discount or discount revocation with a `journal_transaction_id` belonging to a foreign institution is rejected by the composite foreign key `(institution_id, journal_transaction_id) REFERENCES finance_journal_transactions(institution_id, id)` and causes transactional rollback.
- **Director read-only:** `director` role receives `403 Forbidden` on create, version, apply, and revoke.
- **Unauthorized mutation rejection:** Unauthenticated requests receive `401 Unauthorized`.

### 24.3 DISCOUNT ECONOMICS PROOFS
- **One active discount invariant:** Rejects second apply while active discount exists (`409`).
- **Covered floor invariant:** Rejects discount reducing effective due below `netCovered` (`422/409`).
- **Original Obligation immutable:** Verifies `finance_obligations.amount` is untouched after apply and revoke.
- **Original Discount immutable:** Verifies `finance_obligation_discounts` fact is untouched after revocation.
- **Revocation once-only:** Second revocation attempt on same discount fails (`409`).
- **Total revocation exact amount:** Restores exact calculated Money amount to payable balance.
- **New discount allowed after revocation:** Once revoked, a new discount under any active policy succeeds.
- **Stacking rejected:** Attempting multiple concurrent discounts on single charge fails.

### 24.4 IDEMPOTENCY PROOFS
- **Apply replay:** Replaying identical `Idempotency-Key` + fingerprint returns `200 OK` (`replayed: true`).
- **Apply conflict:** Differing payload with same key returns `409 Conflict`.
- **Revoke replay & conflict:** Verifies replay and conflict behavior on revocation.
- **Policy create & version replay:** Verifies idempotency across policy definition commands.

### 24.5 CONCURRENCY PROOFS
- **Apply × Apply Race:** Two concurrent apply commands on same obligation: exactly 1 commits (`201`), 1 fails (`409 ALREADY_ACTIVE`).
- **Apply × Allocation Race:** Concurrent Apply and Payment Allocation: serialized by account/obligation locks; covered floor is strictly preserved under race conditions.
- **Apply × Adjustment Race:** Concurrent Apply and Decrease Adjustment: serialized; cumulative reduction never exceeds unallocated balance.
- **Apply × Allocation Reversal Race:** Reversal frees covered amount; serialized without deadlock.
- **Revoke × Allocation Race:** Revocation increases available capacity; allocation succeeds cleanly.
- **Revoke × Adjustment Race:** Serialized; no balance corruption.
- **Revoke × Discount Apply Race:** Serialized; new discount succeeds only after revocation commits.
- **Competing Revoke × Revoke Race:** Exactly 1 revocation commits; 1 fails (`409 ALREADY_REVOKED`).

### 24.6 POSITION & JOURNAL PROOFS
- **Single position authority:** Unit tests verify identical position output across all consumers.
- **Position rebuild consistency:** Rebuilding position from raw Journal facts equals derived aggregate.
- **Journal application linkage:** Verifies Journal entry references `obligationId` and matches discount amount.
- **Journal revocation linkage:** Verifies compensating Journal entry is created.
- **Rollback atomicity:** Injected failure rolls back both Journal and Discount facts atomically.

### 24.7 HTTP & CLIENT PROOFS
- **Policy management endpoints:** Validates `GET`, `POST`, `POST /versions`, and `PATCH /archive`.
- **Concession endpoints:** Validates apply and revoke contracts.
- **Server authority:** Browser cannot dictate calculated discount amount for percentage policies.
- **Tenant non-disclosure:** Unknown/foreign IDs return generic `404` or `403`.

### 24.8 UI & COMPONENT PROOFS
- **Policy management view:** Renders policies table, version badges, creation modal.
- **Contextual menu entry:** Renders `Aplicar desconto` when eligible, `Revogar desconto` when active.
- **Drawer presentation:** Renders over retained account context, live preview calculation, reason input.
- **Floor preventive validation:** Flags invalid fixed discount before submit.
- **Operational history:** Displays applied and revoked discount facts with reason and policy name.

### 24.9 REAL BROWSER E2E PROOFS
- Persistent runtime execution on `http://localhost:3000`.
- Policy creation and versioning.
- Contextual drawer opening and percentage discount application.
- Balance verification (`100 EUR - 20 EUR = 80 EUR effective, 40 EUR remaining`).
- Floor violation warning display.
- Revocation flow and balance restoration (`100 EUR effective, 60 EUR remaining`).
- Light/Dark theme switching, responsive viewport ($375\text{px}$ / $768\text{px}$), keyboard focus/tab/escape, and reduced motion.
- Runtime SHA parity validation.

---

## 25. Temporal Authority Clarification (`POLICY_TIME_AUTHORITY`)

### 25.1 Single Server-Authoritative Instant
A command-level `applicationInstant: Date` is sampled **exactly once server-side** at the entry of the command handler:
$$\text{applicationInstant} = \text{new Date()}$$

- **Zero Browser Clock Authority (`BROWSER_TIME_AUTHORITY = NO`):** The client/browser clock is never trusted or queried.
- **Governing Scope:** The exact same sampled `applicationInstant` strictly governs:
  1. Policy effective-window eligibility: evaluates whether $\text{applicationInstant} \in [V.\text{effectiveFrom}, V.\text{effectiveTo}]$;
  2. Discount economic application semantics: determines base obligation position at that instant;
  3. The immutable application fact timestamp: stored in `finance_obligation_discounts.applied_at` (or `revoked_at`);
  4. Command idempotency and audit provenance.

### 25.2 Distinction Between Economic Instant and Physical Database Instant
- **Economic / Application Instant (`applied_at` / `revoked_at`):** The domain-level economic timestamp determined by `applicationInstant`.
- **Database Recorded Instant (`created_at` / `recorded_at`):** The PostgreSQL physical commit/write timestamp (`clock_timestamp()`).
- In accordance with Finance temporal law, the spec preserves both concepts distinctly without collapsing them.

---

## 26. Codex → Antigravity Delivery Contract

- **Codex (Writer 1):** Implements complete deterministic stack (migrations, domain, repositories, Journal, position engine, HTTP, client, React components, and automated test matrix). Delivers **GREEN** commit on `codex/finance-f6-discount-policy-v1`.
- **Antigravity (Writer 2):** Takes over after deterministic implementation passes. Executes runtime preflight, local UAT provisioning, real browser verification, visual/theme/accessibility checks, and prepares final UAT gate for Product Owner.

---

## 27. Product Owner Decisions (D01 / D02 / D03)

- **D01 — Calculation Modes:** Approved. Supports `percentage` (exact half-up rounding against pre-discount due) and `fixed_amount` (exact Money in obligation currency).
- **D02 — Active Discount Multiplicity:** Approved. Maximum **one active discount** per obligation in v1.
- **D03 — Revocation Semantics:** Approved. Total explicit revocation only, creating an immutable compensating fact, restoring payable balance, and enabling subsequent new concessions.

---

## 28. Acceptance Criteria

1. **Policy Management:** Financial admins can create, list, version, and archive percentage and fixed-amount discount policies.
2. **Contextual Concession:** Operators can apply an active discount policy to an open obligation from the Financial Account workspace with instant before/after preview.
3. **Floor Invariant:** System strictly blocks any discount that would reduce `effectiveDue` below `netCovered`.
4. **Total Revocation:** Active discounts can be revoked with a mandatory reason, immediately restoring the payable balance.
5. **Immutable Journal & Facts:** Every application and revocation generates an append-only Journal entry and immutable fact row with composite tenant FKs.
6. **No Regressions:** All existing F1–F5 test suites pass with 0 errors.

---

## 29. Out-of-Scope Future Evolution

- **F7:** Late Payment Penalties & Interest Rules.
- **F8:** Customer Credit Balances & Advance Holds.
- **F9:** Cash Refunds & Disbursement Lifecycle.
- **F10:** External Payment Gateway & Bank Reconciliation.
