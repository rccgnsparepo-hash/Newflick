/**
 * Flick Device Storage Engine (Local-First Platform Abstraction)
 * 
 * CORE PRINCIPLE: USER DEVICES OWN THE DATA. FIREBASE IS THE BRIDGE.
 * 
 * Supports:
 * - Android (Capacitor / Local Private Storage + SQLite/IndexedDB)
 * - Electron / Linux (Local App Storage + Database)
 * - Web / PWA (IndexedDB + OPFS Origin Private File System)
 * 
 * Storage occurs automatically without requiring manual folder creation,
 * providing the seamless experience of WhatsApp Web while ensuring 100% data ownership.
 */

import { openDB, IDBPDatabase } from 'idb';

export type DevicePlatform = 'android' | 'electron' | 'linux' | 'web';

export interface LocalConversation {
  id: string;
  type: 'direct' | 'group' | 'channel' | 'self_vault';
  participants: string[];
  participantNames?: Record<string, string>;
  title?: string;
  avatar?: string;
  lastMessageText?: string;
  lastMessageType?: 'text' | 'voice' | 'image' | 'file';
  lastMessageTimestamp: number;
  unreadCount: number;
  isPinned: boolean;
  draftText?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocalChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  type: 'text' | 'voice' | 'image' | 'file';
  text?: string;
  mediaRef?: string; // Key in media_blobs store
  duration?: number;
  waveform?: number[];
  transcript?: string;
  fileName?: string;
  fileSizeBytes?: number;
  timestamp: number;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'queued';
  reactions: Record<string, string>; // { userId: emoji }
  replyToId?: string;
  isSaved?: boolean;
  expiresAt?: number | null;
  remoteRelayKey?: string;
}

export interface LocalMediaBlob {
  id: string;
  mimeType: string;
  dataUrl: string; // Base64 / data URL for zero-cloud local playback
  sizeBytes: number;
  fileName?: string;
  createdAt: number;
  expiresAt?: number | null;
}

export interface LocalVoiceEchoMemory {
  id: string;
  title: string;
  audioData: string;
  duration: number;
  waveform: number[];
  transcript?: string;
  tags: string[];
  createdAt: number;
  isVaultPinned: boolean;
}

export interface DeviceMetadata {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  firstInitialized: number;
  lastActive: number;
  vaultVersion: number;
}

const DB_NAME = 'FlickDeviceVaultDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Detect the runtime device platform
 */
export function getDevicePlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'web';
  const ua = window.navigator.userAgent.toLowerCase();
  
  // Capacitor Android
  if ((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor?.getPlatform?.() === 'android') {
    return 'android';
  }
  
  // Electron runtime
  if ((window as any).electronAPI || ua.includes('electron')) {
    return 'electron';
  }
  
  // Linux Desktop browser / native wrapper
  if (ua.includes('linux') && !ua.includes('android')) {
    return 'linux';
  }
  
  return 'web';
}

/**
 * Generates or retrieves unique Device ID
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device_unknown';
  let devId = localStorage.getItem('flick_device_vault_id');
  if (!devId) {
    const platform = getDevicePlatform();
    devId = `flick_${platform}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('flick_device_vault_id', devId);
  }
  return devId;
}

/**
 * Human readable device descriptor
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Flick Device';
  const platform = getDevicePlatform();
  const stored = localStorage.getItem('flick_device_name');
  if (stored) return stored;
  
  let label = 'Flick Web Client';
  if (platform === 'android') label = 'Flick Android Device';
  else if (platform === 'electron') label = 'Flick Desktop Station';
  else if (platform === 'linux') label = 'Flick Linux Station';
  
  localStorage.setItem('flick_device_name', label);
  return label;
}

/**
 * Get or open the local IndexedDB database instance
 */
