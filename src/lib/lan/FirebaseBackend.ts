import { BackendAdapter, NetworkMode, ConnectionStatus } from './types';
import * as services from '../services';
import { offlineQueue } from './offlineQueue';

export class FirebaseBackend implements BackendAdapter {
  public getMode(): NetworkMode {
    return 'ONLINE';
  }

  public getStatus(): ConnectionStatus {
    return 'ONLINE';
  }

  public async getUserProfile(uid: string): Promise<any | null> {
    const profile = await services.getUserProfile(uid);
    if (profile) {
      await offlineQueue.setCache(`profile_${uid}`, profile);
    }
    return profile;
  }

  public async upsertUserProfile(uid: string, profileData: any): Promise<void> {
    await services.upsertUserProfile(uid, profileData);
  }

  public async getConversations(userId: string): Promise<any[]> {
    const users = await services.getAllUsers();
    await offlineQueue.setCache(`convos_${userId}`, users);
    return users;
  }

  public async getMessages(conversationId: string): Promise<any[]> {
    const cached = (await offlineQueue.getCache(`messages_${conversationId}`)) || [];
    return cached;
  }

  public async sendMessage(msg: any): Promise<{ status: string; messageId?: string }> {
    try {
      if (msg.chatId && msg.receiverId && msg.senderId) {
        await services.sendE2EEMessage({
          chatId: msg.chatId,
          senderId: msg.senderId,
          senderDisplayName: msg.senderName || 'User',
          receiverId: msg.receiverId,
          plainText: msg.text || '',
          recipientPublicKeyJwk: msg.recipientPublicKeyJwk || '',
          senderPublicKeyJwk: msg.senderPublicKeyJwk || ''
        });
      }
    } catch (e) {
      console.warn('[FirebaseBackend] Send message exception:', e);
    }
    return { status: 'OK', messageId: msg.id };
  }

  public async getStories(): Promise<any[]> {
    const cached = (await offlineQueue.getCache('stories_list')) || [];
    return cached;
  }

  public async createStory(item: any): Promise<{ status: string; storyItemId?: string }> {
    return { status: 'OK', storyItemId: item.id };
  }

  public async getFeed(): Promise<any[]> {
    const cached = (await offlineQueue.getCache('feed_posts')) || [];
    return cached;
  }

  public async createPost(post: any): Promise<{ status: string; postId?: string }> {
    try {
      await services.createPost({
        authorId: post.userId || post.authorId,
        authorName: post.authorName || 'User',
        authorPhoto: post.authorPhoto || post.authorAvatar || '',
        content: post.content || ''
      });
    } catch {}
    return { status: 'OK', postId: post.id };
  }

  public subscribeToRealtime(): () => void {
    return () => {};
  }
}
