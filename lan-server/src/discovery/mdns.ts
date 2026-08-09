import { UdpDiscoveryServer } from './udpDiscovery';

export class MdnsDiscoveryService {
  private udpServer: UdpDiscoveryServer;

  constructor(serverName: string, port: number) {
    this.udpServer = new UdpDiscoveryServer(serverName, port);
  }

  public start() {
    this.udpServer.start();
  }

  public stop() {
    this.udpServer.stop();
  }

  public getIp(): string {
    return this.udpServer.getPrimaryIp();
  }
}
