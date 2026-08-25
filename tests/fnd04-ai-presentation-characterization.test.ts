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
assert.equal(assistantFetches.length, 0, 'the Copilot must not request the fenced route');
assert.match(assistant, /const handleSendMessage = async/);
assert.match(assistant, /AI_UNAVAILABLE_MESSAGE/);
assert.doesNotMatch(assistant, /setIsLoading\(true\)/, 'the Copilot must not start loading for an unavailable operation');
assert.doesNotMatch(assistant, /motor analítico local/, 'the Copilot must not insert a fictional analytical result');
assert.doesNotMatch(assistant, /GEMINI_API_KEY/, 'the unavailable UX must not expose secret configuration language');

const automationFetches = automations.match(/fetch\('\/api\/chat'/g) ?? [];
assert.equal(automationFetches.length, 4, 'legacy request code remains unreachable and is guarded by the factual UI boundary');
for (const handler of [
  'handleExecuteAbsenceSimulation',
  'handleExecutePaymentSimulation',
  'handleExecuteMatriculaSimulation',
  'handleExecuteOcrSimulation',
]) {
  const start = automations.indexOf(`const ${handler} =`);
  assert.ok(start >= 0, `${handler} must remain explicitly characterized`);
  const body = automations.slice(start, start + 500);
  assert.match(body, /setUnavailableMessage\(/, `${handler} must display an unavailable state`);
  assert.ok(body.indexOf('return;') < body.indexOf('setIsSimulatingRun'), `${handler} must return before local simulation state changes`);
  assert.doesNotMatch(body, /fetch\('\/api\/chat'/, `${handler} must not reach a request before its early return`);
}
assert.match(automations, /role="status"/, 'the unavailable state must be exposed accessibly');
assert.match(automations, /useState<AutomationLog\[\]>\(\[\]\)/, 'there must be no pre-seeded operational success log');
assert.match(automations, /useState<SimulatedNotification \| null>\(null\)/, 'there must be no pre-seeded delivery preview');

console.log('FND-04 PT-23 AI presentation characterization: PASS (the backend remains fail-closed and all five UI callers now stop before request, simulation, success preview or institutional state change).');
