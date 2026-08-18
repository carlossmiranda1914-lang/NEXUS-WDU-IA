import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentDocumentPolicyConfigurator.tsx', import.meta.url), 'utf8');
let assertions = 0;
const expect = (value: unknown, message: string) => { assertions += 1; assert.ok(value, message); };

expect(source.includes("role==='institution_admin'||role==='director'"), 'Backend-resolved role must control administrative visibility.');
expect(source.includes('if(!allowed)return null'), 'Secretariat must not receive administrative controls.');
expect(source.includes('/api/enrollment-document-policies?offerId='), 'Policies must load from the backend for the selected offer.');
expect(source.includes("'/api/enrollment-document-policies/drafts'"), 'Draft creation must use the S04 endpoint.');
expect(source.includes("method:'POST'"), 'Requirement creation must use POST.');
expect(source.includes("method:'PATCH'"), 'Requirement editing must use PATCH.');
expect(source.includes("method:'DELETE'"), 'Requirement removal must use DELETE.');
expect(source.includes('/requirements/order'), 'Reorder must use the canonical endpoint.');
expect(source.includes('/publish'), 'Publication must use the canonical endpoint.');
expect(source.includes('await load();setNotice'), 'A successful mutation must refetch persisted state before success feedback.');
expect(source.includes('e.status===403') && source.includes('e.status===409'), 'Forbidden and conflict responses must remain visible.');
const payloads = Array.from(source.matchAll(/JSON\.stringify\(([^)]*)\)/g), (match) => match[1]).join(' ');
expect(!/\b(role|institution_id|institutionId|authority)\b/.test(payloads), 'Request bodies must not send browser authority.');
const headers = Array.from(source.matchAll(/headers:\{([^}]*)\}/g), (match) => match[1]).join(' ');
expect(!/\b(role|institution_id|institutionId|authority)\b/.test(headers), 'Request headers must not send browser authority.');
expect(!source.includes('policy_id') && !source.includes('requirement_id'), 'The operational path must not expose technical IDs.');
console.log(`[ENROLLMENT-DOCUMENT-POLICY-CONFIGURATOR] passed (${assertions} assertions).`);
