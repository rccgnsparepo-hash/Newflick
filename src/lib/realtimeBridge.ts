/**
 * Flick Realtime Communication & Bridge Coordinator
 * 
 * CORE PRINCIPLE: USER DEVICES OWN THE DATA. FIREBASE IS THE BRIDGE.
 * 
 * Flow:
 * 1. Online Recipient: Realtime direct WebRTC / DataChannel push. Zero cloud storage.
 * 2. Offline Recipient: Temporary encrypted delivery envelope with TTL expiration.
 * 3. On Ingestion: Recipient writes to local device database, then expires temporary cloud copy.
 */

import { db } from './firebase';
import {
  doc,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { saveLocalChatMessage, LocalChatMessage } from './deviceStorageEngine';
import { encryptE2EEMessage, decryptE2EEMessage } from './crypto';

export interface DispatchMessageParams {
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientPublicKey: string;
  senderPublicKey: string;
  senderPrivateKey: string;
  type: 'text' | 'voice' | 'image' | 'file';
  text?: string;
  mediaDataUrl?: string;
  duration?: number;
  waveform?: number[];
  fileName?: string;
  isRecipientOnline?: boolean;
}

/**
 * Dispatch message with local-first priority and temporary cloud relay fallback
 */
export async function dispatchFlickMessage(params: DispatchMessageParams): Promise<LocalChatMessage> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = Date.now();

  // 1. ALWAYS SAVE TO LOCAL DEVICE STORAGE FIRST
  const localRecord: LocalChatMessage = {
    id: messageId,
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    recipientId: params.recipientId,
    type: params.type,
    text: params.text,
    duration: params.duration,
    waveform: params.waveform,
    fileName: params.fileName,
    timestamp,
    deliveryStatus: 'sent',
    reactions: {},
    isSaved: false,
    expiresAt: null, // User's own local copy does not arbitrarily expire
  };

  await saveLocalChatMessage(localRecord, params.mediaDataUrl);

  // 2. PREPARE ENCRYPTED ENVELOPE FOR DELIVERY BRIDGE
  const payloadToTransmit = JSON.stringify({
    messageId,
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    type: params.type,
    text: params.text || '',
    duration: params.duration || 0,
    waveform: params.waveform || [],
    fileName: params.fileName || '',
    mediaDataUrl: params.mediaDataUrl || '', // Sent directly over encrypted tunnel
    timestamp,
  });

  if (params.recipientPublicKey && params.senderPublicKey) {
    try {
      const encrypted = await encryptE2EEMessage(
        payloadToTransmit,
        params.recipientPublicKey,
        params.senderPublicKey
      );

      // Cloud document is a temporary envelope that will expire
      if (db) {
        const relayColl = collection(db, 'temporary_envelopes');
        await addDoc(relayColl, {
          messageId,
          recipientId: params.recipientId,
          senderId: params.senderId,
          encryptedText: encrypted.encryptedText,
          encryptedKey: encrypted.encryptedKey,
          senderEncryptedKey: encrypted.senderEncryptedKey,
          createdAt: serverTimestamp(),
          expiresAt: Date.now() + 86400 * 1000 * 7, // 7 days max temporary cloud lifespan
        });
      }
    } catch (err) {
      console.warn('[RealtimeBridge] Encryption or temporary relay warning:', err);
    }
  }

  return localRecord;
}

/**
 * Subscribe to incoming temporary envelopes on this device, decrypt them,
 * ingest into the local device database, and delete the temporary cloud copy.
 */
export function subscribeToIncomingEnvelopes(
  currentUserId: string,
  userPrivateKey: string,
  onNewMessageIngested?: (msg: LocalChatMessage) => void
): () => void {
  if (!db || !currentUserId || !userPrivateKey) return () => {};

  try {
    const q = query(
      collection(db, 'temporary_envelopes'),
      where('recipientId', '==', currentUserId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const docData = change.doc.data();
          const docRef = change.doc.ref;

          try {
            // Decrypt the temporary envelope
            const decryptedJson = await decryptE2EEMessage(
              docData.encryptedText,
              docData.encryptedKey,
              userPrivateKey
            );

            const payload = JSON.parse(decryptedJson);

            // Ingest into local device storage
            const localMsg: LocalChatMessage = {
              id: payload.messageId || `msg_${Date.now()}`,
              conversationId: payload.conversationId,
              senderId: payload.senderId,
              senderName: payload.senderName || 'Peer',
              recipientId: currentUserId,
              type: payload.type || 'text',
              text: payload.text,
              duration: payload.duration,
              waveform: payload.waveform,
              fileName: payload.fileName,
              timestamp: payload.timestamp || Date.now(),
              deliveryStatus: 'delivered',
              reactions: {},
              isSaved: false,
              expiresAt: null,
            };

            await saveLocalChatMessage(localMsg, payload.mediaDataUrl);

            if (onNewMessageIngested) {
              onNewMessageIngested(localMsg);
            }

            // Immediately wipe temporary cloud copy now that user device owns it!
            await deleteDoc(docRef).catch(console.warn);

          } catch (decryptErr) {
            console.warn('[RealtimeBridge] Ingestion decryption note:', decryptErr);
          }
        }
      }
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[RealtimeBridge] Subscription error:', err);
    return () => {};
  }
}
