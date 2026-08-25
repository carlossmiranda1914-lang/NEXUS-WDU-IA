import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.match(app, /Indicadores institucionais indisponíveis/);
assert.match(app, /Pesquisa institucional indisponível sem projeção autorizada/);
assert.doesNotMatch(app, /activeTab === 'dashboard'[\s\S]{0,900}<Dashboard/);
assert.doesNotMatch(app, /<GlobalSearch/);

for (const key of [
  'nexus_students', 'nexus_teachers', 'nexus_invoices', 'nexus_announcements',
  'nexus_messages', 'nexus_automations', 'nexus_school_docs', 'nexus_signatures',
  'nexus_approvals', 'nexus_role_permissions', 'nexus_audit_logs', 'nexus_notification_presets',
]) {
  assert.doesNotMatch(app, new RegExp(`localStorage\\.(?:getItem|setItem|removeItem)\\('${key}'`));
}

assert.match(app, /localStorage\.getItem\('nexus_theme'\)/);
assert.match(app, /localStorage\.setItem\('nexus_theme', theme\)/);
assert.doesNotMatch(app, /localStorage\.clear\(\)/);

console.log('FND-04 dashboard, search and browser-state truth contract: PASS.');
