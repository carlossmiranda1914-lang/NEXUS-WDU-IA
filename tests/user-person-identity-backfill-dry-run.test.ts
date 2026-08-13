import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  classifyLegacyUsers,
  normalizeEmail,
  PRIVILEGED_LEGACY_EMAIL,
} from '../scripts/user-person-identity-backfill-dry-run.ts';

test('classifies an unambiguous legacy user as a technical backfill candidate', () => {
  const report = classifyLegacyUsers([{ id: 1, uid: 'firebase-uid-1', email: 'user@example.edu', name: 'Utilizador' }]);
  assert.equal(report.records[0].classification, 'AUTO_MIGRATABLE');
  assert.equal(report.summary.autoMigratable, 1);
});

test('detects placeholder, privileged and concrete demo/test evidence', () => {
  const report = classifyLegacyUsers([
    { id: 1, uid: 'uid_pre_created', email: 'placeholder@example.edu', name: 'Pré-criado' },
    { id: 2, uid: 'firebase-admin', email: PRIVILEGED_LEGACY_EMAIL, name: 'Administrador' },
    { id: 3, uid: 'firebase-demo', email: 'demo@example.edu', name: 'Demo' },
  ]);
  assert.equal(report.records[0].classification, 'PLACEHOLDER_UID');
  assert.equal(report.records[1].classification, 'PRIVILEGED_LEGACY');
  assert.equal(report.records[2].classification, 'DEMO_OR_TEST');
});

test('normalizes email only for comparison and records normalization reasons', () => {
  const report = classifyLegacyUsers([{ id: 1, uid: 'firebase-1', email: ' User@Example.edu ', name: 'Utilizador' }]);
  assert.equal(normalizeEmail(' User@Example.edu '), 'user@example.edu');
  assert.equal(report.records[0].maskedEmail, 'u***@example.edu');
  assert.deepEqual(report.records[0].reasonCodes, ['EMAIL_CASE_NORMALIZED', 'EMAIL_TRIMMED']);
});

test('detects duplicate UID, duplicate normalized email and UID/email conflicts', () => {
  const report = classifyLegacyUsers([
    { id: 1, uid: 'same-uid', email: 'first@example.edu', name: 'Primeiro' },
    { id: 2, uid: 'same-uid', email: 'second@example.edu', name: 'Segundo' },
    { id: 3, uid: 'third-uid', email: 'SECOND@example.edu', name: 'Terceiro' },
  ]);
  assert.equal(report.records[0].classification, 'UID_EMAIL_CONFLICT');
  assert.equal(report.records[1].classification, 'UID_EMAIL_CONFLICT');
  assert.equal(report.records[2].classification, 'UID_EMAIL_CONFLICT');
  assert.ok(report.records[1].reasonCodes.includes('DUPLICATE_EMAIL'));
  assert.ok(report.records[0].reasonCodes.includes('DUPLICATE_UID'));
});

test('missing required identity data takes precedence while retaining all reasons', () => {
  const report = classifyLegacyUsers([{ id: 1, uid: 'uid_missing_data', email: '', name: '' }]);
  assert.equal(report.records[0].classification, 'MISSING_REQUIRED_DATA');
  assert.deepEqual(report.records[0].reasonCodes, ['MISSING_EMAIL', 'MISSING_NAME', 'PLACEHOLDER_UID']);
});

test('the dry-run source is read-only and does not map legacy authorization fields', async () => {
  const source = await readFile(new URL('../scripts/user-person-identity-backfill-dry-run.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\s+(?:INTO|FROM|TABLE|DATABASE)?/i);
  assert.match(source, /BEGIN READ ONLY/);
  assert.equal(/\b(role|status|department|associatedStudentIds)\s*[:=]/.test(source), false);
});
