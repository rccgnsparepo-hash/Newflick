import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'FlickVoiceVaultDB';
const DB_VERSION = 1;

export interface LocalVoiceNote {
  id: string; // Unique primary key
  messageId: string;
  chatId: string;
  audioData: string; // Data URL or Base64
  duration: number; // Duration in seconds
  waveform: number[]; // Array of 30-50 normalized amplitude points (0.0 to 1.0)
  transcript?: string; // Optional local speech-to-text transcript
  senderId: string;
  senderName: string;
  isSaved?: boolean; // Starred/saved memory
  isMe?: boolean;
  tags?: string[];
  createdAt: number;
  sizeBytes: number;
}

export interface LocalVoiceMemory {
  id: string;
  title: string;
  audioData: string;
  duration: number;
  waveform: number[];
  transcript?: string;
  tags?: string[];
  createdAt: number;
  chatId?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getVaultDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in SSR'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('voice_messages')) {
          const store = db.createObjectStore('voice_messages', { keyPath: 'id' });
          store.createIndex('by_messageId', 'messageId', { unique: false });
          store.createIndex('by_chatId', 'chatId', { unique: false });
          store.createIndex('by_isSaved', 'isSaved', { unique: false });
          store.createIndex('by_createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('voice_memories')) {
          const memStore = db.createObjectStore('voice_memories', { keyPath: 'id' });
          memStore.createIndex('by_createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('voice_drafts')) {
          db.createObjectStore('voice_drafts', { keyPath: 'chatId' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Generate quick normalized amplitude waveform points from an AudioBuffer or synthetic distribution
 */
export async function computeWaveformFromAudio(audioDataUrl: string, sampleCount = 40): Promise<number[]> {
  try {
    if (typeof window === 'undefined') return Array(sampleCount).fill(0.4);
    
    // Fetch blob
    const response = await fetch(audioDataUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return Array(sampleCount).fill(0.4);
    
    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const totalSamples = rawData.length;
    const blockSize = Math.floor(totalSamples / sampleCount);
    const filteredData: number[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(sum / blockSize);
    }

    // Normalize between 0.15 and 1.0
    const maxVal = Math.max(...filteredData, 0.01);
    const normalized = filteredData.map(v => Math.max(0.15, Math.min(1.0, v / maxVal)));
    
    // Close context
    audioCtx.close().catch(() => {});
    return normalized;
  } catch (err) {
    // Fallback pseudo-waveform with rhythmic variance
    return Array.from({ length: sampleCount }, (_, idx) => {
      const base = 0.3 + 0.5 * Math.abs(Math.sin((idx / sampleCount) * Math.PI * 3));
      return Number(Math.max(0.15, Math.min(0.95, base)).toFixed(2));
    });
  }
}

/**
 * Store a voice note permanently in the user's local device IndexedDB vault
 */
export async function saveVoiceNoteToVault(params: {
  messageId: string;
  chatId: string;
  audioData: string;
  duration?: number;
  waveform?: number[];
  transcript?: string;
  senderId: string;
  senderName: string;
  isMe?: boolean;
  isSaved?: boolean;
  tags?: string[];
}): Promise<LocalVoiceNote> {
  const db = await getVaultDB();
  const id = `vault_voice_${params.messageId || Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  // Calculate size in bytes
  const sizeBytes = Math.round((params.audioData.length * 3) / 4);

  // Compute waveform if not provided
  let waveform = params.waveform;
  if (!waveform || waveform.length === 0) {
    waveform = await computeWaveformFromAudio(params.audioData);
  }

  const record: LocalVoiceNote = {
    id,
    messageId: params.messageId,
    chatId: params.chatId,
    audioData: params.audioData,
    duration: params.duration || 0,
    waveform,
    transcript: params.transcript || '',
    senderId: params.senderId,
    senderName: params.senderName,
    isMe: params.isMe || false,
    isSaved: params.isSaved || false,
    tags: params.tags || [],
    createdAt: Date.now(),
    sizeBytes,
  };

  await db.put('voice_messages', record);
  return record;
}

/**
 * Retrieve a voice note by messageId from local vault
 */
export async function getVoiceNoteByMessageId(messageId: string): Promise<LocalVoiceNote | null> {
  try {
    const db = await getVaultDB();
    const tx = db.transaction('voice_messages', 'readonly');
    const index = tx.store.index('by_messageId');
    const note = await index.get(messageId);
    return note || null;
  } catch (e) {
    console.warn('[VoiceVault] Error looking up voice note:', e);
    return null;
  }
}

/**
 * Retrieve all local voice notes for a specific conversation tunnel
 */
export async function getChatVoiceNotes(chatId: string): Promise<LocalVoiceNote[]> {
  try {
    const db = await getVaultDB();
    const tx = db.transaction('voice_messages', 'readonly');
    const index = tx.store.index('by_chatId');
    const notes = await index.getAll(chatId);
    return notes.sort((a, b) => a.createdAt - b.createdAt);
  } catch (e) {
    console.warn('[VoiceVault] Error loading chat voice notes:', e);
    return [];
  }
}

/**
 * Search local voice notes across transcript text and sender names
 */
export async function searchLocalVoiceVault(query: string, chatId?: string): Promise<LocalVoiceNote[]> {
  try {
    const db = await getVaultDB();
    let notes: LocalVoiceNote[] = [];
    if (chatId) {
      const index = db.transaction('voice_messages', 'readonly').store.index('by_chatId');
      notes = await index.getAll(chatId);
    } else {
      notes = await db.getAll('voice_messages');
    }

    const q = query.trim().toLowerCase();
    if (!q) return notes.sort((a, b) => b.createdAt - a.createdAt);

    return notes.filter(n => 
      (n.transcript && n.transcript.toLowerCase().includes(q)) ||
      (n.senderName && n.senderName.toLowerCase().includes(q)) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
    ).sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.warn('[VoiceVault] Search error:', e);
    return [];
  }
}

/**
 * Star or unstar a voice note in the device's local memory vault
 */
export async function toggleSaveVoiceMemory(noteId: string): Promise<boolean> {
  const db = await getVaultDB();
  const tx = db.transaction('voice_messages', 'readwrite');
  const note = await tx.store.get(noteId);
  if (!note) return false;
  
  const newState = !note.isSaved;
  note.isSaved = newState;
  await tx.store.put(note);
  await tx.done;
  return newState;
}

/**
 * Retrieve all starred / saved voice memories
 */
export async function getSavedVoiceMemories(): Promise<LocalVoiceNote[]> {
  try {
    const db = await getVaultDB();
    const all = await db.getAll('voice_messages');
    return all.filter(n => n.isSaved).sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    return [];
  }
}

/**
 * Explicit user action: Export a voice note to the user's OS file system (downloads folder)
 * Only called on explicit user action (button click)
 */
export function exportVoiceNoteToDevice(audioDataUrl: string, fileName?: string) {
  if (typeof window === 'undefined') return;
  const a = document.createElement('a');
  a.href = audioDataUrl;
  a.download = fileName || `flick-voice-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Get device storage stats for the Voice Vault
 */
export async function getVoiceVaultStats(): Promise<{
  totalNotes: number;
  totalSavedMemories: number;
  totalSizeBytes: number;
  totalDurationSeconds: number;
}> {
  try {
    const db = await getVaultDB();
    const all = await db.getAll('voice_messages');
    const totalNotes = all.length;
    const totalSavedMemories = all.filter(n => n.isSaved).length;
    const totalSizeBytes = all.reduce((acc, n) => acc + (n.sizeBytes || 0), 0);
    const totalDurationSeconds = all.reduce((acc, n) => acc + (n.duration || 0), 0);
    return {
      totalNotes,
      totalSavedMemories,
      totalSizeBytes,
      totalDurationSeconds,
    };
  } catch (e) {
    return {
      totalNotes: 0,
      totalSavedMemories: 0,
      totalSizeBytes: 0,
      totalDurationSeconds: 0,
    };
  }
}

/**
 * Clear unsaved temporary voice cache to free up local device space if requested
 */
export async function purgeUnsavedVoiceNotes(keepSavedOnly = true): Promise<number> {
  const db = await getVaultDB();
  const tx = db.transaction('voice_messages', 'readwrite');
  const all = await tx.store.getAll();
  let deletedCount = 0;

  for (const item of all) {
    if (keepSavedOnly && item.isSaved) continue;
    await tx.store.delete(item.id);
    deletedCount++;
  }
  await tx.done;
  return deletedCount;
}

/**
 * Save draft audio for a specific conversation tunnel
 */
export async function saveVoiceDraft(chatId: string, audioData: string, duration: number) {
  const db = await getVaultDB();
  await db.put('voice_drafts', {
    chatId,
    audioData,
    duration,
    recordedAt: Date.now(),
  });
}

/**
 * Get draft audio for a chat
 */
export async function getVoiceDraft(chatId: string): Promise<{ audioData: string; duration: number } | null> {
  try {
    const db = await getVaultDB();
    const draft = await db.get('voice_drafts', chatId);
    return draft || null;
  } catch (e) {
    return null;
  }
}

/**
 * Clear draft audio for a chat
 */
export async function clearVoiceDraft(chatId: string) {
  try {
    const db = await getVaultDB();
    await db.delete('voice_drafts', chatId);
  } catch (e) {
    // Ignore
  }
}
