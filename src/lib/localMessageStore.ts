import { openDB, IDBPDatabase } from 'idb';
import { computeWaveformFromAudio } from './voiceVault';

export type MediaIndexStatus = 'LOCAL' | 'SAVED' | 'CACHED' | 'DOWNLOADING' | 'REMOTE_ONLY' | 'EXPIRED' | 'MISSING';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'queued';
export type PlaybackStatus = 'unplayed' | 'playing' | 'played' | 'paused';
export type TranscriptStatus = 'ready' | 'processing' | 'unavailable';

export interface LocalMessageRecord {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  createdAt: number;
  duration: number;
  messageType: 'voice' | 'live_flow' | 'text' | 'file';
  localAudioReference?: string; // IDB key or Data URL in storage
  mediaStatus: MediaIndexStatus;
  deliveryStatus: DeliveryStatus;
  playbackStatus: PlaybackStatus;
  transcriptStatus: TranscriptStatus;
  transcript?: string;
  waveform?: number[];
  saved: boolean; // 📌 Intentionally pinned / saved
  temporary: boolean;
  expiresAt: number | null;
  remoteRelayKey?: string; // Short ephemeral pointer
  sizeBytes?: number;
}

const LOCAL_STORE_DB_NAME = 'FlickLocalMessageStoreDB';
const LOCAL_STORE_DB_VERSION = 1;

let localDbPromise: Promise<IDBPDatabase> | null = null;

export function getLocalMessageDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in SSR'));
  }
  if (!localDbPromise) {
    localDbPromise = openDB(LOCAL_STORE_DB_NAME, LOCAL_STORE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('local_messages')) {
          const store = db.createObjectStore('local_messages', { keyPath: 'messageId' });
          store.createIndex('by_conversationId', 'conversationId', { unique: false });
          store.createIndex('by_senderId', 'senderId', { unique: false });
          store.createIndex('by_recipientId', 'recipientId', { unique: false });
          store.createIndex('by_mediaStatus', 'mediaStatus', { unique: false });
          store.createIndex('by_saved', 'saved', { unique: false });
          store.createIndex('by_createdAt', 'createdAt', { unique: false });
          store.createIndex('by_expiresAt', 'expiresAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs', { keyPath: 'messageId' });
        }
        if (!db.objectStoreNames.contains('temp_relay_cache')) {
          const relayStore = db.createObjectStore('temp_relay_cache', { keyPath: 'relayKey' });
          relayStore.createIndex('by_expiresAt', 'expiresAt', { unique: false });
        }
      },
    });
  }
  return localDbPromise;
}

// In-memory active blob cache for smooth instant audio decoding & scrubbing
const memoryAudioUrlCache = new Map<string, string>();

/**
 * SMART LOCAL MEDIA INDEX: Checks whether the actual audio exists on this device
 */
export async function checkMediaStatus(messageId: string): Promise<MediaIndexStatus> {
  try {
    const db = await getLocalMessageDB();
    const record = await db.get('local_messages', messageId);
    if (!record) return 'REMOTE_ONLY';

    if (record.saved) return 'SAVED';

    // Check if audio blob actually exists in local blob store
    const blobRecord = await db.get('audio_blobs', messageId);
    if (blobRecord && blobRecord.audioData) {
      return record.mediaStatus === 'SAVED' ? 'SAVED' : 'LOCAL';
    }

    if (record.expiresAt && record.expiresAt < Date.now()) {
      return 'EXPIRED';
    }

    return record.mediaStatus || 'REMOTE_ONLY';
  } catch (e) {
    console.warn('[SmartLocalMediaIndex] Error checking status for', messageId, e);
    return 'MISSING';
  }
}

/**
 * Save / update a local voice message record
 */
