/**
 * Flick Vault Transfer & Backup Engine
 * 
 * Facilitates:
 * 1. Encrypted File Backup (.flickvault) with AES-256-GCM & PBKDF2 key derivation.
 * 2. Restore / Import of encrypted backups onto any new or existing device.
 * 3. Direct Device-to-Device Transfer over WebRTC DataChannel / Sync PIN.
 * 
 * CORE PRINCIPLE: USER DEVICES OWN THE DATA.
 */

import { getDeviceVaultDB, getDeviceStorageStats } from './deviceStorageEngine';
import { getBackendUrl } from './bootstrap';
import { ICE_SERVERS } from './webrtcService';

export interface VaultBackupPayload {
  version: number;
  exportedAt: number;
  deviceId: string;
  conversations: any[];
  messages: any[];
  mediaBlobs: any[];
  voiceMemories: any[];
  settings: Record<string, any>;
}

// Convert bytes to base64
function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCharCode(x)).join('');
  return btoa(binString);
}

// Convert base64 to bytes
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

/**
 * Derive AES-256 key from a passphrase using PBKDF2
 */
async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export full local device vault to an encrypted .flickvault file
 */
export async function exportEncryptedVault(passphrase: string): Promise<Blob> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Passphrase must be at least 4 characters long.');
  }

  const db = await getDeviceVaultDB();
  const [conversations, messages, mediaBlobs, voiceMemories] = await Promise.all([
    db.getAll('conversations'),
    db.getAll('messages'),
    db.getAll('media_blobs'),
    db.getAll('voice_memories'),
  ]);

  const stats = await getDeviceStorageStats();

  const rawPayload: VaultBackupPayload = {
    version: 2,
    exportedAt: Date.now(),
    deviceId: stats.deviceId,
    conversations,
    messages,
    mediaBlobs,
    voiceMemories,
    settings: {
      theme: localStorage.getItem('flick_theme') || 'dark',
      audioPurge: localStorage.getItem('flick_auto_purge_enabled') || 'false',
    },
  };

  const jsonStr = JSON.stringify(rawPayload);
  const enc = new TextEncoder();
  const dataBytes = enc.encode(jsonStr);

  // Generate 16-byte Salt and 12-byte IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);

  // Package format:
  // [4 bytes: Magic Header "FLKV"]
  // [1 byte: Version 2]
  // [16 bytes: Salt]
  // [12 bytes: IV]
  // [N bytes: Ciphertext]
  const header = new TextEncoder().encode('FLKV');
  const finalFileBytes = new Uint8Array(4 + 1 + 16 + 12 + encryptedBytes.length);
  
  finalFileBytes.set(header, 0);
  finalFileBytes[4] = 2; // version
  finalFileBytes.set(salt, 5);
  finalFileBytes.set(iv, 21);
  finalFileBytes.set(encryptedBytes, 33);

  return new Blob([finalFileBytes], { type: 'application/octet-stream' });
}

/**
 * Trigger file download for exported vault
 */
