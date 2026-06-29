export type TaskEventName =
  | 'TaskCreated'
  | 'TaskUpdated'
  | 'TaskDeleted'
  | 'TaskCompleted'
  | 'TaskRestored'
  | 'TaskArchived'
  | 'TaskDependencyChanged'
  | 'TaskSlaBreached'
  | 'TaskAssigned';

export type TaskEventPayload<T = any> = {
  eventName: TaskEventName;
  tenantId: string;
  taskId: string;
  data: T;
  userId: string;
  userName: string;
  timestamp: string;
  requestId?: string;
  correlationId?: string;
};

export type TaskEventListener = (event: TaskEventPayload) => void | Promise<void>;

class SchoolTaskEventBus {
  private listeners: Map<TaskEventName, TaskEventListener[]> = new Map();

  /**
   * Subscribe a listener to an event
   */
  subscribe(event: TaskEventName, listener: TaskEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Publish an event to all registered listeners asynchronously
   */
  publish(event: TaskEventPayload): void {
    const list = this.listeners.get(event.eventName) || [];
    
    // Log publishing
    console.log(`[EventBus] Publishing event '${event.eventName}' for task ${event.taskId} under tenant ${event.tenantId} by ${event.userName}`);

    for (const listener of list) {
      try {
        Promise.resolve(listener(event)).catch((err) => {
          console.error(`[EventBus] Unhandled rejection in subscriber for event ${event.eventName}:`, err);
        });
      } catch (err) {
        console.error(`[EventBus] Synchronous error in subscriber for event ${event.eventName}:`, err);
      }
    }
  }

  /**
   * Clear all subscribers (useful for tests)
   */
  clearAllSubscribers(): void {
    this.listeners.clear();
  }
}

export const eventBus = new SchoolTaskEventBus();
