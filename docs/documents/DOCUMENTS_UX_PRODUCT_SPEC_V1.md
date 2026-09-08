# Documents Foundation — UX & Product Specification v1.0

**Status:** APPROVED / FROZEN V1  
**Implementation authorization:** NO

## 1. UX principle

The user must be able to answer four questions without understanding the internal architecture:

1. What is this document?
2. What is its technical state?
3. Is any business decision pending or complete?
4. What, if anything, must I do next?

Technical state and business decision must never be collapsed into one ambiguous `status`.

## 2. Required state presentation

Examples:

- `Verificação: Concluída` + `Decisão: A aguardar análise`
- `Verificação: Requer atenção` + `Decisão: Não iniciada`
- `Verificação: Disponível` + `Decisão: Rejeitada pelo domínio competente`

Internal state names may differ, but the user-facing representation must be human-readable and safe.

## 3. Upload experience

- Upload progress reflects transfer progress only.
- `100% enviado` must never imply technical availability or business acceptance.
- After transfer, show the next state explicitly, e.g. `Em verificação`.
- Resumable upload is available only within a valid resumable session.
- Network interruption may allow resume; explicit user cancel ends the session and requires a new attempt.
- Drag-and-drop is optional convenience, never the only input method.
- Large-file retries must not create duplicate logical documents when idempotency applies.

## 4. Duplicates and replacement

When an authorized user submits content already known in the same legitimate context, the UI may offer to reuse/associate the existing authorized document rather than silently duplicate it.

The message must never reveal a cross-tenant match.

`Substituir` means create a new version. It is not equivalent to `Eliminar`.

## 5. Quarantine and security messaging

User-facing quarantine messages are generic and actionable without exposing signatures, scanner internals, storage paths or exploitable details.

Example intent: `O documento não pode ser disponibilizado neste momento e requer verificação adicional.`

Normal institutional administrators do not receive an ordinary `ignore malware` action.

## 6. Review queues

Review workspaces should support:

- priority;
- due date/deadline;
- age;
- institutional/process context;
- current responsible actor/team where delegation is allowed.

Overdue items may trigger alert/escalation. Delegation preserves prior responsibility history.

## 7. Business decision messaging

Rejection/acceptance reasons come from the business domain that owns the decision. Documents must not invent a reason.

The same document may have different decisions in different associations/processes; the UI must reflect the relevant context.

## 8. Destructive and sensitive actions

The following must remain semantically distinct:

- withdraw;
- disassociate;
- replace;
- request deletion;
- execute authorized deletion.

High-risk or irreversible actions require proportionate confirmation. Routine operations should not be overloaded with unnecessary modal confirmation.

## 9. Errors

UI errors must map from stable canonical error categories/codes and must not depend on matching free-form error text.

Users should receive:

- a safe summary;
- whether retry is safe;
- a next action when possible.

Cross-tenant/non-disclosing behavior must not reveal whether the foreign document exists.

## 10. Notifications

Notifications are driven by logical events, not technical retries. Relevant examples include:

- document received;
- document available;
- action required;
- business decision completed;
- deadline approaching/overdue;
- document rejected by competent domain;
- replacement required.

Notification content must minimize sensitive data. Notifications are not proof of authority; canonical state remains in the source domain.

## 11. Accessibility

Minimum requirements:

- keyboard navigation;
- visible focus;
- screen-reader semantics;
- meaningful labels;
- sufficient contrast;
- errors associated to fields/actions;
- no status conveyed only by color;
- upload controls usable without pointer drag-and-drop.

## 12. Internationalization

- User-facing text must be localizable.
- Date/time/size formatting follows appropriate locale/timezone presentation.
- Persisted canonical timestamps remain normalized and unambiguous.
- The original document is not automatically translated.

## 13. Responsive behavior

Core journeys must remain usable on supported desktop, tablet and mobile layouts:

- list/view metadata;
- upload;
- follow technical state;
- act on a required next step;
- review where role permits.

## 14. Product-truth invariant

The UI must never claim that a capability exists before the backing authority exists.

No fake success for upload, preview, malware, signatures, M365 integration, sharing, OCR, AI processing or retention/deletion execution.
