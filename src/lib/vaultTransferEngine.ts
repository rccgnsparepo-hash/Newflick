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
 * Trigger file download or native Android/Capacitor file share for exported vault (.flick)
 */
export async function downloadVaultFile(blob: Blob, customName?: string): Promise<{ method: 'download' | 'share' }> {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fileName = customName || `flick_vault_${dateStr}.flick`;

  // Check if Web Share API with files is supported (Android APK, mobile browsers)
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: 'application/octet-stream' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Flick Storage Vault File',
          text: 'Encrypted .flick backup for multi-device sync and offline recovery.',
          files: [file],
        });
        return { method: 'share' };
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('[VaultShare Warn]', e);
      }
    }
  }

  // Fallback to standard anchor download (Desktop / Web / Electron)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { method: 'download' };
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
  const normalizedPin = syncPin.trim().toUpperCase();
  const sessionId = `transfer_${normalizedPin}_${Date.now()}`;
  let pc: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let isClosed = false;
  let pollInterval: any = null;

  const session: DeviceSyncSession = {
    syncPin: normalizedPin,
    sessionId,
    isSender: true,
    status: 'pairing',
    progressPercent: 10,
    close: () => {
      isClosed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (dataChannel) dataChannel.close();
      if (pc) pc.close();
    },
  };

  onStatusChange(session);

  try {
    // 1. Prepare and export the encrypted vault payload (Zero-Knowledge AES-256-GCM)
    session.progressPercent = 25;
    onStatusChange(session);

    const vaultBlob = await exportEncryptedVault(passphrase);
    const vaultBuffer = await vaultBlob.arrayBuffer();
    const bytes = new Uint8Array(vaultBuffer);
    const payloadBase64 = bytesToBase64(bytes);

    session.progressPercent = 50;
    onStatusChange(session);

    // 2. Stage encrypted ciphertext on the high-speed Zero-Knowledge bridge
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/api/vault/sync/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncPin: normalizedPin,
        payloadBase64,
        totalBytes: bytes.byteLength,
        senderDeviceId: `device_${Date.now()}`
      }),
    });

    session.progressPercent = 75;
    session.status = 'pairing';
    onStatusChange(session);

    // 3. Initialize WebRTC Peer Connection with DataChannel as additional direct pipe
    try {
      pc = new RTCPeerConnection(ICE_SERVERS);
      dataChannel = pc.createDataChannel('flick_vault_transfer', { ordered: true });
      dataChannel.binaryType = 'arraybuffer';

      dataChannel.onopen = async () => {
        session.status = 'transferring';
        session.progressPercent = 85;
        onStatusChange(session);

        const CHUNK_SIZE = 64 * 1024;
        const totalBytes = vaultBuffer.byteLength;
        let offset = 0;

        dataChannel?.send(JSON.stringify({ type: 'TRANSFER_HEADER', totalBytes }));

        const sendNextChunk = () => {
          if (isClosed || !dataChannel || dataChannel.readyState !== 'open') return;

          while (dataChannel.bufferedAmount < 1024 * 1024 && offset < totalBytes) {
            const end = Math.min(offset + CHUNK_SIZE, totalBytes);
            const chunk = vaultBuffer.slice(offset, end);
            dataChannel.send(chunk);
            offset = end;

            const pct = Math.round((offset / totalBytes) * 100);
            session.progressPercent = Math.max(85, pct);
            onStatusChange(session);
          }

          if (offset < totalBytes) {
            setTimeout(sendNextChunk, 20);
          } else {
            dataChannel.send(JSON.stringify({ type: 'TRANSFER_COMPLETE' }));
            session.status = 'completed';
            session.progressPercent = 100;
            onStatusChange(session);
          }
        };

        sendNextChunk();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      fetch(`${backendUrl}/api/calls/signal/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: `sync_${normalizedPin}`,
          senderId: 'sender',
          type: 'offer',
          payload: offer,
        }),
      }).catch(console.warn);
    } catch (webrtcErr) {
      console.warn('[P2P Sync] WebRTC init fallback to instant relay:', webrtcErr);
    }

    // 4. Poll status to detect when peer claims the vault
    pollInterval = setInterval(async () => {
      if (isClosed || session.status === 'completed') {
        clearInterval(pollInterval);
        return;
      }

      try {
        const res = await fetch(`${backendUrl}/api/vault/sync/status/${normalizedPin}`);
        if (res.ok) {
          const data = await res.json();
          // If relay entry is removed or claimed by receiver, mark transfer complete
          if (!data.exists) {
            session.status = 'completed';
            session.progressPercent = 100;
            onStatusChange(session);
            clearInterval(pollInterval);
          }
        }
      } catch {}
    }, 1500);

  } catch (err: any) {
    session.status = 'failed';
    session.errorMessage = err.message || 'Transfer staging failed';
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
  const normalizedPin = syncPin.trim().toUpperCase();
  const sessionId = `recv_${normalizedPin}_${Date.now()}`;
  let pc: RTCPeerConnection | null = null;
  let isClosed = false;
  let pollInterval: any = null;

  const session: DeviceSyncSession = {
    syncPin: normalizedPin,
    sessionId,
    isSender: false,
    status: 'pairing',
    progressPercent: 15,
    close: () => {
      isClosed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (pc) pc.close();
    },
  };

  onStatusChange(session);

  const backendUrl = getBackendUrl();

  // Helper to ingest and restore ciphertext payload
  const ingestPayload = async (payloadBase64: string) => {
    try {
      session.status = 'transferring';
      session.progressPercent = 70;
      onStatusChange(session);

      const bytes = base64ToBytes(payloadBase64);
      const buffer = bytes.buffer;

      session.progressPercent = 85;
      onStatusChange(session);

      await restoreEncryptedVault(buffer, passphrase, 'merge');

      // Clear the temporary bridge
      fetch(`${backendUrl}/api/vault/sync/claim/${normalizedPin}`, { method: 'DELETE' }).catch(() => {});

      session.status = 'completed';
      session.progressPercent = 100;
      onStatusChange(session);

      if (pollInterval) clearInterval(pollInterval);
    } catch (ingestErr: any) {
      session.status = 'failed';
      session.errorMessage = ingestErr.message || 'Failed to decrypt or restore vault';
      onStatusChange(session);
    }
  };

  try {
    // 1. Check if payload is already staged on the bridge
    const directCheckRes = await fetch(`${backendUrl}/api/vault/sync/claim/${normalizedPin}`);
    if (directCheckRes.ok) {
      const data = await directCheckRes.json();
      if (data.payloadBase64) {
        await ingestPayload(data.payloadBase64);
        return session;
      }
    }

    // 2. If not yet staged, begin polling loop (listening for sender to hit dispatch)
    session.status = 'pairing';
    session.progressPercent = 30;
    onStatusChange(session);

    let attempts = 0;
    pollInterval = setInterval(async () => {
      if (isClosed || session.status === 'completed') {
        clearInterval(pollInterval);
        return;
      }

      attempts++;
      if (attempts > 120) { // 2 minutes timeout
        clearInterval(pollInterval);
        session.status = 'failed';
        session.errorMessage = 'Sync pairing timed out. Ensure the code matches on the sending device.';
        onStatusChange(session);
        return;
      }

      try {
        const res = await fetch(`${backendUrl}/api/vault/sync/claim/${normalizedPin}`);
        if (res.ok) {
          const data = await res.json();
          if (data.payloadBase64) {
            clearInterval(pollInterval);
            await ingestPayload(data.payloadBase64);
          }
        }
      } catch (pollErr) {
        console.warn('[P2P Sync] Polling check notice:', pollErr);
      }
    }, 1000);

  } catch (err: any) {
    session.status = 'failed';
    session.errorMessage = err.message || 'Receiver pairing failed';
    onStatusChange(session);
  }

  return session;
}
