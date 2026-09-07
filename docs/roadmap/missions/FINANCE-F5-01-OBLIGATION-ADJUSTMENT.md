# FINANCE-F5-01 — Obligation-linked Adjustment v1

## Status

`SPECIFICATION / NOT READY FOR EXECUTION`. Canonical design: [2026-09-07-finance-obligation-adjustment-v1-design.md](../../superpowers/specs/2026-09-07-finance-obligation-adjustment-v1-design.md).

## Mission boundary

Implement one authorized, immutable, obligation-linked administrative Adjustment fact. It uses direction (`increase`/`decrease`) plus positive exact Money; it never rewrites the original Obligation, Payment, Allocation, or Journal history. The derived law is:

`effectiveDue = original + Σ increases − Σ decreases`; `remainingCoverable = effectiveDue − (Σ allocations − Σ allocation reversals)`.

A decrease is rejected when effective due after the command would be below net covered value. This is the one server-authoritative position used by Adjustment commands, future Allocation remaining-capacity validation and Financial Account reads; Allocation facts remain immutable. The fact is tenant-scoped, account/obligation-linked, reasoned, provenance-bearing, idempotent and represented by a new typed Journal transaction/position.

## Required execution contract

- Read roles: `institution_admin`, `financial`, `director`. Create/correct roles: `institution_admin`, `financial`. `director`, `secretariat`, `teacher`, `student`, and `parent` are denied mutation.
- One command endpoint only; normal and explicit linked-compensation bodies; no edit/delete CRUD or user-supplied effective time.
- PostgreSQL transaction locks account → obligation → allocation rows → allocation reversal rows → adjustment rows in that order.
- Dedicated immutable Adjustment table with tenant composite FKs, exact positive numeric envelope, direction/reason/currency/provenance/idempotency/journal constraints.
- Extend Journal only with `obligation_adjustment`, `obligation_due_increased`, and `obligation_due_decreased`; retain rejection of every unsupported vocabulary value.
- Existing Financial Account workspace is the sole operational surface and must include guided create/preview/confirmation, canonical refresh and chronological history.

## Required proofs

Fresh migration; tenant fences; Money and currency; original fact immutability; atomic Journal/Adjustment and rollback; replay/fingerprint conflict; concurrent decrease, competing partial compensation, Adjustment/Allocation, and Adjustment/Reversal races; adjustment-aware Allocation proof (100/−20/covered 40: reject 41, accept 40); derived rebuild/no-negative remaining; real HTTP/PostgreSQL; rendered operational UI/theme/responsive behavior; the UAT 100/40/−20/rejected −50/+10 scenario; then F5 plus Allocation/Payment/Obligation/Fee/Foundation/FND03/lint/build/diff/secrets/artifacts final gates.

## Out of scope

Discount, Penalty, Credit, Refund, Reconciliation, FX, invoice rewriting, Payment or Allocation mutation, waiver/scholarship policy, automation, bulk/import, reporting, provider return, and fiscal semantics.

## Definition of Ready

This mission advances only after Product Owner approves the linked design's exact semantics, compensating-adjustment law, Journal extension, derived formula, lock order, role matrix, persistence/HTTP/UI contracts, proof matrix and UAT. No implementation is authorized by this document.
