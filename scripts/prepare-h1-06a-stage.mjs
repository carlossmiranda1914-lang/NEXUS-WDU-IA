import { execSync } from 'node:child_process';
import fs from 'node:fs';

const cwd = 'D:/Nexus/repo/NEXUS-WDU-IA';

// --- 1. Stage document-retention-command.ts ---
const retentionCmdContent = fs.readFileSync(`${cwd}/src/modules/documents/document-retention-command.ts`, 'utf-8').replace(/\r\n/g, '\n');
const retentionCmdSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: retentionCmdContent,
  encoding: 'utf-8',
}).trim();
console.log(`document-retention-command.ts blob: ${retentionCmdSha}`);
execSync(`git update-index --cacheinfo 100644 ${retentionCmdSha} src/modules/documents/document-retention-command.ts`, { cwd });

// --- 2. Stage document.controller.ts from HEAD + H1-06A changes ONLY ---
const baseCtrlContent = execSync('git show HEAD:src/modules/documents/document.controller.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// A. CATEGORY_MISMATCH in rejectDomainError
const errBlockMarker = '    // 422 Unprocessable Entity - Other domain state blockers\n    if (\n';
if (!baseCtrlContent.includes(errBlockMarker)) {
  throw new Error('Could not find 422 block marker in base document.controller.ts');
}
let stagedCtrlContent = baseCtrlContent.replace(
  errBlockMarker,
  errBlockMarker + "      msg.includes('CATEGORY_MISMATCH') ||\n",
);

// B. Routes 11.1 (retention) through 14 (authorize-deletion)
const targetRoutesStart = `  // 11.1. POST /api/documents/:id/retention — Governed retention assignment`;
const targetRoutesEndMarker = `  // 15. POST /api/documents/:id/deletion/execute — Execute deletion`;

const startIndex = stagedCtrlContent.indexOf(targetRoutesStart);
const endIndex = stagedCtrlContent.indexOf(targetRoutesEndMarker);

if (startIndex === -1 || endIndex === -1) {
  throw new Error('Target retention routes block not found in HEAD of document.controller.ts');
}

// Extract current modified retention routes from working tree
const workingCtrlContent = fs.readFileSync(`${cwd}/src/modules/documents/document.controller.ts`, 'utf-8').replace(/\r\n/g, '\n');
const workingStartIndex = workingCtrlContent.indexOf(targetRoutesStart);
const workingEndIndex = workingCtrlContent.indexOf(targetRoutesEndMarker);

if (workingStartIndex === -1 || workingEndIndex === -1) {
  throw new Error('Target retention routes block not found in working copy of document.controller.ts');
}

const replacementRoutesBlock = workingCtrlContent.slice(workingStartIndex, workingEndIndex);

stagedCtrlContent = stagedCtrlContent.slice(0, startIndex) + replacementRoutesBlock + stagedCtrlContent.slice(endIndex);

const ctrlSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCtrlContent,
  encoding: 'utf-8',
}).trim();
console.log(`document.controller.ts blob: ${ctrlSha}`);
execSync(`git update-index --cacheinfo 100644 ${ctrlSha} src/modules/documents/document.controller.ts`, { cwd });

// --- 3. Stage the legacy test alignment ---
execSync('git add tests/documents-retention-contract.test.ts', { cwd });

// --- 4. Stage the new test file ---
execSync('git add tests/documents-retention-authorization.test.ts', { cwd });

console.log('All H1-06A files staged cleanly!');
