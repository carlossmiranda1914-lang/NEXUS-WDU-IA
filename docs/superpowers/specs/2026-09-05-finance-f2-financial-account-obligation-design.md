# NEXUS EDU IA — FINANCE-F2-01
## Financial Account + Financial Obligation Core Specification

**State:** APPROVED SPECIFICATION  
**Scope:** Financial Account authority, Financial Obligation authority, Money snapshot law, `IssueFinancialObligation` canonical command, manual issuance flow, PostgreSQL persistence, and Finance workspace integration.  
**Non-goals:** Payments, settlement, partial payment, allocation, reconciliation, invoices, fiscal documents, discounts, penalties, installments, automated enrollment runtime.

---

## 1. Domain Constitution & Principles

### 1.1 Financial Account Domain Law
A **Financial Account** is the institution-scoped unit of financial responsibility.
- It is **NOT** a Person, Student, Guardian, Representative, or Payment Method.
- It references existing `Person` authority as responsible party (`FinancialAccountParty`).
- It generates a human-readable operational reference server-side (e.g. `CTA-000001` or `ACC-000001` per institution).
- It tracks lifecycle status: `active` | `inactive`.
- It maintains tenant isolation: `institution_id` scopes all reads, mutations, and foreign relationships.

### 1.2 Financial Obligation Domain Law
A **Financial Obligation** is the canonical record establishing that a legitimate economic amount is due under an authorized cause/context.
- It is **NOT** a payment, invoice, allocation, reconciliation fact, or mutable balance.
- It is an immutable economic snapshot of the applicable Fee Catalogue item and version at issuance.
- It records:
  - `id` (UUID)
  - `institutionId` (UUID)
  - `financialAccountId` (UUID)
  - `beneficiaryPersonId` (UUID nullable, referencing a Person e.g. student beneficiary)
  - `sourceType` (`manual_finance` | future `enrollment`, `academic_process`, `service_request`)
  - `sourceRef` (string)
  - `feeCatalogueItemId` (UUID)
  - `feeCatalogueVersion` (integer)
  - `amount` (exact numeric string) & `currency` (3-letter uppercase ISO)
  - `effectiveAt` (timestamp)
  - `dueAt` (timestamp nullable)
  - `status` (`open` | `cancelled`)
  - `notes` (text nullable)
  - `createdById` / `actorPersonId`
  - `idempotencyKey` / command provenance
  - `financialProfileVersion` (integer provenance)

### 1.3 Money Snapshot Invariant
At issuance time, the obligation copies the exact `amount` and `currency` of the selected Fee Catalogue version into the obligation record.
- Subsequent changes or new versions in the Fee Catalogue **MUST NEVER** alter existing obligations.
- The amount is read-only in the manual issuance flow; users cannot override or retype money values manually.

### 1.4 Command Law: `IssueFinancialObligation`
All obligation creation flows (manual Finance now, Enrollment later) must invoke the single canonical domain command:
`IssueFinancialObligation(actor, input, idempotencyKey)`

---

## 2. Persistence Model (Migration 0033)

### 2.1 Schema Definition

```sql
-- Sequence / Counter for human operational Financial Account references per institution
CREATE TABLE IF NOT EXISTS finance_financial_account_counters (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (institution_id)
);

-- Financial Accounts
CREATE TABLE IF NOT EXISTS finance_financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  account_number VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_financial_accounts_number UNIQUE (institution_id, account_number)
);

-- Financial Account Parties (Responsibility relationships to existing People)
CREATE TABLE IF NOT EXISTS finance_financial_account_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL REFERENCES finance_financial_accounts(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  role VARCHAR(50) NOT NULL DEFAULT 'primary_debtor',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_account_party_role UNIQUE (financial_account_id, person_id, role)
);

-- Financial Obligations
CREATE TABLE IF NOT EXISTS finance_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  financial_account_id UUID NOT NULL REFERENCES finance_financial_accounts(id) ON DELETE RESTRICT,
  beneficiary_person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  fee_catalogue_item_id UUID NOT NULL REFERENCES finance_fee_catalogue_items(id) ON DELETE RESTRICT,
  fee_catalogue_version INTEGER NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('manual_finance', 'enrollment', 'academic_process', 'service_request')),
  source_ref VARCHAR(255) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  notes TEXT,
  financial_profile_version INTEGER NOT NULL,
  created_by_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_finance_obligations_idempotency UNIQUE (institution_id, idempotency_key)
);
```

