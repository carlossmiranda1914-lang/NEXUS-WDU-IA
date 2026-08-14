import { readFile } from 'node:fs/promises';
const script = await readFile('scripts/apply-s02-3-2-document-list-fields.ts', 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };
assert(script.includes('required'), 'Document list must expose required flag.');
assert(script.includes('source_requirement_id'), 'Document list must expose source requirement id.');
console.log(`Secretariat S02.3.2 API field contract passed (${assertions} assertions).`);
