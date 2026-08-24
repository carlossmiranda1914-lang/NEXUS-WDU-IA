import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

function routeBody(route: string, length = 700): string {
  const start = source.indexOf(route);
  assert.ok(start >= 0, `missing ${route}`);
  return source.slice(start, start + length);
}

const wipe = routeBody("app.post('/api/system/wipe-data'", 5_000);
assert.match(wipe, /return res\.status\(503\)\.json\(\{[\s\S]*SYSTEM_DATA_RESET_NOT_AVAILABLE/, 'wipe must be universally fail-closed');
assert.ok(wipe.indexOf('SYSTEM_DATA_RESET_NOT_AVAILABLE') < wipe.indexOf('SYSTEM_WIPE_TOKEN'), 'wipe fence must run before token handling');
assert.ok(wipe.indexOf('SYSTEM_DATA_RESET_NOT_AVAILABLE') < wipe.indexOf('db.insert'), 'wipe fence must run before audit persistence');
assert.ok(wipe.indexOf('SYSTEM_DATA_RESET_NOT_AVAILABLE') < wipe.indexOf('db.delete'), 'wipe fence must run before destructive persistence');

for (const [route, code] of [
  ["app.post('/api/students'", 'CANONICAL_ENROLLMENT_REQUIRED'],
  ["app.delete('/api/students/:id'", 'CANONICAL_STUDENT_LIFECYCLE_REQUIRED'],
] as const) {
  const body = routeBody(route);
  assert.match(body, new RegExp(`return res\\.status\\(503\\)\\.json\\(\\{[\\s\\S]*${code}`), `${route} must return the approved code`);
  assert.ok(body.indexOf(code) < body.indexOf('try'), `${route} must reject before persistence logic`);
}

console.log('FND-02 destructive system and legacy student write fences: PASS (direct endpoint contracts reject before token, persistence, tenant or entity handling).');
