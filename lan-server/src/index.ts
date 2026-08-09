import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

const DEFAULT_PORT = parseInt(process.env.PORT || '47821', 10);
const HOST = process.env.HOST || '0.0.0.0';

export class LocalLanServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private port: number;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocketHandler();
  }

  private setupMiddleware() {
    this.app.use(cors({ origin: '*' }));
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
  }

  private setupRoutes() {
    // API Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'online',
        mode: 'LAN_LOCAL_INFRASTRUCTURE',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // P2P/LAN Peer Info Endpoint
    this.app.get('/api/lan/info', (req, res) => {
      res.json({
        serverName: 'Flick LAN Node',
        port: this.port,
        wsEndpoint: `ws://${req.hostname}:${this.port}`,
        activeSockets: this.wss.clients.size
      });
    });

    // Static Frontend Build Serving
    const staticPublicPath = path.join(__dirname, 'public');
    this.app.use(express.static(staticPublicPath));

    // Fallback SPA routing to index.html
    this.app.get('*', (req, res) => {
      const indexPath = path.join(staticPublicPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Flick LAN Server</title></head>
            <body style="background:#030712; color:#fff; font-family:sans-serif; padding:40px; text-align:center;">
              <h1 style="color:#00f2fe;">Flick Local LAN Server Active</h1>
              <p>Server listening on port ${this.port}. Web static bundle loading...</p>
            </body>
          </html>
        `);
      }
    });
  }

  private setupWebSocketHandler() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log(`[LAN WebSocket] Peer connected from ${req.socket.remoteAddress}`);

      ws.on('message', (message: Buffer | string) => {
        try {
          const parsed = JSON.parse(message.toString());
          console.log('[LAN WebSocket] Relay message type:', parsed.type);

          // Broadcast P2P message relay to all other connected local clients
          this.wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(parsed));
            }
          });
        } catch (e) {
          console.error('[LAN WebSocket] Failed to parse message:', e);
        }
      });

      ws.on('close', () => {
        console.log('[LAN WebSocket] Peer disconnected');
      });

      // Send initial welcome handshake
      ws.send(JSON.stringify({
        type: 'HANDSHAKE_ACK',
        status: 'CONNECTED',
        serverPort: this.port
      }));
    });
  }

  public listen(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(this.port, HOST, () => {
        console.log(`[LocalLanServer] Express server running at http://${HOST}:${this.port}`);
        console.log(`[LocalLanServer] WebSocket P2P relay active at ws://${HOST}:${this.port}`);
        resolve(this.port);
      });
    });
  }

  public getPort(): number {
    return this.port;
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => resolve());
    });
  }
}

// If executed directly, run server standalone
if (require.main === module) {
  const server = new LocalLanServer();
  server.listen();
}
