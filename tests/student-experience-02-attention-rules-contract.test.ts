import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const missionPath = resolve('docs/roadmap/missions/STUDENT-EXPERIENCE-02.md');

assert.ok(existsSync(missionPath), 'Task 1 requires the canonical STUDENT-EXPERIENCE-02 Mission Pack before any attention projection exists.');

const mission = readFileSync(missionPath, 'utf8');

for (const law of [
  'Quiet summary, contextual detail',
  'Attention requires canonical fact + explicit domain rule',
  'See here, resolve at the owner',
]) assert.ok(mission.includes(law), `Mission Pack must preserve product law: ${law}`);

for (const column of [
  'FACT',
  'CANONICAL OWNER',
  'SOURCE FIELD/STATE',
  'DOMAIN RULE',
  'USER MEANING',
  'OWNING SECTION',
  'REAL ACTION AVAILABLE?',
  'SAFE ROUTE AVAILABLE?',
]) assert.ok(mission.includes(column), `Mission Pack must inventory ${column}.`);

assert.match(mission, /SCHEMA_CHANGE_EXPECTED=NO/);
assert.match(mission, /absence\/null alone cannot create attention/i);
assert.match(mission, /ATTENTION_RULES_ACCEPTED=(?:NONE|[A-Z0-9_, -]+)/);
assert.match(mission, /ATTENTION_RULES_REJECTED=(?:NONE|[A-Z0-9_, -]+)/);

console.log('student-experience-02-attention-rules-contract: PASS');
