import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  getDocs, 
  writeBatch, 
  serverTimestamp,
  arrayUnion,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { DirectChat, ChatMessage } from '../types';
import { BadgeService, ConversationNotificationManager } from './notificationSystem';
import { getMessageTimestamp } from './services';

// Active Conversation Tracker (singleton)
let currentActiveConversationId: string | null = null;
const activeChatListeners = new Set<(chatId: string | null) => void>();

export function setActiveConversationId(chatId: string | null): void {
  currentActiveConversationId = chatId;
  // Keep ConversationNotificationManager in sync
  ConversationNotificationManager.setActiveChat(chatId);
  activeChatListeners.forEach(cb => cb(chatId));
}

export function getActiveConversationId(): string | null {
  return currentActiveConversationId;
}

export function isConversationActive(chatId: string): boolean {
  return currentActiveConversationId === chatId;
}

export function subscribeToActiveConversation(callback: (chatId: string | null) => void): () => void {
  activeChatListeners.add(callback);
  return () => {
    activeChatListeners.delete(callback);
  };
}

/**
 * Calculates per-user unread count for a given conversation.
 */
export function getConversationUnreadCount(chat: DirectChat, currentUserId: string): number {
  if (!chat || !currentUserId) return 0;
  if (chat.unreadCounts && typeof chat.unreadCounts[currentUserId] === 'number') {
    return Math.max(0, chat.unreadCounts[currentUserId]);
  }
  return 0;
}

/**
 * Calculates global unread counter across all conversations for current user.
 * Sum(all conversation unread counts)
 */
export function calculateTotalUnreadCount(chats: DirectChat[], currentUserId: string): number {
  if (!Array.isArray(chats) || !currentUserId) return 0;
  return chats.reduce((total, chat) => {
    // Ignore deleted or archived chats in unread count if preferred
    if (chat.deletedFor && chat.deletedFor[currentUserId]) return total;
    return total + getConversationUnreadCount(chat, currentUserId);
  }, 0);
}

/**
 * Format timestamp safely for sorting and display
 */
export function getChatTimestampMs(chat: DirectChat): number {
  if (!chat) return 0;
  const ts = chat.lastMessageAt || chat.updatedAt || chat.createdAt;
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.round((ts.nanoseconds || 0) / 1000000);
  }
  if (typeof ts === 'number' && ts > 0) return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

/**
 * Formats a clean, sender-aware, media-aware latest message preview for the chat list.
 */
export function formatConversationPreview(chat: DirectChat, currentUserId: string): { 
  preview: string; 
  isMine: boolean;
  mediaType?: string;
} {
  if (!chat) return { preview: 'Tap to chat', isMine: false };

  const isGroup = !!chat.isGroup;
  const lastSenderId = chat.lastMessageSenderId;
  const lastSenderName = chat.lastMessageSenderName;
  const isMine = !!(lastSenderId && currentUserId && lastSenderId === currentUserId);
  const rawSnippet = chat.lastMessageText || chat.lastMessage || '';

  // Determine media or content category
  let bodyPreview = rawSnippet;
  let mediaType = chat.lastMessageType;

  // Detect serialized attachments in rawSnippet
  if (rawSnippet.startsWith('{') && rawSnippet.includes('"attachmentType"')) {
    try {
      const parsed = JSON.parse(rawSnippet);
      const attType = parsed.attachmentType || parsed.mediaType;
      if (attType === 'image' || attType?.startsWith('image/')) {
        bodyPreview = '📷 Photo';
        mediaType = 'image';
      } else if (attType === 'video' || attType?.startsWith('video/')) {
        bodyPreview = '🎥 Video';
        mediaType = 'video';
      } else if (attType === 'audio' || attType?.startsWith('audio/')) {
        bodyPreview = parsed.text && parsed.text.startsWith('🎙️') ? parsed.text : '🎤 Voice message';
        mediaType = 'voice';
      } else if (attType === 'document' || attType === 'file') {
        bodyPreview = parsed.attachmentName ? `📄 ${parsed.attachmentName}` : '📄 Document';
        mediaType = 'document';
      } else if (parsed.text) {
        bodyPreview = parsed.text;
      }
    } catch {
      // Keep raw
    }
  } else if (rawSnippet.startsWith('{"type":"voice_flick"') || rawSnippet.startsWith('🎙️')) {
    bodyPreview = rawSnippet.startsWith('🎙️') ? rawSnippet : '🎤 Voice message';
    mediaType = 'voice';
  } else if (rawSnippet.startsWith('📊 POLL_DATA:') || rawSnippet.startsWith('📊 Poll:')) {
    bodyPreview = rawSnippet.startsWith('📊 Poll:') ? rawSnippet : '📊 Poll';
    mediaType = 'poll';
  } else if (rawSnippet.startsWith('📍 Location:')) {
    bodyPreview = rawSnippet;
    mediaType = 'location';
  }

  // Fallback if empty
  if (!bodyPreview || bodyPreview.trim() === '') {
    bodyPreview = isGroup ? 'Concourse active' : 'Tap to chat';
  }

  // Sender-aware prefixes
  let finalPreview = bodyPreview;
  if (isGroup) {
    if (isMine) {
      finalPreview = `You: ${bodyPreview}`;
    } else if (lastSenderName) {
      finalPreview = `${lastSenderName.split(' ')[0]}: ${bodyPreview}`;
    }
  } else {
    if (isMine) {
      finalPreview = `You: ${bodyPreview}`;
    }
  }

  return { preview: finalPreview, isMine, mediaType };
}

