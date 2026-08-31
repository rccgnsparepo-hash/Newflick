/**
 * Flick Multi-Device Account Sync Lock & Authorization Protocol
 * 
 * Telegram & WhatsApp-style multi-device pairing and authorization architecture:
 * 1. When a user signs in to a new/unregistered device, the system detects other active devices.
 * 2. If Account Sync Lock is enabled (or other active devices exist), the new device is held in verification.
 * 3. A 6-digit verification code & pairing handshake request is created and broadcast to the active devices.
 * 4. Active devices display an instant interactive Authorization & Vault Transfer modal.
 * 5. On approval (or code entry), the active device exports its encrypted E2EE keypairs and IndexedDB vault
 *    and transmits them through the zero-knowledge sync relay.
 * 6. The new device ingests the keys and chat history, unlocks, and registers as an authorized device.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { getLocalDeviceId, detectDeviceName, getUserDeviceSessions, UserDeviceSession, logSecurityEvent, registerCurrentDevice } from './securityService';
import { exportEncryptedVault, restoreEncryptedVault, generateSyncPin } from './vaultTransferEngine';
import { getBackendUrl } from './bootstrap';
import { decryptSymmetrically, encryptSymmetrically } from './crypto';

export interface DeviceAuthRequest {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'web';
  verificationCode: string;
  syncPin: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  approvedByDeviceId?: string;
  approvedByDeviceName?: string;
  extraPayload?: {
    encryptedPrivateKeyBundle?: string;
  };
}

// Generate random 6-digit verification code
export function generateVerificationCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

// Check if Account Sync Lock is enabled for the user
export function isAccountSyncLockEnabled(userId: string): boolean {
  if (!userId) return true; // Default to secure mode
  const localSetting = localStorage.getItem(`flick_sync_lock_${userId}`);
  if (localSetting !== null) {
    return localSetting === 'true';
  }
  return true; // Enabled by default for maximum zero-knowledge privacy
}

export async function setAccountSyncLockEnabled(userId: string, enabled: boolean): Promise<void> {
  if (!userId) return;
  localStorage.setItem(`flick_sync_lock_${userId}`, enabled ? 'true' : 'false');
  try {
    if (db) {
      await updateDoc(doc(db, 'users', userId), {
        accountSyncLock: enabled,
        updatedAt: serverTimestamp()
      });
    }
  } catch {
    // offline graceful fallback
  }
}

// Query other active device sessions registered for this user
export async function getOtherActiveDevices(userId: string): Promise<UserDeviceSession[]> {
  if (!userId) return [];
  const currentDeviceId = getLocalDeviceId();
  try {
    const allSessions = await getUserDeviceSessions(userId);
    return allSessions.filter(s => s.id !== currentDeviceId);
  } catch (err) {
    console.warn('[DeviceAuthSync] Error getting other devices:', err);
    return [];
  }
}

// Create a new device login authorization request
export async function createDeviceAuthRequest(userId: string): Promise<DeviceAuthRequest> {
  const deviceId = getLocalDeviceId();
  const { name, type } = detectDeviceName();
  const verificationCode = generateVerificationCode();
  const syncPin = generateSyncPin();
  const requestId = `auth_${userId}_${deviceId}_${Date.now()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minute valid window

  const requestData: DeviceAuthRequest = {
    id: requestId,
    userId,
    deviceId,
    deviceName: name,
    deviceType: type,
    verificationCode,
    syncPin,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt
  };

  // Cache locally
  try {
    localStorage.setItem(`flick_active_device_auth_req_${userId}`, JSON.stringify(requestData));
  } catch {}

  // Write to Firestore
  try {
    if (db) {
      await setDoc(doc(db, 'device_authorizations', requestId), {
        ...requestData,
        serverCreatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('[DeviceAuthSync] Failed to publish auth request to Firestore:', err);
  }

  // Also stage in temporary relay bridge for universal cross-platform delivery
  try {
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/api/vault/sync/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncPin: `auth_${syncPin}`,
        payloadBase64: btoa(JSON.stringify(requestData)),
        totalBytes: 256,
        senderDeviceId: deviceId
      })
    }).catch(() => {});
  } catch {}

  return requestData;
}

// Active devices: listen for incoming pending device authorization requests
export function listenForPendingDeviceAuthRequests(
  userId: string,
  onNewRequest: (req: DeviceAuthRequest) => void
): () => void {
  if (!userId || !db) return () => {};

  const currentDeviceId = getLocalDeviceId();
  const seenIds = new Set<string>();

  try {
    const q = query(
      collection(db, 'device_authorizations'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data() as DeviceAuthRequest;
          // Only prompt if it's from another device and not expired
          if (data && data.deviceId !== currentDeviceId && data.status === 'pending') {
            const isExpired = new Date(data.expiresAt).getTime() < Date.now();
            if (!isExpired && !seenIds.has(data.id)) {
              seenIds.add(data.id);
              onNewRequest(data);
            }
          }
        }
      });
    }, (err) => {
      console.warn('[DeviceAuthSync] listenForPendingDeviceAuthRequests warning:', err);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[DeviceAuthSync] Failed to bind auth listener:', err);
    return () => {};
  }
}

// Active device approves the request and transfers the encrypted vault + keypair
export async function approveDeviceAuthRequest(
  request: DeviceAuthRequest,
  privateKeyJwk: string | null,
  globalPassword?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentDeviceId = getLocalDeviceId();
    const { name } = detectDeviceName();

    // 1. Export local IndexedDB vault encrypted with the 6-digit verification code
    let vaultBase64 = '';
    try {
      const vaultBlob = await exportEncryptedVault(request.verificationCode);
      const vaultBuffer = await vaultBlob.arrayBuffer();
      const bytes = new Uint8Array(vaultBuffer);
      const binString = Array.from(bytes, (x) => String.fromCharCode(x)).join('');
      vaultBase64 = btoa(binString);
    } catch (vaultErr) {
      console.warn('[DeviceAuthSync] Vault export notice:', vaultErr);
    }

    // 2. Encrypt the E2EE private key and Master Global Password with the 6-digit code
    let encryptedKeyBundle = '';
    if (privateKeyJwk) {
      const keyBundle = {
        privateKeyJwk,
        globalPassword: globalPassword || localStorage.getItem(`e2ee_global_password_${request.userId}`) || '',
        exportedAt: Date.now()
      };
      encryptedKeyBundle = await encryptSymmetrically(JSON.stringify(keyBundle), request.verificationCode);
    }

    // 3. Stage full payload onto the zero-knowledge vault relay bridge
    const backendUrl = getBackendUrl();
    const syncPayload = {
      vaultBase64,
      encryptedKeyBundle,
      approvedByDeviceId: currentDeviceId,
      approvedByDeviceName: name,
      approvedAt: Date.now()
    };

    const payloadString = JSON.stringify(syncPayload);
    const enc = new TextEncoder().encode(payloadString);
    const binString = Array.from(enc, (x) => String.fromCharCode(x)).join('');
    const fullPayloadBase64 = btoa(binString);

    await fetch(`${backendUrl}/api/vault/sync/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncPin: request.syncPin,
        payloadBase64: fullPayloadBase64,
        totalBytes: enc.byteLength,
        senderDeviceId: currentDeviceId
      })
    });

    // 4. Update Firestore authorization document status
    if (db) {
      await updateDoc(doc(db, 'device_authorizations', request.id), {
        status: 'approved',
        approvedByDeviceId: currentDeviceId,
        approvedByDeviceName: name,
        approvedAt: serverTimestamp()
      });
    }

    // 5. Log security audit event
    await logSecurityEvent(
      request.userId,
      'device_added',
      `Approved new device session: ${request.deviceName} (${request.deviceType})`
    );

    return { success: true };
  } catch (err: any) {
    console.error('[DeviceAuthSync] approveDeviceAuthRequest error:', err);
    return { success: false, error: err.message || 'Failed to authorize and transfer data' };
  }
}

// Active device rejects the request
export async function rejectDeviceAuthRequest(
  request: DeviceAuthRequest
): Promise<void> {
  const currentDeviceId = getLocalDeviceId();
  try {
    if (db) {
      await updateDoc(doc(db, 'device_authorizations', request.id), {
        status: 'rejected',
        rejectedByDeviceId: currentDeviceId,
        rejectedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('[DeviceAuthSync] reject error:', err);
  }

  await logSecurityEvent(
    request.userId,
    'device_removed',
    `Rejected unauthorized login request from ${request.deviceName}`
  );
}

// New device: listen for real-time approval status on its pending request
export function listenForDeviceAuthApproval(
  requestId: string,
  onStatus: (status: 'pending' | 'approved' | 'rejected' | 'expired', data?: any) => void
): () => void {
  if (!requestId || !db) return () => {};

  try {
    const unsubscribe = onSnapshot(doc(db, 'device_authorizations', requestId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DeviceAuthRequest;
        if (data.status === 'approved') {
          onStatus('approved', data);
        } else if (data.status === 'rejected') {
          onStatus('rejected', data);
        } else if (data.status === 'expired' || new Date(data.expiresAt).getTime() < Date.now()) {
          onStatus('expired', data);
        } else {
          onStatus('pending', data);
        }
      }
    }, (err) => {
      console.warn('[DeviceAuthSync] listenForDeviceAuthApproval warning:', err);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[DeviceAuthSync] Failed to subscribe to request status:', err);
    return () => {};
  }
}

// New device: Claim and ingest the approved encrypted vault and keypair
export async function claimAndRestoreVaultFromApproval(
  request: DeviceAuthRequest,
  inputCode?: string
): Promise<{
  restoredConversations: number;
  restoredMessages: number;
  privateKeyRestored: boolean;
  globalPasswordRestored: boolean;
}> {
  const codeToUse = (inputCode || request.verificationCode).trim();
  const backendUrl = getBackendUrl();

  // 1. Fetch the staged encrypted payload from the bridge
  const res = await fetch(`${backendUrl}/api/vault/sync/claim/${request.syncPin}`);
  if (!res.ok) {
    throw new Error('Vault transfer payload not ready or expired on the secure relay.');
  }

  const data = await res.json();
  if (!data.payloadBase64) {
    throw new Error('Empty payload returned from secure relay.');
  }

  // 2. Decode the outer JSON bundle
  const binStr = atob(data.payloadBase64);
  const bytes = Uint8Array.from(binStr, m => m.charCodeAt(0));
  const jsonStr = new TextDecoder().decode(bytes);
  const syncPayload = JSON.parse(jsonStr);

  let privateKeyRestored = false;
  let globalPasswordRestored = false;

  // 3. Decrypt and restore E2EE Keypair
  if (syncPayload.encryptedKeyBundle) {
    try {
      const decryptedKeyJson = await decryptSymmetrically(syncPayload.encryptedKeyBundle, codeToUse);
      const keyBundle = JSON.parse(decryptedKeyJson);

      if (keyBundle.privateKeyJwk) {
        localStorage.setItem(`e2ee_private_${request.userId}`, keyBundle.privateKeyJwk);
        localStorage.setItem('flick_cached_private_key', keyBundle.privateKeyJwk);
        privateKeyRestored = true;
      }

      if (keyBundle.globalPassword) {
        localStorage.setItem(`e2ee_global_password_${request.userId}`, keyBundle.globalPassword);
        globalPasswordRestored = true;
      }
    } catch (keyErr) {
      console.warn('[DeviceAuthSync] Key bundle decryption error:', keyErr);
    }
  }

  // 4. Decrypt and restore IndexedDB Vault (chats, voice notes, media)
  let restoredConversations = 0;
  let restoredMessages = 0;

  if (syncPayload.vaultBase64) {
    try {
      const vaultBin = atob(syncPayload.vaultBase64);
      const vaultBytes = Uint8Array.from(vaultBin, m => m.charCodeAt(0));
      const result = await restoreEncryptedVault(vaultBytes.buffer, codeToUse, 'merge');
      restoredConversations = result.restoredConversations;
      restoredMessages = result.restoredMessages;
    } catch (vaultErr) {
      console.warn('[DeviceAuthSync] Vault restore notice:', vaultErr);
    }
  }

  // 5. Register this device in the authorized device list
  await registerCurrentDevice(request.userId);

  // 6. Clean up temporary bridge
  fetch(`${backendUrl}/api/vault/sync/claim/${request.syncPin}`, { method: 'DELETE' }).catch(() => {});

  // 7. Clean up local request cache
  try {
    localStorage.removeItem(`flick_active_device_auth_req_${request.userId}`);
  } catch {}

  return {
    restoredConversations,
    restoredMessages,
    privateKeyRestored,
    globalPasswordRestored
  };
}

// Fallback: Unlock device with Master Global Key Password or Passphrase
export async function unlockWithMasterKeyPassword(
  userId: string,
  masterPassword: string,
  encryptedPrivateKey?: string
): Promise<boolean> {
  if (!userId || !masterPassword) return false;

  try {
    const trimmedPass = masterPassword.trim();
    let encPriv = encryptedPrivateKey;

    if (!encPriv && db) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        encPriv = userDoc.data().encryptedPrivateKey;
      }
    }

    if (!encPriv) {
      return false;
    }

    const decryptedPriv = await decryptSymmetrically(encPriv, trimmedPass);
    if (decryptedPriv && decryptedPriv.length > 20) {
      localStorage.setItem(`e2ee_private_${userId}`, decryptedPriv);
      localStorage.setItem('flick_cached_private_key', decryptedPriv);
      localStorage.setItem(`e2ee_global_password_${userId}`, trimmedPass);
      await registerCurrentDevice(userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[DeviceAuthSync] unlockWithMasterKeyPassword failed:', err);
    return false;
  }
}
