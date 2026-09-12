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

### AO-AGT-FE-INTRO

```text
official_title=Introdução — API de Facturação Electrónica
issuing_authority=Administração Geral Tributária / Ministério das Finanças
publication_date=UNVERIFIED_IN_THIS_PACK
effective_date_if_known=UNVERIFIED_IN_THIS_PACK
official_location=https://quiosqueagt.minfin.gov.ao/doc-agt/faturacao-electronica/1/
scope=interface, fluxo assíncrono, integridade, autenticidade, rastreabilidade e consulta/callback de validação
supersedes_or_amends=UNVERIFIED_IN_THIS_PACK
retrieval_date=2026-09-12
source_type=PRIMARY_TECHNICAL
```

### AO-AGT-FE-REGISTAR

```text
official_title=Registar Factura — API de Facturação Electrónica
issuing_authority=Administração Geral Tributária / Ministério das Finanças
publication_date=UNVERIFIED_IN_THIS_PACK
effective_date_if_known=UNVERIFIED_IN_THIS_PACK
official_location=https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/servicos/registar.html
scope=registo electrónico, tipos documentais, campos, assinatura JWS e devolução de requestID
supersedes_or_amends=UNVERIFIED_IN_THIS_PACK
retrieval_date=2026-09-12
source_type=PRIMARY_TECHNICAL
```

### AO-AGT-FE-SERVICES

```text
official_title=Serviços Especificados — API de Facturação Electrónica
issuing_authority=Administração Geral Tributária / Ministério das Finanças
publication_date=UNVERIFIED_IN_THIS_PACK
effective_date_if_known=UNVERIFIED_IN_THIS_PACK
official_location=https://portaldoparceiro.hml.minfin.gov.ao/doc-agt/doc-agt/2/servicos/especificados.html
scope=catálogo dos serviços registarFactura, obterEstado, listar/consultarFactura, solicitar/listarSeries, validarDocumento e anularFactura
supersedes_or_amends=UNVERIFIED_IN_THIS_PACK
retrieval_date=2026-09-12
source_type=PRIMARY_TECHNICAL_HML_CATALOGUE
```

### AO-AGT-FE-KEYS

```text
official_title=Gestão de Certificados e Chaves — Facturação Electrónica
issuing_authority=Administração Geral Tributária / Ministério das Finanças
publication_date=UNVERIFIED_IN_THIS_PACK
effective_date_if_known=UNVERIFIED_IN_THIS_PACK
official_location=https://quiosqueagt.minfin.gov.ao/doc-agt/faturacao-electronica/1/gestao.html
scope=chaves, assinatura JWS e registo/validação de chaves públicas
supersedes_or_amends=UNVERIFIED_IN_THIS_PACK
retrieval_date=2026-09-12
source_type=PRIMARY_TECHNICAL
```

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
| AO-AGT-TECH-060 | AO-AGT-FE-INTRO | Submission is asynchronous: receipt of a request is not final document validation; the authoritative outcome must be recovered by status/polling or an enabled callback. | PUBLICLY_PROVEN |
| AO-AGT-TECH-061 | AO-AGT-FE-REGISTAR | Public electronic document codes include FT, FR, RC/RG, NC and ND; each submission requires an official request format and JWS signature. | PUBLICLY_PROVEN |
| AO-AGT-TECH-062 | AO-AGT-FE-SERVICES | The public catalogue defines registration, status/retrieval, series, validation and annulment operations. A Nexus command is not successful merely because registration accepted it. | PUBLICLY_PROVEN |
| AO-AGT-ONBOARD-070 | AO-AGT-FE-REGISTAR; AO-AGT-FE-KEYS | Production submission requires a certified software identity and registered/issued cryptographic material; neither is available from public documentation alone. | REQUIRES_AGT_ONBOARDING |

## Non-enablement ruling

No production capability is enabled by this pack. In particular, it does not
prove current technical annex content, AGT onboarding/series-generation flow,
applicability to the target education institution, tax treatment, valid
corrective-document semantics, or the complete field set for each supported
document type. `NEXUS_TEST/core` remains UAT-only and is not evidence.

## Task 2 evidence update — public technical API

The public AGT/MinFin API sources establish the following without enabling
production: `registarFactura` accepts electronic document registration and
returns a request identifier; final validity is asynchronous; public document
codes include FT (Factura), FR (Factura/Recibo), RC/RG (Recibo), NC (Nota de
Crédito) and ND (Nota de Débito); and the service catalogue exposes status,
retrieval, series request/listing, validation and annulment operations.

The sources do **not** supply Nexus with production credentials, a certified
software validation number, institution-specific taxpayer facts, taxpayer keys,
or a completed AGT series request. These remain external/institutional gates.

```text
PUBLIC_TECHNICAL_SPEC=PASS
PRODUCTION_ADAPTER_ENABLEMENT=NO
PUBLICLY_PROVEN=API_PROTOCOL_AND_DOCUMENT_CODES
REQUIRES_AGT_ONBOARDING=credentials, certification, keys, series issuance
REQUIRES_INSTITUTION_DATA=NIF, taxpayer regime, legal identity, tax treatment, authorised establishment data
STILL_LEGALLY_AMBIGUOUS=per-document applicability, correction basis, target-school tax treatment and complete legal mentions
```