/**
 * Sorts conversations:
 * 1. Pinned conversations first (sorted by latestMessageAt DESC)
 * 2. Unpinned conversations sorted by latestMessageAt DESC
 */
export function sortConversations(chats: DirectChat[], currentUserId: string, localPinnedIds: string[] = []): DirectChat[] {
  return [...chats].sort((a, b) => {
    const isPinnedA = (a.pinnedFor && a.pinnedFor[currentUserId]) || localPinnedIds.includes(a.id);
    const isPinnedB = (b.pinnedFor && b.pinnedFor[currentUserId]) || localPinnedIds.includes(b.id);

    if (isPinnedA && !isPinnedB) return -1;
    if (isPinnedB && !isPinnedA) return 1;

    const timeA = getChatTimestampMs(a);
    const timeB = getChatTimestampMs(b);
    return timeB - timeA;
  });
}

// Local storage caching keys
const CHATS_CACHE_PREFIX = 'flick_convos_cache_';

export function getConversationsCache(userId: string): DirectChat[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const stored = localStorage.getItem(`${CHATS_CACHE_PREFIX}${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[ConversationService] Failed reading cache:', e);
  }
  return [];
}

export function saveConversationsCache(userId: string, chats: DirectChat[]): void {
  if (typeof window === 'undefined' || !userId || !Array.isArray(chats)) return;
  try {
    // Only cache serializable metadata (max 50 recent conversations)
    const lightweight = chats.slice(0, 50).map(c => ({
      id: c.id,
      participantIds: c.participantIds || [],
      lastMessage: c.lastMessage || '',
      lastMessageText: c.lastMessageText || c.lastMessage || '',
      lastMessageId: c.lastMessageId || '',
      lastMessageType: c.lastMessageType || 'text',
      lastMessageSenderId: c.lastMessageSenderId || '',
      lastMessageSenderName: c.lastMessageSenderName || '',
      lastMessageAt: getChatTimestampMs(c),
      isGroup: !!c.isGroup,
      name: c.name || '',
      avatarUrl: c.avatarUrl || '',
      unreadCounts: c.unreadCounts || {},
      pinnedFor: c.pinnedFor || {},
      mutedFor: c.mutedFor || {},
      archivedFor: c.archivedFor || {}
    }));
    localStorage.setItem(`${CHATS_CACHE_PREFIX}${userId}`, JSON.stringify(lightweight));
  } catch (e) {
    console.warn('[ConversationService] Failed saving cache:', e);
  }
}

/**
 * Deterministic chat ID helper for direct conversations
 */
function getDeterministicChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/**
 * Production-grade real-time listener for user's conversation metadata list.
 * - Subscribes strictly to `chats` metadata (NOT full message histories)
 * - Realtime deduplication & canonical ID assignment
 * - Sorts by pinned -> latestMessageAt DESC
 * - Caches locally for instantaneous display
 * - Dispatches global unread count badge update
 */
export function subscribeToUserConversations(
  userId: string,
  onUpdate: (chats: DirectChat[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!userId) {
    return () => {};
  }

  const q = query(
    collection(db, 'chats'),
    where('participantIds', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rawChats = snapshot.docs.map(doc => doc.data() as DirectChat);
      const deduplicatedMap = new Map<string, DirectChat>();

      for (const chat of rawChats) {
        if (chat.isGroup) {
          deduplicatedMap.set(chat.id, chat);
          continue;
        }

        const participants = Array.isArray(chat.participantIds) ? [...chat.participantIds].sort() : [];
        const canonicalKey = participants.length >= 2 ? `direct_${participants.join('_')}` : `direct_${chat.id}`;
        const canonicalId = participants.length >= 2 ? getDeterministicChatId(participants[0], participants[1]) : chat.id;

        if (!deduplicatedMap.has(canonicalKey)) {
          deduplicatedMap.set(canonicalKey, {
            ...chat,
            id: canonicalId
          });
        } else {
          const existing = deduplicatedMap.get(canonicalKey)!;
          const existingTime = getChatTimestampMs(existing);
          const newTime = getChatTimestampMs(chat);

          if (newTime >= existingTime) {
            deduplicatedMap.set(canonicalKey, {
              ...chat,
              id: canonicalId,
              unreadCounts: {
                ...(existing.unreadCounts || {}),
                ...(chat.unreadCounts || {})
              }
            });
          }
        }
      }

      const cleanList = Array.from(deduplicatedMap.values());
      const sorted = sortConversations(cleanList, userId);

      // Save to local cache
      saveConversationsCache(userId, sorted);

      // Calculate global unread count and synchronize badge
      const totalUnread = calculateTotalUnreadCount(sorted, userId);
      BadgeService.updateBadgeCount(totalUnread, userId);

      // Dispatch global custom event for any listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flick-unread-count-changed', {
          detail: { totalUnread, userId }
        }));
      }

      onUpdate(sorted);
    },
    (err) => {
      console.warn('[ConversationService] Listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Resets unread count for current user in Firestore and marks unread messages as read.
 * Executed when USER B actually opens conversation.
 * Synchronizes across all devices.
 */
export async function markConversationAsRead(chatId: string, userId: string): Promise<void> {
  if (!chatId || !userId) return;

  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      const data = chatSnap.data() as DirectChat;
      const currentCount = data.unreadCounts?.[userId] || 0;

      // Reset conversation unread count in Firestore
      if (currentCount > 0 || data.unreadCounts?.[userId] !== 0) {
        await updateDoc(chatRef, {
          [`unreadCounts.${userId}`]: 0,
          updatedAt: serverTimestamp()
        });
      }
    }

    // Also mark unread messages in this conversation as read
    try {
      const msgsQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('receiverId', '==', userId),
        where('read', '==', false)
      );
      const snap = await getDocs(msgsQuery);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.update(d.ref, {
            read: true,
            readAt: serverTimestamp(),
            readBy: arrayUnion(userId)
          });
        });
        await batch.commit();
      }
    } catch (msgErr) {
      // Subquery might require index or fail silently, non-critical
      console.debug('[ConversationService] Mark unread messages error:', msgErr);
    }

    // Dismiss any pending in-app notifications for this chat
    try {
      const notifsQuery = query(
        collection(db, 'notifications'),
        where('receiverId', '==', userId),
        where('chatId', '==', chatId),
        where('read', '==', false)
      );
      const notifSnap = await getDocs(notifsQuery);
      if (!notifSnap.empty) {
        const batch = writeBatch(db);
        notifSnap.docs.forEach((d) => {
          batch.update(d.ref, { read: true });
        });
        await batch.commit();
      }
    } catch {
      // Non-critical
    }

    // Dispatch global event for instant UI reaction
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flick-conversation-marked-read', {
        detail: { chatId, userId }
      }));
    }
  } catch (err) {
    console.warn('[ConversationService] markConversationAsRead failed:', err);
  }
}

/**
 * Globally marks ALL conversations and messages as read for a given user.
 * Optimistically zeroes out local caches, clears application badge counters,
 * and updates Firestore in background batches.
 */
export async function markAllConversationsAsRead(userId: string): Promise<void> {
  if (!userId) return;

  // 1. Optimistically zero out local conversation cache
  try {
    const cached = getConversationsCache(userId);
    if (cached && cached.length > 0) {
      const updated = cached.map((c) => ({
        ...c,
        unreadCounts: {
          ...(c.unreadCounts || {}),
          [userId]: 0
        }
      }));
      saveConversationsCache(userId, updated);
    }
  } catch (cacheErr) {
    console.warn('[ConversationService] Failed updating local cache in markAllConversationsAsRead:', cacheErr);
  }

  // 2. Clear stored counts in localStorage and sessionStorage
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`flick_cached_unread_${userId}`, '0');
      sessionStorage.setItem(`flick_cached_unread_${userId}`, '0');
      localStorage.setItem('flick_badge_count', '0');
    }
  } catch (e) {}

  // 3. Dispatch global events for immediate UI zeroing across the entire application
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('flick-unread-count-changed', {
      detail: { totalUnread: 0, userId }
    }));
    window.dispatchEvent(new CustomEvent('flick-badge-updated', {
      detail: { count: 0 }
    }));
    window.dispatchEvent(new CustomEvent('flick-all-messages-marked-read', {
      detail: { userId }
    }));
  }

  // 4. Update BadgeService
  try {
    await BadgeService.set(0, userId);
  } catch (badgeErr) {
    console.warn('[ConversationService] BadgeService clear failed:', badgeErr);
  }

  // 5. Update Firestore in batches
  try {
    // A. Clear unread counts across all active user chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', userId)
    );
    const chatsSnap = await getDocs(chatsQuery);
    if (!chatsSnap.empty) {
      const batch = writeBatch(db);
      let hasUpdates = false;

      chatsSnap.docs.forEach((d) => {
        const data = d.data() as DirectChat;
        if (data.unreadCounts && data.unreadCounts[userId] && data.unreadCounts[userId] > 0) {
          batch.update(d.ref, {
            [`unreadCounts.${userId}`]: 0,
            updatedAt: serverTimestamp()
          });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        await batch.commit();
      }
    }

    // B. Mark all unread notifications for this user as read
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('receiverId', '==', userId),
      where('read', '==', false)
    );
    const notifsSnap = await getDocs(notifsQuery);
    if (!notifsSnap.empty) {
      const notifBatch = writeBatch(db);
      notifsSnap.docs.forEach((d) => {
        notifBatch.update(d.ref, { read: true });
      });
      await notifBatch.commit();
    }

    // C. Update user profile document unreadBadgeCount to 0
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        unreadBadgeCount: 0,
        updatedAt: serverTimestamp()
      });
    } catch {
      // User doc update optional
    }
  } catch (firestoreErr) {
    console.warn('[ConversationService] markAllConversationsAsRead Firestore commit failed:', firestoreErr);
  }
}

/**
 * Toggle pinned status for a conversation (persisted per-user)
 */
export async function toggleChatPinned(chatId: string, userId: string, pinned: boolean): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`pinnedFor.${userId}`]: pinned,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[ConversationService] Failed to toggle pinned:', err);
  }
}

/**
 * Toggle muted status for a conversation (persisted per-user)
 */
export async function toggleChatMuted(chatId: string, userId: string, muted: boolean): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`mutedFor.${userId}`]: muted,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[ConversationService] Failed to toggle muted:', err);
  }
}

/**
 * Toggle archived status for a conversation (persisted per-user)
 */
export async function toggleChatArchived(chatId: string, userId: string, archived: boolean): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`archivedFor.${userId}`]: archived,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[ConversationService] Failed to toggle archived:', err);
  }
}

/**
 * Clear conversation history for user
 */
export async function clearChatHistory(chatId: string, userId: string): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`clearedFor.${userId}`]: serverTimestamp(),
      [`unreadCounts.${userId}`]: 0,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[ConversationService] Failed to clear chat history:', err);
  }
}

/**
 * Delete a conversation for user
 */
export async function deleteChatForUser(chatId: string, userId: string): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`deletedFor.${userId}`]: true,
      [`unreadCounts.${userId}`]: 0,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[ConversationService] Failed to delete chat:', err);
  }
}