export async function saveLocalMessage(
  record: LocalMessageRecord,
  audioBlobOrDataUrl?: string
): Promise<void> {
  const db = await getLocalMessageDB();

  // If waveform is missing but audio is provided, compute locally
  let waveform = record.waveform;
  if ((!waveform || waveform.length === 0) && audioBlobOrDataUrl) {
    try {
      waveform = await computeWaveformFromAudio(audioBlobOrDataUrl);
    } catch {
      waveform = Array(40).fill(0.35);
    }
  }

  const updatedRecord: LocalMessageRecord = {
    ...record,
    waveform: waveform || Array(40).fill(0.35),
    mediaStatus: record.saved ? 'SAVED' : (audioBlobOrDataUrl ? 'LOCAL' : record.mediaStatus),
  };

  const tx = db.transaction(['local_messages', 'audio_blobs'], 'readwrite');
  await tx.objectStore('local_messages').put(updatedRecord);

  if (audioBlobOrDataUrl) {
    await tx.objectStore('audio_blobs').put({
      messageId: record.messageId,
      audioData: audioBlobOrDataUrl,
      createdAt: Date.now(),
      expiresAt: record.expiresAt,
    });
    memoryAudioUrlCache.set(record.messageId, audioBlobOrDataUrl);
  }

  await tx.done;
}

/**
 * Retrieve local message metadata
 */
export async function getLocalMessage(messageId: string): Promise<LocalMessageRecord | null> {
  try {
    const db = await getLocalMessageDB();
    const record = await db.get('local_messages', messageId);
    return record || null;
  } catch (e) {
    return null;
  }
}

/**
 * Retrieve audio data URL for a message:
 * 1. Check memory cache
 * 2. Check local IndexedDB (LOCAL / SAVED / CACHED)
 * 3. If REMOTE_ONLY -> Retrieve temporary relay copy -> Store locally -> Return Data URL
 * 4. Never download unnecessarily when already local!
 */
export async function retrieveAndCacheAudio(
  messageId: string,
  fallbackRemotePayload?: string
): Promise<{ audioUrl: string | null; status: MediaIndexStatus }> {
  // 1. In-memory fast cache
  if (memoryAudioUrlCache.has(messageId)) {
    const db = await getLocalMessageDB();
    const msg = await db.get('local_messages', messageId);
    return {
      audioUrl: memoryAudioUrlCache.get(messageId)!,
      status: msg?.saved ? 'SAVED' : 'LOCAL',
    };
  }

  try {
    const db = await getLocalMessageDB();

    // 2. Check local blob storage
    const blobRecord = await db.get('audio_blobs', messageId);
    if (blobRecord && blobRecord.audioData) {
      memoryAudioUrlCache.set(messageId, blobRecord.audioData);
      const msg = await db.get('local_messages', messageId);
      const status: MediaIndexStatus = msg?.saved ? 'SAVED' : 'LOCAL';
      return { audioUrl: blobRecord.audioData, status };
    }

    // 3. If not found locally, fetch temporary remote relay payload
    const msgRecord = await db.get('local_messages', messageId);
    if (msgRecord && msgRecord.expiresAt && msgRecord.expiresAt < Date.now()) {
      return { audioUrl: null, status: 'EXPIRED' };
    }

    // Mark as DOWNLOADING in local index
    if (msgRecord) {
      msgRecord.mediaStatus = 'DOWNLOADING';
      await db.put('local_messages', msgRecord);
    }

    let rawAudio = fallbackRemotePayload;

    // Check temp relay store if remoteRelayKey is specified
    if (!rawAudio && msgRecord?.remoteRelayKey) {
      const relayEntry = await db.get('temp_relay_cache', msgRecord.remoteRelayKey);
      if (relayEntry && relayEntry.audioData) {
        rawAudio = relayEntry.audioData;
      }
    }

    if (rawAudio) {
      // Store locally in audio_blobs and update index to LOCAL
      await db.put('audio_blobs', {
        messageId,
        audioData: rawAudio,
        createdAt: Date.now(),
        expiresAt: msgRecord?.expiresAt || null,
      });

      if (msgRecord) {
        msgRecord.mediaStatus = msgRecord.saved ? 'SAVED' : 'LOCAL';
        await db.put('local_messages', msgRecord);
      }

      memoryAudioUrlCache.set(messageId, rawAudio);
      return { audioUrl: rawAudio, status: msgRecord?.saved ? 'SAVED' : 'LOCAL' };
    }

    return { audioUrl: null, status: 'REMOTE_ONLY' };
  } catch (err) {
    console.warn('[SmartLocalMediaIndex] retrieveAndCacheAudio error:', err);
    return { audioUrl: null, status: 'MISSING' };
  }
}

