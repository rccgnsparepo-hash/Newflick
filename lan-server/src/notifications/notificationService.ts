import { LanRepository } from '../database/repository';
import { WebSocketServerManager } from '../server/websocketServer';

export class NotificationService {
  private repo: LanRepository;
  private wsServer: WebSocketServerManager | null = null;

  constructor(repo: LanRepository) {
    this.repo = repo;
  }

  public setWsServer(wsServer: WebSocketServerManager) {
    this.wsServer = wsServer;
  }

  public sendNotificationToUser(userId: string, title: string, body: string, type = 'info', data: any = {}) {
    const notif = {
      userId,
      title,
      body,
      type,
      data
    };
    this.repo.insertNotification(notif);

    if (this.wsServer) {
      this.wsServer.broadcastToUser(userId, 'notification:new', notif);
    }
  }
}
