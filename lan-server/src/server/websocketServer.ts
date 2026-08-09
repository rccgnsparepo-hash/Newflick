import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { EVENTS, PROTOCOL_CONFIG } from '../shared/protocol';
import { SessionManager } from '../auth/sessionManager';
import { LanRepository } from '../database/repository';

interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  deviceId?: string;
  isAlive: boolean;
}

export class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<ConnectedClient> = new Set();
  private userSockets: Map<string, Set<ConnectedClient>> = new Map();
  private sessionManager: SessionManager;
  private repo: LanRepository;
  private heartbeatInterval: any = null;

  constructor(sessionManager: SessionManager, repo: LanRepository) {
    this.sessionManager = sessionManager;
    this.repo = repo;
  }

  public init(server: HttpServer) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      const client: ConnectedClient = { ws, isAlive: true };
      this.clients.add(client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString('utf-8'));
          this.handleClientEvent(client, parsed);
        } catch (e) {
          console.warn('[WS Server] Failed parsing incoming event:', e);
        }
      });

      ws.on('close', () => {
        this.removeClient(client);
      });

      ws.on('error', (err) => {
        console.warn('[WS Server] Socket error:', err);
        this.removeClient(client);
      });
    });

    // Start heartbeat monitor
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((c) => {
        if (!c.isAlive) {
          c.ws.terminate();
          this.removeClient(c);
          return;
        }
        c.isAlive = false;
        c.ws.ping();
      });
    }, PROTOCOL_CONFIG.heartbeatIntervalMs);

    console.log('[WS Server] WebSocket realtime server initialized.');
  }

  private handleClientEvent(client: ConnectedClient, msg: any) {
    const { event, payload, token } = msg;

    if (event === EVENTS.HANDSHAKE) {
      const session = token ? this.sessionManager.validateToken(token) : null;
      if (session) {
        client.userId = session.userId;
        client.deviceId = session.deviceId;

        if (!this.userSockets.has(session.userId)) {
          this.userSockets.set(session.userId, new Set());
        }
        this.userSockets.get(session.userId)!.add(client);

        this.repo.updatePresence(session.userId, 'online');
        this.broadcastAll(EVENTS.PRESENCE_ONLINE, { userId: session.userId });

        client.ws.send(
          JSON.stringify({
            event: EVENTS.HANDSHAKE_ACK,
            payload: {
              status: 'OK',
              userId: session.userId,
              protocolVersion: PROTOCOL_CONFIG.protocolVersion
            }
          })
        );
      } else {
        client.ws.send(
          JSON.stringify({
            event: EVENTS.HANDSHAKE_ACK,
            payload: { status: 'ANONYMOUS_ACCEPTED' }
          })
        );
      }
      return;
    }

    if (event === EVENTS.TYPING_START || event === EVENTS.TYPING_STOP) {
      this.broadcastAll(event, payload, client.userId);
      return;
    }

    if (event === EVENTS.PING) {
      client.ws.send(JSON.stringify({ event: EVENTS.PONG, payload: { time: Date.now() } }));
    }
  }

  private removeClient(client: ConnectedClient) {
    this.clients.delete(client);
    if (client.userId) {
      const set = this.userSockets.get(client.userId);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          this.userSockets.delete(client.userId);
          this.repo.updatePresence(client.userId, 'offline');
          this.broadcastAll(EVENTS.PRESENCE_OFFLINE, { userId: client.userId });
        }
      }
    }
  }

  public broadcastAll(event: string, payload: any, excludeUserId?: string) {
    const json = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    this.clients.forEach((c) => {
      if (excludeUserId && c.userId === excludeUserId) return;
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(json);
      }
    });
  }

  public broadcastToUser(userId: string, event: string, payload: any) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    const json = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    sockets.forEach((c) => {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(json);
      }
    });
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getActiveUsersCount(): number {
    return this.userSockets.size;
  }

  public stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.wss) {
      this.wss.close();
    }
  }
}
