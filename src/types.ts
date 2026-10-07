export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  status: 'online' | 'offline';
  publicKey: string; // Public Key JWK as JSON string
  updatedAt: any; // Firestore Timestamp
  bio?: string;
  coverURL?: string;
  soundEnabled?: boolean;
  notifSocialFeed?: boolean;
  notifMessagesAll?: boolean;
  notifMessagesFrom?: string[];
  lastSeen?: any; // Firestore Timestamp or serverTimestamp()
  isDeleted?: boolean;
  disabledReadReceipts?: string[];
  encryptedPrivateKey?: string; // Symmetrically encrypted privateKeyJwk using Global Key Password
  globalKeyPassword?: string; // Backed up human-readable Recovery/Sync Passkey
  oneSignalSubscriptionId?: string;
  oneSignalId?: string;
  followers?: string[];
  following?: string[];
  followersCount?: number;
  followingCount?: number;
  blockedStatusViewers?: string[]; // List of user IDs blocked from seeing my status updates
  username?: string;
  statusBio?: string;
  isOnline?: boolean;
  school?: string;
  coverPhotoURL?: string;
}

export interface PrivateUserInfo {
  email: string;
  createdAt: any;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string; // Support for short-form clips
  audioUrl?: string; // Support for voicenotes in social feeds
  mediaType?: 'image' | 'video' | 'audio' | 'none';
  likesCount: number;
  createdAt: any;
  updatedAt: any;
  likedBy?: string[]; // list of userIds who liked it or client-checked state
  isSensitive?: boolean;
  sensitiveReason?: string;
  sensitiveCategory?: 'spoiler' | 'violence' | 'adult' | 'medical' | 'general' | string;
  flaggedBy?: string[];
  flagCount?: number;
}

export interface DirectChat {
  id: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: any;
  typing?: { [userId: string]: boolean };
  isGroup?: boolean;
  name?: string;
  ownerId?: string;
  createdAt?: any;
  disabledReadReceipts?: { [userId: string]: boolean };
  avatarUrl?: string;
  description?: string;
  privacy?: 'public' | 'private';
  inviteCode?: string;
  roles?: { [userId: string]: 'owner' | 'admin' | 'moderator' | 'member' | 'muted' | 'guest' | 'bot' };
  announcementsOnly?: boolean;
  pinnedMessages?: string[];
  unreadCounts?: { [userId: string]: number };
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageType?: 'text' | 'image' | 'video' | 'voice' | 'audio' | 'document' | 'location' | 'poll' | 'system' | string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;
  updatedAt?: any;
  pinnedFor?: { [userId: string]: boolean };
  archivedFor?: { [userId: string]: boolean };
  mutedFor?: { [userId: string]: boolean };
  clearedFor?: { [userId: string]: any };
  deletedFor?: { [userId: string]: boolean };

  // New WhatsApp-style group properties
  groupType?: 'friends' | 'school' | 'church' | 'business' | 'community' | 'custom';
  groupBannerUrl?: string;
  permSend?: 'all' | 'admins';
  permAdd?: 'all' | 'admins';
  permPin?: boolean;
  adminApprovalRequired?: boolean;
  anonymousMode?: boolean;
  approvalQueue?: string[]; // list of user UIDs waiting to join
  voiceRoomActive?: boolean;
  voiceRoomParticipants?: string[];
  events?: any[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  participantIds: string[];
  encryptedText: string; // AES-GCM ciphertext in Base64 or Hex
  encryptedKey: string; // Receiver's RSA-encrypted AES key key package (Base64)
  senderEncryptedKey: string; // Sender's RSA-encrypted AES key package for history recovery (Base64)
  createdAt: any;
  read?: boolean;
  readBy?: string[];
  senderDisplayName?: string;
  expiresAt?: any;
  pinned?: boolean;
  readAt?: any;
  isGroupMessage?: boolean;
  plainText?: string;
  messageType?: 'text' | 'system' | 'poll' | 'shared_post' | 'shared_profile' | 'voice' | 'image' | 'video' | 'document' | 'location' | string;
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  threadRootId?: string;
  threadReplyCount?: number;
  reactions?: { [userId: string]: string }; // map of userId -> emoji reactions
  pollData?: {
    question: string;
    options: string[];
    votes: { [userId: string]: number }; // map of userId -> optionIndex
  };
  isEdited?: boolean;
  editedAt?: any;
  isDeleted?: boolean;
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  optimisticId?: string;
  isOfflineQueued?: boolean;
  syncStatus?: 'queued' | 'syncing' | 'failed';
  content?: string;
}

export interface InAppNotification {
  id: string;
  receiverId: string;
  senderName: string;
  senderId?: string;
  chatId?: string; // Target chat tunnel identifier for real-time inbox badge counts
  type: 'message' | 'like';
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
}

export interface MessageReaction {
  id?: string; // userId (document ID is the userId to enforce 1 reaction type/user maximum)
  emoji: string;
  userId: string;
  userName: string;
  createdAt: any;
  encryptedPayload?: string; // AES-GCM encrypted reaction payload for zero-knowledge verification
  algorithm?: string;
}

export interface StoryViewerDetail {
  userId: string;
  userName: string;
  userPhoto?: string;
  viewedAt: any;
}

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  mediaType: 'image' | 'video' | 'audio' | 'none';
  viewsCount: number;
  viewedBy: string[]; // List of user IDs who viewed this story
  viewersDetails?: Record<string, StoryViewerDetail>; // Map of userId -> viewer detail
  blockedViewers?: string[]; // List of user IDs blocked from seeing this story
  createdAt: any;
  link?: string;
  musicTitle?: string;
  musicArtist?: string;
  location?: string;
  pollQuestion?: string;
  pollOptions?: { id: string; text: string; votes: number }[];
  pollVotes?: Record<string, string>; // userId -> optionId
  stickers?: string[];
  mentions?: string[];
  hashtags?: string[];
  gradientPreset?: string;
}

export interface CallLogItem {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName?: string;
  receiverPhoto?: string;
  type: 'voice' | 'video';
  status: 'active' | 'ended' | 'dialing' | 'ringing' | 'missed' | 'rejected' | 'declined' | 'completed';
  endReason?: 'completed' | 'declined' | 'missed' | 'quick_replied' | 'cancelled';
  quickReplyText?: string;
  durationSeconds?: number;
  duration?: number;
  timestamp?: any;
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
  createdAt: any;
  endedAt?: any;
}


