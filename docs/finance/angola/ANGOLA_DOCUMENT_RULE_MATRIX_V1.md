# Angola document rule matrix V1

Status values are deliberately conservative: `PROVEN`, `NOT_APPLICABLE`, or
`BLOCKED`. A blocked cell cannot be enabled by a default, a feature flag, or a
synthetic adapter.

Source identifiers are defined in `ANGOLA_FISCAL_EVIDENCE_PACK_V1.md`.

| Document type | Rule category | Status | Source / interpretation |
| --- | --- | --- | --- |
| invoice | legal recognition/applicability | BLOCKED | AO-RJF-2025-71 governs in-scope taxpayers but this pack does not prove target-institution applicability or exact invoice type mapping. |
| invoice | authoritative issuance event/source | BLOCKED | Finance Obligation source is product architecture, not verified Angola rule. |
| invoice | mandatory fields | BLOCKED | AO-RJF-FIELDS-010 establishes partial statutory field constraints; full executable set remains unverified. |
| invoice | series/numbering | BLOCKED | AO-RJF-SERIES-020 constrains electronic series to AGT generation; operational process missing. |
| invoice | tax/document treatment | BLOCKED | No verified target-institution tax treatment. |
| invoice | related-document references | BLOCKED | No complete primary rule extracted. |
| invoice | correction/cancellation | BLOCKED | No complete primary rule extracted. |
| invoice | legal mentions/validation | BLOCKED | Annex/validation elements not verified. |
| invoice | electronic/technical | BLOCKED | AO-EF-TECH-050. |
| invoice | exceptions/regime limits | BLOCKED | No target regime determination. |
| invoice_receipt | legal recognition/applicability | BLOCKED | No complete primary mapping extracted. |
| invoice_receipt | authoritative issuance event/source | BLOCKED | Product Obligation+Payment+Allocation is not legal proof. |
| invoice_receipt | mandatory fields | BLOCKED | No complete primary field rule extracted. |
| invoice_receipt | series/numbering | BLOCKED | AO-RJF-SERIES-020 requires official process evidence. |
| invoice_receipt | tax/document treatment | BLOCKED | No verified target treatment. |
| invoice_receipt | related-document references | BLOCKED | No complete primary rule extracted. |
| invoice_receipt | correction/cancellation | BLOCKED | No complete primary rule extracted. |
| invoice_receipt | legal mentions/validation | BLOCKED | No verified validation elements. |
| invoice_receipt | electronic/technical | BLOCKED | AO-EF-TECH-050. |
| invoice_receipt | exceptions/regime limits | BLOCKED | No target regime determination. |
| receipt | legal recognition/applicability | BLOCKED | AO-RJF-2025-71 contains receipt provisions, but applicability and exact required form were not completely extracted. |
| receipt | authoritative issuance event/source | BLOCKED | Finance Payment source is product architecture, not legal proof. |
| receipt | mandatory fields | BLOCKED | No complete primary field rule extracted. |
| receipt | series/numbering | BLOCKED | AO-RJF-SERIES-020. |
| receipt | tax/document treatment | BLOCKED | No verified target treatment. |
| receipt | related-document references | BLOCKED | No complete primary rule extracted. |
| receipt | correction/cancellation | BLOCKED | No complete primary rule extracted. |
| receipt | legal mentions/validation | BLOCKED | No verified validation elements. |
| receipt | electronic/technical | BLOCKED | AO-EF-TECH-050. |
| receipt | exceptions/regime limits | BLOCKED | No target regime determination. |
| credit_note | legal recognition/applicability | BLOCKED | No complete primary mapping extracted. |
| credit_note | authoritative issuance event/source | BLOCKED | Product correction source is not legal proof. |
| credit_note | mandatory fields | BLOCKED | No complete primary field rule extracted. |
| credit_note | series/numbering | BLOCKED | AO-RJF-SERIES-020. |
| credit_note | tax/document treatment | BLOCKED | No verified target treatment. |
| credit_note | related-document references | BLOCKED | No complete primary rule extracted. |
| credit_note | correction/cancellation | BLOCKED | No complete primary rule extracted. |
| credit_note | legal mentions/validation | BLOCKED | No verified validation elements. |
| credit_note | electronic/technical | BLOCKED | AO-EF-TECH-050. |
| credit_note | exceptions/regime limits | BLOCKED | No target regime determination. |
| debit_note | legal recognition/applicability | BLOCKED | No complete primary mapping extracted. |
| debit_note | authoritative issuance event/source | BLOCKED | Product source is not legal proof. |
| debit_note | mandatory fields | BLOCKED | No complete primary field rule extracted. |
| debit_note | series/numbering | BLOCKED | AO-RJF-SERIES-020. |
| debit_note | tax/document treatment | BLOCKED | No verified target treatment. |
| debit_note | related-document references | BLOCKED | No complete primary rule extracted. |
| debit_note | correction/cancellation | BLOCKED | No complete primary rule extracted. |
| debit_note | legal mentions/validation | BLOCKED | No verified validation elements. |
| debit_note | electronic/technical | BLOCKED | AO-EF-TECH-050. |
| debit_note | exceptions/regime limits | BLOCKED | No target regime determination. |

