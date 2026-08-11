import test from 'node:test';
import assert from 'node:assert/strict';
import { describeRequestForAudit, outcomeForStatus, shouldAuditRequest } from '../src/observability/request-audit.ts';

test('audits mutations and failed requests, but not successful reads', () => {
  assert.equal(shouldAuditRequest({ method: 'GET', statusCode: 200, durationMs: 2 }), false);
  assert.equal(shouldAuditRequest({ method: 'POST', statusCode: 201, durationMs: 2 }), true);
  assert.equal(shouldAuditRequest({ method: 'GET', statusCode: 403, durationMs: 2 }), true);
});

test('records outcomes without using query strings or request bodies', () => {
  const details = describeRequestForAudit({
    method: 'POST',
    statusCode: 201,
    durationMs: 14,
    routePattern: '/api/students/:id',
  });
  assert.match(details, /POST \/api\/students\/:id/);
  assert.doesNotMatch(details, /token|password|secret/i);
  assert.equal(outcomeForStatus(201), 'success');
  assert.equal(outcomeForStatus(403), 'blocked');
  assert.equal(outcomeForStatus(500), 'failure');
});
