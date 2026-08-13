import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserDeviceSession {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'web';
  ipAddress?: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface SecurityEvent {
  id: string;
  userId: string;
  title: string;
  timestamp: string;
  type: 'login' | 'logout' | 'password_change' | 'device_added' | 'device_removed';
  details?: string;
}

export interface UserPrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  onlineStatus: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  typingIndicator: boolean;
  whoCanMessageMe: 'everyone' | 'contacts';
  whoCanCallMe: 'everyone' | 'contacts' | 'nobody';
  whoCanAddToGroups: 'everyone' | 'contacts';
  storyVisibility: 'public' | 'contacts' | 'private';
  profileVisibility: 'public' | 'contacts';
}

const DEFAULT_PRIVACY_SETTINGS: UserPrivacySettings = {
  lastSeen: 'everyone',
  onlineStatus: 'everyone',
  readReceipts: true,
  typingIndicator: true,
  whoCanMessageMe: 'everyone',
  whoCanCallMe: 'everyone',
  whoCanAddToGroups: 'everyone',
  storyVisibility: 'public',
  profileVisibility: 'public'
};

// --- Device Management ---

export function getLocalDeviceId(): string {
  let deviceId = localStorage.getItem('flick_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    localStorage.setItem('flick_device_id', deviceId);
  }
  return deviceId;
}

export function detectDeviceName(): { name: string; type: 'desktop' | 'mobile' | 'web' } {
  if (typeof window === 'undefined') {
    return { name: 'Unknown Device', type: 'web' };
  }
  const ua = navigator.userAgent || '';
  let name = 'Web Browser';
  let type: 'desktop' | 'mobile' | 'web' = 'web';

  if ((window as any).electronAPI || ua.includes('Electron')) {
    name = 'Flick Desktop App';
    type = 'desktop';
  } else if (/Android/i.test(ua)) {
    name = 'Android Device';
    type = 'mobile';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    name = 'iOS Device';
    type = 'mobile';
  } else if (/Windows/i.test(ua)) {
    name = 'Windows PC Browser';
    type = 'web';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    name = 'Mac Workstation';
    type = 'web';
  } else if (/Linux/i.test(ua)) {
    name = 'Linux Workstation';
    type = 'web';
  }

  return { name, type };
}

export async function registerCurrentDevice(userId: string): Promise<void> {
  if (!userId) return;
  const deviceId = getLocalDeviceId();
  const { name, type } = detectDeviceName();

  const deviceData: UserDeviceSession = {
    id: deviceId,
    userId,
    deviceName: name,
    deviceType: type,
    lastActive: new Date().toISOString(),
    isCurrent: true
  };

  // Local storage cache
  try {
    const existingSessions = JSON.parse(localStorage.getItem(`flick_sessions_${userId}`) || '[]');
    const updated = existingSessions.filter((s: UserDeviceSession) => s.id !== deviceId);
    updated.unshift(deviceData);
    localStorage.setItem(`flick_sessions_${userId}`, JSON.stringify(updated));
  } catch {
    // ignore local storage errors
  }

  // Firestore write if available
  try {
    await setDoc(doc(db, 'user_devices', `${userId}_${deviceId}`), {
      ...deviceData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch {
    // Offline mode
  }
}

export async function getUserDeviceSessions(userId: string): Promise<UserDeviceSession[]> {
  if (!userId) return [];
  const currentDeviceId = getLocalDeviceId();

  try {
    const q = query(collection(db, 'user_devices'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docs = snap.docs.map(d => {
        const data = d.data() as UserDeviceSession;
        return {
          ...data,
          isCurrent: data.id === currentDeviceId
        };
      });
      localStorage.setItem(`flick_sessions_${userId}`, JSON.stringify(docs));
      return docs;
    }
  } catch {
    // Fall back to local sessions
  }

  try {
    const cached = JSON.parse(localStorage.getItem(`flick_sessions_${userId}`) || '[]');
    if (cached.length > 0) {
      return cached.map((s: UserDeviceSession) => ({
        ...s,
        isCurrent: s.id === currentDeviceId
      }));
    }
  } catch {
    // ignore
  }

  // Fallback default
  const { name, type } = detectDeviceName();
  return [{
    id: currentDeviceId,
    userId,
    deviceName: name,
    deviceType: type,
    lastActive: 'Active now',
    isCurrent: true
  }];
}

export async function logoutDeviceSession(userId: string, targetDeviceId: string): Promise<void> {
  if (!userId || !targetDeviceId) return;

  try {
    await deleteDoc(doc(db, 'user_devices', `${userId}_${targetDeviceId}`));
  } catch {
    // ignore offline
  }

  try {
    const cached = JSON.parse(localStorage.getItem(`flick_sessions_${userId}`) || '[]');
    const updated = cached.filter((s: UserDeviceSession) => s.id !== targetDeviceId);
    localStorage.setItem(`flick_sessions_${userId}`, JSON.stringify(updated));
  } catch {
    // ignore
  }

  await logSecurityEvent(userId, 'device_removed', 'Logged out a registered device session');
}

export async function logoutAllOtherDevices(userId: string): Promise<void> {
  if (!userId) return;
  const currentDeviceId = getLocalDeviceId();

  const sessions = await getUserDeviceSessions(userId);
  for (const s of sessions) {
    if (s.id !== currentDeviceId) {
      await logoutDeviceSession(userId, s.id);
    }
  }

  await logSecurityEvent(userId, 'logout', 'Logged out all other active device sessions');
}

// --- Security History Events ---

export async function logSecurityEvent(
  userId: string,
  type: 'login' | 'logout' | 'password_change' | 'device_added' | 'device_removed',
  details?: string
): Promise<void> {
  if (!userId) return;

  const titles: Record<string, string> = {
    login: 'New device signed in',
    logout: 'Device signed out',
    password_change: 'Security key or password updated',
    device_added: 'New device registered',
    device_removed: 'Session revoked'
  };

  const event: SecurityEvent = {
    id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    userId,
    title: titles[type] || 'Security activity logged',
    timestamp: new Date().toISOString(),
    type,
    details
  };

  try {
    const existing = JSON.parse(localStorage.getItem(`flick_sec_events_${userId}`) || '[]');
    existing.unshift(event);
    localStorage.setItem(`flick_sec_events_${userId}`, JSON.stringify(existing.slice(0, 20)));
  } catch {
    // ignore
  }

  try {
    await setDoc(doc(db, 'security_logs', event.id), {
      ...event,
      createdAt: serverTimestamp()
    });
  } catch {
    // ignore offline
  }
}

export async function getSecurityEvents(userId: string): Promise<SecurityEvent[]> {
  if (!userId) return [];

  try {
    const q = query(
      collection(db, 'security_logs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => d.data() as SecurityEvent);
    }
  } catch {
    // Fallback to local logs
  }

  try {
    return JSON.parse(localStorage.getItem(`flick_sec_events_${userId}`) || '[]');
  } catch {
    return [];
  }
}

// --- Unified Privacy Settings ---

export function getSavedPrivacySettings(userId: string): UserPrivacySettings {
  try {
    const saved = localStorage.getItem(`flick_privacy_${userId}`);
    if (saved) {
      return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PRIVACY_SETTINGS;
}

export async function savePrivacySettings(userId: string, settings: UserPrivacySettings): Promise<void> {
  if (!userId) return;
  try {
    localStorage.setItem(`flick_privacy_${userId}`, JSON.stringify(settings));
    await setDoc(doc(db, 'users', userId), { privacySettings: settings }, { merge: true });
  } catch {
    // offline state preserved
  }
}
