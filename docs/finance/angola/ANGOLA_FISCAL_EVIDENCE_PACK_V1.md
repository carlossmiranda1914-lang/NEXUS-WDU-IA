# Angola fiscal evidence pack V1

Status: **production enablement blocked**. This is an evidence inventory, not
an adapter, configuration, registry entry, or compliance assertion.

## Primary-source inventory

### AO-RJF-2025-71

```text
official_title=Decreto Presidencial n.º 71/25 — Regime Jurídico das Facturas
issuing_authority=Presidente da República de Angola / Diário da República
publication_date=2025-03-20
effective_date_if_known=UNVERIFIED_IN_THIS_PACK
official_location=https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw40/otu2/~edisp/minfin4956210.pdf
scope=emissão, rectificação, anulação, conservação e arquivamento de facturas e documentos fiscalmente relevantes
supersedes_or_amends=revoga DP 292/18 e DP 144/23; demais efeitos exactos devem ser lidos no texto oficial
retrieval_date=2026-09-12
source_type=PRIMARY
```

Verified provisions used below: article 1 (object), article 2 (scope), article
10(1) (mandatory invoice fields), article 23 (verification) and article 24(1)
(electronic establishment/software/series reporting). The official text also
delegates technical/electronic specification under article 36; this pack does
not infer its contents.

### AO-EF-2025-683

```text
official_title=Decreto Executivo n.º 683/25
issuing_authority=Ministério das Finanças / Diário da República
publication_date=2025-08-22
effective_date_if_known=UNVERIFIED_IN_THIS_PACK
official_location=https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw40/otuy/~edisp/minfin4952361.pdf
scope=estrutura de dados de software, modelo e especificações técnicas/procedimentais da facturação electrónica; competência para séries
supersedes_or_amends=UNVERIFIED_IN_THIS_PACK
retrieval_date=2026-09-12
source_type=PRIMARY
```

Verified provisions used below: articles 1–4. Articles 2–3 make the Annexes
and AGT technical updates material; because their applicable, current content
was not verified in this pack, those technical requirements are blocked.

## Evidence rules

| Rule ID | Source and exact basis | Nexus interpretation | Status |
| --- | --- | --- | --- |
| AO-RJF-SCOPE-001 | AO-RJF-2025-71, arts. 1–2 | The regime governs fiscal documents for in-scope Angolan taxpayers. It does not itself prove that a particular Nexus institution, transaction, or document type is in scope. | PROVEN boundary / applicability per institution BLOCKED |
| AO-RJF-FIELDS-010 | AO-RJF-2025-71, art. 10(1)(a)–(f) | An enabled invoice policy must require documented issuer/acquirer identification, sequential chronological number/series, lines, national-currency unit/total price, applicable tax amount, and legal basis for non-taxation where due. Remaining art. 10 fields must be extracted from the primary text before enablement. | BLOCKED for executable policy |
| AO-RJF-SERIES-020 | AO-RJF-2025-71, art. 10(1)(b); AO-EF-2025-683, art. 4 | Electronic-invoice series are AGT-generated. Nexus may not self-authorize a production electronic series without verified AGT process/integration evidence. | PROVEN constraint; capability BLOCKED |
| AO-RJF-REPORT-030 | AO-RJF-2025-71, art. 24(1)(a)–(c) | A production policy must account for electronic reporting of establishments, software and used/unused series. Exact operational API/file mechanism is not established here. | BLOCKED |
| AO-RJF-VERIFY-040 | AO-RJF-2025-71, art. 23 | Archived Finance evidence must remain inspectable through an authorized, tenant-safe boundary; technical delivery requirements remain blocked. | PROVEN boundary |
| AO-EF-TECH-050 | AO-EF-2025-683, arts. 1–3 | The electronic data model/specification is annex- and AGT-update controlled, not guessed by generic Finance. | BLOCKED |
| AO-EF-TECH-051 | AO-EF-2025-683, art. 4 | AGT generates electronic-facturation series. | PROVEN constraint; implementation BLOCKED pending official process evidence |

## Non-enablement ruling

No production capability is enabled by this pack. In particular, it does not
prove current technical annex content, AGT onboarding/series-generation flow,
applicability to the target education institution, tax treatment, valid
corrective-document semantics, or the complete field set for each supported
document type. `NEXUS_TEST/core` remains UAT-only and is not evidence.
