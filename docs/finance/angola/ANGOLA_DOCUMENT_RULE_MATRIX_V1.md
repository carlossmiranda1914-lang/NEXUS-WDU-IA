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
