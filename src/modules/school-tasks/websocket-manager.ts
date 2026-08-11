import { WebSocket } from 'ws';
import { InstitutionalContext } from '../../auth/institutional-context.ts';

export interface TenantWebSocket extends WebSocket {
  tenantId?: string;
}

export class SchoolTaskWebSocketManager {
  private static clients: Set<TenantWebSocket> = new Set();

  /**
   * Register a new WebSocket connection and set up its message handlers
   */
  static handleConnection(ws: TenantWebSocket, context: InstitutionalContext): void {
    this.clients.add(ws);
    ws.tenantId = context.institutionId;
    console.log('[WebSocketManager] Authenticated client connected.');

    // Send confirmation heartbeat
    ws.send(JSON.stringify({
      type: 'HEARTBEAT',
      payload: {
        connected: true,
        msg: 'Conectado com sucesso ao barramento Enterprise do Nexus',
        activeTenantId: ws.tenantId || 'unassigned'
      }
    }));

    // 2. Set up event message processing
    ws.on('message', (msg: any) => {
      try {
        const parsed = JSON.parse(msg.toString());
        
        if (parsed.type === 'SUBSCRIBE') {
          const { tenantId } = parsed;
          if (!tenantId || tenantId === ws.tenantId) {
            ws.send(JSON.stringify({
              type: 'SUBSCRIBED',
              payload: { tenantId: ws.tenantId }
            }));
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { error: 'Instituição não autorizada.' } }));
          }
        } else if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (err) {
        // Safe check
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log('[WebSocketManager] Client disconnected.');
    });

    ws.on('error', (err) => {
      console.error('[WebSocketManager] Client connection error:', err);
      this.clients.delete(ws);
    });
  }

  /**
   * Broadcast real-time events strictly within the tenant room boundary
   */
  static broadcastToTenant(tenantId: string, type: string, payload: unknown): void {
    console.log(`[WebSocketManager] Broadcasting strictly to room 'tenant-${tenantId}' for event type: ${type}`);
    let sentCount = 0;
    
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        // Isolation boundary: must match tenantId, or if client is not assigned yet, do not send to them
        if (client.tenantId === tenantId) {
          try {
            client.send(JSON.stringify({ type, payload }));
            sentCount++;
          } catch (err) {
            console.error('[WebSocketManager] Failed to send socket chunk:', err);
          }
        }
      }
    });

    console.log(`[WebSocketManager] Event '${type}' delivered to ${sentCount} secure tenant client(s).`);
  }

  /**
   * Publish only when the caller supplies a verified institution identifier.
   * There is deliberately no default room: a missing context must never turn
   * into a cross-institution broadcast.
   */
  static broadcast(institutionId: string | undefined, type: string, payload: unknown): boolean {
    if (!institutionId || !institutionId.trim()) {
      console.warn(`[WebSocketManager] Event '${type}' rejected: institutional context is required.`);
      return false;
    }

    this.broadcastToTenant(institutionId, type, payload);
    return true;
  }
}
