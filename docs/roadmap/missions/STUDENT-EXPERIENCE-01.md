# STUDENT-EXPERIENCE-01 — Active Students & Student Record Workspace

**State:** READY  
**Dependencies:** IAM, ENROLLMENT-02, ACADEMIC-01, STUDENT-360-01 and NEXUS-RECOVERY-01 UAT bootstrap.  
**Implementation:** requires separate explicit authorisation.

## Product contract

One person appears once in Active Students with name, state, current class/level, academic year and the next useful operational fact. The primary action opens **Registo do Aluno** — not a technical `Student 360` title and not a process drawer.

## Authority / information architecture

Reuse authorised Student Context, StudentProfile, Enrollment, AcademicYear, Program/Level, Class, StudentAcademicPlacement, GuardianRelationship and safe document metadata. Create no Student writer/aggregate, browser-owned Institution, localStorage authority, Finance/Assessment/Attendance/physical-document fact or duplicated join.

Sections: **Resumo**, **Percurso académico**, **Matrículas**, **Documentos**, **Encarregados**; future areas appear only when authoritative, otherwise explicitly unavailable.

## UX / safety / DoR

Active Students → one person → Registo do Aluno; no historical duplicate. Desktop/mobile/light/dark plus loading, empty, safe error/retry, forbidden/not-found and partial-data are required. Backend `requireAuth`/InstitutionalContext remains authority; no UUIDs, phone/address/national ID/provider IDs/SQL/stack. Human visual UAT (authorised, denied/cross-tenant, responsive/theme, current/history) is mandatory for DONE. Product flow, sources, authority, unavailable semantics and test contract are decided; no authority decision remains open.
