/**
 * Real-Time WebRTC Media & Signaling Engine for Voice & Video Calls
 * Supports P2P Voice and Video streaming across Web, Android APK, and Electron Desktop.
 * Uses Dual-Channel Signaling: High-Speed Backend Memory Relay + Firestore Redundancy.
 */

import { db } from './firebase';
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { getBackendUrl } from './bootstrap';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

export interface WebRTCSessionConfig {
  callId: string;
  currentUserId: string;
  peerId: string;
  isCaller: boolean;
  callType: 'voice' | 'video';
  localStream: MediaStream | null;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onError?: (err: any) => void;
}

export interface WebRTCSession {
  peerConnection: RTCPeerConnection;
  remoteStream: MediaStream;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  close: () => void;
}

/**
 * Sends a WebRTC signal (offer, answer, or candidate) via Fast Server Relay and Firestore
 */
export async function sendWebRTCSignal(
  callId: string,
  senderId: string,
  type: 'offer' | 'answer' | 'candidate',
  payload: any
): Promise<void> {
  // 1. Fast Server Relay
  try {
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/api/calls/signal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, senderId, type, payload })
    }).catch(err => {
      console.warn('[WebRTC Relay] Signal send warning:', err);
    });
  } catch (e) {
    // ignore
  }

  // 2. Firestore Document Update for Offer/Answer
  if (db) {
    try {
      const callRef = doc(db, 'calls', callId);
      if (type === 'offer') {
        await updateDoc(callRef, { offer: payload, updatedAt: serverTimestamp() }).catch(console.warn);
      } else if (type === 'answer') {
        await updateDoc(callRef, { answer: payload, updatedAt: serverTimestamp() }).catch(console.warn);
      } else if (type === 'candidate') {
        // Store in subcollection
        const candColl = collection(db, 'calls', callId, 'candidates');
        await addDoc(candColl, {
          senderId,
          candidate: payload,
          createdAt: serverTimestamp()
        }).catch(console.warn);
      }
    } catch (e) {
      console.warn('[WebRTC Firestore] Signal write notice:', e);
    }
  }
}

/**
 * Initializes and manages a full bi-directional WebRTC connection
 */