/**
 * Toggle intentional saving / pinning of a voice message (📌 SAVED)
 */
export async function toggleSaveLocalMessage(messageId: string): Promise<boolean> {
  const db = await getLocalMessageDB();
  const tx = db.transaction('local_messages', 'readwrite');
  const record = await tx.store.get(messageId);
  if (!record) return false;

  record.saved = !record.saved;
  record.mediaStatus = record.saved ? 'SAVED' : 'LOCAL';
  // Saved messages do not automatically expire
  if (record.saved) {
    record.temporary = false;
    record.expiresAt = null;
  }
  await tx.store.put(record);
  await tx.done;
  return record.saved;
}

/**
 * Get all local voice messages for a conversation
 */
export async function getConversationLocalMessages(conversationId: string): Promise<LocalMessageRecord[]> {
  try {
    const db = await getLocalMessageDB();
    const index = db.transaction('local_messages', 'readonly').store.index('by_conversationId');
    const messages = await index.getAll(conversationId);
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  } catch (e) {
    console.warn('[SmartLocalMediaIndex] Error getting conversation messages:', e);
    return [];
  }
}

/**
 * Get recent voice conversations for the Voice-First Home Screen
 */
export async function getRecentVoiceConversations(currentUserId: string): Promise<{
  conversationId: string;
  peerId: string;
  peerName: string;
  lastMessageAt: number;
  voiceNotes: LocalMessageRecord[];
  savedCount: number;
  unreadCount: number;
}[]> {
  try {
    const db = await getLocalMessageDB();
    const all = await db.getAll('local_messages');
    
    // Group by conversationId
    const groups = new Map<string, LocalMessageRecord[]>();
    for (const msg of all) {
      if (!groups.has(msg.conversationId)) {
        groups.set(msg.conversationId, []);
      }
      groups.get(msg.conversationId)!.push(msg);
    }

    const result: any[] = [];
    for (const [conversationId, list] of groups.entries()) {
      list.sort((a, b) => b.createdAt - a.createdAt);
      const latest = list[0];
      const peerId = latest.senderId === currentUserId ? latest.recipientId : latest.senderId;
      const peerName = latest.senderName || 'Peer Contact';
      const savedCount = list.filter(m => m.saved).length;
      const unreadCount = list.filter(m => m.senderId !== currentUserId && m.playbackStatus === 'unplayed').length;

      result.push({
        conversationId,
        peerId,
        peerName,
        lastMessageAt: latest.createdAt,
        voiceNotes: list.slice(0, 5), // last 5 voice notes
        savedCount,
        unreadCount,
      });
    }

    return result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  } catch (e) {
    console.warn('[SmartLocalMediaIndex] Error loading recent voice conversations:', e);
    return [];
  }
}

/**
 * Periodic cleanup of expired temporary remote cache
 */
export async function cleanupExpiredTemporaryMedia(): Promise<number> {
  try {
    const db = await getLocalMessageDB();
    const now = Date.now();
    const tx = db.transaction(['local_messages', 'audio_blobs', 'temp_relay_cache'], 'readwrite');

    const msgStore = tx.objectStore('local_messages');
    const blobStore = tx.objectStore('audio_blobs');
    const relayStore = tx.objectStore('temp_relay_cache');

    const all = await msgStore.getAll();
    let cleaned = 0;

    for (const msg of all) {
      if (!msg.saved && msg.temporary && msg.expiresAt && msg.expiresAt < now) {
        msg.mediaStatus = 'EXPIRED';
        await msgStore.put(msg);
        await blobStore.delete(msg.messageId);
        memoryAudioUrlCache.delete(msg.messageId);
        cleaned++;
      }
    }

    await tx.done;
    return cleaned;
  } catch (e) {
    return 0;
  }
}

/**
 * Temporary Relay Staging: Saves temporary encrypted payload for async delivery
 */
export async function stageTemporaryRelayAudio(relayKey: string, audioData: string, ttlSeconds = 86400): Promise<void> {
  try {
    const db = await getLocalMessageDB();
    await db.put('temp_relay_cache', {
      relayKey,
      audioData,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  } catch (e) {
    console.warn('[TempRelay] Error staging temporary audio payload:', e);
  }
}
