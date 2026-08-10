import test from 'node:test';
import assert from 'node:assert/strict';
import { SchoolTaskWebSocketManager } from '../src/modules/school-tasks/websocket-manager.ts';

test('refuses a real-time event when no verified institution is supplied', () => {
  assert.equal(SchoolTaskWebSocketManager.broadcast(undefined, 'task_updated', {}), false);
});