export function startWebRTCSession(config: WebRTCSessionConfig): WebRTCSession {
  const {
    callId,
    currentUserId,
    isCaller,
    callType,
    localStream,
    onRemoteStream,
    onConnectionStateChange,
    onIceConnectionStateChange,
    onError
  } = config;

  console.log(`[WebRTC Engine] Initializing session for callId=${callId}, isCaller=${isCaller}, type=${callType}`);

  const pc = new RTCPeerConnection(ICE_SERVERS);
  const remoteStream = new MediaStream();
  let isClosed = false;
  let signalPollInterval: any = null;
  let lastSignalTime = 0;
  let unsubscribeFirestoreCandidates: (() => void) | null = null;
  let unsubscribeFirestoreCallDoc: (() => void) | null = null;
  const processedSignalIds = new Set<string>();
  const pendingIceCandidates: RTCIceCandidateInit[] = [];

  // Attach local tracks to peer connection
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      console.log(`[WebRTC Engine] Adding local track: ${track.kind}, id: ${track.id}`);
      pc.addTrack(track, localStream);
    });
  }

  // Receive remote tracks and aggregate into remoteStream
  pc.ontrack = (event) => {
    console.log(`[WebRTC Engine] Remote track received: ${event.track.kind}, id: ${event.track.id}`);
    if (event.streams && event.streams[0]) {
      event.streams[0].getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
    } else {
      if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }
    onRemoteStream(remoteStream);
  };

  // Dispatch local ICE candidates to peer
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendWebRTCSignal(callId, currentUserId, 'candidate', event.candidate.toJSON());
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC Engine] Connection state changed: ${pc.connectionState}`);
    if (onConnectionStateChange) onConnectionStateChange(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[WebRTC Engine] ICE connection state: ${pc.iceConnectionState}`);
    if (onIceConnectionStateChange) onIceConnectionStateChange(pc.iceConnectionState);
  };

  // Helper to add ICE candidate safely (with buffering if remoteDescription is not yet set)
  const addIceCandidateSafe = async (candidateInit: RTCIceCandidateInit) => {
    try {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } else {
        pendingIceCandidates.push(candidateInit);
      }
    } catch (err) {
      console.warn('[WebRTC Engine] ICE candidate error:', err);
    }
  };

  // Helper to flush pending ICE candidates once remoteDescription is set
  const flushPendingIceCandidates = async () => {
    while (pendingIceCandidates.length > 0) {
      const cand = pendingIceCandidates.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC Engine] Flushed ICE candidate error:', e);
        }
      }
    }
  };

  // Process incoming signal (Offer / Answer / Candidate)
  const handleIncomingSignal = async (signal: { id?: string; type: string; payload: any }) => {
    if (isClosed) return;
    if (signal.id && processedSignalIds.has(signal.id)) return;
    if (signal.id) processedSignalIds.add(signal.id);

    try {
      if (signal.type === 'offer' && !isCaller) {
        if (pc.signalingState !== 'stable') {
          console.warn(`[WebRTC Engine] Received offer in signalingState: ${pc.signalingState}, attempting rollback.`);
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' } as any).catch(() => {}),
            pc.setRemoteDescription(new RTCSessionDescription(signal.payload))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        }
        await flushPendingIceCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC Engine] Created and sent SDP answer');
        await sendWebRTCSignal(callId, currentUserId, 'answer', {
          type: answer.type,
          sdp: answer.sdp
        });
      } else if (signal.type === 'answer' && isCaller) {
        if (pc.signalingState === 'have-local-offer') {
          console.log('[WebRTC Engine] Setting remote SDP answer on caller');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          await flushPendingIceCandidates();
        }
      } else if (signal.type === 'candidate') {
        await addIceCandidateSafe(signal.payload);
      }
    } catch (err) {
      console.error('[WebRTC Engine] Handle signal error:', err);
      if (onError) onError(err);
    }
  };

  // Setup Caller Negotiation (Create and Send Offer)
  const setupCaller = async () => {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      await pc.setLocalDescription(offer);
      console.log('[WebRTC Engine] Caller created and sent SDP offer');
      await sendWebRTCSignal(callId, currentUserId, 'offer', {
        type: offer.type,
        sdp: offer.sdp
      });
    } catch (err) {
      console.error('[WebRTC Engine] Caller offer error:', err);
      if (onError) onError(err);
    }
  };

  if (isCaller) {
    setupCaller();
  }

  // Fast Backend Polling for Signals (runs every 600ms for instantaneous exchange)
  const pollBackendSignals = async () => {
    if (isClosed) return;
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/calls/signal/poll/${callId}/${currentUserId}?since=${lastSignalTime}`);
      if (res.ok) {
        const data = await res.json();
        if (data.signals && Array.isArray(data.signals)) {
          for (const s of data.signals) {
            await handleIncomingSignal(s);
          }
        }
        if (data.serverTime) {
          lastSignalTime = Math.max(lastSignalTime, data.serverTime - 1000);
        }
      }
    } catch (e) {
      // ignore transient network poll errors
    }
  };

  signalPollInterval = setInterval(pollBackendSignals, 600);
  pollBackendSignals();

  // Firestore fallback listeners for resilience across firewalls and network environments
  if (db) {
    try {
      const callDocRef = doc(db, 'calls', callId);
      unsubscribeFirestoreCallDoc = onSnapshot(callDocRef, async (snap) => {
        if (!snap.exists() || isClosed) return;
        const data = snap.data();
        if (!isCaller && data.offer && !processedSignalIds.has('fs-offer')) {
          processedSignalIds.add('fs-offer');
          await handleIncomingSignal({ type: 'offer', payload: data.offer });
        }
        if (isCaller && data.answer && !processedSignalIds.has('fs-answer')) {
          processedSignalIds.add('fs-answer');
          await handleIncomingSignal({ type: 'answer', payload: data.answer });
        }
      }, (err) => console.warn('[WebRTC Firestore] Call doc listener notice:', err));

      const candidatesCollRef = collection(db, 'calls', callId, 'candidates');
      unsubscribeFirestoreCandidates = onSnapshot(candidatesCollRef, async (snap) => {
        if (isClosed) return;
        snap.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.senderId !== currentUserId && data.candidate) {
              const sigKey = `fs-cand-${change.doc.id}`;
              if (!processedSignalIds.has(sigKey)) {
                processedSignalIds.add(sigKey);
                await handleIncomingSignal({ type: 'candidate', payload: data.candidate });
              }
            }
          }
        });
      }, (err) => console.warn('[WebRTC Firestore] Candidates listener notice:', err));
    } catch (e) {
      console.warn('[WebRTC Firestore] Setup listeners notice:', e);
    }
  }

  // Toggle Audio Track Mute
  const toggleAudio = (enabled: boolean) => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  };

  // Toggle Video Track
  const toggleVideo = (enabled: boolean) => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  };

  // Teardown WebRTC Session
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    console.log(`[WebRTC Engine] Closing session for callId=${callId}`);

    if (signalPollInterval) {
      clearInterval(signalPollInterval);
      signalPollInterval = null;
    }
    if (unsubscribeFirestoreCallDoc) {
      unsubscribeFirestoreCallDoc();
      unsubscribeFirestoreCallDoc = null;
    }
    if (unsubscribeFirestoreCandidates) {
      unsubscribeFirestoreCandidates();
      unsubscribeFirestoreCandidates = null;
    }

    try {
      pc.getSenders().forEach((sender) => {
        try {
          if (sender.track) sender.track.stop();
        } catch (e) {}
      });
      remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      pc.close();
    } catch (e) {
      console.warn('[WebRTC Engine] Close exception:', e);
    }
  };

  return {
    peerConnection: pc,
    remoteStream,
    toggleAudio,
    toggleVideo,
    close
  };
}