export function downloadVaultFile(blob: Blob, customName?: string) {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fileName = customName || `flick_encrypted_vault_${dateStr}.flickvault`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Restore an encrypted .flickvault file into the local device database
 */
export async function restoreEncryptedVault(
  fileData: ArrayBuffer,
  passphrase: string,
  mergeStrategy: 'merge' | 'replace' = 'merge'
): Promise<{ restoredConversations: number; restoredMessages: number; restoredBlobs: number }> {
  const fileBytes = new Uint8Array(fileData);

  // Check magic header
  const magic = new TextDecoder().decode(fileBytes.slice(0, 4));
  if (magic !== 'FLKV') {
    throw new Error('Invalid Flick Vault backup format (missing FLKV header).');
  }

  const salt = fileBytes.slice(5, 21);
  const iv = fileBytes.slice(21, 33);
  const ciphertext = fileBytes.slice(33);

  const key = await deriveKeyFromPassphrase(passphrase, salt);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted backup file.');
  }

  const jsonStr = new TextDecoder().decode(decryptedBuffer);
  const payload: VaultBackupPayload = JSON.parse(jsonStr);

  if (!payload.conversations || !payload.messages) {
    throw new Error('Malformed vault data in backup archive.');
  }

  const db = await getDeviceVaultDB();
  const tx = db.transaction(['conversations', 'messages', 'media_blobs', 'voice_memories'], 'readwrite');

  if (mergeStrategy === 'replace') {
    await Promise.all([
      tx.objectStore('conversations').clear(),
      tx.objectStore('messages').clear(),
      tx.objectStore('media_blobs').clear(),
      tx.objectStore('voice_memories').clear(),
    ]);
  }

  // Restore conversations
  for (const c of payload.conversations) {
    await tx.objectStore('conversations').put(c);
  }

  // Restore messages
  for (const m of payload.messages) {
    await tx.objectStore('messages').put(m);
  }

  // Restore media blobs
  if (payload.mediaBlobs) {
    for (const b of payload.mediaBlobs) {
      await tx.objectStore('media_blobs').put(b);
    }
  }

  // Restore voice memories
  if (payload.voiceMemories) {
    for (const v of payload.voiceMemories) {
      await tx.objectStore('voice_memories').put(v);
    }
  }

  await tx.done;

  return {
    restoredConversations: payload.conversations.length,
    restoredMessages: payload.messages.length,
    restoredBlobs: (payload.mediaBlobs?.length || 0) + (payload.voiceMemories?.length || 0),
  };
}

/* ========================================================================= */
/* DEVICE-TO-DEVICE DIRECT P2P TRANSFER (WebRTC DataChannel)                */
/* ========================================================================= */

export interface DeviceSyncSession {
  syncPin: string;
  sessionId: string;
  isSender: boolean;
  status: 'idle' | 'pairing' | 'connected' | 'transferring' | 'completed' | 'failed';
  progressPercent: number;
  peerDeviceName?: string;
  errorMessage?: string;
  close: () => void;
}

/**
 * Generate a 6-character alphanumeric sync code
 */
export function generateSyncPin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

/**
 * Start a Device Vault Sender Session
 */