export function getDeviceVaultDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Device database not available in SSR'));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Conversations Store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('by_updatedAt', 'updatedAt', { unique: false });
          convStore.createIndex('by_isPinned', 'isPinned', { unique: false });
        }

        // Messages Store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by_conversationId', 'conversationId', { unique: false });
          msgStore.createIndex('by_timestamp', 'timestamp', { unique: false });
          msgStore.createIndex('by_senderId', 'senderId', { unique: false });
          msgStore.createIndex('by_type', 'type', { unique: false });
          msgStore.createIndex('by_isSaved', 'isSaved', { unique: false });
        }

        // Media Blobs Store (Audio, Images, Files)
        if (!db.objectStoreNames.contains('media_blobs')) {
          const blobStore = db.createObjectStore('media_blobs', { keyPath: 'id' });
          blobStore.createIndex('by_createdAt', 'createdAt', { unique: false });
          blobStore.createIndex('by_expiresAt', 'expiresAt', { unique: false });
        }

        // Voice Echo Memories Store
        if (!db.objectStoreNames.contains('voice_memories')) {
          const memStore = db.createObjectStore('voice_memories', { keyPath: 'id' });
          memStore.createIndex('by_createdAt', 'createdAt', { unique: false });
          memStore.createIndex('by_isVaultPinned', 'isVaultPinned', { unique: false });
        }

        // Device Metadata & Settings Store
        if (!db.objectStoreNames.contains('device_meta')) {
          db.createObjectStore('device_meta', { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
}

/* ========================================================================= */
/* CONVERSATIONS OPERATIONS                                                 */
/* ========================================================================= */

export async function saveLocalConversation(conv: LocalConversation): Promise<void> {
  const db = await getDeviceVaultDB();
  await db.put('conversations', conv);
}

export async function getLocalConversation(id: string): Promise<LocalConversation | null> {
  try {
    const db = await getDeviceVaultDB();
    const res = await db.get('conversations', id);
    return res || null;
  } catch (e) {
    return null;
  }
}

export async function getAllLocalConversations(): Promise<LocalConversation[]> {
  try {
    const db = await getDeviceVaultDB();
    const all = await db.getAll('conversations');
    return all.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.lastMessageTimestamp || b.updatedAt) - (a.lastMessageTimestamp || a.updatedAt);
    });
  } catch (e) {
    console.warn('[DeviceStorage] getAllLocalConversations error:', e);
    return [];
  }
}

export async function updateConversationDraft(id: string, draftText: string): Promise<void> {
  const db = await getDeviceVaultDB();
  const tx = db.transaction('conversations', 'readwrite');
  const conv = await tx.store.get(id);
  if (conv) {
    conv.draftText = draftText;
    conv.updatedAt = Date.now();
    await tx.store.put(conv);
  }
  await tx.done;
}

/* ========================================================================= */
/* MESSAGES OPERATIONS                                                      */
/* ========================================================================= */

export async function saveLocalChatMessage(
  message: LocalChatMessage,
  mediaDataUrl?: string
): Promise<void> {
  const db = await getDeviceVaultDB();
  const tx = db.transaction(['messages', 'conversations', 'media_blobs'], 'readwrite');

  // Save media blob if attached
  if (mediaDataUrl) {
    const mediaId = message.mediaRef || `media_${message.id}`;
    message.mediaRef = mediaId;
    const mediaRecord: LocalMediaBlob = {
      id: mediaId,
      mimeType: message.type === 'voice' ? 'audio/webm' : message.type === 'image' ? 'image/jpeg' : 'application/octet-stream',
      dataUrl: mediaDataUrl,
      sizeBytes: Math.round((mediaDataUrl.length * 3) / 4),
      fileName: message.fileName,
      createdAt: Date.now(),
      expiresAt: message.expiresAt || null,
    };
    await tx.objectStore('media_blobs').put(mediaRecord);
  }

  // Save message record
  await tx.objectStore('messages').put(message);

  // Update conversation last message & timestamp
  const convStore = tx.objectStore('conversations');
  let conv = await convStore.get(message.conversationId);
  const snippet = message.type === 'voice'
    ? `🎙️ Voice Note (${Math.round(message.duration || 0)}s)`
    : message.type === 'image'
    ? '📷 Photo'
    : message.type === 'file'
    ? `📎 ${message.fileName || 'File'}`
    : (message.text || '');

  if (!conv) {
    conv = {
      id: message.conversationId,
      type: 'direct',
      participants: [message.senderId, message.recipientId].filter(Boolean),
      lastMessageText: snippet,
      lastMessageType: message.type,
      lastMessageTimestamp: message.timestamp,
      unreadCount: 0,
      isPinned: false,
      createdAt: message.timestamp,
      updatedAt: message.timestamp,
    };
  } else {
    conv.lastMessageText = snippet;
    conv.lastMessageType = message.type;
    conv.lastMessageTimestamp = message.timestamp;
    conv.updatedAt = message.timestamp;
  }
  await convStore.put(conv);

  await tx.done;
}

