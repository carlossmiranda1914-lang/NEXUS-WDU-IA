import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag >= 0 ? path.resolve(process.argv[rootFlag + 1]) : process.cwd();
const failures = [];
const legacySchemaSymbols = new Set(['users', 'students', 'teachers', 'invoices', 'announcements', 'chatMessages', 'automations', 'uploadedDocuments', 'approvals']);
const baseline = JSON.parse(await readFile(path.join(root, 'engineering-foundation-baseline.json'), 'utf8'));
const server = await readFile(path.join(root, 'server.ts'), 'utf8');
const routeCount = [...server.matchAll(/\bapp\.(?:get|post|put|patch|delete)\s*\(/g)].length;
if (routeCount > baseline.serverInlineRouteCount) failures.push('NEW_INLINE_SERVER_ROUTE');

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
for (const file of await files(path.join(root, 'src/modules'))) {
  if (!/\.(?:ts|tsx|js|mjs)$/.test(file)) continue;
  const source = await readFile(file, 'utf8');
  const relative = path.relative(path.join(root, 'src/modules'), file).replaceAll('\\', '/');
  const domain = relative.split('/')[0];
  for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['\"][^'\"]*db\/schema(?:\.ts)?['\"]/g)) {
    const imports = match[1].split(',').map(item => item.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    if (imports.some(item => legacySchemaSymbols.has(item))) failures.push(`LEGACY_CONSUMER:${relative}`);
  }
  const imports = [...source.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)].map(match => match[1]);
  if (imports.some(item => /(?:^|\/)(?:finance|documents|iam|enrollments)\/.*(?:repository|persistence|storage)/.test(item) && !item.includes(`/${domain}/`))) failures.push(`CROSS_DOMAIN_INFRASTRUCTURE_IMPORT:${relative}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; } else console.log('engineering-foundation-gate: PASS');
