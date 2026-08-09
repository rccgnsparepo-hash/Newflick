import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { ApiControllers } from '../api/controllers';
import { createApiRouter } from '../api/routes';
import { DEFAULT_LAN_PORT } from '../shared/types';

export class HttpServerManager {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;

  constructor(controllers: ApiControllers, customPort = DEFAULT_LAN_PORT, mediaDir?: string) {
    this.app = express();
    this.port = customPort;

    this.app.use(cors());
    this.app.use(express.json({ limit: '100mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '100mb' }));

    // Serve media files statically
    if (mediaDir) {
      this.app.use('/media', express.static(mediaDir));
    }

    // Mount API routes
    const router = createApiRouter(controllers);
    this.app.use(router);
  }

  public start(): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`[LAN HTTP Server] Running on http://0.0.0.0:${this.port}`);
        resolve(this.server!);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[LAN HTTP Server] Port ${this.port} occupied. Retrying port ${this.port + 1}...`);
          this.port += 1;
          this.server?.listen(this.port, '0.0.0.0');
        } else {
          reject(err);
        }
      });
    });
  }

  public getServer(): http.Server | null {
    return this.server;
  }

  public getPort(): number {
    return this.port;
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[LAN HTTP Server] Stopped.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
