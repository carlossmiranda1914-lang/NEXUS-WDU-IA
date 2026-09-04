# FINANCE-F1-01: Fee Catalogue Structural UX & Information Architecture Design

## 0. Future Cross-Module Integration Principle (ARCHITECTURAL_FUTURE_ONLY=true)

> [!IMPORTANT]
> **ARCHITECTURAL_FUTURE_ONLY=true** — This section documents cross-module integration rules for future milestones. No student billing, obligations, payments, or enrollment hooks are implemented in Phase 1.

Enrollment/registration data already known by Nexus must **never** be re-entered manually by Finance.

### Target Workflow:
```
Enrollment Completed
└──> Applicable Financial Rule Resolved
     └──> Financial Obligation / Charge Created (references Fee Catalogue UUID + version)
          └──> Finance Handles Collection / Payment / Allocation / Reconciliation
```

### Invariants:
1. **Enrollment Boundary**: Enrollment must NOT create a payment directly.
2. **Identity Boundary**: Finance must NOT duplicate student or enrollment identity data.
3. **Canonical References**: Future financial records reference canonical entity UUIDs, never copied free-text strings.
4. **Catalogue vs Charging Separation**:
   - **Fee Catalogue** defines **WHAT** can be charged (designation, governed fee type, money parameters, validity interval).
   - **Future Charging Rules** define **WHEN**, **TO WHOM**, and **UNDER WHICH CONDITIONS** it is charged (periodicity, class/grade applicability, discounts, penalties).

---

## 1. Executive Summary & Approved Navigation Model
This specification defines the **Institutional Fee Types, Canonical Operational Code Generation, and Integrated Subviews Architecture** for the **Fee / Emolument Catalogue** (`FINANCE-F1-01`) within the NEXUS EDU IA Finance vertical (`Finanças & Contas → Catálogo de Emolumentos`).

### Navigation Hierarchy & Principle:
Permanent sidebar navigation remains simple and coherent:
```
Finanças & Contas
└── Catálogo de Emolumentos
```
The operations for creating items, publishing new versions, managing fee types, and auditing history are **NOT separate sidebar routes**, nor are they modal overlays. They are **integrated internal subviews** managed by a deterministic state machine within `FinanceFeeCatalogueWorkspace`:

```
CATALOGUE LIST (Default Surface)
├── [Click + Novo emolumento]     ──> CREATE SUBVIEW     ──> [Save/Back] ──> CATALOGUE LIST
├── [Click Gerir tipos]           ──> TYPES SUBVIEW      ──> [Back]      ──> CATALOGUE LIST
├── [Click Editar]                ──> VERSION SUBVIEW    ──> [Save/Back] ──> CATALOGUE LIST
└── [Click Histórico]             ──> HISTORY SUBVIEW    ──> [Back]      ──> CATALOGUE LIST
```

### Invariants:
1. **Zero Modal Overlays**: All interactions occur directly within the central workspace content area.
2. **Single Surface Rendering**: Exactly ONE principal view (`list`, `create`, `types`, `version`, or `history`) is rendered at a time. No floating generic CRUD boxes, no backdrop blur overlays, and no persistent empty forms occupying space.
3. **Integrated Page Shell**: Each subview features a contextual back action (`← Catálogo de Emolumentos`), section title, and structured layout.
4. **Extensibility**: Establishes a standard pattern where future Finance capabilities (charges, payments, reconciliation) can exist as sibling areas within `Finanças & Contas` without altering Fee Catalogue contracts.

---

## 2. Workspace View State Machine

```typescript
export type FeeCatalogueView =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'types' }
  | { kind: 'version'; item: FeeCatalogueRecord }
  | { kind: 'history'; item: FeeCatalogueRecord };
```

- **Initial State**: `{ kind: 'list' }`
- **Transitions**:
  - `LIST -> CREATE`: `setView({ kind: 'create' })`
  - `LIST -> TYPES`: `setView({ kind: 'types' })`
  - `LIST -> VERSION`: `setView({ kind: 'version', item })`
  - `LIST -> HISTORY`: `setView({ kind: 'history', item })`
  - `* -> LIST`: `setView({ kind: 'list' })` (with catalog refresh on mutations)

---

## 3. Institutional Fee Type Registry & Operational Code Generation

