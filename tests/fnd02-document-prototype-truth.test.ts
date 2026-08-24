import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('src/components/DigitalSignatureSystem.tsx', 'utf8');
for (const name of ['handleArchiveSignature', 'handleSendDraft']) {
  const start = source.indexOf(`const ${name}`);
  const body = source.slice(start, start + 500);
  assert.match(body, /não está disponível/);
  assert.doesNotMatch(body, /onUpdateSignature\(/);
  assert.doesNotMatch(body, /com sucesso|arquivado digitalmente/);
}
console.log('FND-02 document prototype truth fence: PASS.');
