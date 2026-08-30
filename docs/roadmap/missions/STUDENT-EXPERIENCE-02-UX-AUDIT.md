# STUDENT-EXPERIENCE-02 — Premium Serene UX Baseline Audit

**Task:** Revised Task 4 — audit only
**Baseline:** `67322bd1680c25b469a3ff6eb4c9d40d2362e094`
**Scope:** Active Students and the existing five-section Student Record. No product, backend, schema, routing or authority change is included in this task.

## Guardrails protected by this audit

```text
PREMIUM_SERENE_DIRECTION=PROTECTED
ATTENTION_RULES_ACCEPTED=NONE
ATTENTION_UI_ADDED=NO
FAKE_ACTIONS_ADDED=NO
BROWSER_AUTHORITY_ADDED=NO
TECHNICAL_IDS_EXPOSED=NO
PRODUCT_CODE_CHANGE=NO
BACKEND_CHANGE=NO
SCHEMA_CHANGE=NO
ROUTING_CHANGE=NO
```

The normal state is a quiet institutional record, not a dashboard or an operational cockpit. Every recommendation below preserves the existing server-owned Student Context and adds no action, alert, score, route, or client-side authority.

## Visual evidence collected

```text
VISUAL_EVIDENCE=LIVE_LOCAL_UI
RESPONSIVE_EVIDENCE=DESKTOP_TABLET_MOBILE
THEME_EVIDENCE=LIGHT_AND_DARK
ACCESSIBILITY_EVIDENCE=SEMANTIC_LANDMARKS_AND_KEYBOARD_TAB_PATH_OBSERVED
```

The authenticated local portal was inspected at the live Active Students view and Student Record: **Resumo**, **Percurso académico**, **Matrículas**, **Documentos**, and **Encarregados**. It was observed at desktop, a 768px tablet viewport and a 390px mobile viewport; the temporary viewport and theme overrides were restored after inspection.

Observed as working visual foundations: a labelled Student Record region and breadcrumb navigation; one H1 for the student, section H2s, labelled section navigation, semantic definition terms in Summary, and named tab buttons. Keyboard traversal reached the active Summary tab. The active/focus state is not visually separable enough in that observed case, so it is a refinement candidate rather than an assumed pass.

Not visually exercised in this audit: a genuine empty/partial/error/forbidden Student Record dataset, because changing data or permissions is out of Task 4. Those states remain covered by the existing product contracts and require a focused UAT fixture when Task 5 is approved. The browser console had no Student Record fatal error; it did contain unrelated existing 503 warnings from unavailable notice, chat, finance and teacher integrations, which are outside this read-only Student Record audit and are not treated as Student Record success or failure.

## KEEP / REFINE / REJECT inventory

