/**
 * Robust, Web-focused Push Notification Utility for Progressive Web Apps (PWA)
 * Configured for OneSignal Web SDK, standard browser Notification API, and service worker fallbacks.
 */

import { isSoundEnabled } from './sounds';
import { triggerMessageTypeVibration, triggerPatternVibration, MessageType } from './haptics';
import { doc, setDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { deepLinkManager } from './deepLinkManager';
import { PushPayloadSchema } from './schemas';
import { Capacitor } from '@capacitor/core';
import OneSignalPlugin from 'onesignal-cordova-plugin';
import { getBackendUrl } from './bootstrap';

/**
 * Quiet Hours & Priority Senders Configuration Interface
 */
export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string; // e.g. "22:00"
  endTime: string;   // e.g. "07:00"
  allowPrioritySenders: boolean;
}

export function getQuietHoursConfig(): QuietHoursConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, startTime: '22:00', endTime: '07:00', allowPrioritySenders: true };
  }
  return {
    enabled: localStorage.getItem('flick_quiet_hours_enabled') === 'true',
    startTime: localStorage.getItem('flick_quiet_hours_start') || '22:00',
    endTime: localStorage.getItem('flick_quiet_hours_end') || '07:00',
    allowPrioritySenders: localStorage.getItem('flick_quiet_hours_allow_priority') !== 'false'
  };
}

export function setQuietHoursConfig(config: Partial<QuietHoursConfig>): void {
  if (typeof window === 'undefined') return;
  if (config.enabled !== undefined) localStorage.setItem('flick_quiet_hours_enabled', config.enabled ? 'true' : 'false');
  if (config.startTime !== undefined) localStorage.setItem('flick_quiet_hours_start', config.startTime);
  if (config.endTime !== undefined) localStorage.setItem('flick_quiet_hours_end', config.endTime);
  if (config.allowPrioritySenders !== undefined) localStorage.setItem('flick_quiet_hours_allow_priority', config.allowPrioritySenders ? 'true' : 'false');
  window.dispatchEvent(new Event('flick_notifications_updated'));
}

export function isCurrentlyInQuietHours(): boolean {
  const config = getQuietHoursConfig();
  if (!config.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = (config.startTime || '22:00').split(':').map(Number);
  const [endH, endM] = (config.endTime || '07:00').split(':').map(Number);

  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes === endMinutes) return false;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function isPrioritySender(senderUidOrName?: string): boolean {
  if (!senderUidOrName || typeof window === 'undefined') return false;
  try {
    const listRaw = localStorage.getItem('flick_notif_messages_from') || '[]';
    const allowedList: string[] = JSON.parse(listRaw);
    const target = senderUidOrName.toLowerCase();
    return allowedList.some(id => id.toLowerCase() === target);
  } catch {
    return false;
  }
}

export function shouldSuppressNotification(senderId?: string, isUrgentOrPriority?: boolean): { suppress: boolean; reason?: string } {
  if (typeof window === 'undefined') return { suppress: false };

  // Check Silent mode / Do Not Disturb
  const silentMode = localStorage.getItem('flick_notif_silent_mode') === 'true';
  if (silentMode) {
    return { suppress: true, reason: 'Silent Mode (Do Not Disturb) active' };
  }

  const isSenderPriority = !!(isUrgentOrPriority || isPrioritySender(senderId));

  // Check VIP Priority Senders only toggle
  const priorityOnly = localStorage.getItem('flick_notif_priority_chats_only') === 'true';
  if (priorityOnly && !isSenderPriority) {
    return { suppress: true, reason: 'Priority Senders Only setting active (non-priority sender filtered)' };
  }

  // Check Quiet Hours window
  if (isCurrentlyInQuietHours()) {
    const config = getQuietHoursConfig();
    if (config.allowPrioritySenders && isSenderPriority) {
      addPushDebugLog('info', `Quiet Hours active, but notification passed for Priority Sender: ${senderId || 'VIP'}`);
      return { suppress: false };
    }
    return { suppress: true, reason: `Quiet Hours active (${config.startTime} - ${config.endTime})` };
  }

  return { suppress: false };
}

/**
 * Shared log storage interface for the NativePushDebugger / WebPushDebugger utility
 */
export interface PushDebugLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'token' | 'payload';
  message: string;
  data?: any;
}

let pushDebugLogs: PushDebugLog[] = [];
const logCallbacks = new Set<(logs: PushDebugLog[]) => void>();

