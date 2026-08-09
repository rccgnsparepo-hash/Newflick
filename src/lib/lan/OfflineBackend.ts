import { BackendAdapter, NetworkMode, ConnectionStatus } from './types';
import { offlineQueue } from './offlineQueue';

export class OfflineBackend implements BackendAdapter {
  public getMode(): NetworkMode {
    return 'OFFLINE';
  }

  public getStatus(): ConnectionStatus {
    return 'OFFLINE';
  }

  public async getUserProfile(uid: string): Promise<any | null> {
    return offlineQueue.getCache(`profile_${uid}`);
  }

  public async upsertUserProfile(uid: string, profileData: any): Promise<void> {
    await offlineQueue.setCache(`profile_${uid}`, profileData);
    await offlineQueue.enqueue({
      userId: uid,
      entityType: 'profile',
      entityId: uid,
      operationType: 'UPDATE',
      payload: profileData
    });
  }

  public async getConversations(userId: string): Promise<any[]> {
    return (await offlineQueue.getCache(`convos_${userId}`)) || [];
  }

  public async getMessages(conversationId: string): Promise<any[]> {
    return (await offlineQueue.getCache(`messages_${conversationId}`)) || [];
  }

  public async sendMessage(msg: any): Promise<{ status: string; messageId?: string }> {
    const opId = await offlineQueue.enqueue({
      userId: msg.senderId || 'anon',
      entityType: 'message',
      entityId: msg.id || `msg_${Date.now()}`,
      operationType: 'CREATE',
      payload: msg
    });

    // Optimistically update local cache
    const existing = (await offlineQueue.getCache(`messages_${msg.conversationId}`)) || [];
    existing.push({ ...msg, sync_status: 'QUEUED' });
    await offlineQueue.setCache(`messages_${msg.conversationId}`, existing);

    return { status: 'QUEUED_OFFLINE', messageId: opId };
  }

  public async getStories(): Promise<any[]> {
    return (await offlineQueue.getCache('stories_list')) || [];
  }

  public async createStory(item: any): Promise<{ status: string; storyItemId?: string }> {
    await offlineQueue.enqueue({
      userId: item.userId || 'anon',
      entityType: 'story',
      entityId: item.id || `story_${Date.now()}`,
      operationType: 'CREATE',
      payload: item
    });
    return { status: 'QUEUED_OFFLINE' };
  }

  public async getFeed(): Promise<any[]> {
    return (await offlineQueue.getCache('feed_posts')) || [];
  }

  public async createPost(post: any): Promise<{ status: string; postId?: string }> {
    await offlineQueue.enqueue({
      userId: post.userId || 'anon',
      entityType: 'post',
      entityId: post.id || `post_${Date.now()}`,
      operationType: 'CREATE',
      payload: post
    });
    return { status: 'QUEUED_OFFLINE' };
  }

  public subscribeToRealtime(): () => void {
    return () => {};
  }
}
