import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');

assert.match(source, /NEXUS_UAT_AUTH_TRACE === 'true'/, 'UAT diagnostics must require the explicit local trace flag');
assert.match(source, /\/api\/diagnostics\/uat\/finance-documents-last-request/, 'UAT diagnostics must expose the last Financial Documents outcome');
assert.match(source, /method: req\.method/, 'the diagnostic must capture only request method');
assert.match(source, /path: req\.path/, 'the diagnostic must capture only request path');
assert.match(source, /statusCode: res\.statusCode/, 'the diagnostic must capture the final HTTP status');
assert.doesNotMatch(source, /financeDocumentsUatTrace[\s\S]{0,500}(authorization|token|cookie|uid)/i, 'UAT diagnostics must never retain credentials or identity data');
assert.match(source, /\/__uat\/runtime/, 'UAT diagnostics must expose a development-only runtime identity endpoint');
assert.match(source, /X-Nexus-Uat-Pid/, 'UAT responses must carry a safe runtime identity marker');
assert.match(source, /NEXUS_UAT_RUNTIME_IDENTITY === 'true'/, 'runtime identity diagnostics must require an explicit UAT flag');
assert.doesNotMatch(source, /\/__uat\/trace/, 'temporary browser forensic trace endpoints must not remain after diagnosis');
assert.doesNotMatch(source, /runtimeIdentity[\s\S]{0,500}(authorization|token|cookie|password|database_url)/i, 'runtime identity must not retain secrets or credentials');

console.log('F7_06_UAT_RUNTIME_DIAGNOSTICS=PASS');
