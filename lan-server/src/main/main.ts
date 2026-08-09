import { app, BrowserWindow, Tray, Menu, ipcMain, shell } from 'electron';
import path from 'path';

import { LanDatabase } from '../database/database';
import { runMigrations } from '../database/migrations';
import { LanRepository } from '../database/repository';
import { SessionManager } from '../auth/sessionManager';
import { AuthService } from '../auth/authService';
import { FileStorageManager } from '../storage/fileStorage';
import { MediaManager } from '../storage/mediaManager';
import { CloudSyncEngine } from '../sync/syncEngine';
import { WebSocketServerManager } from '../server/websocketServer';
import { ApiControllers } from '../api/controllers';
import { HttpServerManager } from '../server/httpServer';
import { MdnsDiscoveryService } from '../discovery/mdns';
import { NotificationService } from '../notifications/notificationService';
import { DEFAULT_LAN_PORT } from '../shared/types';

class LanServerApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;

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

  public async start() {
    console.log('====================================================');
    console.log('       STARTING FLICK LAN INFRASTRUCTURE SERVER      ');
    console.log('====================================================');

    // 1. Initialize Database & Migrations
    this.db = new LanDatabase();
    runMigrations(this.db);
    this.repo = new LanRepository(this.db);

    // 2. Auth & Session Management
    this.sessionManager = new SessionManager(this.repo);
    this.authService = new AuthService(this.sessionManager, this.repo);

    // 3. File Storage & Media Manager
    this.fileStorage = new FileStorageManager(this.db.getDataDir());
    this.mediaManager = new MediaManager(this.fileStorage, this.repo);

    // 4. Cloud Sync Engine
    this.syncEngine = new CloudSyncEngine(this.repo);
    this.syncEngine.start();

    // 5. Notifications & WebSockets
    this.wsServer = new WebSocketServerManager(this.sessionManager, this.repo);
    this.notificationService = new NotificationService(this.repo);
    this.notificationService.setWsServer(this.wsServer);

    // 6. Controllers & Express HTTP REST API
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

    // 7. Attach WebSockets to HTTP Server
    this.wsServer.init(rawServer);

    // 8. Start mDNS & UDP Multicast Discovery
    const serverName = this.repo.getSetting('serverName', 'Flick School Server');
    this.discoveryService = new MdnsDiscoveryService(serverName, this.httpServer.getPort());
    this.discoveryService.start();

    console.log(`[LAN Infrastructure] Ready at http://${this.discoveryService.getIp()}:${this.httpServer.getPort()}`);

    // Register IPC handlers for Electron GUI Dashboard
    this.registerIpcHandlers();
  }

  public createDashboardWindow() {
    this.mainWindow = new BrowserWindow({
      width: 980,
      height: 720,
      title: 'Flick LAN Server Control Center',
      backgroundColor: '#030712',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const dashboardPath = path.join(__dirname, '../dashboard/dashboard.html');
    this.mainWindow.loadFile(dashboardPath);
  }

  private registerIpcHandlers() {
    ipcMain.handle('get-server-status', () => {
      return {
        serverName: this.repo.getSetting('serverName', 'Flick School Server'),
        ipAddress: this.discoveryService.getIp(),
        port: this.httpServer.getPort(),
        connectedClients: this.wsServer.getConnectedClientsCount(),
        activeUsers: this.wsServer.getActiveUsersCount(),
        dbSizeMB: 0.5,
        mediaSizeMB: this.fileStorage.getDirectorySizeMB(),
        cloudStatus: this.syncEngine.getCloudStatus()
      };
    });

    ipcMain.handle('open-data-folder', () => {
      shell.openPath(this.db.getDataDir());
    });
  }
}

// Electron App Lifecycle
const lanServerApp = new LanServerApp();

app.whenReady().then(async () => {
  await lanServerApp.start();
  lanServerApp.createDashboardWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