### A. Governed Institutional Fee Type Registry (`finance_fee_types`)
Fee classifications are governed institutional entities, **never arbitrary free-text strings**.

#### Properties:
- `id`: UUID (internal immutable PK)
- `institution_id`: UUID (tenant isolation)
- `canonical_key`: Nullable string for Nexus baseline types (e.g. `'tuition'`, `'enrollment'`)
- `source`: `'nexus_base' | 'institution_custom'`
- `display_name`: Human-readable localized label (e.g. `"Propina / Mensalidade"`)
- `code_prefix`: Uppercase alphanumeric prefix (2-8 chars, e.g. `"PROP"`, `"MATR"`, `"LAB"`)
- `status`: `'active' | 'inactive'`
- `created_at`, `updated_at`: Timestamps

#### Nexus Baseline Classifications (Auto-Provisioned per Institution):
1. **Tuition / Mensalidade**: `tuition` → Prefix `PROP`
2. **Enrollment / Matrícula**: `enrollment` → Prefix `MATR`
3. **Examination / Exames**: `examination` → Prefix `EXAM`
4. **Document / Certificados**: `document` → Prefix `DOC`
5. **Transport / Transporte**: `transport` → Prefix `TRAN`
6. **Meals / Refeições**: `meals` → Prefix `ALIM`
7. **Activity / Extracurricular**: `activity` → Prefix `ACT`
8. **Service / Serviços**: `service` → Prefix `SERV`
9. **Penalty / Multas**: `penalty` → Prefix `MULT`
10. **Other / Outros**: `other` → Prefix `DIV`

Institutions can activate/deactivate baseline types and create custom types with custom prefixes. Deactivated types cannot be used for new items, but historical catalogue references remain strictly intact.

### B. Canonical Operational Code Generation (`<PREFIX>-<SEQUENCE>`)
- **Format**: `<PREFIX>-<SEQUENCE>`, zero-padded 6 digits (e.g. `PROP-000001`, `PROP-000002`, `LAB-000001`).
- **Authority**: PostgreSQL atomic counter table `finance_fee_code_counters (institution_id, fee_type_id, last_sequence)`.
- **Invariants**:
  - Generated exclusively server-side.
  - Browser cannot submit or override the code.
  - Concurrency safe via atomic `ON CONFLICT (institution_id, fee_type_id) DO UPDATE SET last_sequence = last_sequence + 1 RETURNING last_sequence`.
  - Immutable once created. Publishing new versions does NOT alter or regenerate the operational code.

---

## 4. Fee Catalogue Item & Version Domain Specification

### Technical Identity vs Operational Reference:
- **Technical Identity**: Internal UUID (`id`), primary cross-module reference.
- **Operational Code**: Human-readable `<PREFIX>-<SEQUENCE>`, institution-scoped, immutable, used for search, reports, and communication.
- **Designation**: Human-readable name (`name`).
- **Fee Type**: Governed reference (`fee_type_id`), versionable across published versions.
- **Money**: `amount` (ExactDecimal positive) + `currency` (canonical enabled profile currency).
- **Effective Period**: `effective_from` (ISO timestamp) to `effective_to` (ISO timestamp or NULL for active).
- **Status**: `'active' | 'inactive'`.

### Versioning Rules:
- Fee Type is part of the version definition. If an item changes its Fee Type in $v_{n+1}$, the new version points to the new `fee_type_id`, older versions retain their historical `fee_type_id`, and the operational code remains unchanged.
- Check constraint `finance_fee_catalogue_versions_effective_interval`:
  $$\text{effective\_to IS NULL} \lor \text{effective\_to} > \text{effective\_from}$$

---

## 5. Component Hierarchy

```
src/components/finance/fee-catalogue/
├── fee-catalogue-date.ts              # Canonical date helpers & minute-precision converters
├── FeeCatalogueList.tsx               # Default home surface (table/cards, CTA, filters, Gerir tipos button)
├── FeeCatalogueCreateView.tsx         # Integrated subview for creating v1 (combobox fee type, auto-code)
├── FeeCatalogueTypesView.tsx          # Integrated subview for managing institutional Fee Types
├── FeeCatalogueVersionView.tsx        # Integrated subview for publishing v(n+1)
├── FeeCatalogueHistoryView.tsx        # Integrated read-only history timeline subview
└── FinanceFeeCatalogueWorkspace.tsx   # Top-level orchestrator & state machine
```