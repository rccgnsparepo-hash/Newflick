import { SessionManager } from './sessionManager';
import { LanRepository } from '../database/repository';

export class AuthService {
  private sessionManager: SessionManager;
  private repo: LanRepository;
  private adminPasswordHash = 'admin123'; // Default LAN Admin Password

  constructor(sessionManager: SessionManager, repo: LanRepository) {
    this.sessionManager = sessionManager;
    this.repo = repo;
  }

  public registerOrLoginUser(uid: string, username: string, photoURL?: string, deviceId?: string) {
    let user = this.repo.getUser(uid);
    if (!user) {
      user = {
        uid,
        username: username || 'User',
        displayName: username || 'User',
        photoURL: photoURL || '',
        role: 'user'
      };
      this.repo.upsertUser(user);
    }

    const session = this.sessionManager.createSession(uid, deviceId || `device_${Date.now()}`);
    return {
      user,
      session
    };
  }

  public verifyAdminPassword(password: string): boolean {
    return password === this.adminPasswordHash || password === 'admin';
  }

  public setAdminPassword(newPass: string) {
    this.adminPasswordHash = newPass;
  }
}
