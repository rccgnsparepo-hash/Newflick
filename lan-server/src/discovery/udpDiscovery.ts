import dgram from 'dgram';
import os from 'os';
import { DEFAULT_LAN_PORT, SERVICE_TYPE, PROTOCOL_VERSION } from '../shared/types';

export class UdpDiscoveryServer {
  private socket: dgram.Socket | null = null;
  private serverName: string;
  private port: number;
  private isRunning = false;

  constructor(serverName = 'Flick School Server', port = DEFAULT_LAN_PORT) {
    this.serverName = serverName;
    this.port = port;
  }

  public getPrimaryIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  }

  public start(): void {
    if (this.isRunning) return;
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('error', (err) => {
      console.warn('[UDP Discovery] Socket error:', err.message);
    });

    this.socket.on('message', (msg, rinfo) => {
      const query = msg.toString('utf-8');
      if (query.includes('FLICK_DISCOVER_SERVER') || query.includes(SERVICE_TYPE)) {
        const responsePayload = JSON.stringify({
          type: 'FLICK_DISCOVERY_RESPONSE',
          serverName: this.serverName,
          serverId: `flick_lan_${this.getPrimaryIp().replace(/\./g, '_')}`,
          ipAddress: this.getPrimaryIp(),
          port: this.port,
          protocolVersion: PROTOCOL_VERSION,
          flickVersion: '1.0.0',
          capabilities: ['E2EE', 'MESSAGES', 'STORIES', 'FEED', 'P2P_MESH']
        });

        const replyBuf = Buffer.from(responsePayload);
        this.socket?.send(replyBuf, 0, replyBuf.length, rinfo.port, rinfo.address, (err) => {
          if (err) console.warn('[UDP Discovery] Error sending response:', err);
        });
      }
    });

    try {
      this.socket.bind(47820, () => {
        this.socket?.setBroadcast(true);
        this.isRunning = true;
        console.log(`[UDP Discovery] Listening for Flick LAN discovery requests on UDP port 47820 (Server IP: ${this.getPrimaryIp()}:${this.port})`);
      });
    } catch (e: any) {
      console.warn('[UDP Discovery] Could not bind port 47820, fallback listener:', e.message);
    }
  }

  public stop(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.isRunning = false;
  }

  public setServerName(newName: string) {
    this.serverName = newName;
  }
}
