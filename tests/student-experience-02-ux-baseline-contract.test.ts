import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const auditPath = new URL('../docs/roadmap/missions/STUDENT-EXPERIENCE-02-UX-AUDIT.md', import.meta.url);
const audit = await readFile(auditPath, 'utf8');

assert.match(audit, /PREMIUM_SERENE_DIRECTION=PROTECTED/);
assert.match(audit, /ATTENTION_RULES_ACCEPTED=NONE/);
assert.match(audit, /ATTENTION_UI_ADDED=NO/);
assert.match(audit, /FAKE_ACTIONS_ADDED=NO/);
assert.match(audit, /BROWSER_AUTHORITY_ADDED=NO/);
assert.match(audit, /TECHNICAL_IDS_EXPOSED=NO/);
assert.match(audit, /VISUAL_EVIDENCE=LIVE_LOCAL_UI/);
assert.match(audit, /RESPONSIVE_EVIDENCE=DESKTOP_TABLET_MOBILE/);
assert.match(audit, /THEME_EVIDENCE=LIGHT_AND_DARK/);

for (const surface of ['Alunos ativos', 'Entity Context Header', 'Resumo', 'Percurso académico', 'Matrículas', 'Documentos', 'Encarregados']) {
  assert.match(audit, new RegExp(`\\| ${surface} \\|`), `audit must inventory ${surface}.`);
}

for (const classification of ['KEEP', 'REFINE', 'REJECT']) {
  assert.match(audit, new RegExp(`\\| ${classification} \\|`), `audit must contain ${classification} decisions.`);
}

assert.match(audit, /\| SURFACE \| CURRENT EVIDENCE \| CLASSIFICATION \| USER BENEFIT \| PROPOSED DIRECTION \| AUTHORITY IMPACT \| REGRESSION RISK \| ACCEPTANCE CRITERION \|/);
assert.match(audit, /ACCESSIBILITY_EVIDENCE=/);
assert.match(audit, /PRODUCT_CODE_CHANGE=NO/);
assert.match(audit, /BACKEND_CHANGE=NO/);
assert.match(audit, /SCHEMA_CHANGE=NO/);
assert.match(audit, /ROUTING_CHANGE=NO/);

console.log('[STUDENT-EXPERIENCE-02] Task 4 UX baseline governance: PASS.');
