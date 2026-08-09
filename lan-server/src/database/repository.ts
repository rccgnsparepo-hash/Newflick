import { LanDatabase } from './database';
import { SyncOperation } from '../shared/types';

export class LanRepository {
  private db: LanDatabase;

  constructor(db: LanDatabase) {
    this.db = db;
  }

  // --- Users & Profiles ---
  public upsertUser(user: any): void {
    this.db.insert('users', {
      id: user.uid || user.id,
      uid: user.uid || user.id,
      username: user.username || user.displayName || 'Anonymous',
      displayName: user.displayName || user.username || 'User',
      photoURL: user.photoURL || user.avatar || '',
      role: user.role || 'user',
      updated_at: new Date().toISOString()
    });
  }

  public getUser(uid: string): any | null {
    const list = this.db.query('users', (u) => u.uid === uid || u.id === uid);
    return list.length > 0 ? list[0] : null;
  }

  public getAllUsers(): any[] {
    return this.db.getTable('users');
  }

  // --- Conversations & Members ---
  public upsertConversation(convo: any): void {
    this.db.insert('conversations', {
      id: convo.id,
      type: convo.type || 'direct',
      name: convo.name || '',
      iconURL: convo.iconURL || '',
      lastMessageText: convo.lastMessageText || '',
      lastMessageTime: convo.lastMessageTime || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  public getConversationsForUser(userId: string): any[] {
    const members = this.db.query('conversation_members', (m) => m.userId === userId);
    const convoIds = new Set(members.map((m) => m.conversationId));
    return this.db.query('conversations', (c) => convoIds.has(c.id));
  }

  public addConversationMember(conversationId: string, userId: string, role = 'member'): void {
    this.db.insert('conversation_members', {
      id: `${conversationId}_${userId}`,
      conversationId,
      userId,
      role,
      joinedAt: new Date().toISOString()
    });
  }

  // --- Messages & Reactions ---
  public insertMessage(msg: any): void {
    this.db.insert('messages', {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.senderName || '',
      senderAvatar: msg.senderAvatar || '',
      text: msg.text || '',
      cipherText: msg.cipherText || '',
      mediaUrl: msg.mediaUrl || '',
      mediaType: msg.mediaType || '',
      replyToId: msg.replyToId || '',
      isEncrypted: msg.isEncrypted ? 1 : 0,
      sync_status: msg.sync_status || 'LAN_ACK',
      operationId: msg.operationId || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: msg.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Update conversation lastMessageText
    if (msg.conversationId) {
      this.upsertConversation({
        id: msg.conversationId,
        lastMessageText: msg.text || (msg.cipherText ? '🔒 Encrypted message' : 'Media file'),
        lastMessageTime: new Date().toISOString()
      });
    }
  }

  public getMessagesForConversation(conversationId: string, limitCount = 100): any[] {
    const msgs = this.db.query('messages', (m) => m.conversationId === conversationId);
    msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return msgs.slice(-limitCount);
  }

  public addMessageReaction(messageId: string, userId: string, reaction: string): void {
    this.db.insert('message_reactions', {
      id: `${messageId}_${userId}_${reaction}`,
      messageId,
      userId,
      reaction,
      created_at: new Date().toISOString()
    });
  }

  // --- Stories & Items ---
  public upsertStoryItem(item: any): void {
    // 1. Ensure User Story Container exists
    const existingStories = this.db.query('stories', (s) => s.userId === item.userId);
    let storyContainerId = item.userId;
    if (existingStories.length === 0) {
      this.db.insert('stories', {
        id: storyContainerId,
        userId: item.userId,
        username: item.username || 'User',
        userAvatar: item.userAvatar || '',
        lastUpdated: new Date().toISOString()
      });
    } else {
      this.db.update('stories', existingStories[0].id, {
        lastUpdated: new Date().toISOString(),
        username: item.username || existingStories[0].username,
        userAvatar: item.userAvatar || existingStories[0].userAvatar
      });
    }

    // 2. Insert Story Item
    this.db.insert('story_items', {
      id: item.id || `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      storyId: storyContainerId,
      userId: item.userId,
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType || 'image',
      caption: item.caption || '',
      musicTrack: item.musicTrack || '',
      expiresAt: item.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    });
  }

  public getAllActiveStories(): any[] {
    const nowISO = new Date().toISOString();
    const activeItems = this.db.query('story_items', (i) => i.expiresAt > nowISO);
    const storyContainers = this.db.getTable('stories');

    // Group items by storyId/userId to ensure single bubble per user
    const result: any[] = [];
    storyContainers.forEach((container) => {
      const items = activeItems.filter((item) => item.storyId === container.id || item.userId === container.userId);
      if (items.length > 0) {
        result.push({
          ...container,
          items
        });
      }
    });
    return result;
  }

  // --- Feed Posts & Comments ---
  public insertPost(post: any): void {
    this.db.insert('posts', {
      id: post.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: post.userId,
      authorName: post.authorName || 'User',
      authorAvatar: post.authorAvatar || '',
      content: post.content || '',
      mediaUrls: JSON.stringify(post.mediaUrls || []),
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      operationId: post.operationId || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString()
    });
  }

  public getFeedPosts(limitCount = 50): any[] {
    const posts = this.db.getTable('posts');
    posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return posts.slice(0, limitCount).map((p) => {
      let parsedMedia = [];
      try {
        parsedMedia = typeof p.mediaUrls === 'string' ? JSON.parse(p.mediaUrls) : p.mediaUrls;
      } catch {
        parsedMedia = [];
      }
      return {
        ...p,
        mediaUrls: parsedMedia
      };
    });
  }

  // --- Notifications ---
  public insertNotification(notif: any): void {
    this.db.insert('notifications', {
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: notif.userId,
      title: notif.title,
      body: notif.body || '',
      type: notif.type || 'info',
      data: JSON.stringify(notif.data || {}),
      isRead: 0,
      created_at: new Date().toISOString()
    });
  }

  public getNotificationsForUser(userId: string): any[] {
    return this.db.query('notifications', (n) => n.userId === userId);
  }

  // --- Presence ---
  public updatePresence(userId: string, status: 'online' | 'offline', customStatus?: string): void {
    this.db.insert('presence', {
      id: `pres_${userId}`,
      userId,
      status,
      customStatus: customStatus || '',
      lastActiveAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  public getAllPresence(): any[] {
    return this.db.getTable('presence');
  }

  // --- Sync Operations Queue & Idempotency ---
  public hasOperationBeenProcessed(operationId: string): boolean {
    const list = this.db.query('sync_operations', (op) => op.operationId === operationId);
    return list.length > 0;
  }

  public recordSyncOperation(op: SyncOperation): void {
    this.db.insert('sync_operations', {
      id: op.operationId,
      operationId: op.operationId,
      deviceId: op.deviceId,
      userId: op.userId,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      payload: JSON.stringify(op.payload),
      status: op.status,
      version: op.version || 1,
      created_at: new Date().toISOString()
    });
  }

  public getPendingSyncOperations(): SyncOperation[] {
    const raw = this.db.query('sync_operations', (op) => op.status === 'QUEUED' || op.status === 'LAN_ACK');
    return raw.map((item) => ({
      ...item,
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload
    }));
  }

  public markOperationSynced(operationId: string): void {
    this.db.update('sync_operations', operationId, { status: 'SYNCED', updated_at: new Date().toISOString() });
  }

  // --- Server Settings & Audit ---
  public getSetting(key: string, defaultValue = ''): string {
    const list = this.db.query('server_settings', (s) => s.key === key);
    return list.length > 0 ? list[0].value : defaultValue;
  }

  public setSetting(key: string, value: string): void {
    this.db.insert('server_settings', {
      id: `set_${key}`,
      key,
      value,
      updated_at: new Date().toISOString()
    });
  }

  public logAudit(action: string, actorUserId?: string, ipAddress?: string, details?: any): void {
    this.db.insert('audit_logs', {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      actorUserId: actorUserId || 'SYSTEM',
      ipAddress: ipAddress || '127.0.0.1',
      details: typeof details === 'object' ? JSON.stringify(details) : String(details || ''),
      created_at: new Date().toISOString()
    });
  }
}
