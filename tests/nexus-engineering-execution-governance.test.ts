import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const operatingSystem = await readFile(new URL('../docs/operations/NEXUS_ENGINEERING_OPERATING_SYSTEM.md', import.meta.url), 'utf8');
const codexAdapter = await readFile(new URL('../docs/operations/CODEX_EXECUTION_ADAPTER.md', import.meta.url), 'utf8');
const antigravityAdapter = await readFile(new URL('../docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md', import.meta.url), 'utf8');
const playbook = await readFile(new URL('../docs/operations/ENGINEERING_PLAYBOOK.md', import.meta.url), 'utf8');
const definitionOfDone = await readFile(new URL('../docs/DEFINITION_READY_DONE_EVIDENCE.md', import.meta.url), 'utf8');
const engineeringConfig = await readFile(new URL('../docs/operations/NEXUS_ENGINEERING_CONFIG.yaml', import.meta.url), 'utf8');

assert.match(operatingSystem, /Risk\s*->\s*Proof\s*->\s*Tool\s*->\s*DONE/, 'The canonical operating system must bind risk to proof, tool and DONE eligibility.');
assert.match(operatingSystem, /WRITE_OWNER/, 'The canonical write-lock must name the write owner.');
assert.match(operatingSystem, /REVIEWER_MODE/, 'The canonical write-lock must state reviewer mode.');
assert.match(operatingSystem, /REVIEWED_HEAD/, 'The canonical review handoff must bind review to an exact head.');
assert.match(operatingSystem, /MERGE_SAFE/, 'The canonical review handoff must make merge eligibility explicit.');
assert.match(operatingSystem, /stateful[\s\S]{0,240}behavioral proof/i, 'Stateful critical flows require behavioral proof.');
assert.match(operatingSystem, /review[\s-]thread[\s\S]{0,240}adjudicat/i, 'Unadjudicated review threads must block critical-path merge eligibility.');

for (const [name, adapter] of [['Codex', codexAdapter], ['Antigravity', antigravityAdapter]] as const) {
  assert.match(adapter, /HANDOFF_TYPE=IMPLEMENTATION/, `${name} must define implementation handoffs.`);
  assert.match(adapter, /HANDOFF_TYPE=REVIEW/, `${name} must define review handoffs.`);
  assert.match(adapter, /REVIEWED_HEAD/, `${name} reviews must bind to an exact head.`);
  assert.match(adapter, /WRITE_TRANSFER_REQUIRED/, `${name} must require an explicit transfer before a reviewer edits owner work.`);
  assert.match(adapter, /READ_ONLY/, `${name} reviewer mode must begin read-only.`);
}

for (const field of ['MISSION', 'TASK', 'HEAD SHA', 'WRITE_OWNER', 'REVIEWER', 'INVARIANTS', 'RISK CLASS', 'AUTHORIZED_SCOPE', 'FORBIDDEN_SCOPE', 'REQUIRED_PROOF', 'STOP_CONDITIONS', 'COMMIT/PUSH/MERGE AUTHORIZATION']) {
  assert.match(playbook, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `The canonical prompt contract must require ${field}.`);
}
assert.match(playbook, /Static\/source tests are complementary only/i, 'The playbook must distinguish static checks from behavioral proof.');
assert.match(playbook, /Stateful user flows require behavioral\/state-transition proof/i, 'The playbook must require ordered behavioral proof for stateful user flows.');
assert.match(definitionOfDone, /REVIEWED_HEAD/, 'The Definition of Done must require current-head review.');
assert.match(definitionOfDone, /review-thread[\s\S]{0,240}adjudic/i, 'The Definition of Done must require review-thread adjudication.');

assert.match(engineeringConfig, /mission:\s*ALUNOS-01A\.3/, 'The selector must retain the ALUNOS-01A.3 mission.');
assert.match(engineeringConfig, /activity:\s*FINAL_HARDENING\/CLOSEOUT/, 'The selector must state the current closeout activity rather than a completed Task 5.');
assert.match(engineeringConfig, /write_owner:\s*CODEX/, 'The selector must name Codex as the single governance writer.');
assert.match(engineeringConfig, /reviewer:\s*ANTIGRAVITY/, 'The selector must name Antigravity as reviewer.');
assert.match(engineeringConfig, /reviewer_mode:\s*READ_ONLY/, 'The selector must require a read-only reviewer.');
assert.match(engineeringConfig, /mission_branch:\s*codex\/alunos-01a-design/, 'The selector must keep the canonical ALUNOS branch.');
for (const prohibition of ['no new module', 'no unrelated refactor', 'no historical migration modification', 'no parallel writer', 'no automatic scope expansion']) {
  assert.match(engineeringConfig, new RegExp(prohibition), `The selector must prohibit ${prohibition}.`);
}

console.log('[NEXUS] engineering execution governance Task 1 contract: PASS.');
