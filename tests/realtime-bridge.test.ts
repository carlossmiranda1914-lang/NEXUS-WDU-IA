import test from 'node:test';
import assert from 'node:assert/strict';
import { eventBus } from '../src/modules/school-tasks/event-bus.ts';
import { registerSchoolTaskRealtimeBridge } from '../src/modules/school-tasks/realtime-bridge.ts';
import { SchoolTaskWebSocketManager } from '../src/modules/school-tasks/websocket-manager.ts';

test('bridges task events only through the originating institution', () => {
  const calls: Array<{ institutionId: string | undefined; type: string; payload: unknown }> = [];
  const originalBroadcast = SchoolTaskWebSocketManager.broadcast;
  SchoolTaskWebSocketManager.broadcast = ((institutionId, type, payload) => {
    calls.push({ institutionId, type, payload });
    return true;
  }) as typeof SchoolTaskWebSocketManager.broadcast;

  try {
    registerSchoolTaskRealtimeBridge();
    eventBus.publish({
      eventName: 'TaskUpdated',
      tenantId: 'school-a',
      taskId: 'task-a',
      data: { private: 'task data stays in the authorised API' },
      userId: 'person-a',
      userName: 'A',
      timestamp: new Date().toISOString(),
    });

    assert.deepEqual(calls, [{
      institutionId: 'school-a',
      type: 'REFRESH_DATA',
      payload: { source: 'school-tasks', eventName: 'TaskUpdated' },
    }]);
  } finally {
    SchoolTaskWebSocketManager.broadcast = originalBroadcast;
  }
});