export async function startDeviceTransferSender(
  syncPin: string,
  passphrase: string,
  onStatusChange: (session: DeviceSyncSession) => void
): Promise<DeviceSyncSession> {
  const sessionId = `transfer_${syncPin}_${Date.now()}`;
  let pc: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let isClosed = false;

  const session: DeviceSyncSession = {
    syncPin,
    sessionId,
    isSender: true,
    status: 'pairing',
    progressPercent: 0,
    close: () => {
      isClosed = true;
      if (dataChannel) dataChannel.close();
      if (pc) pc.close();
    },
  };

  onStatusChange(session);

  try {
    // 1. Prepare the encrypted vault payload
    const vaultBlob = await exportEncryptedVault(passphrase);
    const vaultBuffer = await vaultBlob.arrayBuffer();

    // 2. Initialize WebRTC Peer Connection with DataChannel
    pc = new RTCPeerConnection(ICE_SERVERS);
    dataChannel = pc.createDataChannel('flick_vault_transfer', { ordered: true });
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = async () => {
      session.status = 'transferring';
      onStatusChange(session);

      // Stream data in 64KB chunks
      const CHUNK_SIZE = 64 * 1024;
      const totalBytes = vaultBuffer.byteLength;
      let offset = 0;

      // Send header with total size
      dataChannel?.send(JSON.stringify({ type: 'TRANSFER_HEADER', totalBytes }));

      const sendNextChunk = () => {
        if (isClosed || !dataChannel || dataChannel.readyState !== 'open') return;

        while (dataChannel.bufferedAmount < 1024 * 1024 && offset < totalBytes) {
          const end = Math.min(offset + CHUNK_SIZE, totalBytes);
          const chunk = vaultBuffer.slice(offset, end);
          dataChannel.send(chunk);
          offset = end;

          const pct = Math.round((offset / totalBytes) * 100);
          session.progressPercent = pct;
          onStatusChange(session);
        }

        if (offset < totalBytes) {
          setTimeout(sendNextChunk, 20);
        } else {
          // Send completion signal
          dataChannel.send(JSON.stringify({ type: 'TRANSFER_COMPLETE' }));
          session.status = 'completed';
          session.progressPercent = 100;
          onStatusChange(session);
        }
      };

      sendNextChunk();
    };

    // Register signaling over fast server relay
    const backendUrl = getBackendUrl();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await fetch(`${backendUrl}/api/calls/signal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: `sync_${syncPin}`,
        senderId: 'sender',
        type: 'offer',
        payload: offer,
      }),
    }).catch(console.warn);

    // Poll for answer
    const pollInterval = setInterval(async () => {
      if (isClosed || session.status === 'completed') {
        clearInterval(pollInterval);
        return;
      }

      try {
        const res = await fetch(`${backendUrl}/api/calls/signal/poll?callId=sync_${syncPin}&recipientId=sender`);
        if (res.ok) {
          const data = await res.json();
          if (data.answer && !pc?.currentRemoteDescription) {
            await pc?.setRemoteDescription(new RTCSessionDescription(data.answer));
            session.status = 'connected';
            onStatusChange(session);
          }
        }
      } catch {}
    }, 1200);

  } catch (err: any) {
    session.status = 'failed';
    session.errorMessage = err.message || 'Transfer failed';
    onStatusChange(session);
  }

  return session;
}

/**
 * Start a Device Vault Receiver Session
 */
export async function startDeviceTransferReceiver(
  syncPin: string,
  passphrase: string,
  onStatusChange: (session: DeviceSyncSession) => void
): Promise<DeviceSyncSession> {
  const sessionId = `recv_${syncPin}_${Date.now()}`;
  let pc: RTCPeerConnection | null = null;
  let isClosed = false;

  const session: DeviceSyncSession = {
    syncPin,
    sessionId,
    isSender: false,
    status: 'pairing',
    progressPercent: 0,
    close: () => {
      isClosed = true;
      if (pc) pc.close();
    },
  };

  onStatusChange(session);

  try {
    pc = new RTCPeerConnection(ICE_SERVERS);
    let totalBytesExpected = 0;
    const receivedChunks: ArrayBuffer[] = [];
    let receivedBytes = 0;

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.binaryType = 'arraybuffer';

      channel.onmessage = async (e) => {
        if (typeof e.data === 'string') {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.type === 'TRANSFER_HEADER') {
              totalBytesExpected = parsed.totalBytes;
              session.status = 'transferring';
              onStatusChange(session);
            } else if (parsed.type === 'TRANSFER_COMPLETE') {
              // Assemble chunks and restore
              session.status = 'transferring';
              session.progressPercent = 95;
              onStatusChange(session);

              const combined = new Uint8Array(receivedBytes);
              let offset = 0;
              for (const chunk of receivedChunks) {
                combined.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
              }

              await restoreEncryptedVault(combined.buffer, passphrase, 'merge');
              session.status = 'completed';
              session.progressPercent = 100;
              onStatusChange(session);
            }
          } catch {}
        } else if (e.data instanceof ArrayBuffer) {
          receivedChunks.push(e.data);
          receivedBytes += e.data.byteLength;
          if (totalBytesExpected > 0) {
            session.progressPercent = Math.min(94, Math.round((receivedBytes / totalBytesExpected) * 100));
            onStatusChange(session);
          }
        }
      };
    };

    const backendUrl = getBackendUrl();

    // Poll for sender offer
    let offerHandled = false;
    const pollInterval = setInterval(async () => {
      if (isClosed || offerHandled) return;

      try {
        const res = await fetch(`${backendUrl}/api/calls/signal/poll?callId=sync_${syncPin}&recipientId=receiver`);
        if (res.ok) {
          const data = await res.json();
          if (data.offer && !offerHandled) {
            offerHandled = true;
            clearInterval(pollInterval);

            await pc?.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc?.createAnswer();
            await pc?.setLocalDescription(answer);

            await fetch(`${backendUrl}/api/calls/signal/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callId: `sync_${syncPin}`,
                senderId: 'receiver',
                type: 'answer',
                payload: answer,
              }),
            });

            session.status = 'connected';
            onStatusChange(session);
          }
        }
      } catch {}
    }, 1200);

  } catch (err: any) {
    session.status = 'failed';
    session.errorMessage = err.message || 'Receiver pairing failed';
    onStatusChange(session);
  }

  return session;
}