export async function getConversationMessages(conversationId: string): Promise<LocalChatMessage[]> {
  try {
    const db = await getDeviceVaultDB();
    const index = db.transaction('messages', 'readonly').store.index('by_conversationId');
    const messages = await index.getAll(conversationId);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e) {
    console.warn('[DeviceStorage] getConversationMessages error:', e);
    return [];
  }
}

export async function updateMessageReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const db = await getDeviceVaultDB();
  const tx = db.transaction('messages', 'readwrite');
  const msg = await tx.store.get(messageId);
  if (msg) {
    if (!msg.reactions) msg.reactions = {};
    if (msg.reactions[userId] === emoji) {
      delete msg.reactions[userId];
    } else {
      msg.reactions[userId] = emoji;
    }
    await tx.store.put(msg);
  }
  await tx.done;
}

export async function toggleSaveMessage(messageId: string): Promise<boolean> {
  const db = await getDeviceVaultDB();
  const tx = db.transaction('messages', 'readwrite');
  const msg = await tx.store.get(messageId);
  if (!msg) return false;

  msg.isSaved = !msg.isSaved;
  if (msg.isSaved) {
    msg.expiresAt = null;
  }
  await tx.store.put(msg);
  await tx.done;
  return msg.isSaved;
}

/* ========================================================================= */
/* MEDIA BLOBS OPERATIONS (AUDIO, PHOTOS, ATTACHMENTS)                      */
/* ========================================================================= */

export async function getLocalMediaBlob(mediaId: string): Promise<LocalMediaBlob | null> {
  try {
    const db = await getDeviceVaultDB();
    const blob = await db.get('media_blobs', mediaId);
    return blob || null;
  } catch (e) {
    return null;
  }
}

export async function saveLocalMediaBlob(blob: LocalMediaBlob): Promise<void> {
  const db = await getDeviceVaultDB();
  await db.put('media_blobs', blob);
}

/* ========================================================================= */
/* VOICE ECHO MEMORIES (PERSONAL DEVICE VAULT)                              */
/* ========================================================================= */

export async function saveVoiceEchoMemory(memory: LocalVoiceEchoMemory): Promise<void> {
  const db = await getDeviceVaultDB();
  await db.put('voice_memories', memory);
}

export async function getAllVoiceEchoMemories(): Promise<LocalVoiceEchoMemory[]> {
  try {
    const db = await getDeviceVaultDB();
    const all = await db.getAll('voice_memories');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    return [];
  }
}

export async function deleteVoiceEchoMemory(id: string): Promise<void> {
  const db = await getDeviceVaultDB();
  await db.delete('voice_memories', id);
}

/* ========================================================================= */
/* STORAGE BREAKDOWN & STATS DIAGNOSTICS                                     */
/* ========================================================================= */

export interface DeviceStorageStats {
  platform: DevicePlatform;
  deviceId: string;
  totalConversations: number;
  totalMessages: number;
  totalMediaBlobs: number;
  totalVoiceMemories: number;
  estimatedSizeBytes: number;
  quotaEstimatedBytes: number;
}