export function getPushDebugLogs(): PushDebugLog[] {
  return [...pushDebugLogs];
}

export function clearPushDebugLogs() {
  pushDebugLogs = [];
  notifyListeners();
}

export function subscribePushDebugLogs(cb: (logs: PushDebugLog[]) => void) {
  logCallbacks.add(cb);
  cb([...pushDebugLogs]);
  return () => {
    logCallbacks.delete(cb);
  };
}

function notifyListeners() {
  logCallbacks.forEach(cb => {
    try {
      cb([...pushDebugLogs]);
    } catch (e) {
      console.warn('[Push Debugger Listeners] Callback exception:', e);
    }
  });
}

export function addPushDebugLog(type: PushDebugLog['type'], message: string, data?: any) {
  const newLog: PushDebugLog = {
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
    data
  };
  pushDebugLogs = [newLog, ...pushDebugLogs].slice(0, 50); // Keep last 50 entries
  
  const logColor = type === 'error' ? '\x1b[31m' : type === 'success' ? '\x1b[32m' : type === 'token' ? '\x1b[36m' : '\x1b[0m';
  console.log(`%c[PushDebugger] [${type.toUpperCase()}] ${message}`, logColor, data || '');
  
  notifyListeners();
}

/**
 * Validates any push payload against the strict schema
 */
export function validatePushNotificationPayload(payload: any): boolean {
  try {
    PushPayloadSchema.parse(payload);
    addPushDebugLog('success', 'Payload validated successfully against strict schema.', payload);
    return true;
  } catch (err: any) {
    addPushDebugLog('error', `Payload validation failed: ${err.message || String(err)}`, payload);
    return false;
  }
}

/**
 * Dynamically resolves OneSignal from window script injection
 */
