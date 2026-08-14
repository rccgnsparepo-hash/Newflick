/**
 * High-Performance, Production-Grade Deep Link & Push Notification Router Manager
 * Supports: Android, iOS, and Browser Web fallback channels.
 * Features: Cold starts, Auth guards, Navigation queues, and Deduplication keys.
 */

export interface DeepLinkPayload {
  route: string;                  // Target screen identifier (e.g. 'chat', 'feed', 'settings')
  senderId?: string;              // Target peer ID parameter (specifically for direct message deep links)
  params?: Record<string, string>; // Auxiliary payload options
  id?: string;                    // Unique notification or payload telemetry identifier
}

type OnNavigateCallback = (payload: DeepLinkPayload) => void;

class DeepLinkManager {
  private pendingPayload: DeepLinkPayload | null = null;
  private listeners: Set<OnNavigateCallback> = new Set();
  private processedIds: Set<string> = new Set(); // Prevents redundant navigation loops from duplicated platform signals
  private isAppReady: boolean = false;
  private isAuthenticated: boolean = false;
  private STORAGE_KEY = 'faraflick_pending_deeplink';

  constructor() {
    this.restorePendingDeepLink();
    this.initNativeAndWebListeners();
  }

  private initNativeAndWebListeners() {
    if (typeof window === 'undefined') return;

    // Check window URL query parameters on initial load
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const routeParam = urlParams.get('route') || (urlParams.get('chatId') || urlParams.get('senderId') ? 'chat' : null);
      if (routeParam) {
        const payload = this.parsePayload({
          route: routeParam,
          senderId: urlParams.get('senderId') || urlParams.get('chatId') || undefined,
          chatId: urlParams.get('chatId') || undefined,
          id: urlParams.get('id') || `url-query-${Date.now()}`
        });
        if (payload) {
          console.log('[DeepLink Manager] Query parameter deep link detected on load:', payload);
          this.queueDeepLink(payload);
        }
      }
    } catch (e) {
      console.warn('[DeepLink Manager] Error reading window location query:', e);
    }

    // Median.co / GoNative JavaScript Bridge integration
    const uWindow = window as any;
    uWindow.gonative_onesignal_opened = (data: any) => {
      console.log('[Median Bridge] OneSignal notification opened:', data);
      if (data && data.additionalData) {
        const parsed = this.parsePayload(data.additionalData);
        if (parsed) this.queueDeepLink(parsed);
      }
    };

    // Listen for custom window event dispatches
    window.addEventListener('fara-flick-deeplink', (e: any) => {
      if (e.detail) {
        const parsed = this.parsePayload(e.detail);
        if (parsed) this.queueDeepLink(parsed);
      }
    });

    // Check window URL hash on load
    this.checkWindowHash();

