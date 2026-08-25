import assert from 'node:assert/strict';
import fs from 'node:fs';

const assistant = fs.readFileSync('src/components/AIAssistant.tsx', 'utf8');
const automations = fs.readFileSync('src/components/AutomationsSection.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

const chatRouteStart = server.indexOf("app.post('/api/chat'");
assert.ok(chatRouteStart >= 0, 'the mounted AI route must exist');
const chatRoute = server.slice(chatRouteStart, chatRouteStart + 1_500);
assert.match(chatRoute, /return res\.status\(503\)\.json\(\{\s*code: 'CANONICAL_AI_AUTHORITY_REQUIRED'/);
assert.ok(chatRoute.indexOf('CANONICAL_AI_AUTHORITY_REQUIRED') < chatRoute.indexOf('db.select'), 'the AI fence must precede institutional queries');
assert.ok(chatRoute.indexOf('CANONICAL_AI_AUTHORITY_REQUIRED') < server.indexOf('generateContentWithRetry', chatRouteStart), 'the AI fence must precede an external AI call');

const assistantFetches = assistant.match(/fetch\('\/api\/chat'/g) ?? [];
assert.equal(assistantFetches.length, 1, 'the operational copilot has one reachable chat caller');
assert.match(assistant, /const handleSendMessage = async/);
assert.match(assistant, /body: JSON\.stringify\(\{ prompt: text \}\)/, 'the client only supplies a prompt');
assert.match(assistant, /headers: await getHeaders\(\)/, 'the request uses identity headers, not a client tenant field');
assert.doesNotMatch(assistant, /body: JSON\.stringify\(\{[^}]*institution/i, 'the copilot request cannot select an institution in its body');
assert.match(assistant, /if \(!response\.ok\) \{\s*throw new Error\('Falha no servidor'\)/);
assert.match(assistant, /apresento-lhe uma resposta direta do meu motor analítico local/, 'the 503 catch currently displays a simulated analytical response');
assert.match(assistant, /finally \{\s*setIsLoading\(false\)/, 'the copilot loading state ends after the fenced request');

const automationFetches = automations.match(/fetch\('\/api\/chat'/g) ?? [];
assert.equal(automationFetches.length, 4, 'four simulation actions issue best-effort chat log calls');
for (const handler of [
  'handleExecuteAbsenceSimulation',
  'handleExecutePaymentSimulation',
  'handleExecuteMatriculaSimulation',
  'handleExecuteOcrSimulation',
]) {
  assert.match(automations, new RegExp(`const ${handler} =`), `${handler} must remain explicitly characterized`);
}
assert.match(automations, /fetch\('\/api\/chat',[\s\S]{0,300}\.catch\(/, 'simulation chat failures are currently ignored');
assert.match(automations, /status: 'success'/, 'simulation state can display success independently of the fenced chat request');
assert.doesNotMatch(automations, /JSON\.stringify\(\{[^}]*institution/i, 'simulation chat bodies cannot select an institution');

console.log('FND-04 PT-23 AI presentation characterization: PASS (five mounted callers reach the fail-closed route; current client presentation remains misleading and is locked for CP2 correction).');
