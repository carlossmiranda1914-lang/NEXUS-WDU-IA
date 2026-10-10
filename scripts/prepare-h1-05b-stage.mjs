import { execSync } from 'node:child_process';
import fs from 'node:fs';

const cwd = 'D:/Nexus/repo/NEXUS-WDU-IA';

// --- 1. Stage document-upload-command.ts ---
const uploadCmdContent = fs.readFileSync(`${cwd}/src/modules/documents/document-upload-command.ts`, 'utf-8').replace(/\r\n/g, '\n');
const uploadCmdSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: uploadCmdContent,
  encoding: 'utf-8',
}).trim();
console.log(`document-upload-command.ts blob: ${uploadCmdSha}`);
execSync(`git update-index --cacheinfo 100644 ${uploadCmdSha} src/modules/documents/document-upload-command.ts`, { cwd });

// --- 2. Stage document.controller.ts from HEAD + H1-05B route changes ONLY ---
const baseCtrlContent = execSync('git show HEAD:src/modules/documents/document.controller.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// Find the routes block starting from PUT /api/documents/upload-sessions/:sessionId/transfer to end of POST /api/documents/upload-sessions/:sessionId/cancel
const targetRoutesStart = `  // 5.1. PUT /api/documents/upload-sessions/:sessionId/transfer — Real streaming byte transport`;
const targetRoutesEndMarker = `  // 9. POST /api/documents/:id/access — Authorize content access (Stage 1)`;

const startIndex = baseCtrlContent.indexOf(targetRoutesStart);
const endIndex = baseCtrlContent.indexOf(targetRoutesEndMarker);

if (startIndex === -1 || endIndex === -1) {
  throw new Error('Target upload session routes block not found in HEAD of document.controller.ts');
}

// Extract current modified upload session routes from working tree
const workingCtrlContent = fs.readFileSync(`${cwd}/src/modules/documents/document.controller.ts`, 'utf-8').replace(/\r\n/g, '\n');
const workingStartIndex = workingCtrlContent.indexOf(targetRoutesStart);
const workingEndIndex = workingCtrlContent.indexOf(targetRoutesEndMarker);

if (workingStartIndex === -1 || workingEndIndex === -1) {
  throw new Error('Target upload session routes block not found in working copy of document.controller.ts');
}

const replacementRoutesBlock = workingCtrlContent.slice(workingStartIndex, workingEndIndex);

const stagedCtrlContent = baseCtrlContent.slice(0, startIndex) + replacementRoutesBlock + baseCtrlContent.slice(endIndex);

const ctrlSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCtrlContent,
  encoding: 'utf-8',
}).trim();
console.log(`document.controller.ts blob: ${ctrlSha}`);
execSync(`git update-index --cacheinfo 100644 ${ctrlSha} src/modules/documents/document.controller.ts`, { cwd });

// --- 3. Stage the 3 updated test files ---
execSync('git add tests/documents-upload-postgres.test.ts', { cwd });
execSync('git add tests/documents-upload-idempotency-concurrency-postgres.test.ts', { cwd });
execSync('git add tests/documents-upload-multi-tenant-negative-postgres.test.ts', { cwd });

// --- 4. Stage the new test file ---
execSync('git add tests/documents-upload-session-authorization.test.ts', { cwd });

console.log('All H1-05B files staged cleanly!');