    // Listen for window hash and popstate changes
    window.addEventListener('hashchange', () => this.checkWindowHash());
    window.addEventListener('popstate', () => this.checkWindowHash());
  }

  private checkWindowHash() {
    if (typeof window === 'undefined') return;
    try {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (!hash) return;

      const [routePart, paramPart] = hash.split('/');
      const route = routePart?.toLowerCase();

      if (route) {
        const payload: DeepLinkPayload = {
          route: route === 'calls' ? 'call-history' : route,
          senderId: paramPart || undefined,
          params: paramPart ? { id: paramPart } : undefined,
          id: `hash-${hash}-${Date.now()}`
        };
        console.log('[DeepLink Manager] Hash deep link detected:', payload);
        this.queueDeepLink(payload);
      }
    } catch (e) {
      console.warn('[DeepLink Manager] Error reading window hash:', e);
    }
  }

  /**
   * Safe parser to extract route/params from custom scheme or web URLs
   */
  public parseUrl(urlStr: string): DeepLinkPayload | null {
    if (!urlStr) return null;
    try {
      console.log('[DeepLink Parser] Parsing url:', urlStr);
      const cleaned = urlStr.replace(/^(app|faraflick|flick|https?):\/\//i, '');
      const parts = cleaned.split('/');
      const route = parts[0]?.toLowerCase().trim();
      const id = parts[1]?.split('?')[0] || null;

      if (!route) return null;

      const params: Record<string, string> = {};
      if (id) {
        params.id = id;
      }

      const questionIndex = urlStr.indexOf('?');
      if (questionIndex !== -1) {
        const queryStr = urlStr.substring(questionIndex + 1);
        const queryParts = queryStr.split('&');
        queryParts.forEach(qp => {
          const [key, val] = qp.split('=');
          if (key && val) {
            params[decodeURIComponent(key)] = decodeURIComponent(val);
          }
        });
      }

      let senderId = params.senderId || params.sender_id || null;
      if (route === 'chat' && id && !senderId) {
        senderId = id;
      }

      return {
        route,
        senderId: senderId || undefined,
        params,
        id: params.id || `${Date.now()}-${Math.random()}`
      };
    } catch (e) {
      console.warn('[DeepLink Parser] Failed to parse url:', urlStr, e);
      return null;
    }
  }

  /**
   * Safe parser to normalize raw JSON payloads from Capacitor push clicks or cold starts
   */
  public parsePayload(rawData: any): DeepLinkPayload | null {
    if (!rawData) return null;

    try {
      console.log('[DeepLink Parser] Received raw payload:', rawData);

      // Extract route setting
      let route = rawData.route || '';
      const type = rawData.type;

      // Map older notification actions or 'type' tags to clean routes
      if (!route && type) {
        if (type === 'message' || type === 'chat') {
          route = 'chat';
        } else if (type === 'like' || type === 'feed') {
          route = 'feed';
        } else if (type === 'call') {
          route = 'call';
        }
      }

      // If call payload detected, dispatch high-priority custom incoming-call event
      if (type === 'call' || rawData.callId) {
        route = 'call';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('faraflick-incoming-call', {
            detail: {
              id: rawData.callId || rawData.id,
              callerId: rawData.callerId || rawData.senderId,
              callerName: rawData.callerName || 'Peer',
              callerPhoto: rawData.callerPhoto || '',
              type: rawData.callType || 'voice',
              status: 'dialing'
            }
          }));
        }
      }

      // If still empty but we have a senderId, default route to chat
      const senderId = rawData.senderId || rawData.sender_id || rawData.callerId;
      if (!route && senderId) {
        route = 'chat';
      }

      if (!route) {
        console.warn('[DeepLink Parser] No valid route or routing type found in payload.');
        return null;
      }

      // Extract standard and custom payload params
      const params: Record<string, string> = {};
      Object.keys(rawData).forEach(key => {
        if (typeof rawData[key] === 'string') {
          params[key] = rawData[key];
        }
      });

      return {
        route,
        senderId,
        params,
        id: rawData.id || rawData.notification_id || `${Date.now()}-${Math.random()}`
      };
    } catch (err) {
      console.warn('[DeepLink Parser] Exception parsing notification details:', err);
      return null;
    }
  }

  /**
   * Enqueues a parsed Deep Link, checking for status, auth, and duplication gates.
   */
  public queueDeepLink(payload: DeepLinkPayload) {
    if (!payload?.route) return;

    // Deduplicate: Don't execute the same request twice in a short timeframe
    if (payload.id && this.processedIds.has(payload.id)) {
      console.log('[DeepLink Manager] Duplicate event rejected:', payload.id);
      return;
    }
    if (payload.id) {
      this.processedIds.add(payload.id);
      // Clean up processed ID cache after 5 seconds to avoid unbounded space usage
      setTimeout(() => this.processedIds.delete(payload.id!), 5000);
    }

    console.log('[DeepLink Manager] Enqueueing link:', payload);

    if (!this.isAuthenticated) {
      console.log('[DeepLink Manager] Recipient is currently logged out. Persisting payload to survive auth redirects...');
      this.persistPendingDeepLink(payload);
      return;
    }

    if (!this.isAppReady) {
      console.log('[DeepLink Manager] Application UI layer not fully prepared. Caching deep link in-memory...');
      this.pendingPayload = payload;
      return;
    }

    // Immediate dispatch
    this.dispatch(payload);
  }

  /**
   * Trigger callbacks to shift views inside React/SPA routers
   */
  private dispatch(payload: DeepLinkPayload) {
    console.log('[DeepLink Manager] Executing active transition dispatch to target:', payload);
    this.listeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.warn('[DeepLink Manager] Listener navigation threw an error:', err);
      }
    });
    this.clearPersisted();
  }

  /**
   * Registers a router/SPA navigation listener.
   * Immediately dispatches any queued payloads.
   */
  public subscribe(callback: OnNavigateCallback): () => void {
    this.listeners.add(callback);
    
    // If we have a pending payload that can be resolved, do so immediately
    if (this.isAppReady && this.isAuthenticated && this.pendingPayload) {
      const payload = this.pendingPayload;
      this.pendingPayload = null;
      this.dispatch(payload);
    }

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Update lifecycle states from the central App module
   */
  public setStates(isAppReady: boolean, isAuthenticated: boolean) {
    this.isAppReady = isAppReady;
    this.isAuthenticated = isAuthenticated;

    console.log(`[DeepLink States] Ready: ${isAppReady} | Authenticated: ${isAuthenticated}`);

    if (this.isAppReady && this.isAuthenticated) {
      // Priority: Dispatch persisted deep-link if any exists
      if (this.pendingPayload) {
        const payload = this.pendingPayload;
        this.pendingPayload = null;
        this.dispatch(payload);
      }
    }
  }

  // Backing persistence methods to survive hot reloads/auth updates
  private persistPendingDeepLink(payload: DeepLinkPayload) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[DeepLink Manager] Storage write error:', err);
    }
  }

  private restorePendingDeepLink() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.pendingPayload = JSON.parse(saved);
        console.log('[DeepLink Manager] Restored pending deep link from local storage:', this.pendingPayload);
      }
    } catch (err) {
      console.warn('[DeepLink Manager] Storage restore error:', err);
    }
  }

  private clearPersisted() {
    this.pendingPayload = null;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      // safe
    }
  }
}

export const deepLinkManager = new DeepLinkManager();
