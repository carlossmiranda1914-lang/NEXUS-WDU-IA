import { execFileSync } from 'node:child_process';
const explicit = process.argv.indexOf('--files');
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(/\r?\n/);
const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).split(/\r?\n/);
const files = explicit >= 0 ? process.argv.slice(explicit + 1) : [...new Set([...tracked, ...staged])].filter(Boolean);
const rules = [
  ['tracked-local-env', /^\.env(?:$|\.)/i, /^\.env(?:\.test\.local)?\.example$/i],
  ['temporary-or-log', /(?:^|\/)(?:coverage|playwright-report|test-results|\.cache)(?:\/|$)|\.(?:tmp|temp|log|bak|dump|sql\.dump)$/i],
  ['recovery-helper', /(?:^|\/)(?:recover|recovery|restore)[^/]*\.(?:ps1|sh|cmd|bat)$/i],
  ['editor-system-file', /(?:^|\/)(?:\.DS_Store|Thumbs\.db|.*~)$/i],
];
let failed = false;
for (const file of files) for (const [rule, pattern, allow] of rules) if (pattern.test(file) && !(allow && allow.test(file))) { console.error(`artifact-scan: ${file} [${rule}]`); failed = true; }
if (failed) process.exit(1);
console.log(`artifact-scan: PASS (${files.length} tracked/staged files checked).`);
