import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('mobile navigation retains the normal sign-out action', () => {
  const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const mobileOverlay = source.slice(source.indexOf('{/* SIDEBAR MOBILE OVERLAY */}'), source.indexOf('{/* VISOR PRINCIPAL DE CONTEÚDO */}'));
  assert.match(mobileOverlay, /onClick=\{handleSignOut\}/, 'mobile navigation must retain the authenticated session exit action');
  assert.match(mobileOverlay, />\s*Sair\s*</, 'mobile navigation must expose the session exit action with normal product language');
});
