import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/components/EnrollmentDocumentChecklist.tsx', 'utf8');
assert(source.includes('type="file"') && source.includes('application/pdf,image/jpeg,image/png'), 'Checklist must select a real allowed file.');
assert(source.includes("'X-File-Name': encodeURIComponent(file.name)") && source.includes("'Idempotency-Key': key"), 'Upload must use encoded filename metadata and idempotency.');
assert(source.includes('body: file') && source.includes('await load(); await onChanged?.();'), 'UI must refresh only after backend upload succeeds.');
assert(!source.includes('Referência da evidência') && !source.includes('Registar referência'), 'The operational UI must not submit evidence_reference.');
assert(source.includes("/documents/${document.id}/file") && source.includes('response.blob()'), 'Download must use the authenticated backend endpoint.');
console.log('[ENROLLMENT-DOCUMENT-CHECKLIST-UPLOAD-CONTRACT] passed.');
