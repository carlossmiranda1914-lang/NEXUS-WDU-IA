import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve('src/index.css'), 'utf8');
const app = readFileSync(resolve('src/App.tsx'), 'utf8');

for (const token of [
  '--color-surface-canvas', '--color-surface-raised', '--color-surface-workspace',
  '--color-text-primary', '--color-text-secondary', '--color-border-default',
  '--color-action-primary', '--color-state-info', '--color-state-success',
  '--color-state-warning', '--color-state-danger', '--color-focus-ring',
]) assert.match(css, new RegExp(token), `Aurora semantic token ${token} must be defined centrally`);

assert.match(css, /body\.dark/, 'Aurora must expose a dark semantic alias set');
assert.match(css, /body\.tonal/, 'Aurora must expose a tonal semantic alias set');
assert.match(app, /'light' \| 'dark' \| 'tonal' \| 'system'/, 'the existing theme mechanism must retain a system-follow mode');
assert.match(app, /matchMedia\('\(prefers-color-scheme: dark\)'\)/, 'system mode must resolve to the device light/dark preference');

console.log('AURORA_TOKEN_THEME_CONTRACT=PASS');
