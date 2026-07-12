import { ref, onValue, onDisconnect, set, serverTimestamp, remove } from 'firebase/database';
import { rtdb } from './firebase';

export interface PresenceInfo {
  state: 'online' | 'offline';
  lastChanged: any;
  displayName?: string;
  photoURL?: string;
  email?: string;
}

/**
 * Monitors connection status to Firebase RTDB and registers presence
 */
export function trackUserPresence(
  uid: string,
  displayName: string,
  photoURL: string,
  email: string,
  onConnectedStatus?: (isOnline: boolean) => void
) {
  if (!rtdb) {
    return () => {};
  }
  const connectedRef = ref(rtdb, '.info/connected');
  const userStatusRef = ref(rtdb, `status/${uid}`);

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === true) {
      // Configure onDisconnect: set status to offline when disconnection triggers
      const disconnectRef = onDisconnect(userStatusRef);
      await disconnectRef.set({
        state: 'offline',
        lastChanged: serverTimestamp(),
        displayName,
        photoURL,
        email,
        uid
      }).catch(err => console.warn("RTDB disconnect error", err));

      // Write active session online status
      await set(userStatusRef, {
        state: 'online',
        lastChanged: serverTimestamp(),
        displayName,
        photoURL,
        email,
        uid
      }).catch(err => console.warn("RTDB set error", err));

      if (onConnectedStatus) {
        onConnectedStatus(true);
      }
    } else {
      if (onConnectedStatus) {
        onConnectedStatus(false);
      }
    }
  });

  return () => {
    unsubscribe();
    // Best-effort set offline on unmount/manual trigger
    set(userStatusRef, {
      state: 'offline',
      lastChanged: serverTimestamp(),
      displayName,
      photoURL,
      email,
      uid
    }).catch(err => console.warn("RTDB set error", err));
  };
}

/**
 * Subscribes to the status of all discovered peers
 */
export function subscribeToPeersStatus(
  callback: (statusMap: Record<string, PresenceInfo>) => void
) {
  if (!rtdb) {
    return () => {};
  }
  const statusRef = ref(rtdb, 'status');
  const unsubscribe = onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    callback(data || {});
  }, (err) => {
    console.warn("RTDB Status subscription failed or permission issue:", err);
  });
  return unsubscribe;
}

/**
 * Updates whether a specific user is typing in a specific chat session
 */
export function setTypingStatus(chatId: string, uid: string, isTyping: boolean) {
  if (!rtdb) return;
  const typingRef = ref(rtdb, `typing/${chatId}/${uid}`);
  if (isTyping) {
    set(typingRef, true).catch(() => {});
  } else {
    remove(typingRef).catch(() => {});
  }
}

/**
 * Subscribes to typing notifications inside a specific chat session
 */
export function subscribeToTypingStatus(
  chatId: string,
  callback: (typingMap: Record<string, boolean>) => void
) {
  if (!rtdb) {
    return () => {};
  }
  const typingRef = ref(rtdb, `typing/${chatId}`);
  const unsubscribe = onValue(typingRef, (snapshot) => {
    const data = snapshot.val();
    callback(data || {});
  }, (err) => {
    console.warn("Typing subscription rejected/permission limit:", err);
  });
  return unsubscribe;
}
