# FINANCE-F5-01 — Adjustment operational UX v2

## Status, authority and boundary

This design **complements** `2026-09-07-finance-obligation-adjustment-v1-design.md`; it does not replace its Money, Journal, append-only, lock-order, role, HTTP, idempotency, or derived-position laws. It authorizes no implementation by itself. The Financial Account remains the operational center. Adjustment receives no page, permanent section, dashboard card, navigation item, or new persistent primary action.

Governing laws:

> New financial authority != new permanent UI surface.

> Escopo frontend limitado, execução frontend completa.

The UI follows the financial object and operator intent, not the list of backend features. Future Discount, Penalty, Credit and Refund are out of scope and may not be anticipated with buttons, sections, types, or placeholder states.

## Canonical placement and entry

The path is **Financial Account → Cobranças → selected charge → contextual actions → Registar correção → side drawer**. Payment keeps the distinct action “Associar valor recebido”; an Adjustment is never presented as an Allocation or receipt action.

Each charge has a restrained contextual `…` menu. “Registar correção” normally lives there; it may be state-appropriate primary only where the surrounding charge presentation clearly justifies it. No row of permanent per-charge buttons is permitted. The selected charge supplies institution, account, charge, currency and current position; the operator never reselects any of these.

## Drawer interaction model

The drawer opens over the retained Financial Account context. On desktop it is a bounded professional side panel; at narrow widths it becomes near/full screen rather than compressing desktop geometry. It is one continuous operational surface, not a wizard or a stack of decorative cards.

1. **Context** — compact charge description, useful reference, lifecycle state and current financial value.
2. **Decision** — “O que pretende corrigir?” with mutually exclusive, purposeful choices: `↓ Reduzir valor` and `↑ Aumentar valor`.
3. **Input** — “Quanto pretende corrigir?” and mandatory “Porquê?”. Optional suggestion chips (`Erro administrativo`, `Valor lançado incorretamente`, `Correção autorizada`) only assist typing; they are not classifications and never select direction, amount or confirmation.
4. **Impact** — one before → after financial comparison, for example `100,00 EUR → 80,00 EUR`, captioned “Valor da cobrança após correção”, followed by `Já coberto 40,00 EUR` and `Ficará por cobrar 40,00 EUR`.
5. **Footer** — stable, compact `Cancelar` / `Confirmar correção`; Cancel is never a full-width strip.

Cards are permitted only for a meaningful information or decision unit. Generic large rectangles, repeated context, technical identifiers, oversized controls, excessive whitespace and four unrelated metric cards are prohibited.

## Terminology, adaptation and visual semantics

Product wording is operational: Cobrança, Valor da cobrança, Já coberto, Valor ainda por cobrar, Registar correção, Reduzir valor, Aumentar valor, Motivo da correção and Corrigir uma correção. Internal terms (Obligation, Adjustment, Allocation, Payment, covered-floor, effective due) remain canonical in code and contracts but are not normal operator vocabulary.

Nexus may adapt presentation, context, suggestions, action ordering, derived information and validation guidance. It must never silently decide direction, amount, economic reason or financial confirmation.

Use restrained semantic color: reduction uses controlled positive/reduction treatment; increase uses informational/attention treatment; invalid is clear error; success confirms; neutral structures context. Light and dark palettes are designed independently with readable contrast, never mechanically inverted. Microinteractions explain drawer, choice, impact, validation, submission and canonical-refresh changes; decorative or work-slowing animation is forbidden.

## Validation, submit and recovery

Preview uses exact display-only Money-compatible arithmetic; the server remains authority. A known covered-floor breach is an invalid state, not an ordinary projected result: explain that the charge already has the covered amount and cannot fall below it; where deterministic, show the maximum reduction. Preserve amount and reason, disable confirmation while invalid, and retain values after server error.

Submitting says “A registar correção...”, prevents duplicates and never invents optimistic economic truth. On authoritative success, refresh the Financial Account, charge position and relevant history, show brief success feedback and retain account context. Errors are human operational messages with retry where appropriate; raw browser/runtime errors are never shown.

`Failed to execute 'fetch' on 'Window': Illegal invocation` is a P1 functional defect. Implementation must reproduce it in the real browser, trace browser → selected charge → drawer → validation → submit → HTTP → command → PostgreSQL → response → canonical refresh, and apply the minimal proven correction. Catch-and-mask, speculative fetch replacement and fake success are prohibited.

## Accessibility, coherence and proof

The bounded coherence pass may touch only Financial Account charge presentation, contextual actions, financial position, receipt/allocation relationship and relevant history. It may not redesign Finance.

Required implementation proof: desktop, reduced viewport, light/dark, keyboard navigation, focus containment/restoration, loading, invalid, server-error, success, no overflow/clipped footer, canonical refresh and history. Component rendering alone is insufficient.

Before Human UAT, real-browser evidence in Financial Account context must prove: original 100, covered 40, remaining 60; reduction 20 yields 80/40; refresh/history persist; a below-floor decrease is clearly rejected with no fact; increase is exact; linked compensation preserves root and displays separately; themes, narrow layout, focus, submit and error behavior work. The economic specification continues to govern all final values and persistence.

## Self-review

`PLACEHOLDERS=0`; `CONTRADICTIONS=0`; `AMBIGUOUS_PRODUCT_DECISIONS=0`; `OUT_OF_SCOPE_EXPANSION=0`. This document is consistent with Finance guardrails: runtime parity and real-browser proof are mandatory before Human UAT.
