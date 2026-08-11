# Nexus Edu IA — Experience & Guidance Model v1

Status: PLANNING CANONICAL

## 1. Purpose
Define how Nexus presents work to real school users without exposing technical architecture. The product must be simple enough for a secretary, financial manager, teacher, director or guardian to understand what requires attention and what action is possible without learning internal system terminology.

This document does not define visual decoration. It defines product behaviour.

## 2. Core principle
Nexus must not force users to learn the software's internal structure before doing their work.

The interface should answer, in order:
1. What needs my attention?
2. Why does it need attention?
3. What can I do now?
4. What will happen after I act?

Normal work should be automated where rules and evidence allow it. Human attention should concentrate on decisions, exceptions and ambiguous situations.

## 3. Operational Center instead of passive dashboard
The main experience is an Operational Center adapted to institutional context and role.

### 3.1 Attention now
Prioritized exceptions and blocked work, for example:
- enrollment documents missing;
- identity conflicts requiring review;
- payments received but not reconciled;
- overdue balances requiring action;
- approvals waiting for Direction;
- attendance exceptions requiring follow-up.

Every item must have an owner, state, reason, age/SLA where relevant and a safe next action.

### 3.2 Work today
Operational workload that is not necessarily an exception:
- new applications;
- documents to issue;
- payments to reconcile;
- attendance to complete;
- assessments awaiting validation.

### 3.3 Contextual actions
Actions are shown according to role, institution and current state, for example:
- Start enrollment;
- Find person/student;
- Issue document;
- Register or reconcile payment;
- Send reminder;
- Review application;
- Resolve identity;
- Approve exception.

Buttons are not a second navigation menu. An action must represent a real operation with authorization, validation, evidence and an expected outcome.

### 3.4 School state
Use a small number of decision-useful indicators. Metrics must lead to understanding or action. Avoid decorative charts and vanity metrics.

## 4. Role-adapted experience
The underlying platform is shared, but priorities differ.

### Secretary
Enrollment, renewals, transfers, people, guardians, documents, pending information and administrative exceptions.

### Financial manager
Receivables, overdue obligations, payments to reconcile, exceptions, reversals/refunds subject to policy, evidence and daily closure.

The financial experience must make frequent operations fast while retaining institutional isolation, auditability and separation of duties. It must not require users to understand accounting or database implementation terminology to complete routine authorized work.

### Direction
Decisions, approvals, risks, capacity, institutional trends and unresolved high-impact exceptions.

### Teacher
Today's classes, attendance, assessments, student situations requiring attention and communications within authorization.

### Guardian/family
Required actions, payments, documents, messages, student information and process status, with minimal institutional terminology.

## 5. Guided institutional onboarding
A new institution should be configured through a guided experience rather than by manually discovering many settings pages.

Possible collection areas:
- institution and units;
- approximate scale and student population;
- academic levels/cycles and offers;
- academic year/calendar;
- classes/capacity;
- enrollment practices;
- required documents;
- financial model and collection practices;
- communication channels;
- current operational pain points;
- existing data/import sources.

Answers may produce configuration suggestions, tasks and readiness warnings. They must not silently grant privileges or bypass approval/policy boundaries.

Configuration should be progressive: only ask what is needed for the next real workflow. Do not create a giant mandatory setup questionnaire.

## 6. Structured data collection / questionnaires
Nexus may provide reusable guided forms/questionnaires for onboarding, enrollment, family information, authorizations, internal diagnosis and other workflows.

Rules:
- questions belong to a defined purpose and institutional context;
- collect only information required for that purpose;
- distinguish mandatory, optional and conditional questions;
- answers can create tasks/recommendations/workflow inputs;
- sensitive or privileged outcomes remain controlled by backend policies;
- configuration must support institutional variation without breaking canonical data models;
- questionnaire answers must not become an uncontrolled parallel database when the information belongs to canonical Person, Enrollment, Guardian, Finance or other domain entities.

## 7. Embedded help and product guidance
Help should live inside the workflow, not primarily in a separate manual.

### 7.1 Contextual explanation
Short human-language explanation near an unfamiliar state/action: what it means, why it matters and what happens next.

### 7.2 First-use guidance
Progressive onboarding for new users. Teach the next relevant operation, not the entire platform at once.

### 7.3 Action preview
For consequential actions, explain the result before confirmation, e.g. activating an enrollment will create/activate the downstream student context and trigger defined follow-up processes.

### 7.4 Empty-state guidance
An empty screen must explain what belongs there and offer the legitimate first action where the user is authorized.

### 7.5 Help/search entry point
A user should be able to ask how to perform a task in ordinary language and be guided to the authorized workflow. Future conversational/AI assistance may support this, but must obey the same policies and must not invent permissions or perform critical actions without required confirmation.

## 8. Navigation model
Navigation is for stable domains and orientation. The Operational Center is for today's work. Contextual actions are for execution.

Do not duplicate every operation in all three layers.

A user should be able to reach a process from:
- a priority/exception card;
- a contextual search for person/process;
- a stable domain entry when deliberately exploring records.

## 9. Daily-use design rules
1. Prefer one clear primary action per state.
2. Hide technical implementation vocabulary.
3. Do not ask twice for information already known and authorized for reuse.
4. Pre-fill safe context from institution and workflow.
5. Make irreversible/high-impact actions explicit and evidenced.
6. Preserve history; correction should not erase accountability.
7. Batch operations should exist where school work is naturally repetitive, but must expose scope and result.
8. Search must prioritize real entities and processes, not raw database identifiers.
9. Mobile/responsive use is part of the workflow design, not a later visual adaptation.
10. Accessibility and understandable language are quality requirements.

## 10. Automation contract
Automation should be invisible when successful and explicit when human attention is required.

Pattern:
Event -> validate rules/context -> perform safe deterministic work -> record evidence -> create exception/task only when required -> present human-readable next action.

Examples:
- missing required document -> mark pending and prepare/send permitted reminder;
- confirmed payment -> reconcile eligible obligation and update status;
- enrollment ready -> place in decision queue rather than asking Secretary to rediscover it;
- unresolved identity match -> stop automatic creation and request reconciliation.

Automation must never weaken tenant isolation, authorization, audit or separation of duties.

## 11. Relationship to modules
A module/domain is not automatically a dashboard tile. Domains provide records and capabilities; workflows orchestrate work across them; the Operational Center presents the user's priorities.

Therefore Nexus should avoid rebuilding the legacy pattern of many visually attractive module cards with shallow CRUD screens.

## 12. Definition of a useful screen
Before implementation, every significant screen must answer:
- Which user/job is this for?
- What decision or task is being completed?
- What information is necessary now?
- What can be inferred/pre-filled?
- What are the normal path and exceptions?
- What is the primary action?
- What happens after that action?
- What evidence/history is produced?
- What authorization boundary applies?
- What does the user see when there is nothing to do, an error, or insufficient permission?

If these questions are unanswered, the screen is not READY for implementation.

## 13. Product success criteria
The model succeeds when:
- routine work requires fewer navigation steps and repeated entries;
- users can identify priorities without knowing module structure;
- exceptions reach the correct responsible role;
- institutional setup accelerates first useful operation;
- financial and administrative frequent tasks are quick but controlled;
- help is available at the moment of need;
- dashboards drive action rather than merely display totals;
- automation reduces manual coordination while retaining evidence.

## 14. Governance
This model is subordinate to accepted ADRs, official architecture and security invariants. It is a mandatory product reference for future operational-center, dashboard, onboarding, questionnaire, navigation and embedded-help work.

No implementation is authorized by this document alone. Each vertical still requires READY criteria, evidence plan and mission decomposition.