import { execSync } from 'node:child_process';
import fs from 'node:fs';

const cwd = 'D:/Nexus/repo/NEXUS-WDU-IA';

// --- 1. Stage document-deletion-command.ts ---
const deletionCmdContent = fs.readFileSync(`${cwd}/src/modules/documents/document-deletion-command.ts`, 'utf-8').replace(/\r\n/g, '\n');
const deletionCmdSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: deletionCmdContent,
  encoding: 'utf-8',
}).trim();
console.log(`document-deletion-command.ts blob: ${deletionCmdSha}`);
execSync(`git update-index --cacheinfo 100644 ${deletionCmdSha} src/modules/documents/document-deletion-command.ts`, { cwd });

// --- 2. Stage document.controller.ts from HEAD + H1-06B changes ONLY ---
const baseCtrlContent = execSync('git show HEAD:src/modules/documents/document.controller.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// Routes 15 and 16 (deletion execute and reconcile)
const targetRoutesStart = `  // 15. POST /api/documents/:id/deletion/execute — Execute deletion`;
const targetRoutesEndMarker = `}\n`;

const startIndex = baseCtrlContent.indexOf(targetRoutesStart);
if (startIndex === -1) {
  throw new Error('Target deletion routes block not found in HEAD of document.controller.ts');
}

// Extract current modified deletion routes from working tree
const workingCtrlContent = fs.readFileSync(`${cwd}/src/modules/documents/document.controller.ts`, 'utf-8').replace(/\r\n/g, '\n');
const workingStartIndex = workingCtrlContent.indexOf(targetRoutesStart);
if (workingStartIndex === -1) {
  throw new Error('Target deletion routes block not found in working copy of document.controller.ts');
}

const replacementRoutesBlock = workingCtrlContent.slice(workingStartIndex);

const stagedCtrlContent = baseCtrlContent.slice(0, startIndex) + replacementRoutesBlock;

const ctrlSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCtrlContent,
  encoding: 'utf-8',
}).trim();
console.log(`document.controller.ts blob: ${ctrlSha}`);
execSync(`git update-index --cacheinfo 100644 ${ctrlSha} src/modules/documents/document.controller.ts`, { cwd });

// --- 3. Stage the new test file ---
execSync('git add tests/documents-deletion-authorization.test.ts', { cwd });

console.log('All H1-06B files staged cleanly!');
