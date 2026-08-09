import { app, BrowserWindow, Tray, Menu, ipcMain, shell } from 'electron';
import path from 'path';
import { LocalLanServer } from './index';
import { LanDatabase } from './database/database';
import { runMigrations } from './database/migrations';
import { LanRepository } from './database/repository';
import { SessionManager } from './auth/sessionManager';
import { AuthService } from './auth/authService';
import { FileStorageManager } from './storage/fileStorage';
import { MediaManager } from './storage/mediaManager';
import { CloudSyncEngine } from './sync/syncEngine';
import { WebSocketServerManager } from './server/websocketServer';
import { ApiControllers } from './api/controllers';
import { HttpServerManager } from './server/httpServer';
import { MdnsDiscoveryService } from './discovery/mdns';
import { NotificationService } from './notifications/notificationService';
import { DEFAULT_LAN_PORT } from './shared/types';

class StandaloneLanApp {
  private mainWindow: BrowserWindow | null = null;
  private localExpressServer!: LocalLanServer;

  private db!: LanDatabase;
  private repo!: LanRepository;
  private sessionManager!: SessionManager;
  private authService!: AuthService;
  private fileStorage!: FileStorageManager;
  private mediaManager!: MediaManager;
  private syncEngine!: CloudSyncEngine;
  private wsServer!: WebSocketServerManager;
  private notificationService!: NotificationService;
  private httpServer!: HttpServerManager;
  private discoveryService!: MdnsDiscoveryService;

  public async init() {
    console.log('====================================================');
    console.log('   STARTING FLICK LAN INFRASTRUCTURE DESKTOP APP    ');
    console.log('====================================================');

    // 1. Initialize Database & Repositories
    this.db = new LanDatabase();
    runMigrations(this.db);
    this.repo = new LanRepository(this.db);

    // 2. Auth & Storage
    this.sessionManager = new SessionManager(this.repo);
    this.authService = new AuthService(this.sessionManager, this.repo);
    this.fileStorage = new FileStorageManager(this.db.getDataDir());
    this.mediaManager = new MediaManager(this.fileStorage, this.repo);

    // 3. Cloud Sync
    this.syncEngine = new CloudSyncEngine(this.repo);
    this.syncEngine.start();

    // 4. WebSockets & Notifications
    this.wsServer = new WebSocketServerManager(this.sessionManager, this.repo);
    this.notificationService = new NotificationService(this.repo);
    this.notificationService.setWsServer(this.wsServer);

    // 5. REST Controllers & Express Server Manager
    const controllers = new ApiControllers(
      this.repo,
      this.authService,
      this.mediaManager,
      this.wsServer,
      this.syncEngine,
      this.fileStorage
    );

    this.httpServer = new HttpServerManager(controllers, DEFAULT_LAN_PORT, this.fileStorage.getMediaDir());
    const rawServer = await this.httpServer.start();
    this.wsServer.init(rawServer);

    // 6. Start mDNS
    const serverName = this.repo.getSetting('serverName', 'Flick LAN Node');
    this.discoveryService = new MdnsDiscoveryService(serverName, this.httpServer.getPort());
    this.discoveryService.start();

    // 7. Start Standalone Local Express Fallback Server with static frontend capability
    this.localExpressServer = new LocalLanServer(47821);
    await this.localExpressServer.listen();

    console.log(`[LAN App] Server online at http://${this.discoveryService.getIp()}:${this.httpServer.getPort()}`);

    this.registerIpcHandlers();
  }

  public createSettingsGuiWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1040,
      height: 760,
      title: 'Flick LAN Infrastructure - Settings & Control Center',
      backgroundColor: '#030712',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'main/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Standalone desktop GUI Control Center (No external browser required)
    const dashboardHtml = path.join(__dirname, 'dashboard/dashboard.html');
    this.mainWindow.loadFile(dashboardHtml);
  }

  private registerIpcHandlers() {
    ipcMain.handle('get-server-status', () => {
      return {
        serverName: this.repo.getSetting('serverName', 'Flick LAN Node'),
        ipAddress: this.discoveryService.getIp(),
        port: this.httpServer.getPort(),
        fallbackPort: 47821,
        connectedClients: this.wsServer.getConnectedClientsCount(),
        activeUsers: this.wsServer.getActiveUsersCount(),
        dbSizeMB: 0.8,
        mediaSizeMB: this.fileStorage.getDirectorySizeMB(),
        cloudStatus: this.syncEngine.getCloudStatus()
      };
    });

    ipcMain.handle('open-data-folder', () => {
      shell.openPath(this.db.getDataDir());
    });
  }
}

const desktopApp = new StandaloneLanApp();

app.whenReady().then(async () => {
  await desktopApp.init();
  desktopApp.createSettingsGuiWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
