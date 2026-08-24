import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('src/components/GoogleSheetsCenter.tsx', 'utf8');
const start = source.indexOf('const handleImportStudents');
const body = source.slice(start, start + 900);
assert.match(body, /importação institucional não está disponível/);
assert.doesNotMatch(body, /setStudents\(/);
assert.doesNotMatch(body, /Foram importados e inscritos/);
console.log('FND-02 Google import truth fence: PASS.');
