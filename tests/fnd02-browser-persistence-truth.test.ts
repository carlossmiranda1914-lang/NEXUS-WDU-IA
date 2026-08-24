import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('src/supabaseClient.ts', 'utf8');
assert.doesNotMatch(source, /sincronizado de forma instantânea/);
assert.match(source, /sincronização institucional não está disponível/);
assert.doesNotMatch(source, /seedSupabaseDatabase[\s\S]{0,300}success:\s*true/);
console.log('FND-02 browser persistence truth fence: PASS.');
