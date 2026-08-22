import { z } from 'zod';

// Zod schemas matching our JSON blueprint entities

export const UserProfileSchema = z.object({
  uid: z.string().min(1).max(128),
  displayName: z.string().min(1).max(128),
  photoURL: z.string().url().or(z.string().min(0)),
  email: z.string().email(),
  status: z.enum(['online', 'offline']),
  publicKey: z.string().min(1).max(4096),
  updatedAt: z.any(), // Firestore FieldValue or Timestamp
  bio: z.string().max(500).optional(),
  coverURL: z.string().optional(),
  soundEnabled: z.boolean().optional(),
  notifSocialFeed: z.boolean().optional(),
  notifMessagesAll: z.boolean().optional(),
  notifMessagesFrom: z.array(z.string().min(1).max(128)).optional(),
  lastSeen: z.any().optional(),
  followers: z.array(z.string()).optional(),
  following: z.array(z.string()).optional(),
  followersCount: z.number().optional(),
  followingCount: z.number().optional()
});

export const PrivateUserInfoSchema = z.object({
  email: z.string().email(),
  createdAt: z.any()
});

export const PostSchema = z.object({
  id: z.string().min(1).max(128),
  authorId: z.string().min(1).max(128),
  authorName: z.string().min(1).max(128),
  authorPhoto: z.string().min(0),
  content: z.string().min(0).max(5000),
  imageUrl: z.string().min(0).max(1048576).optional(),
  videoUrl: z.string().min(0).max(1048576).optional(),
  audioUrl: z.string().min(0).max(1048576).optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'none']).optional(),
  likesCount: z.number().nonnegative(),
  createdAt: z.any(),
  updatedAt: z.any()
});

export const DirectChatSchema = z.object({
  id: z.string().min(1).max(128),
  participantIds: z.array(z.string()),
  lastMessage: z.string().max(2000),
  lastMessageAt: z.any(),
  typing: z.record(z.string(), z.boolean()).optional(),
  isGroup: z.boolean().optional(),
  name: z.string().optional(),
  ownerId: z.string().optional(),
  createdAt: z.any().optional(),
  avatarUrl: z.string().optional(),
  description: z.string().optional(),
  privacy: z.enum(['public', 'private']).optional(),
  inviteCode: z.string().optional(),
  roles: z.record(z.string(), z.enum(['owner', 'admin', 'moderator', 'member', 'muted', 'guest', 'bot'])).optional(),
  announcementsOnly: z.boolean().optional(),
  pinnedMessages: z.array(z.string()).optional(),

  // New WhatsApp-style group properties
  groupType: z.enum(['friends', 'school', 'church', 'business', 'community', 'custom']).optional(),
  groupBannerUrl: z.string().optional(),
  permSend: z.enum(['all', 'admins']).optional(),
  permAdd: z.enum(['all', 'admins']).optional(),
  permPin: z.boolean().optional(),
  adminApprovalRequired: z.boolean().optional(),
  anonymousMode: z.boolean().optional(),
  approvalQueue: z.array(z.string()).optional(),
  voiceRoomActive: z.boolean().optional(),
  voiceRoomParticipants: z.array(z.string()).optional(),
  events: z.array(z.any()).optional()
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1).max(128),
  senderId: z.string().min(1).max(128),
  receiverId: z.string().min(0).max(128),
  participantIds: z.array(z.string()),
  encryptedText: z.string().max(1048576).optional().or(z.literal('')),
  encryptedKey: z.string().max(4096).optional().or(z.literal('')),
  senderEncryptedKey: z.string().max(4096).optional().or(z.literal('')),
  createdAt: z.any(),
  read: z.boolean().optional(),
  readBy: z.array(z.string().min(1).max(128)).optional(),
  senderDisplayName: z.string().optional(),
  clientTimestamp: z.number().optional(),
  expiresAt: z.any().optional(),
  isGroupMessage: z.boolean().optional(),
  plainText: z.string().optional(),
  messageType: z.enum(['text', 'system', 'poll', 'shared_post', 'shared_profile']).optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  mediaName: z.string().optional(),
  replyToId: z.string().optional(),
  replyToText: z.string().optional(),
  replyToSenderName: z.string().optional(),
  reactions: z.record(z.string(), z.string()).optional(),
  pollData: z.object({
    question: z.string(),
    options: z.array(z.string()),
    votes: z.record(z.string(), z.number())
  }).nullable().optional(),
  isEdited: z.boolean().optional(),
  editedAt: z.any().optional(),
  isDeleted: z.boolean().optional()
});

export const InAppNotificationSchema = z.object({
  id: z.string().min(1).max(128),
  receiverId: z.string().min(1).max(128),
  senderName: z.string().min(1).max(128),
  senderId: z.string().min(1).max(128).optional(),
  chatId: z.string().min(1).max(128).optional(),
  type: z.enum(['message', 'like']),
  title: z.string().max(200),
  body: z.string().max(1000),
  read: z.boolean(),
  createdAt: z.any()
});

export const MessageReactionSchema = z.object({
  id: z.string().min(1).max(128),
  emoji: z.string().min(1).max(32),
  userId: z.string().min(1).max(128),
  userName: z.string().min(1).max(128),
  createdAt: z.any()
});

export const StorySchema = z.object({
  id: z.string().min(1).max(128),
  authorId: z.string().min(1).max(128),
  authorName: z.string().min(1).max(128),
  authorPhoto: z.string().min(0),
  content: z.string().min(0).max(500),
  imageUrl: z.string().min(0).max(1048576).optional(),
  videoUrl: z.string().min(0).max(1048576).optional(),
  audioUrl: z.string().min(0).max(1048576).optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'none']),
  viewsCount: z.number().nonnegative(),
  viewedBy: z.array(z.string().min(1).max(128)),
  createdAt: z.any(),
  link: z.string().max(1024).optional(),
  musicTitle: z.string().max(256).optional(),
  musicArtist: z.string().max(256).optional(),
  location: z.string().max(128).optional(),
  pollQuestion: z.string().max(256).optional(),
  pollOptions: z.array(z.object({ id: z.string(), text: z.string(), votes: z.number() })).optional(),
  pollVotes: z.record(z.string(), z.string()).optional(),
  stickers: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  hashtags: z.array(z.string()).optional(),
  gradientPreset: z.string().max(128).optional()
});

export const PushPayloadSchema = z.object({
  senderId: z.string().nullable().refine(val => val !== null && val !== undefined && val !== '', {
    message: "senderId is required and cannot be empty or null"
  }),
  content: z.string().nullable().refine(val => val !== null && val !== undefined && val !== '', {
    message: "content is required and cannot be empty or null"
  }),
  timestamp: z.any().refine(val => val !== null && val !== undefined, {
    message: "timestamp is required and cannot be null"
  }),
  title: z.string().optional(),
  body: z.string().optional(),
  icon: z.string().optional(),
  tag: z.string().optional()
});


