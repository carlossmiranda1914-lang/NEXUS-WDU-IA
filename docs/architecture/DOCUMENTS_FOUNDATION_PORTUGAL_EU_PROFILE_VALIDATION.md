# DOCUMENTS-FOUNDATION — Portugal / EU Jurisdiction Profile Validation Dossier

**Status:** DRAFT — regulatory input for legal review; not legal advice or implementation authorisation.  
**Purpose:** Define the evidence and configuration required before an approved Portugal/EU jurisdiction profile can be activated for Documents Foundation.

## 1. Scope and limitation

This dossier translates official regulatory sources into product-validation questions. It does not determine the legal basis, retention duration, controller/processor allocation or transfer mechanism for any institution. Those decisions require qualified legal review for the applicable institution, data categories and operating model.

## 2. Official sources reviewed

- [Regulation (EU) 2016/679 (GDPR), EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- [Lei n.º 58/2019, Diário da República](https://files.dre.pt/1s/2019/08/15100/0000300040.pdf)
- [CNPD Deliberação n.º 1495/2016 — dados de alunos na internet](https://www.cnpd.pt/media/qaxbr1y2/del_1495_2016_dados_alunos_internet.pdf)

## 3. Regulatory requirements to validate

| Topic | Product implication | Required legal validation |
|---|---|---|
| Controller and processor roles | Institution/platform responsibilities cannot be inferred from software tenancy | Identify controller(s), processor(s), contractual terms and instruction boundary |
| Lawfulness and purpose | Documents Foundation must not create its own broad lawful basis | Source process records purpose and lawful basis; validate by category |
| Data minimisation | Foundation stores only references, file/version metadata and technical audit required for its purpose | Confirm all metadata fields and logs are necessary |
| Retention/deletion | Portugal’s Lei n.º 58/2019 Article 21 points to legal/regulatory periods or necessity for purpose; after purpose ends, destruction or anonymisation applies | Set jurisdiction-and-category retention table and legal-hold triggers |
| Data-subject rights | Access, rectification, erasure and restriction requests need a responsible operational route | Map which requests are handled by source process, institution or platform |
| Security | GDPR Article 32 requires appropriate technical and organisational measures | Validate encryption, access, audit, incident and restore controls against risk assessment |
| Records and contracts | GDPR Articles 28 and 30 may require processor terms and records of processing | Confirm institutional agreements and records |
| DPIA | GDPR Article 35 can require a data-protection impact assessment for likely high-risk processing | Document a DPIA screening and, if triggered, complete it before activation |
| Breach process | GDPR Articles 33–34 can impose notification duties | Define controller notification, incident evidence and escalation timetable |
| Third-country transfers | GDPR Chapter V regulates transfers outside the EEA | Approve origin/destination profile, transfer basis and safeguards before enabling transfer |
| DPO | Portuguese law identifies DPO obligations for public entities and certain private high-risk/large-scale cases | Determine DPO need and contact/operational escalation route for each institution |

## 4. Portugal/EU profile configuration requirements

A profile proposed by an institution must contain, at minimum:

1. operational jurisdiction and legal-entity identity;
2. category-specific purposes and validated lawful-basis references;
3. controller/processor allocation and approved contract reference;
4. retention rule per document category, including legal hold and backup effect;
5. classification/access minimum and authorised roles;
6. applicable data-subject-rights operating path;
7. approved storage/processing location and processor/subprocessor information;
8. transfer eligibility, approved destination profiles and lawful transfer basis;
9. DPIA screening result, risk owner and review date;
10. incident/DPO/contact escalation details;
11. approval authority, effective date and profile version.

## 5. Product controls already aligned with the profile model

The current Documents Foundation design provides configuration points for:

- jurisdiction-and-category retention;
- legal hold and non-restoration of legally deleted data;
- institution-scoped encryption/access/audit;
- minimal references rather than replicated entity records;
- controlled transfer with origin/destination profile compatibility;
- policy version recorded with decisions;
- append-only audit, incident escalation and data-minimised evidence.

These controls are design inputs, not proof of legal compliance.

## 6. Activation gate for Portugal/EU profile

```
OFFICIAL_SOURCES_REVIEWED = YES
INSTITUTIONAL_ROLE_ALLOCATION_VALIDATED = NO
CATEGORY_LAWFUL_BASIS_VALIDATED = NO
RETENTION_SCHEDULE_VALIDATED = NO
DPIA_SCREENING_COMPLETED = NO
PROCESSOR_AND_TRANSFER_TERMS_VALIDATED = NO
DPO_ESCALATION_VALIDATED = NO
PORTUGAL_EU_PROFILE_APPROVED = NO
```

The profile remains inactive until every applicable item is evidenced and approved through the platform’s jurisdiction-profile process.

## 7. Next legal-validation action

Obtain a qualified Portugal/EU data-protection review covering the exact institutions, categories, hosting/subprocessor model, transfers and retention schedules. Record the outcome as a versioned jurisdiction profile proposal for platform approval.
