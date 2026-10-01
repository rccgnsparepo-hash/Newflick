import { openDB, IDBPDatabase } from 'idb';
import { sendE2EEMessage, sendGroupMessageService } from './services';
import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'FlickOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'outgoing_messages';

export interface QueuedOfflineMessage {
  id: string; // Unique local identifier e.g. offline_chatId_timestamp_random
  chatId: string;
  senderId: string;
  senderDisplayName: string;
  receiverId: string; // Peer UID or 'group'
  isGroup?: boolean;
  plainText: string;
  messageType?: 'text' | 'system' | 'poll' | 'shared_post' | 'shared_profile' | 'voice' | 'image' | 'video' | 'document' | 'location' | string;
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  threadRootId?: string;
  pollData?: {
    question: string;
    options: string[];
    votes: Record<string, number>;
  } | null;
  // 1-on-1 E2EE cryptography keys
  recipientPublicKeyJwk?: string;
  senderPublicKeyJwk?: string;
  lifespanSeconds?: number;
  // Queue metadata
  queuedAt: number;
  status: 'queued' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
}

// Backward compatibility alias
export type QueuedMessage = QueuedOfflineMessage;

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

function getDB(): Promise<IDBPDatabase<any>> | null {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        let store;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } else {
          store = transaction.objectStore(STORE_NAME);
        }

        if (!store.indexNames.contains('by-chatId')) {
          store.createIndex('by-chatId', 'chatId');
        }
        if (!store.indexNames.contains('by-status')) {
          store.createIndex('by-status', 'status');
        }
        if (!store.indexNames.contains('by-queuedAt')) {
          store.createIndex('by-queuedAt', 'queuedAt');
        }
      },
    });
  }
  return dbPromise;
}

function notifyQueueChanged(detail?: any) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('flick-offline-queue-changed', { detail }));
  }
}

/**
 * Enqueue an outgoing message into the IndexedDB local vault
 */
