import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
assert.doesNotMatch(source, /functionDeclarations[\s\S]*createTodoTaskTool/, 'AI task tool must not be exposed to the model');
assert.match(source, /if \(name === 'createTodoTask'\)[\s\S]{0,220}desativada/, 'direct tool calls must fail closed');
assert.doesNotMatch(source, /else if \(name === 'createTodoTask'\) \{[\s\S]{0,200}db\.insert\(schoolTasks\)/, 'no reachable AI task direct write is permitted');
console.log('FND-02 AI Task write fence: PASS.');
