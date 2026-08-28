# ACADEMIC-01 — Definition of Ready Evidence

**Estado:** DONE — ACADEMIC-01 (DoR preserved; execution evidence closed in `ACADEMIC-01.md`).

| Fonte factual | Resultado |
| --- | --- |
| `main @ ff82b40` | IAM, AUTH-CSP, ENROLLMENT-01/02 integrados; workflow pós-merge PASS. |
| Roadmap Partes 4–5 | Academic Core precede Student 360; estrutura temporal e assignment explícita precedem Assessment/Attendance. |
| Architecture §§3,6,8,9,13 | InstitutionalContext, temporal assignment, activation como predecessor e audit factual são obrigatórios. |
| `0006`, `0010`, academic-year controller | AcademicYear/Offer vNext têm tenant ownership e lifecycle, mas não Class/Subject/Assignment. |
| `0017`, `schema.ts` | teachers/classes/subjects legados usam texto/JSON; não têm autoridade temporal, concurrency ou tenant-safe assignment. |
| ENROLLMENT-02 | `Enrollment.active` + `StudentProfile.active` são handoff canónico para placement, sem duplicar activation. |

## Gaps e classificação

| Gap | classificação | risco |
| --- | --- | --- |
| Class/Subject temporal canónico ausente | P1 missing | relações escolares podem tornar-se atemporais/ambíguas. |
| TeacherAssignment canónica ausente | P1 missing | qualquer utilizador/nome pode parecer professor de turma. |
| Placement autorizado ausente | P1 missing | Student 360/Attendance não têm fonte segura de turma atual/histórico. |
| Documento físico | P1 future dependency | não bloqueia estruturar Academic Core, mas bloqueia alegação de evidência física. |
| Student 360 | future scope | não pode ser write silo nem projection incompleta. |

## Ready decision

Aggregate boundaries, temporal authority, teacher eligibility, optimistic concurrency, tenant isolation, migration approach, AC01–AC12, test matrix e downstream contract estão definidos. A migration 0022 é autorizável apenas na implementação TDD posterior; nenhuma migration/schema/API foi criada nesta preparação.

**DONE — ACADEMIC-01.**