async function getOneSignal(): Promise<any> {
  if (Capacitor.isNativePlatform()) {
    return OneSignalPlugin;
  }
  
  if (typeof window === 'undefined') return null;
  
  const uWindow = window as any;
  if (uWindow.plugins?.OneSignal) return uWindow.plugins.OneSignal;
  if (uWindow.OneSignal) return uWindow.OneSignal;

  // Wait up to 5 seconds for defer script load
  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      if (uWindow.plugins?.OneSignal) {
        clearInterval(interval);
        resolve(uWindow.plugins.OneSignal);
      } else if (uWindow.OneSignal) {
        clearInterval(interval);
        resolve(uWindow.OneSignal);
      }
      elapsed += 100;
      if (elapsed >= 5000) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

/**
 * Registers the active authenticated user with OneSignal Web Push SDK.
 * Associated external user ID, saves subscription token state to Firestore.
 */
export async function registerCapacitorPushNotifications(uid: string) {
  const border = '==================================================';
  console.log(`${border}\n[OneSignal Web PWA Register Engine] STARTING HANDSHAKE FOR UID: ${uid}\n${border}`);
  addPushDebugLog('info', 'Connecting to OneSignal Web Push pipeline...', { uid });

  const OneSignal = await getOneSignal();
  if (!OneSignal) {
    console.warn('[OneSignal-Web] SDK failed to load. Operating in local notification mode.');
    addPushDebugLog('error', 'OneSignal Web SDK not available in window context.');
    return;
  }

  try {
    const ONESIGNAL_ID = "453179e9-df43-4411-847b-e1cd7ae1a0f3";
    addPushDebugLog('info', `Initializing OneSignal App ID: ${ONESIGNAL_ID}`);
    
    // 1. Initialize
    if (Capacitor.isNativePlatform()) {
      addPushDebugLog('info', 'Initializing via Cordova Native Plugin (APK/Capacitor)');
      OneSignal.initialize(ONESIGNAL_ID);
    } else {
      addPushDebugLog('info', 'Initializing via Web SDK (PWA / Median)');
      await OneSignal.init({
        appId: ONESIGNAL_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "OneSignalSDKWorker.js",
      });
    }
    addPushDebugLog('success', 'OneSignal SDK initialized.');

    // 2. Associate authenticated User UID
    addPushDebugLog('info', `Establishing external user alignment with UID: ${uid}`);
    await OneSignal.login(uid);
    addPushDebugLog('success', `OneSignal logged-in state completed. External ID mapped.`);

    // 3. Register click handler
    OneSignal.Notifications.addEventListener('click', (event: any) => {
      console.log('[OneSignal-Web] Notification click action observed:', event);
      addPushDebugLog('info', 'Push notification click registered', event);
      
      const data = event.notification?.additionalData;
      if (data) {
        addPushDebugLog('payload', 'Extracted click-through routing parameters', data);
        
        // Dispatch custom global event for backwards-compatibility
        const customEvent = new CustomEvent('fara-flick-deeplink', { detail: data });
        window.dispatchEvent(customEvent);

        // Process routing via deepLinkManager
        const parsed = deepLinkManager.parsePayload(data);
        if (parsed) {
          deepLinkManager.queueDeepLink(parsed);
        }
      }
    });

    // 4. Request browser notification permission proactively
    addPushDebugLog('info', 'Prompting notification permission dialog...');
    const permission = Capacitor.isNativePlatform() 
      ? await OneSignal.Notifications.requestPermission(true)
      : await OneSignal.Notifications.requestPermission();
    addPushDebugLog('success', `Notification permissions result: ${permission}`);

    // 5. Fetch subscription ID and persist to Firestore
    const subscriptionId = typeof OneSignal.User.pushSubscription.getIdAsync === 'function'
      ? await OneSignal.User.pushSubscription.getIdAsync()
      : OneSignal.User.pushSubscription.id;
    if (subscriptionId) {
      addPushDebugLog('success', `Obtained active Web Push subscription ID: ${subscriptionId}`);
      await saveOneSignalTokenToFirestore(uid, subscriptionId);
    } else {
      addPushDebugLog('warning', 'OneSignal registration complete, but subscription ID remains unassigned.');
    }

    // 6. Listen for push subscription shifts to keep Firestore perfectly synchronized
    OneSignal.User.pushSubscription.addEventListener('change', async (event: any) => {
      const newId = event.current.id;
      addPushDebugLog('info', `Subscription shift noticed. New subscriptionId: ${newId || 'NONE'}`);
      if (newId) {
        await saveOneSignalTokenToFirestore(uid, newId);
      }
    });

    console.log(`${border}\n[OneSignal Web PWA Register Engine] PIPELINE SECURED\n${border}`);

  } catch (err: any) {
    console.warn('[OneSignal-Web] Web Push initialization is unavailable in the preview sandbox (this is expected until a Web Push App ID is configured for this domain in OneSignal dashboard). Fallback local notifications are active:', err?.message || JSON.stringify(err));
    addPushDebugLog('warning', `Web Push not fully configured: ${err?.message || JSON.stringify(err)}. Falling back to robust Local Notification engine.`, err);
  }
}

/**
 * Persists the OneSignal subscription ID into Firestore
 */
async function saveOneSignalTokenToFirestore(uid: string, subscriptionId: string) {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      oneSignalId: subscriptionId,
      oneSignalSubscriptionId: subscriptionId,
      oneSignalSubscriptionIds: arrayUnion(subscriptionId),
      platform: 'web',
      lastActive: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    console.log('[OneSignal] Subscription ID successfully persisted in Firestore users collection.');
    addPushDebugLog('success', `Subscription mapped & written to Firestore: ${subscriptionId}`);
  } catch (err: any) {
    console.warn('[OneSignal] Failed to save OneSignal subscription ID to users collection:', err);
    addPushDebugLog('error', `Failed writing subscription token to Firestore: ${err.message}`, err);
  }
}

export function checkNotificationPermission(): 'granted' | 'denied' | 'default' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    return new Promise((resolve) => {
      Notification.requestPermission((p) => resolve(p));
    });
  }
}

/**
 * Standard client-side local notification trigger (works on Web PWA and desktop)
 */
