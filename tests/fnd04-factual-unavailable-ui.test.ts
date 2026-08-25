import assert from 'node:assert/strict';
import fs from 'node:fs';

const assistant = fs.readFileSync('src/components/AIAssistant.tsx', 'utf8');
const automations = fs.readFileSync('src/components/AutomationsSection.tsx', 'utf8');
const sheets = fs.readFileSync('src/components/GoogleSheetsCenter.tsx', 'utf8');
const systemConfig = fs.readFileSync('src/components/SystemConfig.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.match(assistant, /INDISPONÍVEL/);
assert.match(assistant, /Sem consulta, análise ou ações institucionais neste ambiente/);
assert.match(assistant, /Funcionalidade temporariamente indisponível/);
assert.doesNotMatch(assistant, /fetch\('\/api\/chat'/);

for (const text of [
  'Nenhuma mensagem foi enviada nem foram alterados dados',
  'Nenhum aviso foi enviado nem foram alterados dados',
  'Nenhuma conta, credencial ou matrícula foi criada',
  'Nenhum ficheiro foi enviado, analisado ou arquivado',
]) {
  assert.match(automations, new RegExp(text));
}

assert.match(automations, /role="status"/);
assert.doesNotMatch(automations, /useState<AutomationLog\[\]>\(\[\{/, 'no success audit/log fixture may be displayed as current execution');
assert.match(automations, /useState<SimulatedNotification \| null>\(null\)/);

assert.match(sheets, /Integração Google Sheets indisponível/);
assert.match(sheets, /Nenhum dado foi enviado, importado ou alterado/);
assert.match(sheets, /useState<string \| null>\(null\)/, 'cached Google access must not activate the integration');

assert.match(systemConfig, /Configurações operacionais indisponíveis/);
assert.match(systemConfig, /Nenhuma alteração foi aplicada/);
assert.match(systemConfig, /AcademicYearManagement/, 'the canonical Academic Year view must remain available');

for (const text of [
  'Arquivo documental genérico indisponível',
  'Automação e fluxos indisponíveis',
  'Assinaturas digitais indisponíveis',
  'Portal de encarregados indisponível',
  'Administração de docentes indisponível',
]) {
  assert.match(app, new RegExp(text));
}
assert.match(app, /Documentos de Matrícula canónicos permanecem no fluxo de Matrículas/);

console.log('FND-04 factual unavailable UI interaction contract: PASS.');
