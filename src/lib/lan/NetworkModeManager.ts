import { NetworkMode, ConnectionStatus, BackendAdapter } from './types';
import { FirebaseBackend } from './FirebaseBackend';
import { LanBackend } from './LanBackend';
import { OfflineBackend } from './OfflineBackend';

type StatusChangeListener = (status: ConnectionStatus, mode: NetworkMode, info: { lanIp: string; port: number }) => void;

export class NetworkModeManager {
  private mode: NetworkMode = 'AUTO';
  private currentStatus: ConnectionStatus = 'ONLINE';
  private lanIp = '127.0.0.1';
  private lanPort = 47821;

  private firebaseBackend: FirebaseBackend;
  private lanBackend: LanBackend;
  private offlineBackend: OfflineBackend;
  private activeAdapter: BackendAdapter;

  private listeners: Set<StatusChangeListener> = new Set();
  private healthCheckTimer: any = null;

  constructor() {
    this.firebaseBackend = new FirebaseBackend();
    this.lanBackend = new LanBackend(this.lanIp, this.lanPort);
    this.offlineBackend = new OfflineBackend();
    this.activeAdapter = this.firebaseBackend;

    // Load saved settings
    const savedMode = localStorage.getItem('faraflick_connection_mode') as NetworkMode;
    if (savedMode) this.mode = savedMode;

    const savedIp = localStorage.getItem('faraflick_lan_server_ip');
    if (savedIp) {
      this.lanIp = savedIp;
      this.lanBackend.setServerAddress(savedIp, this.lanPort);
    }

    this.startAutoDetection();
  }

  public getMode(): NetworkMode {
    return this.mode;
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public getActiveAdapter(): BackendAdapter {
    return this.activeAdapter;
  }

  public getLanServerIp(): string {
    return this.lanIp;
  }

  public getLanServerPort(): number {
    return this.lanPort;
  }

  public setMode(newMode: NetworkMode) {
    this.mode = newMode;
    localStorage.setItem('faraflick_connection_mode', newMode);
    this.evaluateActiveBackend();
  }

  public setManualLanIp(ip: string, port = 47821) {
    this.lanIp = ip;
    this.lanPort = port;
    localStorage.setItem('faraflick_lan_server_ip', ip);
    this.lanBackend.setServerAddress(ip, port);
    this.evaluateActiveBackend();
  }

  public addStatusListener(fn: StatusChangeListener): () => void {
    this.listeners.add(fn);
    fn(this.currentStatus, this.mode, { lanIp: this.lanIp, port: this.lanPort });
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn(this.currentStatus, this.mode, { lanIp: this.lanIp, port: this.lanPort }));
  }

  public async evaluateActiveBackend() {
    if (this.mode === 'ONLINE') {
      this.activeAdapter = this.firebaseBackend;
      this.currentStatus = 'ONLINE';
    } else if (this.mode === 'LAN') {
      this.activeAdapter = this.lanBackend;
      this.currentStatus = 'SCHOOL_LAN';
    } else if (this.mode === 'OFFLINE') {
      this.activeAdapter = this.offlineBackend;
      this.currentStatus = 'OFFLINE';
    } else {
      // AUTO mode priority: 1. Firebase Online -> 2. Flick LAN Server -> 3. Offline
      const isInternetOnline = navigator.onLine;
      if (isInternetOnline) {
        this.activeAdapter = this.firebaseBackend;
        this.currentStatus = 'ONLINE';
      } else {
        const lanAlive = await this.pingLanServer();
        if (lanAlive) {
          this.activeAdapter = this.lanBackend;
          this.currentStatus = 'SCHOOL_LAN';
        } else {
          this.activeAdapter = this.offlineBackend;
          this.currentStatus = 'OFFLINE';
        }
      }
    }

    this.notifyListeners();
  }

  public async pingLanServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`http://${this.lanIp}:${this.lanPort}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  private startAutoDetection() {
    window.addEventListener('online', () => this.evaluateActiveBackend());
    window.addEventListener('offline', () => this.evaluateActiveBackend());

    this.healthCheckTimer = setInterval(() => {
      if (this.mode === 'AUTO') {
        this.evaluateActiveBackend();
      }
    }, 12000);

    this.evaluateActiveBackend();
  }

  public stop() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
  }
}

export const networkModeManager = new NetworkModeManager();