export function showPushNotification(titleOrPayload: string | any, body?: string, icon?: string, tag?: string) {
  let finalTitle = "";
  let finalBody = "";
  let finalIcon = icon;
  let finalTag = tag;
  let payloadToValidate: any = null;

  if (typeof titleOrPayload === 'object' && titleOrPayload !== null) {
    payloadToValidate = {
      senderId: titleOrPayload.senderId || 'direct-api-dispatch',
      content: titleOrPayload.content || titleOrPayload.body || titleOrPayload.message || 'New secure signal received',
      timestamp: titleOrPayload.timestamp || Date.now(),
      title: titleOrPayload.title || "New Flick Dialogue",
      body: titleOrPayload.body || titleOrPayload.content || "",
      icon: titleOrPayload.icon || icon,
      tag: titleOrPayload.tag || tag
    };
    finalTitle = payloadToValidate.title;
    finalBody = payloadToValidate.body;
    finalIcon = payloadToValidate.icon;
    finalTag = payloadToValidate.tag;
  } else {
    finalTitle = titleOrPayload || "New Dialogue";
    finalBody = body || "";
    payloadToValidate = {
      senderId: 'direct-api-dispatch',
      content: finalBody || finalTitle,
      timestamp: Date.now(),
      title: finalTitle,
      body: finalBody,
      icon: finalIcon,
      tag: finalTag
    };
  }

  // Validate payload against strict schema, but NEVER block the notification from showing!
  const isValid = validatePushNotificationPayload(payloadToValidate);
  if (!isValid) {
    console.warn('[Push Service Warning] Payload failed validation schema checks, bypassing strict blocks to ensure receipt.', payloadToValidate);
    addPushDebugLog('warning', 'Push warning: Payload fails strict Zod schema, displaying with fallback logic.', payloadToValidate);
  }

  // Check Quiet Hours & Priority Sender suppression
  const senderId = payloadToValidate?.senderId;
  const isPriority = payloadToValidate?.isPriority || isPrioritySender(senderId);
  const check = shouldSuppressNotification(senderId, isPriority);
  if (check.suppress) {
    addPushDebugLog('warning', `Notification suppressed for "${finalTitle}": ${check.reason}`);
    console.log(`[PWA Notification Suppressed] ${check.reason}`);
    return;
  }

  const fallbackIcon = finalIcon || 'https://api.dicebear.com/7.x/shapes/png?seed=dialogues';
  console.log(`[PWA Local Alert] "${finalTitle}" - "${finalBody}"`);

  // Determine message type for haptic vibration signature
  let msgType: MessageType = 'direct';
  if (finalTag?.includes('group') || finalTitle?.toLowerCase().includes('group')) {
    msgType = 'group';
  } else if (finalTag?.includes('system') || finalTag?.includes('announcement') || finalTitle?.toLowerCase().includes('system') || finalTitle?.toLowerCase().includes('alert')) {
    msgType = 'system';
  }

  // Device physical haptic vibe using customized vibration pattern
  try {
    triggerMessageTypeVibration(msgType);
  } catch (err) {
    // ignore sandbox limit
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const options: NotificationOptions = {
      body: finalBody,
      icon: fallbackIcon,
      tag: finalTag || 'standard-push',
      badge: 'https://api.dicebear.com/7.x/shapes/png?seed=flick-badge',
      silent: !isSoundEnabled(),
    };
    
    const tryConstructNotification = (t: string, opts: NotificationOptions) => {
      try {
        if (typeof Notification !== 'undefined') {
          new Notification(t, opts);
        }
      } catch (e) {
        console.warn('[Push] Direct Notification constructor unavailable on this device/environment:', e);
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          reg.showNotification(finalTitle, options).catch((err) => {
            console.warn("ServiceWorker showNotification failed, trying fallback:", err);
            tryConstructNotification(finalTitle, options);
          });
        } else {
          tryConstructNotification(finalTitle, options);
        }
      }).catch((err) => {
        console.warn("Error checking ServiceWorker, trying standard fallback:", err);
        tryConstructNotification(finalTitle, options);
      });
    } else {
      tryConstructNotification(finalTitle, options);
    }
  } catch (err) {
    console.warn("Failed to generate system push notification safely:", err);
  }
}

/**
 * Dispatch a native push notification to another user via OneSignal's REST API.
 * Employs Express proxy API to shield REST keys completely from the client browser!
 */
