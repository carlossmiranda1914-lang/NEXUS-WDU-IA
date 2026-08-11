import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { SchoolTaskWebSocketManager } from '../src/modules/school-tasks/websocket-manager.ts';
import { InstitutionalContext } from '../src/auth/institutional-context.ts';

class FakeSocket extends EventEmitter {
  readyState = 1;
  sent: string[] = [];

  send(message: string): void {
    this.sent.push(message);
  }
}

function context(institutionId: string): InstitutionalContext {
  return {
    personId: `person-${institutionId}`,
    personName: institutionId,
    identityEmail: null,
    membershipId: `membership-${institutionId}`,
    institutionId,
    institutionName: institutionId,
    institutionSlug: institutionId,
    role: 'institution_admin',
  };
}

test('refuses a real-time event when no verified institution is supplied', () => {
  assert.equal(SchoolTaskWebSocketManager.broadcast(undefined, 'task_updated', {}), false);
  assert.equal(SchoolTaskWebSocketManager.broadcast('   ', 'task_updated', {}), false);
});

test('sends an institutional event only to sockets from that institution', () => {
  const schoolA = new FakeSocket();
  const schoolB = new FakeSocket();
  SchoolTaskWebSocketManager.handleConnection(schoolA as any, context('school-a'));
  SchoolTaskWebSocketManager.handleConnection(schoolB as any, context('school-b'));
  schoolA.sent = [];
  schoolB.sent = [];

  assert.equal(SchoolTaskWebSocketManager.broadcast('school-a', 'REFRESH_DATA', { source: 'test' }), true);
  assert.equal(schoolA.sent.length, 1);
  assert.equal(schoolB.sent.length, 0);

  schoolA.emit('close');
  schoolB.emit('close');
});

test('refuses a socket attempt to subscribe to another institution', () => {
  const schoolA = new FakeSocket();
  SchoolTaskWebSocketManager.handleConnection(schoolA as any, context('school-a'));
  schoolA.sent = [];

  schoolA.emit('message', Buffer.from(JSON.stringify({ type: 'SUBSCRIBE', tenantId: 'school-b' })));
  assert.equal(schoolA.sent.length, 1);
  const rejection = JSON.parse(schoolA.sent[0]);
  assert.equal(rejection.type, 'ERROR');
  assert.equal(typeof rejection.payload.error, 'string');

  schoolA.emit('close');
});
