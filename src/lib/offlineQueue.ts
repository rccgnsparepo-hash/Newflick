import { openDB } from 'idb';
import { sendE2EEMessage } from './services';

const DB_NAME = 'FlickOfflineDB';
const STORE_NAME = 'outgoing_messages';

export interface QueuedMessage {
  id: string; // unique local ID
  chatId: string;
  senderId: string;
  senderDisplayName: string;
  receiverId: string;
  plainText: string;
  recipientPublicKeyJwk: string;
  senderPublicKeyJwk: string;
  lifespanSeconds?: number;
  queuedAt: number;
}

let dbPromise: any = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueOfflineMessage(params: Omit<QueuedMessage, 'id' | 'queuedAt'>): Promise<string> {
  const db = await getDB();
  const id = 'temp_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const newItem: QueuedMessage = {
    ...params,
    id,
    queuedAt: Date.now()
  };
  
  if (db) {
    await db.put(STORE_NAME, newItem);
  }
  return id;
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll(STORE_NAME);
}

export async function deleteQueuedMessage(id: string): Promise<void> {
  const db = await getDB();
  if (db) {
    await db.delete(STORE_NAME, id);
  }
}

let isSyncing = false;

export async function syncOfflineMessages(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  if (isSyncing) return;

  isSyncing = true;
  console.log("[Offline Syncer] Starting E2EE message synchronization...");

  try {
    const queued = await getQueuedMessages();
    if (queued.length === 0) {
      isSyncing = false;
      return;
    }

    // Sort by queuedAt so we maintain message sending order!
    queued.sort((a, b) => a.queuedAt - b.queuedAt);

    for (const msg of queued) {
      try {
        console.log(`[Offline Syncer] Delivering queued message: ${msg.id}`);
        await sendE2EEMessage({
          chatId: msg.chatId,
          senderId: msg.senderId,
          senderDisplayName: msg.senderDisplayName,
          receiverId: msg.receiverId,
          plainText: msg.plainText,
          recipientPublicKeyJwk: msg.recipientPublicKeyJwk,
          senderPublicKeyJwk: msg.senderPublicKeyJwk,
          lifespanSeconds: msg.lifespanSeconds
        });
        
        // On success, evict from offline store
        await deleteQueuedMessage(msg.id);
        console.log(`[Offline Syncer] Message ${msg.id} delivered and cleared from cache.`);
      } catch (err) {
        console.error(`[Offline Syncer] Delivery failed for message ${msg.id}:`, err);
        // If it was a network error, stop sending further messages to maintain order
        break;
      }
    }
  } finally {
    isSyncing = false;
  }
}

// Automatically listen for connection restoration and run sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("[Offline Syncer] Network connectivity RESTORED. Triggering queue drain.");
    syncOfflineMessages().catch(console.error);
  });
}
