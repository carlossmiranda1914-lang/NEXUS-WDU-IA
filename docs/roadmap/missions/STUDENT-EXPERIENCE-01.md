# STUDENT-EXPERIENCE-01 — Active Students & Student Record Workspace

**State:** IMPLEMENTING
**Dependencies:** IAM, ENROLLMENT-02, ACADEMIC-01, STUDENT-360-01 and NEXUS-RECOVERY-01 UAT bootstrap.  
**Implementation:** requires separate explicit authorisation.

## Product contract

One person appears once in Active Students with name, state, current class/level, academic year and the next useful operational fact. The primary action opens **Registo do Aluno** — not a technical `Student 360` title and not a process drawer.

## Authority / information architecture

Reuse authorised Student Context, StudentProfile, Enrollment, AcademicYear, Program/Level, Class, StudentAcademicPlacement, GuardianRelationship and safe document metadata. Create no Student writer/aggregate, browser-owned Institution, localStorage authority, Finance/Assessment/Attendance/physical-document fact or duplicated join.

Sections: **Resumo**, **Percurso académico**, **Matrículas**, **Documentos**, **Encarregados**; future areas appear only when authoritative, otherwise explicitly unavailable.

## Execution sequence

Objective 1 is **ACCEPTED AS NAVIGATION FOUNDATION ONLY**: Active Students is a server-owned, one-person list and its primary action uses the opaque `studentRef`. The existing `StudentRecordDrawer` is **TRANSITIONAL / QUICK PREVIEW ONLY** and is not the final Registo do Aluno.

**Target surface:** **DEDICATED STUDENT RECORD WORKSPACE**.

1. **Objective 2.1 — Workspace + Resumo**: dedicated, read-only Student Record workspace with factual identity/status/current academic summary. **Human UAT accepted.**
2. **Objective 2.2 — Percurso académico**. **Human UAT accepted.**
3. **Objective 2.3 — Matrículas**. **Human UAT accepted.**
4. **Objective 2.4 — Documentos**. **Human UAT accepted.** Physical document lifecycle remains outside this mission.
5. **Objective 2.5 — Encarregados**. **Human UAT accepted.**
6. **Objective 2.6 — hardening final / responsive / security / states**. **VALIDATING: automated gates green; final Human UAT required.**

Every objective requires Human UAT before the following objective. No future section may be presented as operational before its authoritative data and approval exist.

## UX / safety / DoR

Active Students → one person → Registo do Aluno; no historical duplicate. Desktop/mobile/light/dark plus loading, empty, safe error/retry, forbidden/not-found and partial-data are required. Backend `requireAuth`/InstitutionalContext remains authority; no UUIDs, phone/address/national ID/provider IDs/SQL/stack. Human visual UAT (authorised, denied/cross-tenant, responsive/theme, current/history) is mandatory for DONE. Product flow, sources, authority, unavailable semantics and test contract are decided; no authority decision remains open.
