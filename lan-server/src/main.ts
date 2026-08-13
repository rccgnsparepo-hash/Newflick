import { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
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
  private localExpressServer: LocalLanServer | null = null;

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

    // 7. Optional Secondary Fallback Relay Server on Port 47822
    try {
      this.localExpressServer = new LocalLanServer(47822);
      await this.localExpressServer.listen();
    } catch (err) {
      console.warn('[LAN App] Secondary fallback relay server skipped:', err);
    }

    console.log(`[LAN App] Server online at http://${this.discoveryService.getIp()}:${this.httpServer.getPort()}`);

    this.registerIpcHandlers();
  }

  public createSettingsGuiWindow() {
    const preloadCandidates = [
      path.join(__dirname, 'main/preload.js'),
      path.join(__dirname, 'preload.js')
    ];
    const preloadPath = preloadCandidates.find((p) => fs.existsSync(p)) || preloadCandidates[0];

    this.mainWindow = new BrowserWindow({
      width: 1040,
      height: 760,
      title: 'Flick LAN Infrastructure - Settings & Control Center',
      backgroundColor: '#030712',
      autoHideMenuBar: true,
      show: true,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Standalone desktop GUI Control Center (No external browser required)
    const dashboardCandidates = [
      path.join(__dirname, 'dashboard/dashboard.html'),
      path.join(__dirname, '../src/dashboard/dashboard.html'),
      path.join(process.cwd(), 'dist/dashboard/dashboard.html'),
      path.join(process.cwd(), 'src/dashboard/dashboard.html')
    ];
    const dashboardHtml = dashboardCandidates.find((p) => fs.existsSync(p)) || dashboardCandidates[0];
    this.mainWindow.loadFile(dashboardHtml);
  }

  private registerIpcHandlers() {
    ipcMain.handle('get-server-status', () => {
      return {
        serverName: this.repo ? this.repo.getSetting('serverName', 'Flick LAN Node') : 'Flick LAN Node',
        ipAddress: this.discoveryService ? this.discoveryService.getIp() : '127.0.0.1',
        port: this.httpServer ? this.httpServer.getPort() : 47821,
        fallbackPort: 47822,
        connectedClients: this.wsServer ? this.wsServer.getConnectedClientsCount() : 0,
        activeUsers: this.wsServer ? this.wsServer.getActiveUsersCount() : 0,
        dbSizeMB: 0.8,
        mediaSizeMB: this.fileStorage ? this.fileStorage.getDirectorySizeMB() : 0,
        cloudStatus: this.syncEngine ? this.syncEngine.getCloudStatus() : 'ONLINE'
      };
    });

    ipcMain.handle('open-data-folder', () => {
      if (this.db) {
        shell.openPath(this.db.getDataDir());
      }
    });
  }
}

const desktopApp = new StandaloneLanApp();

app.whenReady().then(async () => {
  // Show GUI window immediately on start so the user receives visual feedback right away
  desktopApp.createSettingsGuiWindow();

  try {
    await desktopApp.init();
  } catch (err: any) {
    console.error('[LAN App] Failed to initialize backend services:', err);
    dialog.showErrorBox(
      'Flick LAN Server Startup Notice',
      `Flick LAN Server GUI opened with initialization warning:\n\n${err?.stack || err?.message || err}`
    );
  }
}).catch((err) => {
  console.error('[LAN App] Fatal startup error:', err);
  dialog.showErrorBox('Flick LAN Server Fatal Error', String(err));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
