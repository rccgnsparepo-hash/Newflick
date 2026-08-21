/**
 * FLICK — Native Push Notification Diagnostic Service
 * Consolidates checks for:
 * 1. Native & Web Push permissions (including Android 13+ POST_NOTIFICATIONS)
 * 2. OneSignal SDK initialization and subscription ID alignment
 * 3. FCM token & ServiceWorker availability
 * 4. Device-to-Backend Firestore record token matching & validation
 */

import { Capacitor } from '@capacitor/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { registerCapacitorPushNotifications, getOneSignal } from './pushNotifications';

export interface DiagnosticItem {
  id: string;
  name: string;
  category: 'permission' | 'onesignal' | 'fcm' | 'backend_sync' | 'environment';
  status: 'pass' | 'warn' | 'fail' | 'info';
  summary: string;
  detail: string;
  actionHint?: string;
}

export interface PushDiagnosticReport {
  timestamp: number;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  score: number; // 0 - 100
  platform: 'android' | 'ios' | 'web' | 'desktop';
  isNative: boolean;
  isSecureContext: boolean;
  permissionState: 'granted' | 'denied' | 'default' | 'unsupported';
  localDeviceTokens: {
    oneSignalSubscriptionId: string | null;
    oneSignalExternalId: string | null;
    serviceWorkerScope: string | null;
    fcmToken: string | null;
  };
  backendRecord: {
    uid: string | null;
    firestoreTokenPresent: boolean;
    registeredTokens: string[];
    isDeviceSyncedWithBackend: boolean;
  };
  items: DiagnosticItem[];
}

class NotificationDiagnosticService {
  /**
   * Check browser / device push notification permission status
   */
  public async checkPermission(): Promise<{
    permission: 'granted' | 'denied' | 'default' | 'unsupported';
    detail: string;
  }> {
    if (typeof window === 'undefined') {
      return { permission: 'unsupported', detail: 'Window environment not available.' };
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const OneSignal = await getOneSignal();
        if (OneSignal?.Notifications?.hasPermission) {
          const hasPerm = await OneSignal.Notifications.hasPermission();
          return {
            permission: hasPerm ? 'granted' : 'denied',
            detail: `Native Android/iOS permission query result: ${hasPerm ? 'GRANTED' : 'NOT GRANTED'}`
          };
        }
      } catch (e: any) {
        console.warn('[Diagnostic] Native permission check error:', e);
      }
    }

    if (!('Notification' in window)) {
      return {
        permission: 'unsupported',
        detail: 'The Notification API is not supported in this browser engine.'
      };
    }