export async function getDeviceStorageStats(): Promise<DeviceStorageStats> {
  try {
    const db = await getDeviceVaultDB();
    const [conversations, messages, mediaBlobs, voiceMemories] = await Promise.all([
      db.getAll('conversations'),
      db.getAll('messages'),
      db.getAll('media_blobs'),
      db.getAll('voice_memories'),
    ]);

    let estimatedSizeBytes = 0;
    for (const m of mediaBlobs) {
      estimatedSizeBytes += m.sizeBytes || 0;
    }
    for (const v of voiceMemories) {
      estimatedSizeBytes += Math.round((v.audioData?.length || 0) * 0.75);
    }
    estimatedSizeBytes += messages.length * 256;
    estimatedSizeBytes += conversations.length * 512;

    let quotaEstimatedBytes = 2 * 1024 * 1024 * 1024; // 2GB estimate
    if (typeof navigator !== 'undefined' && (navigator as any).storage?.estimate) {
      try {
        const estimate = await (navigator as any).storage.estimate();
        if (estimate.quota) quotaEstimatedBytes = estimate.quota;
      } catch {}
    }

    return {
      platform: getDevicePlatform(),
      deviceId: getOrCreateDeviceId(),
      totalConversations: conversations.length,
      totalMessages: messages.length,
      totalMediaBlobs: mediaBlobs.length,
      totalVoiceMemories: voiceMemories.length,
      estimatedSizeBytes,
      quotaEstimatedBytes,
    };
  } catch (err) {
    return {
      platform: getDevicePlatform(),
      deviceId: getOrCreateDeviceId(),
      totalConversations: 0,
      totalMessages: 0,
      totalMediaBlobs: 0,
      totalVoiceMemories: 0,
      estimatedSizeBytes: 0,
      quotaEstimatedBytes: 50 * 1024 * 1024,
    };
  }
}

/**
 * Retrieve all local chats / conversations
 */
export const getAllLocalChats = getAllLocalConversations;

/**
 * Retrieve all stored local messages across all conversations
 */
export async function getAllLocalMessages(): Promise<LocalChatMessage[]> {
  try {
    const db = await getDeviceVaultDB();
    const all = await db.getAll('messages');
    return all.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e) {
    console.warn('[DeviceStorage] getAllLocalMessages error:', e);
    return [];
  }
}

/**
 * Ingest / restore a full vault archive into IndexedDB
 */
export async function importVaultArchive(
  archive: {
    chats?: any[];
    conversations?: any[];
    messages?: any[];
    media?: any[];
    mediaBlobs?: any[];
    voiceNotes?: any[];
    voiceMemories?: any[];
  },
  strategy: 'merge' | 'replace' = 'merge'
): Promise<void> {
  const db = await getDeviceVaultDB();
  const tx = db.transaction(['conversations', 'messages', 'media_blobs', 'voice_memories'], 'readwrite');

  if (strategy === 'replace') {
    await Promise.all([
      tx.objectStore('conversations').clear(),
      tx.objectStore('messages').clear(),
      tx.objectStore('media_blobs').clear(),
      tx.objectStore('voice_memories').clear(),
    ]);
  }

  const chatsToInsert = archive.chats || archive.conversations || [];
  for (const c of chatsToInsert) {
    await tx.objectStore('conversations').put(c);
  }

  const msgsToInsert = archive.messages || [];
  for (const m of msgsToInsert) {
    await tx.objectStore('messages').put(m);
  }

  const mediaToInsert = archive.media || archive.mediaBlobs || [];
  for (const b of mediaToInsert) {
    await tx.objectStore('media_blobs').put(b);
  }

  const voicesToInsert = archive.voiceNotes || archive.voiceMemories || [];
  for (const v of voicesToInsert) {
    await tx.objectStore('voice_memories').put(v);
  }

  await tx.done;
}

/**
 * Completely wipe local storage on explicit user request
 */
export async function wipeAllLocalDeviceData(): Promise<void> {
  const db = await getDeviceVaultDB();
  const tx = db.transaction(['conversations', 'messages', 'media_blobs', 'voice_memories'], 'readwrite');
  await Promise.all([
    tx.objectStore('conversations').clear(),
    tx.objectStore('messages').clear(),
    tx.objectStore('media_blobs').clear(),
    tx.objectStore('voice_memories').clear(),
  ]);
  await tx.done;
}