| SURFACE | CURRENT EVIDENCE | CLASSIFICATION | USER BENEFIT | PROPOSED DIRECTION | AUTHORITY IMPACT | REGRESSION RISK | ACCEPTANCE CRITERION |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alunos ativos | Live desktop view presents one calm row for the active student with name, status, current class/level/year/programme and `Abrir registo`; no historical duplicates or identifiers were visible. | KEEP | A secretary can identify one current student record at a glance. | Preserve the single-row, current-context-first projection and its opaque-record entry. | NONE | Reintroducing enrollment-process rows would duplicate people and blur the destination. | One person remains one row; opening it remains an authorised record read. |
| Alunos ativos framing | The selected Active Students view still inherits broad workspace copy and entry/process actions from the parent enrollment workspace, visually competing with the one-row student task. | REFINE | Reduces cognitive noise when the user is already in the active-student task. | In a later approved visual task, scope the selected-view framing so the list is primary while keeping enrollment operations in their own views. | NONE | Moving or hiding an actual enrollment action could break an established process. | Active Students starts with its student task; Entradas/Matrículas actions remain discoverable in their existing process views. |
| Entity Context Header | Desktop/light/dark shows contextual breadcrumb, initials avatar, student name, restrained `Ativo` badge, and current year/class in one structured header. | KEEP | Confirms who the user is viewing and the current institutional context before details. | Preserve this header architecture, its calm surface and semantic status treatment. | NONE | Flattening it would remove context continuity; adding metrics would turn it into a cockpit. | Header retains breadcrumb, identity, state, year and class without technical IDs or decorative metrics. |
| Header versus summary context | The header already displays `Ativo`, year and class, while Summary repeats all three before providing programme/level. | REFINE | Less repetition lets the record read faster and preserves a serene hierarchy. | In a later approved task, decide one canonical visual placement for repeated current facts; retain programme/level without concealing any authoritative information. | NONE | Removing a field from both locations would make current context incomplete. | Each current fact has one clear primary placement; programme/level remains easy to find. |
| Section navigation | Five named sections are visible in a dedicated navigation: Resumo, Percurso académico, Matrículas, Documentos and Encarregados. | KEEP | Stable mental model for staff without turning every section into a dashboard card. | Preserve exactly five sections and the explicit active state. | NONE | Collapsing sections or replacing them with generic cards would lose navigation clarity. | All five sections remain reachable and their active state is apparent. |
| Mobile section navigation | At 390px, the fifth tab extends beyond the initial visible strip; the horizontal continuation is possible but its affordance is not obvious from the first viewport. | REFINE | Makes every existing section discoverable on a touch device. | In a later approved task, provide a quiet overflow affordance or spacing treatment without changing the five-section information architecture. | NONE | A replacement control could hide a tab or alter keyboard order. | At 390px all five sections are discoverable, reachable by touch and keyboard, with no clipped label mistaken for unavailable content. |
| Keyboard focus | Live keyboard traversal reached the Summary tab; the selected underline made the focus location insufficiently distinguishable in the observed active-tab case. | REFINE | Users navigating by keyboard can locate focus independently of selection or colour. | Strengthen the existing non-colour focus treatment only if a later focused visual test confirms the gap. | NONE | A new outline may conflict with the calm active-tab state or theme contrast. | Focus is visibly distinct from selection in light and dark, while semantic buttons and keyboard order remain unchanged. |
| Resumo | A single structured card presents current authorised context using status, year, class and programme/level. | KEEP | Gives staff a compact, factual first read. | Preserve one calm summary surface rather than introducing KPI cards, scores or alerts. | NONE | Converting this to metrics or attention tiles would manufacture operational meaning. | Summary stays factual, compact and free of attention language. |
| Percurso académico | Live view separates one `Situação atual` from a chronological `Percurso anterior`; current year/class/level/programme do not appear as historical rows. | KEEP | Preserves current-versus-history meaning without rewriting history. | Preserve the separation and chronological structure. | NONE | Merging lists would contaminate current context with past data. | Current context is visually distinct and historical items remain ordered without duplication. |
| Matrículas | Live view gives `Matrícula atual` a distinct first position followed by `Matrículas anteriores` in descending years. | KEEP | Staff can distinguish the present enrollment from prior periods quickly. | Preserve the current-first sequence and the restrained list presentation. | NONE | Reordering or repeating current enrollment would misstate lifecycle context. | Current enrollment appears once; earlier periods remain newest-first. |
| Historical enrollment copy | Each observed historical enrollment repeats the generic sentence `Matrícula registada neste ano letivo`. | REFINE | Removes repeated low-information text while retaining factual history. | In a later approved task, use the available human status/date detail only when it differentiates a historical period; otherwise keep the list concise. | NONE | Omitting a real enrollment state could hide operational meaning. | Every history row remains factually distinguishable; generic filler does not dominate the list. |
| Documentos | Live view is a concise metadata list: document type, factual verification status and date; no storage path, internal ID, download claim or fabricated lifecycle action was visible. | KEEP | Provides safe, factual document awareness without implying physical-document authority. | Preserve the metadata-only, structured list. | NONE | Adding upload/download/approval controls would create unproven owner actions. | Only safe metadata is displayed; no storage paths, identifiers or false action. |
| Encarregados | Live view lists the authorised guardian name, relationship and factual status in the same restrained record language. | KEEP | Staff can understand the supported association without contact-data leakage. | Preserve the minimal read-only list and its real empty-state contract. | NONE | Adding contacts, primary/financial labels or edit controls would exceed authority. | Only name, relationship and meaningful status are shown; no contacts, IDs or write action. |
| Attention/cockpit layer | Task 1 accepted no canonical attention facts; no attention panel, score, warning badge or placeholder is present in the observed record. | REJECT | Prevents fake urgency and protects trust in normal state. | Do not add attention decorations until a separately proven canonical rule exists. | NONE | A visual-only alert would invent business meaning and distract from the record. | No alert, score, warning badge or `attention` placeholder appears in the five sections. |
| Fake owner actions | Task 3 found no routable owner bridge for enrollment/document process actions from Student Record; the observed record provides no invented action controls. | REJECT | Avoids dead-end or unsafe operations. | Do not add disabled, simulated or internal-ID-backed action buttons. | NONE | A fake action may disclose IDs or mislead staff about operational capability. | No action is introduced without a proven safe public reference, route and authorisation boundary. |
| Card-wall / decorative metrics | The observed record uses one header, tab navigation and focused section surfaces rather than a dashboard of KPI tiles. | REJECT | Keeps the page calm and readable for the normal case. | Do not replace record sections with metric cards, progress rings or decorative counts. | NONE | A dashboard treatment increases density without an authority-backed user decision. | The record remains section-led and fact-led, with no manufactured performance metrics. |

## Baseline decision

```text
KEEP_COUNT=8
REFINE_COUNT=5
REJECT_COUNT=3
```

The refinement backlog is intentionally descriptive, not authorisation to modify the product. Any later implementation must use only these `REFINE` items, write a focused visual contract first, preserve all existing server-owned data semantics and re-run the existing privacy, tenant and Student Record regressions.

## Task 4 acceptance

```text
UX_CONTRACT=PREMIUM_SERENE_BASELINE_AUDITED
NEXT_AUTHORISED_TASK=NONE — WAITING FOR REVIEW
```