export async function sendOneSignalPush(recipientId: string, title: string, body: string, extraData?: any) {
  const label = `[OneSignal Proxy Dispatch] User: ${recipientId}`;
  addPushDebugLog('info', `Routing backend-driven push proxy to: ${recipientId}...`);

  try {
    const userRef = doc(db, 'users', recipientId);
    const userSnap = await getDoc(userRef);
    
    let playerIds: string[] = [];
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.oneSignalSubscriptionId) {
        playerIds.push(userData.oneSignalSubscriptionId);
      }
      if (userData.oneSignalId) {
        playerIds.push(userData.oneSignalId);
      }
      if (userData.oneSignalSubscriptionIds && Array.isArray(userData.oneSignalSubscriptionIds)) {
        playerIds.push(...userData.oneSignalSubscriptionIds);
      }
    }

    // Deduplicate and filter empty
    playerIds = Array.from(new Set(playerIds)).filter(id => typeof id === 'string' && id.trim().length > 0);

    const ONESIGNAL_APP_ID = process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || "453179e9-df43-4411-847b-e1cd7ae1a0f3";
    let channelId = "messages";
    if (extraData && extraData.type) {
      const type = extraData.type;
      if (type === 'message' || type === 'group_message') {
        channelId = "messages";
      } else if (type === 'call') {
        channelId = "calls";
      } else if (type === 'like' || type === 'comment' || type === 'follow' || type === 'mention') {
        channelId = "mentions";
      } else if (type === 'announcement' || type === 'announcements') {
        channelId = "announcements";
      } else if (type === 'update' || type === 'updates') {
        channelId = "updates";
      }
    }

    const payload: any = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: body || "" },
      data: extraData || {},
      priority: 10,                 // High priority: dispatches immediately and wakes up deep-sleeping devices
      ttl: 259200,                  // Time To Live: 3 days in seconds
      android_visibility: 1,        // Public: visible on lock screen
      android_sound: "default",
      ios_sound: "default",
      android_channel_id: channelId,
      small_icon: "ic_stat_flick_logo",
      android_accent_color: "FF39FF14" // Flick Neon Green
    };

    if (extraData && (extraData.senderAvatar || extraData.avatarUrl)) {
      payload.large_icon = extraData.senderAvatar || extraData.avatarUrl;
    } else if (extraData && extraData.senderName) {
      payload.large_icon = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(extraData.senderName)}`;
    }

    if (extraData && extraData.chatId) {
      payload.collapse_id = extraData.chatId;
      payload.android_group = extraData.chatId;
    }

    if (playerIds.length > 0) {
      payload.include_subscription_ids = playerIds;
      payload.include_player_ids = playerIds; // Fallback for older API versions
      addPushDebugLog('info', `Targeting active subscriptions: ${playerIds.join(', ')}`);
    } else {
      payload.include_aliases = { external_id: [recipientId] };
      payload.include_external_user_ids = [recipientId]; // Fallback for older API versions
      payload.target_channel = "push";
      addPushDebugLog('info', `Targeting alias external_id: ${recipientId}`);
    }

    // Call the server API proxy (never expose REST keys on client browser!)
    const baseUrl = getBackendUrl();
    const response = await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`${label} - Proxy response received:`, result);
    
    if (result.errors) {
      addPushDebugLog('warning', `Push warning/errors returned: ${JSON.stringify(result.errors)}`);
      return { success: false, errors: result.errors };
    } else {
      addPushDebugLog('success', `Push proxy successfully completed! ID: ${result.id || 'N/A'}`);
      return { success: true, response: result };
    }
  } catch (err: any) {
    console.warn(`${label} - Failed to send REST request via proxy:`, err);
    addPushDebugLog('error', `Proxy push dispatch failed: ${err.message || String(err)}`);
    return { success: false, error: err };
  }
}

/**
 * Synchronizes client preferences tags with OneSignal context
 */
export async function updateOneSignalUserTags(profile: any) {
  const OneSignal = await getOneSignal();
  if (!OneSignal) return;
  try {
    addPushDebugLog('info', 'Synchronizing preference user tags with OneSignal server context...');
    
    const tags: Record<string, any> = {
      role: profile.role || 'student',
      campus: profile.campus || 'uni',
      department: profile.department || 'cs',
      premium: profile.premium === true ? 'true' : 'false',
      displayName: profile.displayName || ''
    };

    const categories = ['chat', 'mentions', 'follows', 'likes', 'group_message', 'stories', 'announcements', 'emergency_alerts'];
    categories.forEach(cat => {
      tags[`notif_${cat}`] = 'true';
    });

    await OneSignal.User.addTags(tags);
    addPushDebugLog('success', 'OneSignal player tag configuration uploaded successfully.', tags);
  } catch (err: any) {
    console.warn('[OneSignal-Web] Failed to associate user tags:', err?.message || JSON.stringify(err));
    addPushDebugLog('error', `OneSignal tag upload failed: ${err?.message || JSON.stringify(err)}`);
  }
}

/**
 * Clear push notification tokens on logout
 */
export async function logoutPushNotificationsCleanup(uid: string) {
  addPushDebugLog('info', `Cleaning up push subscriptions and event bindings for UID: ${uid}`);
  try {
    const OneSignal = await getOneSignal();
    if (OneSignal) {
      await OneSignal.logout();
      addPushDebugLog('success', 'OneSignal external User mapping scrubbed.');
    }
  } catch (err: any) {
    console.warn('[Push-Web-Cleanup] Error during logout cleanup:', err);
    addPushDebugLog('error', `Scrubbing session exception occurred: ${err.message || String(err)}`);
  }
}
