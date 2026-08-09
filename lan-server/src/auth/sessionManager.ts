import crypto from 'crypto';
import { LanRepository } from '../database/repository';
import { AuthSession } from '../shared/types';

export class SessionManager {
  private repo: LanRepository;
  private activeSessions: Map<string, AuthSession> = new Map();

  constructor(repo: LanRepository) {
    this.repo = repo;
  }

  public createSession(userId: string, deviceId: string, isAdmin = false): AuthSession {
    const token = `flick_token_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const session: AuthSession = {
      token,
      userId,
      deviceId,
      expiresAt,
      isApproved: true,
      isAdmin
    };

    this.activeSessions.set(token, session);
    this.repo.logAudit('CREATE_SESSION', userId, '127.0.0.1', { deviceId, token: token.substring(0, 10) });
    return session;
  }

  public validateToken(token: string): AuthSession | null {
    if (!token) return null;
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const session = this.activeSessions.get(cleanToken);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.activeSessions.delete(cleanToken);
      return null;
    }

    return session;
  }

  public getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }
}
