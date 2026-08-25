import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const rootIndex = process.argv.indexOf('--root');
const root = resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : '.');
const explicit = process.argv.indexOf('--files');
const files = explicit >= 0
  ? process.argv.slice(explicit + 1)
  : [...new Set([
      ...execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/),
      ...execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/),
    ])].filter(Boolean);
const findings = [];
const placeholder = /^(?:__REQUIRED_[A-Z0-9_]+__|\$\{[A-Z0-9_]+\}|<[^>]+>|CHANGEME|example)$/i;
const disposablePostgres = (file, value) => { try { const url = new URL(value); return url.protocol === 'postgresql:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && (file === '.env.test.local.example' || file.startsWith('.github/workflows/')); } catch { return false; } };
for (const file of files) {
  const absolute = resolve(root, file);
  if (!absolute.startsWith(`${root}\\`) || !existsSync(absolute)) continue;
  if (file === 'tests/secret-scanner.test.mjs') continue;
  const text = readFileSync(absolute, 'utf8');
  const add = rule => findings.push({ file: relative(root, absolute).replaceAll('\\', '/'), rule });
  if (/^\.env(?:$|\.)/i.test(file) && !/^\.env(?:\.test\.local)?\.example$/i.test(file)) add('tracked-env-file');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) add('private-key-marker');
  for (const match of text.matchAll(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+(?:\/[^\s'"`]+)?/gi)) if (!disposablePostgres(file, match[0])) add('credential-bearing-url');
  for (const line of text.split(/\r?\n/)) {
    const assignment = line.match(/^\s*([A-Z][A-Z0-9_]*(?:PASSWORD|TOKEN|SECRET|PRIVATE_KEY|API_KEY)[A-Z0-9_]*)\s*=\s*(.*)$/);
    if (assignment && assignment[2] && !placeholder.test(assignment[2].trim().replace(/^['"]|['"]$/g, ''))) add('credential-like-assignment');
  }
}
for (const finding of findings) console.error(`secret-scan: ${finding.file} [${finding.rule}]`);
if (findings.length) process.exit(1);
console.log(`secret-scan: PASS (${files.length} tracked/staged files checked).`);
