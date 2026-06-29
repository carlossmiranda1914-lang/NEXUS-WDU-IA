import { WebSocket } from 'ws';

export interface TenantWebSocket extends WebSocket {
  tenantId?: string;
}

export class SchoolTaskWebSocketManager {
  private static clients: Set<TenantWebSocket> = new Set();

  /**
   * Register a new WebSocket connection and set up its message handlers
   */
  static handleConnection(ws: TenantWebSocket, req: any): void {
    this.clients.add(ws);
    console.log('[WebSocketManager] New client connected.');

    // 1. Try to extract tenantId from connection URL query params
    try {
      const urlString = req.url || '';
      if (urlString.includes('tenantId=')) {
        const urlParams = new URLSearchParams(urlString.split('?')[1]);
        const tId = urlParams.get('tenantId');
        if (tId) {
          ws.tenantId = tId;
          console.log(`[WebSocketManager] Client bound to tenant '${tId}' via handshake query.`);
        }
      }
    } catch (err) {
      console.error('[WebSocketManager] Handshake parsing error:', err);
    }

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
          if (tenantId && typeof tenantId === 'string') {
            ws.tenantId = tenantId;
            console.log(`[WebSocketManager] Client joined subscription room for tenant '${tenantId}'`);
            ws.send(JSON.stringify({
              type: 'SUBSCRIBED',
              payload: { tenantId }
            }));
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
  static broadcastToTenant(tenantId: string, type: string, payload: any): void {
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
   * Universal broadcast as fallback (respects tenant context)
   */
  static broadcast(type: string, payload: any, fallbackTenantId: string = 'default-tenant'): void {
    const tenantId = payload.tenantId || payload.data?.tenantId || fallbackTenantId;
    this.broadcastToTenant(tenantId, type, payload);
  }
}
