export type NetworkMode = 'AUTO' | 'ONLINE' | 'LAN' | 'OFFLINE';
export type ConnectionStatus = 'ONLINE' | 'SCHOOL_LAN' | 'OFFLINE' | 'SYNCING';

export interface BackendAdapter {
  getMode(): NetworkMode;
  getStatus(): ConnectionStatus;
  
  // Auth & Profile
  getUserProfile(uid: string): Promise<any | null>;
  upsertUserProfile(uid: string, profileData: any): Promise<void>;

  // Messaging
  getConversations(userId: string): Promise<any[]>;
  getMessages(conversationId: string, limitCount?: number): Promise<any[]>;
  sendMessage(msg: any): Promise<{ status: string; messageId?: string }>;

  // Stories
  getStories(): Promise<any[]>;
  createStory(item: any): Promise<{ status: string; storyItemId?: string }>;

  // Feed
  getFeed(): Promise<any[]>;
  createPost(post: any): Promise<{ status: string; postId?: string }>;

  // Realtime
  subscribeToRealtime(event: string, callback: (data: any) => void): () => void;
}