export async function queueOfflineMessage(
  params: Omit<QueuedOfflineMessage, 'id' | 'queuedAt' | 'status' | 'retryCount'>
): Promise<string> {
  const db = await getDB();
  const id = `offline_${params.chatId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newItem: QueuedOfflineMessage = {
    ...params,
    id,
    queuedAt: Date.now(),
    status: 'queued',
    retryCount: 0,
  };

  if (db) {
    await db.put(STORE_NAME, newItem);
  }

  notifyQueueChanged({ action: 'enqueued', message: newItem });

  // If online, immediately attempt syncing
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      syncOfflineMessages().catch((err) =>
        console.warn('[Offline Queue] Immediate sync check warning:', err)
      );
    }, 100);
  }

  return id;
}

/**
 * Retrieve all queued messages sorted chronologically by queuedAt
 */
export async function getQueuedMessages(): Promise<QueuedOfflineMessage[]> {
  const db = await getDB();
  if (!db) return [];
  try {
    const list: QueuedOfflineMessage[] = await db.getAll(STORE_NAME);
    return list.sort((a, b) => a.queuedAt - b.queuedAt);
  } catch (err) {
    console.error('[Offline Queue] Failed to retrieve messages from IndexedDB:', err);
    return [];
  }
}

/**
 * Retrieve queued messages specific to a single chat room
 */
export async function getQueuedMessagesForChat(chatId: string): Promise<QueuedOfflineMessage[]> {
  if (!chatId) return [];
  const db = await getDB();
  if (!db) return [];
  try {
    let list: QueuedOfflineMessage[] = [];
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    if (store.indexNames.contains('by-chatId')) {
      const index = store.index('by-chatId');
      list = await index.getAll(chatId);
    } else {
      const all: QueuedOfflineMessage[] = await store.getAll();
      list = all.filter((m) => m.chatId === chatId);
    }
    return list.sort((a, b) => a.queuedAt - b.queuedAt);
  } catch (err) {
    console.warn('[Offline Queue] Error fetching messages for chat:', chatId, err);
    const all = await getQueuedMessages();
    return all.filter((m) => m.chatId === chatId);
  }
}

/**
 * Return the total number of queued messages currently pending synchronization
 */
export async function getQueuedMessagesCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  try {
    return await db.count(STORE_NAME);
  } catch (err) {
    console.warn('[Offline Queue] Count check failed:', err);
    return 0;
  }
}

/**
 * Remove a delivered message from the IndexedDB store
 */
export async function deleteQueuedMessage(id: string): Promise<void> {
  const db = await getDB();
  if (db) {
    try {
      await db.delete(STORE_NAME, id);
      notifyQueueChanged({ action: 'deleted', id });
    } catch (err) {
      console.warn('[Offline Queue] Error deleting message from IndexedDB:', id, err);
    }
  }
}

/**
 * Update the state of a queued message (e.g. syncing, failed)
 */
export async function updateQueuedMessage(
  id: string,
  updates: Partial<QueuedOfflineMessage>
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  try {
    const existing = await db.get(STORE_NAME, id);
    if (existing) {
      const updated = { ...existing, ...updates };
      await db.put(STORE_NAME, updated);
      notifyQueueChanged({ action: 'updated', id, message: updated });
    }
  } catch (err) {
    console.warn('[Offline Queue] Error updating queued message:', id, err);
  }
}

/**
 * Clear all queued messages
 */
export async function clearAllQueuedMessages(): Promise<void> {
  const db = await getDB();
  if (db) {
    await db.clear(STORE_NAME);
    notifyQueueChanged({ action: 'cleared' });
  }
}

let isSyncing = false;

/**
 * Drain and synchronize all offline queued messages once internet connectivity is present
 */
export async function syncOfflineMessages(
  force = false
): Promise<{ synced: number; remaining: number }> {
  if (typeof window === 'undefined') return { synced: 0, remaining: 0 };
  if (!force && typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, remaining: await getQueuedMessagesCount() };
  }
  if (isSyncing) {
    return { synced: 0, remaining: await getQueuedMessagesCount() };
  }

  isSyncing = true;
  let syncedCount = 0;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('flick-offline-sync-started'));
  }

  console.log('[Offline Syncer] Starting IndexedDB offline message queue sync...');

  try {
    const queued = await getQueuedMessages();
    if (queued.length === 0) {
      return { synced: 0, remaining: 0 };
    }

    console.log(`[Offline Syncer] Processing ${queued.length} queued offline message(s)...`);

    for (const msg of queued) {
      // Re-verify network before each dispatch
      if (!force && typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[Offline Syncer] Network lost mid-sync. Pausing queue drain.');
        await updateQueuedMessage(msg.id, { status: 'queued' });
        break;
      }

      try {
        await updateQueuedMessage(msg.id, { status: 'syncing' });

        if (msg.isGroup || msg.receiverId === 'group') {
          // Deliver via Group Message Service
          await sendGroupMessageService({
            chatId: msg.chatId,
            senderId: msg.senderId,
            senderDisplayName: msg.senderDisplayName || 'Relay User',
            plainText: msg.plainText,
            messageType: (msg.messageType as any) || 'text',
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType,
            mediaName: msg.mediaName,
            replyToId: msg.replyToId,
            replyToText: msg.replyToText,
            replyToSenderName: msg.replyToSenderName,
            threadRootId: msg.threadRootId,
            pollData: msg.pollData ? {
              question: msg.pollData.question,
              options: msg.pollData.options,
              votes: msg.pollData.votes || {}
            } : undefined,
          });
        } else {
          // Deliver via 1-on-1 E2EE Handshake
          await sendE2EEMessage({
            chatId: msg.chatId,
            senderId: msg.senderId,
            senderDisplayName: msg.senderDisplayName,
            receiverId: msg.receiverId,
            plainText: msg.plainText,
            recipientPublicKeyJwk: msg.recipientPublicKeyJwk || '',
            senderPublicKeyJwk: msg.senderPublicKeyJwk || '',
            lifespanSeconds: msg.lifespanSeconds,
            replyToId: msg.replyToId,
            replyToText: msg.replyToText,
            replyToSenderName: msg.replyToSenderName,
            threadRootId: msg.threadRootId,
          });
        }

        // Successfully delivered: Evict from local IndexedDB vault
        await deleteQueuedMessage(msg.id);
        syncedCount++;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('flick-offline-message-synced', {
              detail: { id: msg.id, chatId: msg.chatId },
            })
          );
        }

        console.log(`[Offline Syncer] Successfully synchronized queued message: ${msg.id}`);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const isNetworkErr =
          !navigator.onLine ||
          /offline|network|failed to fetch|unavailable|client is offline|load failed|connection refused|timeout/i.test(
            errorMsg
          );

        console.warn(`[Offline Syncer] Delivery failed for message ${msg.id}:`, err);

        if (isNetworkErr) {
          // Reset status back to queued and halt further processing to maintain FIFO order
          await updateQueuedMessage(msg.id, {
            status: 'queued',
            retryCount: (msg.retryCount || 0) + 1,
            lastError: errorMsg,
          });
          break;
        } else {
          // Non-network failure (e.g. payload corruption or missing public key)
          const newRetryCount = (msg.retryCount || 0) + 1;
          if (newRetryCount >= 5) {
            await updateQueuedMessage(msg.id, {
              status: 'failed',
              retryCount: newRetryCount,
              lastError: errorMsg,
            });
          } else {
            await updateQueuedMessage(msg.id, {
              status: 'queued',
              retryCount: newRetryCount,
              lastError: errorMsg,
            });
          }
        }
      }
    }

    const remaining = await getQueuedMessagesCount();
    return { synced: syncedCount, remaining };
  } finally {
    isSyncing = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('flick-offline-sync-completed', {
          detail: { synced: syncedCount },
        })
      );
    }
  }
}

// Background network listener setup
if (typeof window !== 'undefined') {
  // Listen for online connectivity restoration
  window.addEventListener('online', () => {
    console.log('[Offline Syncer] Network ONLINE event captured. Triggering automatic sync.');
    syncOfflineMessages().catch((e) =>
      console.warn('[Offline Syncer] Auto-sync online trigger error:', e)
    );
  });

  // Also check on tab focus/visibility
  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      syncOfflineMessages().catch(() => {});
    }
  });

  // Periodic heartbeat sync: every 25 seconds if online and items exist
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      getQueuedMessagesCount().then((count) => {
        if (count > 0) {
          syncOfflineMessages().catch(() => {});
        }
      });
    }
  }, 25000);
}

/**
 * React Hook to access and observe the IndexedDB offline message queue
 */
export function useOfflineQueue(chatId?: string) {
  const [messages, setMessages] = useState<QueuedOfflineMessage[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSyncingState, setIsSyncingState] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    try {
      const [allCount, chatMsgs] = await Promise.all([
        getQueuedMessagesCount(),
        chatId ? getQueuedMessagesForChat(chatId) : getQueuedMessages(),
      ]);
      setTotalCount(allCount);
      setMessages(chatMsgs);
    } catch (e) {
      console.warn('[useOfflineQueue] Refresh failed:', e);
    }
  }, [chatId]);

  useEffect(() => {
    refresh();

    const handleQueueChange = () => refresh();
    const handleSyncStart = () => setIsSyncingState(true);
    const handleSyncEnd = () => {
      setIsSyncingState(false);
      refresh();
    };

    window.addEventListener('flick-offline-queue-changed', handleQueueChange);
    window.addEventListener('flick-offline-sync-started', handleSyncStart);
    window.addEventListener('flick-offline-sync-completed', handleSyncEnd);
    window.addEventListener('online', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);

    return () => {
      window.removeEventListener('flick-offline-queue-changed', handleQueueChange);
      window.removeEventListener('flick-offline-sync-started', handleSyncStart);
      window.removeEventListener('flick-offline-sync-completed', handleSyncEnd);
      window.removeEventListener('online', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    setIsSyncingState(true);
    try {
      await syncOfflineMessages(true);
    } finally {
      setIsSyncingState(false);
      await refresh();
    }
  }, [refresh]);

  const removeMessage = useCallback(
    async (id: string) => {
      await deleteQueuedMessage(id);
      await refresh();
    },
    [refresh]
  );

  return {
    messages,
    totalCount,
    isSyncing: isSyncingState,
    syncNow,
    refresh,
    removeMessage,
  };
}