## Rule-to-source traceability

| Rule ID | Source ID | Exact normative basis | Nexus interpretation | Document type | Expected policy behavior |
| --- | --- | --- | --- | --- | --- |
| AO-RJF-FIELDS-010 | AO-RJF-2025-71 | Art. 10(1)(a)–(f) | Partial field constraints, not a complete enabled schema | invoice | BLOCK until the complete official field set and applicability are verified |
| AO-RJF-SERIES-020 | AO-RJF-2025-71; AO-EF-2025-683 | Art. 10(1)(b); art. 4 | Electronic series are AGT-generated | all | BLOCK issuance/series configuration absent verified AGT series process |
| AO-RJF-REPORT-030 | AO-RJF-2025-71 | Art. 24(1)(a)–(c) | Establishment/software/series reporting cannot be omitted | all | BLOCK until current technical reporting requirements are proven |
| AO-EF-TECH-050 | AO-EF-2025-683 | Arts. 1–3 and annexes | Technical model is normative/AGT-updatable | all | BLOCK until current applicable annexes are verified |

## Production gate

```text
INVOICE=BLOCKED
INVOICE_RECEIPT=BLOCKED
RECEIPT=BLOCKED
CREDIT_NOTE=BLOCKED
DEBIT_NOTE=BLOCKED
UNSOURCED_PRODUCTION_RULES=0
AMBIGUOUS_OR_UNVERIFIED_CAPABILITIES=BLOCKED
PRODUCTION_ADAPTER_ENABLEMENT=NO
```

## Task 2 evidence update — reclassification

This table supersedes the initial conservative classification. `PROVEN` means
that the cited official technical source proves the stated **technical**
behavior; it does not claim taxpayer applicability or production onboarding.

