import { BackendAdapter, NetworkMode, ConnectionStatus } from './types';
import { offlineQueue } from './offlineQueue';

export class LanBackend implements BackendAdapter {
  private serverUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(lanIp = '127.0.0.1', port = 47821) {
    this.serverUrl = `http://${lanIp}:${port}`;
    this.wsUrl = `ws://${lanIp}:${port}`;
    this.connectWs();
  }

  public setServerAddress(lanIp: string, port = 47821) {
    this.serverUrl = `http://${lanIp}:${port}`;
    this.wsUrl = `ws://${lanIp}:${port}`;
    this.connectWs();
  }

  public getMode(): NetworkMode {
    return 'LAN';
  }

  public getStatus(): ConnectionStatus {
    return 'SCHOOL_LAN';
  }

  private connectWs() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        console.log('[LAN Backend] WebSocket connected to LAN server:', this.wsUrl);
        this.ws?.send(
          JSON.stringify({
            event: 'handshake',
            token: localStorage.getItem('faraflick_lan_token') || ''
          })
        );
      };

      this.ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          const callbacks = this.listeners.get(parsed.event);
          if (callbacks) {
            callbacks.forEach((cb) => cb(parsed.payload));
          }
        } catch {}
      };

      this.ws.onclose = () => {
        console.warn('[LAN Backend] WS disconnected, retrying in 3s...');
        setTimeout(() => this.connectWs(), 3000);
      };
    } catch (e) {
      console.warn('[LAN Backend] Could not connect WS:', e);
    }
  }

  public async getUserProfile(uid: string): Promise<any | null> {
    try {
      const res = await fetch(`${this.serverUrl}/api/users`);
      if (res.ok) {
        const users = await res.json();
        const user = users.find((u: any) => u.uid === uid || u.id === uid);
        if (user) {
          await offlineQueue.setCache(`profile_${uid}`, user);
          return user;
        }
      }
    } catch {}
    return offlineQueue.getCache(`profile_${uid}`);
  }

  public async upsertUserProfile(uid: string, profileData: any): Promise<void> {
    try {
      await fetch(`${this.serverUrl}/api/auth/register-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, ...profileData })
      });
    } catch {}
  }

  public async getConversations(userId: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.serverUrl}/api/conversations?userId=${userId}`);
      if (res.ok) {
        const convos = await res.json();
        await offlineQueue.setCache(`convos_${userId}`, convos);
        return convos;
      }
    } catch {}
    return (await offlineQueue.getCache(`convos_${userId}`)) || [];
  }

  public async getMessages(conversationId: string, limitCount = 100): Promise<any[]> {
    try {
      const res = await fetch(`${this.serverUrl}/api/messages/${conversationId}?limit=${limitCount}`);
      if (res.ok) {
        const msgs = await res.json();
        await offlineQueue.setCache(`messages_${conversationId}`, msgs);
        return msgs;
      }
    } catch {}
    return (await offlineQueue.getCache(`messages_${conversationId}`)) || [];
  }

  public async sendMessage(msg: any): Promise<{ status: string; messageId?: string }> {
    try {
      const res = await fetch(`${this.serverUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
      if (res.ok) {
        return res.json();
      }
    } catch {}

    // Queue mutation if LAN request fails transiently
    await offlineQueue.enqueue({
      userId: msg.senderId || 'anon',
      entityType: 'message',
      entityId: msg.id || 'msg',
      operationType: 'CREATE',
      payload: msg
    });

    return { status: 'QUEUED_LAN' };
  }

  public async getStories(): Promise<any[]> {
    try {
      const res = await fetch(`${this.serverUrl}/api/stories`);
      if (res.ok) {
        const stories = await res.json();
        await offlineQueue.setCache('stories_list', stories);
        return stories;
      }
    } catch {}
    return (await offlineQueue.getCache('stories_list')) || [];
  }

  public async createStory(item: any): Promise<{ status: string; storyItemId?: string }> {
    try {
      const res = await fetch(`${this.serverUrl}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        return res.json();
      }
    } catch {}
    return { status: 'QUEUED_LAN' };
  }

  public async getFeed(): Promise<any[]> {
    try {
      const res = await fetch(`${this.serverUrl}/api/feed`);
      if (res.ok) {
        const feed = await res.json();
        await offlineQueue.setCache('feed_posts', feed);
        return feed;
      }
    } catch {}
    return (await offlineQueue.getCache('feed_posts')) || [];
  }

  public async createPost(post: any): Promise<{ status: string; postId?: string }> {
    try {
      const res = await fetch(`${this.serverUrl}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      });
      if (res.ok) {
        return res.json();
      }
    } catch {}
    return { status: 'QUEUED_LAN' };
  }

  public subscribeToRealtime(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }
}
