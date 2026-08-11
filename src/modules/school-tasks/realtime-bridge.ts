import { eventBus, TaskEventName } from './event-bus.ts';
import { SchoolTaskWebSocketManager } from './websocket-manager.ts';

const REALTIME_EVENTS: TaskEventName[] = [
  'TaskCreated',
  'TaskUpdated',
  'TaskDeleted',
  'TaskCompleted',
  'TaskRestored',
  'TaskArchived',
  'TaskDependencyChanged',
  'TaskSlaBreached',
  'TaskAssigned',
];

let registered = false;

/**
 * Bridges task-domain changes to the WebSocket room of the verified institution.
 * A refresh event contains no task data; clients retrieve their own institution's
 * data through the existing authorised APIs.
 */
export function registerSchoolTaskRealtimeBridge(): void {
  if (registered) return;
  registered = true;

  for (const eventName of REALTIME_EVENTS) {
    eventBus.subscribe(eventName, (event) => {
      if (!event.tenantId) {
        console.warn(`[REALTIME-WS] Task event '${event.eventName}' rejected: institutional context is required.`);
        return;
      }

      SchoolTaskWebSocketManager.broadcast(event.tenantId, 'REFRESH_DATA', {
        source: 'school-tasks',
        eventName: event.eventName,
      });
    });
  }
}