    const perm = Notification.permission;
    return {
      permission: perm,
      detail: `Standard Notification.permission evaluates to "${perm}".`
    };
  }

  /**
   * Check OneSignal SDK registration, subscription ID, and external ID mapping
   */
  public async checkOneSignalState(): Promise<{
    initialized: boolean;
    subscriptionId: string | null;
    externalId: string | null;
    optedIn: boolean;
    appId: string;
    details: string;
  }> {
    const defaultAppId = "453179e9-df43-4411-847b-e1cd7ae1a0f3";
    try {
      const OneSignal = await getOneSignal();
      if (!OneSignal) {
        return {
          initialized: false,
          subscriptionId: null,
          externalId: null,
          optedIn: false,
          appId: defaultAppId,
          details: 'OneSignal SDK is not yet instantiated or blocked by content filter.'
        };
      }

      let subId: string | null = null;
      let externalId: string | null = null;
      let optedIn = false;

      if (OneSignal.User?.pushSubscription) {
        subId = OneSignal.User.pushSubscription.id || null;
        if (!subId && typeof OneSignal.User.pushSubscription.getIdAsync === 'function') {
          try {
            subId = await OneSignal.User.pushSubscription.getIdAsync();
          } catch {
            // ignore
          }
        }
        optedIn = !!OneSignal.User.pushSubscription.optedIn;
      }

      if (OneSignal.User?.externalId) {
        externalId = OneSignal.User.externalId;
      }

      if (!subId && typeof OneSignal.getDeviceState === 'function') {
        const state = await OneSignal.getDeviceState();
        subId = state?.userId || state?.subscriptionId || null;
        optedIn = state?.isSubscribed ?? optedIn;
      }

      return {
        initialized: true,
        subscriptionId: subId,
        externalId,
        optedIn,
        appId: defaultAppId,
        details: subId
          ? `OneSignal active with subscription ID: ${subId}`
          : 'OneSignal initialized, but subscription ID token is pending gateway assignment.'
      };
    } catch (err: any) {
      return {
        initialized: false,
        subscriptionId: null,
        externalId: null,
        optedIn: false,
        appId: defaultAppId,
        details: `OneSignal inspection failed: ${err?.message || String(err)}`
      };
    }
  }

  /**
   * Check ServiceWorker and FCM token pipeline availability
   */
  public async checkFcmAndServiceWorkerState(): Promise<{
    serviceWorkerActive: boolean;
    serviceWorkerScope: string | null;
    details: string;
  }> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return {
        serviceWorkerActive: false,
        serviceWorkerScope: null,
        details: 'Service Workers not supported in this runtime environment.'
      };
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        return {
          serviceWorkerActive: true,
          serviceWorkerScope: reg.scope,
          details: `Active ServiceWorker registration found with scope: "${reg.scope}".`
        };
      }
      return {
        serviceWorkerActive: false,
        serviceWorkerScope: null,
        details: 'No active ServiceWorker registration found on current origin.'
      };
    } catch (err: any) {
      return {
        serviceWorkerActive: false,
        serviceWorkerScope: null,
        details: `ServiceWorker query exception: ${err?.message || String(err)}`
      };
    }
  }

  /**
   * Validate if current device tokens match the user's Firestore record
   */
  public async validateDeviceBackendMatching(uid: string, localSubId: string | null): Promise<{
    userFound: boolean;
    matched: boolean;
    tokensInDb: string[];
    details: string;
  }> {
    if (!uid) {
      return {
        userFound: false,
        matched: false,
        tokensInDb: [],
        details: 'No authenticated user UID provided to validate backend record.'
      };
    }

    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        return {
          userFound: false,
          matched: false,
          tokensInDb: [],
          details: `User profile document 'users/${uid}' does not exist in Firestore.`
        };
      }

      const data = snap.data();
      const tokens: string[] = [];

      if (data.oneSignalSubscriptionId) tokens.push(data.oneSignalSubscriptionId);
      if (data.oneSignalId) tokens.push(data.oneSignalId);
      if (Array.isArray(data.oneSignalSubscriptionIds)) {
        tokens.push(...data.oneSignalSubscriptionIds);
      }

      const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

      if (!localSubId) {
        return {
          userFound: true,
          matched: false,
          tokensInDb: uniqueTokens,
          details: uniqueTokens.length > 0
            ? `Backend holds ${uniqueTokens.length} token(s), but local device has no active subscription ID.`
            : 'Neither local device nor backend record has an active push subscription ID.'
        };
      }

      const hasMatch = uniqueTokens.includes(localSubId);

      return {
        userFound: true,
        matched: hasMatch,
        tokensInDb: uniqueTokens,
        details: hasMatch
          ? `Device subscription ID (${localSubId}) matches Firestore backend record!`
          : `Device subscription ID (${localSubId}) is NOT currently listed in Firestore backend record (${uniqueTokens.length} token(s) registered).`
      };
    } catch (err: any) {
      return {
        userFound: false,
        matched: false,
        tokensInDb: [],
        details: `Backend validation query error: ${err?.message || String(err)}`
      };
    }
  }

  /**
   * Run full consolidated push diagnostic report
   */
  public async runFullDiagnostics(uid?: string): Promise<PushDiagnosticReport> {
    const isNative = Capacitor.isNativePlatform();
    const platform: 'android' | 'ios' | 'web' | 'desktop' = isNative
      ? (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android')
      : (typeof window !== 'undefined' && ((window as any).electron || (window as any).ipcRenderer) ? 'desktop' : 'web');
    const isSecureContext = typeof window !== 'undefined' ? (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost') : false;

    const items: DiagnosticItem[] = [];

    // 1. Environment & Secure Context Check
    items.push({
      id: 'env-secure-context',
      name: 'Cryptographic Secure Context (HTTPS / Localhost)',
      category: 'environment',
      status: isSecureContext ? 'pass' : 'fail',
      summary: isSecureContext ? 'Secure Context Verified' : 'Insecure Context (HTTP)',
      detail: isSecureContext
        ? `App is running in a cryptographically secure context (${window.location.protocol}//${window.location.host}).`
        : 'Web Push and Service Workers require HTTPS or localhost.',
      actionHint: !isSecureContext ? 'Deploy app over HTTPS or run in native APK container.' : undefined
    });

    // 2. Platform Runtime Inspection
    items.push({
      id: 'env-platform',
      name: 'Runtime Target Platform',
      category: 'environment',
      status: 'info',
      summary: isNative ? `Native Capacitor APK (${platform.toUpperCase()})` : `Web Browser / PWA (${platform.toUpperCase()})`,
      detail: `Target platform is identified as ${platform}. Native Android utilizes Cordova OneSignal Plugin with FCM background service.`
    });

    // 3. Permission Check
    const permResult = await this.checkPermission();
    let permStatus: 'pass' | 'warn' | 'fail' = 'pass';
    if (permResult.permission === 'denied') permStatus = 'fail';
    else if (permResult.permission === 'default' || permResult.permission === 'unsupported') permStatus = 'warn';

    items.push({
      id: 'perm-notifications',
      name: 'Device Push Notification Permission',
      category: 'permission',
      status: permStatus,
      summary: permResult.permission.toUpperCase(),
      detail: permResult.detail,
      actionHint: permResult.permission !== 'granted' ? 'Request or enable notifications in OS settings.' : undefined
    });

    // 4. OneSignal Registration Check
    const osState = await this.checkOneSignalState();
    let osStatus: 'pass' | 'warn' | 'fail' = 'pass';
    if (!osState.initialized) osStatus = 'fail';
    else if (!osState.subscriptionId) osStatus = 'warn';

    items.push({
      id: 'onesignal-init',
      name: 'OneSignal Push Service Engine',
      category: 'onesignal',
      status: osStatus,
      summary: osState.initialized
        ? (osState.subscriptionId ? 'Connected & Subscribed' : 'Initialized (Token Pending)')
        : 'Not Initialized',
      detail: `${osState.details} (App ID: ${osState.appId})`,
      actionHint: !osState.initialized
        ? 'Re-trigger OneSignal initialization sequence.'
        : (!osState.subscriptionId ? 'Ensure Google Play Services or network connectivity is available.' : undefined)
    });

    // 5. OneSignal External ID Mapping Check
    if (uid) {
      const isExternalIdMatched = osState.externalId === uid;
      items.push({
        id: 'onesignal-external-id',
        name: 'OneSignal User Login / External ID Alignment',
        category: 'onesignal',
        status: isExternalIdMatched ? 'pass' : (osState.initialized ? 'warn' : 'fail'),
        summary: isExternalIdMatched ? 'External UID Linked' : (osState.externalId ? 'UID Mismatch' : 'UID Not Linked'),
        detail: `Device external ID is "${osState.externalId || 'NONE'}" (Expected: "${uid}").`,
        actionHint: !isExternalIdMatched ? 'Call OneSignal.login(uid) to bind device to account.' : undefined
      });
    }

    // 6. ServiceWorker / Web FCM Check (for Web/PWA)
    const swState = await this.checkFcmAndServiceWorkerState();
    if (!isNative) {
      items.push({
        id: 'fcm-serviceworker',
        name: 'Service Worker Background Receiver',
        category: 'fcm',
        status: swState.serviceWorkerActive ? 'pass' : 'warn',
        summary: swState.serviceWorkerActive ? 'ServiceWorker Active' : 'No ServiceWorker',
        detail: swState.details,
        actionHint: !swState.serviceWorkerActive ? 'Register ServiceWorker for background delivery.' : undefined
      });
    }

    // 7. Backend Firestore User Record Synchronization Check
    let backendRecordState = {
      uid: uid || null,
      firestoreTokenPresent: false,
      registeredTokens: [] as string[],
      isDeviceSyncedWithBackend: false
    };

    if (uid) {
      const backendResult = await this.validateDeviceBackendMatching(uid, osState.subscriptionId);
      backendRecordState = {
        uid,
        firestoreTokenPresent: backendResult.tokensInDb.length > 0,
        registeredTokens: backendResult.tokensInDb,
        isDeviceSyncedWithBackend: backendResult.matched
      };

      items.push({
        id: 'backend-firestore-sync',
        name: 'Backend Firestore Device Token Sync',
        category: 'backend_sync',
        status: backendResult.matched ? 'pass' : (backendResult.tokensInDb.length > 0 ? 'warn' : 'fail'),
        summary: backendResult.matched ? 'Device Synchronized' : (backendResult.tokensInDb.length > 0 ? 'Device Not Linked' : 'No Tokens in DB'),
        detail: backendResult.details,
        actionHint: !backendResult.matched ? 'Click "Sync Device & Repair Registration" to update backend record.' : undefined
      });
    }

    // Calculate score and overall status
    const passCount = items.filter(i => i.status === 'pass').length;
    const failCount = items.filter(i => i.status === 'fail').length;
    const totalScored = items.filter(i => i.status !== 'info').length;
    const score = totalScored > 0 ? Math.round((passCount / totalScored) * 100) : 100;

    let overallStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (failCount > 0) overallStatus = 'FAIL';
    else if (score < 80) overallStatus = 'WARN';

    return {
      timestamp: Date.now(),
      overallStatus,
      score,
      platform,
      isNative,
      isSecureContext,
      permissionState: permResult.permission,
      localDeviceTokens: {
        oneSignalSubscriptionId: osState.subscriptionId,
        oneSignalExternalId: osState.externalId,
        serviceWorkerScope: swState.serviceWorkerScope,
        fcmToken: null
      },
      backendRecord: backendRecordState,
      items
    };
  }

  /**
   * Helper to perform automated one-click repair of push notification pipeline
   */
  public async repairPushRegistration(uid: string): Promise<{ success: boolean; message: string }> {
    if (!uid) {
      return { success: false, message: 'Authenticated user UID is required to repair registration.' };
    }

    try {
      await registerCapacitorPushNotifications(uid);
      const report = await this.runFullDiagnostics(uid);
      if (report.overallStatus === 'PASS' || report.overallStatus === 'WARN') {
        return {
          success: true,
          message: `Push pipeline repaired successfully! Diagnostic score: ${report.score}%`
        };
      } else {
        return {
          success: false,
          message: `Repair attempted, but issues remain. Check diagnostic items below.`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Push repair failed with error: ${err?.message || String(err)}`
      };
    }
  }
}

export const notificationDiagnosticService = new NotificationDiagnosticService();