---

## 3. Authorization & Multi-Tenancy

- **Role Policy:**
  - `institution_admin`: full read/write for Financial Accounts and Financial Obligations.
  - `financial`: full read/write for Financial Accounts and Financial Obligations.
  - `director`: read-only access.
  - other roles (`teacher`, `student`, `parent`, `secretariat`, etc.): fail closed with `403 Forbidden`.
- **Institutional Context:**
  - All operations resolve `actor.institutionId` from verified token claims.
  - Foreign tenant IDs in queries or bodies are rejected with `404 Not Found` or `422 Unprocessable Entity`.

---

## 4. HTTP API Contract

### 4.1 Financial Accounts
- `GET /api/finance/financial-accounts?status=active|inactive|all`
- `GET /api/finance/financial-accounts/:id`
- `POST /api/finance/financial-accounts` (Header: `Idempotency-Key`)
  - Body: `{ name: string, primaryPersonId: string }`
- `POST /api/finance/financial-accounts/:id/activate` | `/deactivate` (Header: `Idempotency-Key`)

### 4.2 Financial Obligations
- `GET /api/finance/obligations?status=open|cancelled|all&financialAccountId=...`
- `GET /api/finance/obligations/:id`
- `POST /api/finance/obligations` (Header: `Idempotency-Key`)
  - Body: `{ financialAccountId: string, feeCatalogueItemId: string, beneficiaryPersonId?: string, dueAt?: string, notes?: string }`
  - Server resolves active Fee Catalogue item and current version, snapshots Money, validates same-tenant ownership, and commits atomically.
- `POST /api/finance/obligations/:id/cancel` (Header: `Idempotency-Key`)
  - Body: `{ reason: string }`

---

## 5. UI & UX Contract

### 5.1 Finance Navigation
Sidebar / Financial Workspace tabs:
- **Catálogo de Emolumentos** (F1)
- **Obrigações Financeiras** (F2)

### 5.2 Obligations Workspace Views
- **List View (`FeeObligationsListView`):**
  - Search / Filter by status (`open`, `cancelled`, `all`).
  - Table: Operational code, Account, Beneficiary, Item/Fee Name, Version, Amount/Currency, Effective date, Due date, Status badge.
  - Primary button: `Nova Obrigação`.
  - Secondary button / link: `Gerir Contas Financeiras`.
- **Create View (`FeeObligationCreateView`):**
  - Integrated subview with back navigation.
  - Select Financial Account (dropdown / combobox).
  - Select Beneficiary Person (optional / student context).
  - Select Fee Catalogue Item (combobox from active items).
  - Automatically displays read-only Money, Version, Code Prefix.
  - Optional Due Date & Notes inputs.
  - Submit button invokes canonical `createObligation` client method with `Idempotency-Key`.
- **Accounts Management View (`FinancialAccountsView`):**
  - Integrated subview.
  - List existing accounts with account number, name, primary responsible person, and status.
  - Form to create a new Financial Account linked to an existing Person.

---

## 6. Journal Boundary Determination

- **Determination:** `JOURNAL_EXTENSION_REQUIRED=NO` for the F2-01 core slice.
- **Rationale:** Existing `FoundationJournalType` (`foundation_value_received`, `foundation_reversal`) is designed strictly for cash settlement/inflows. An obligation is an accounts receivable claim. Forcing an obligation into `foundation_value_received` would corrupt ledger truth. Obligations are recorded with immutable command and audit provenance in `finance_obligations`. Double-entry receivable ledger integration will occur in the subsequent Ledger/Receivables expansion when balancing entry positions are formally specified.