| Document type | Rule category | Status | Evidence class | Rule ID / exact basis | Testable policy behavior |
| --- | --- | --- | --- | --- | --- |
| Factura (invoice) | legal recognition | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | deny production capability until target applicability is verified |
| Factura | issuance/source semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | do not map a Nexus Obligation to legal authority by default |
| Factura | mandatory fields | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-061 / `registarFactura` FT | require API submission identity, number, date, customer, totals and JWS fields |
| Factura | numbering/series | PROVEN | REQUIRES_AGT_ONBOARDING | AO-RJF-SERIES-020; AO-AGT-TECH-062 / `solicitarSerie` | deny issuance without an AGT-issued active series |
| Factura | tax/document treatment | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-FIELDS-010 | deny if tax regime/treatment is unresolved |
| Factura | related document references | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | no fabricated reference relationship |
| Factura | correction/cancellation semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-062 | do not equate AGT annulment API with product correction authority |
| Factura | legal mentions/validation elements | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-FIELDS-010 | deny until complete legal mentions are resolved |
| Factura | electronic/technical requirements | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-060/061/062 | async requestID, JWS, status recovery; no local success before AGT result |
| Factura | exceptions/regime applicability | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-SCOPE-001 | deny until taxpayer regime is established |
| Factura-Recibo (invoice_receipt) | legal recognition | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | deny until legal mapping is established |
| Factura-Recibo | issuance/source semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | do not treat allocation as sufficient legal authority |
| Factura-Recibo | mandatory fields | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-061 / `registarFactura` FR | validate official API payload/JWS fields |
| Factura-Recibo | numbering/series | PROVEN | REQUIRES_AGT_ONBOARDING | AO-RJF-SERIES-020; AO-AGT-TECH-062 | require AGT-issued series |
| Factura-Recibo | tax/document treatment | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-FIELDS-010 | deny unresolved treatment |
| Factura-Recibo | related document references | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | no fabricated relation |
| Factura-Recibo | correction/cancellation semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-062 | preserve immutability; no enablement |
| Factura-Recibo | legal mentions/validation elements | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-FIELDS-010 | deny incomplete legal set |
| Factura-Recibo | electronic/technical requirements | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-060/061/062 | async AGT validation and immutable submission evidence |
| Factura-Recibo | exceptions/regime applicability | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-SCOPE-001 | deny until taxpayer regime known |
| Recibo (receipt) | legal recognition | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | deny production mapping |
| Recibo | issuance/source semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | Payment is Nexus provenance, not unproven legal authority |
| Recibo | mandatory fields | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-061 / RC/RG and `paymentReceipt` | require receipt payload/JWS structure when enabled |
| Recibo | numbering/series | PROVEN | REQUIRES_AGT_ONBOARDING | AO-RJF-SERIES-020; AO-AGT-TECH-062 | require AGT-issued series |
| Recibo | tax/document treatment | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-FIELDS-010 | deny unresolved tax treatment |
| Recibo | related document references | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | no inferred reference rules |
| Recibo | correction/cancellation semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-062 | no automatic cancellation/correction mapping |
| Recibo | legal mentions/validation elements | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-FIELDS-010 | deny incomplete legal set |
| Recibo | electronic/technical requirements | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-060/061/062 | await/recover final AGT validation |
| Recibo | exceptions/regime applicability | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-SCOPE-001 | deny until taxpayer regime known |
| Nota de Crédito (credit_note) | legal recognition | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | deny production mapping |
| Nota de Crédito | issuance/source semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | original-document relationship must be legally established |
| Nota de Crédito | mandatory fields | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-061 / NC | require NC API submission/JWS fields |
| Nota de Crédito | numbering/series | PROVEN | REQUIRES_AGT_ONBOARDING | AO-RJF-SERIES-020; AO-AGT-TECH-062 | require AGT-issued series |
| Nota de Crédito | tax/document treatment | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-FIELDS-010 | deny unresolved treatment |
| Nota de Crédito | related document references | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | no fabricated original reference |
| Nota de Crédito | correction/cancellation semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-062 | separate immutable correction from AGT annulment |
| Nota de Crédito | legal mentions/validation elements | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-FIELDS-010 | deny incomplete legal set |
| Nota de Crédito | electronic/technical requirements | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-060/061/062 | persist requestID and final validation state |
| Nota de Crédito | exceptions/regime applicability | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-SCOPE-001 | deny until taxpayer regime known |
| Nota de Débito (debit_note) | legal recognition | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-SCOPE-001 | deny production mapping |
| Nota de Débito | issuance/source semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | no sign-flip inference from NC |
| Nota de Débito | mandatory fields | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-061 / ND | require ND API submission/JWS fields |
| Nota de Débito | numbering/series | PROVEN | REQUIRES_AGT_ONBOARDING | AO-RJF-SERIES-020; AO-AGT-TECH-062 | require AGT-issued series |
| Nota de Débito | tax/document treatment | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-FIELDS-010 | deny unresolved treatment |
| Nota de Débito | related document references | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-061 | no fabricated original reference |
| Nota de Débito | correction/cancellation semantics | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-AGT-TECH-062 | separate from AGT annulment and NC semantics |
| Nota de Débito | legal mentions/validation elements | BLOCKED | STILL_LEGALLY_AMBIGUOUS | AO-RJF-FIELDS-010 | deny incomplete legal set |
| Nota de Débito | electronic/technical requirements | PROVEN | PUBLICLY_PROVEN | AO-AGT-TECH-060/061/062 | persist requestID and final validation state |
| Nota de Débito | exceptions/regime applicability | BLOCKED | REQUIRES_INSTITUTION_DATA | AO-RJF-SCOPE-001 | deny until taxpayer regime known |
