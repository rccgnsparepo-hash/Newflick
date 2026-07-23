import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { playLikeSound, playGlitchClickSound } from '../lib/sounds';
import { triggerVibration } from '../lib/haptics';

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface ConnectivityStatus {
  isOnline: boolean;
  connectionType: ConnectionType;
  isSlow: boolean;
  effectiveType?: string;
  hasTestedActualInternet: boolean;
}

interface QueuedRequest {
  id: string;
  callback: () => Promise<any> | any;
}

interface ConnectivityContextType {
  isOnline: boolean;
  connectionType: ConnectionType;
  isSlow: boolean;
  effectiveType?: string;
  pendingRequestsCount: number;
  queueRequest: (callback: () => Promise<any> | any) => void;
  triggerSync: () => Promise<boolean>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
}

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core connection state
  const [status, setStatus] = useState<ConnectivityStatus>(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return {
      isOnline,
      connectionType: 'unknown',
      isSlow: false,
      hasTestedActualInternet: false,
    };
  });

  // 2. Offline requests queue
  const [queuedRequests, setQueuedRequests] = useState<QueuedRequest[]>([]);
  const isSyncingRef = useRef<boolean>(false);

  // 3. UI states for notifications
  const [showRestoredBanner, setShowRestoredBanner] = useState<boolean>(false);
  
  // Keep track of previous online status to detect transitions (online -> offline -> online)
  const previousOnlineRef = useRef<boolean>(status.isOnline);

  // Helper to retrieve detailed connection info via Network Information API
  const getConnectionDetails = (): Pick<ConnectivityStatus, 'connectionType' | 'isSlow' | 'effectiveType'> => {
    if (typeof navigator === 'undefined') {
      return { connectionType: 'unknown', isSlow: false };
    }
    
    if (!navigator.onLine) {
      return { connectionType: 'none', isSlow: false };
    }

    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (!connection) {
      return { connectionType: 'unknown', isSlow: false };
    }

    const type = connection.type || 'unknown';
    const effectiveType = connection.effectiveType || '';
    const isSlow = ['slow-2g', '2g', '3g'].includes(effectiveType) || connection.saveData === true;

    let connectionType: ConnectionType = 'unknown';
    if (type === 'wifi') {
      connectionType = 'wifi';
    } else if (type === 'cellular' || type === 'wimax' || type === 'mixed') {
      connectionType = 'cellular';
    } else if (type === 'ethernet') {
      connectionType = 'ethernet';
    }

    return {
      connectionType,
      isSlow,
      effectiveType,
    };
  };

  // Perform active heartbeats to prevent false-positives (DNS failure, local WiFi without routing)
  const testActualInternetAccess = (): Promise<boolean> => {
    return new Promise((resolve) => {
      // If navigator tells us we are offline, trust it immediately
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        resolve(false);
        return;
      }

      // Check if we can make a tiny request using a lightweight, native image object.
      // This is extremely robust across all local protocols (file://, app://),
      // completely immune to CORS, and highly reliable.
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = '';
        resolve(typeof navigator !== 'undefined' ? navigator.onLine : true);
      }, 3500);

      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timer);
        // Fallback: If image fails to load (due to CSP, offline, or DNS block),
        // we fallback on navigator.onLine to avoid false-positives under strict CSP policies.
        resolve(typeof navigator !== 'undefined' ? navigator.onLine : true);
      };

      // Use a cache-busting query parameter
      img.src = `https://www.google.com/favicon.ico?t=${Date.now()}`;
    });
  };

  // Consolidate current connectivity parameters
  const updateConnectivity = async () => {
    const details = getConnectionDetails();
    const tentativeOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    console.log(`[Connectivity Log] Checking connectivity. Browser online state: ${tentativeOnline}. Connection type: ${details.connectionType}`);

    if (!tentativeOnline) {
      setStatus({
        isOnline: false,
        connectionType: 'none',
        isSlow: false,
        effectiveType: details.effectiveType,
        hasTestedActualInternet: true,
      });
      return;
    }

    // Active diagnostic check
    const isActuallyOnline = await testActualInternetAccess();
    
    setStatus(prev => ({
      ...prev,
      isOnline: isActuallyOnline,
      connectionType: isActuallyOnline ? details.connectionType : 'none',
      isSlow: isActuallyOnline ? details.isSlow : false,
      effectiveType: details.effectiveType,
      hasTestedActualInternet: true,
    }));
  };

  // Queue a callback to execute later
  const queueRequest = (callback: () => Promise<any> | any) => {
    const newReq: QueuedRequest = {
      id: Math.random().toString(36).substring(2, 9),
      callback,
    };
    setQueuedRequests(prev => [...prev, newReq]);
    console.log(`[Connectivity Queue] Registered request callback in offline queue. Id: ${newReq.id}. Active queue length: ${queuedRequests.length + 1}`);
  };

  // Synchronize and replay queued requests
  const triggerSync = async (): Promise<boolean> => {
    if (queuedRequests.length === 0 || isSyncingRef.current) {
      return false;
    }

    console.log(`[Connectivity Sync] Restored. Triggering execution loop for ${queuedRequests.length} offline queued requests.`);
    isSyncingRef.current = true;
    
    // Copy the current queue and clear state to avoid race conditions
    const requestsToProcess = [...queuedRequests];
    setQueuedRequests([]);

    const failedRequests: QueuedRequest[] = [];

    for (const req of requestsToProcess) {
      try {
        console.log(`[Connectivity Sync] Executing queued task: ${req.id}`);
        await req.callback();
      } catch (err) {
        console.warn(`[Connectivity Sync] Failed to process queued request: ${req.id}. Postponing back to queue.`, err);
        failedRequests.push(req);
      }
    }

    if (failedRequests.length > 0) {
      setQueuedRequests(prev => [...failedRequests, ...prev]);
    }

    isSyncingRef.current = false;
    return true;
  };

  // Sync state transitions and deliver notifications
  useEffect(() => {
    const wasOnline = previousOnlineRef.current;
    const isNowOnline = status.isOnline;

    if (wasOnline !== isNowOnline) {
      console.log(`[Connectivity Switch] Connectivity transition logged. ${wasOnline ? 'ONLINE' : 'OFFLINE'} -> ${isNowOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      if (isNowOnline) {
        // Transition: Offline -> Online
        setShowRestoredBanner(true);
        triggerVibration('medium');
        try {
          playLikeSound(); // success sound
        } catch (_) {}
        
        // Auto-dismiss restored notification after 3 seconds
        const timer = setTimeout(() => {
          setShowRestoredBanner(false);
        }, 3000);

        // Replay offline mutations
        triggerSync();

        previousOnlineRef.current = true;
        return () => clearTimeout(timer);
      } else {
        // Transition: Online -> Offline
        setShowRestoredBanner(false);
        triggerVibration('heavy');
        try {
          playGlitchClickSound(); // alert indicator sound
        } catch (_) {}

        previousOnlineRef.current = false;
      }
    }
  }, [status.isOnline, queuedRequests]);

  // Bind native browser listeners and background trackers
  useEffect(() => {
    // 1. Listen for browser offline indicator events
    const handleBrowserOnline = () => updateConnectivity();
    const handleBrowserOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        connectionType: 'none',
      }));
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    // 2. Listen for detailed Network Information changes
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateConnectivity);
    }

    // 3. Monitor browser window/tab focus & visibility switches
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Connectivity Focus] App brought to foreground. Verifying tunnel link.');
        updateConnectivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Lightweight connection poll to monitor slow states or active routing blocks
    const heartbeatInterval = setInterval(() => {
      updateConnectivity();
    }, 45000); // Standard robust, non-expensive background heartbeat 45s

    // Initial load sync
    updateConnectivity();

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeatInterval);
    };
  }, []);

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline: status.isOnline,
        connectionType: status.connectionType,
        isSlow: status.isSlow,
        effectiveType: status.effectiveType,
        pendingRequestsCount: queuedRequests.length,
        queueRequest,
        triggerSync,
      }}
    >
      {/* Real-time Layout Banner Injection Container */}
      <div className="relative">
        <AnimatePresence>
          {/* A: Off-line Floating Non-dismissible Warning Banner */}
          {!status.isOnline && (
            <motion.div
              key="connectivity-offline-banner"
              initial={{ opacity: 0, y: -80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -80 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="fixed top-0 left-0 right-0 z-100 flex justify-center p-3 sm:p-4 pointer-events-none select-none font-mono"
            >
              <div className="pointer-events-auto bg-[var(--color-surface)]/85 backdrop-blur-md border-2 border-red-500 rounded-none w-full max-w-xl p-3.5 flex items-center justify-between gap-4 [box-shadow:4px_4px_0px_#ef4444] shadow-black/80">
                <div className="flex items-center space-x-3 text-red-500">
                  <div className="w-8 h-8 rounded-none border border-red-500/40 bg-red-950/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <WifiOff className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-black uppercase tracking-wider text-red-500 flex items-center gap-1.5 leading-none">
                      ⚠️ No Internet Connection
                    </h3>
                    <p className="text-[9.5px] text-zinc-400 font-sans tracking-wide mt-1">
                      Encryption tunnels temporarily suspended. Content queued offline.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {status.connectionType !== 'none' && (
                    <span className="text-[8px] border border-red-500/25 bg-red-950/10 px-1.5 py-0.5 text-zinc-400 capitalize">
                      {status.connectionType}
                    </span>
                  )}
                  {queuedRequests.length > 0 && (
                    <span className="text-[8px] bg-red-500 text-black font-extrabold px-1.5 py-0.5 animate-pulse uppercase">
                      {queuedRequests.length} QUEUED
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* B: Restored Banner Floating Toast */}
          {showRestoredBanner && (
            <motion.div
              key="connectivity-restored-banner"
              initial={{ opacity: 0, y: -80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -80 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="fixed top-0 left-0 right-0 z-100 flex justify-center p-3 sm:p-4 pointer-events-none select-none font-mono"
            >
              <div className="pointer-events-auto bg-[var(--color-surface)]/85 backdrop-blur-md border-2 border-[var(--neon-green)] rounded-none w-full max-w-xl p-3.5 flex items-center justify-between gap-4 [box-shadow:4px_4px_0px_var(--neon-green)] shadow-black/80">
                <div className="flex items-center space-x-3 text-[var(--neon-green)]">
                  <div className="w-8 h-8 rounded-none border border-[var(--neon-green)]/40 bg-[var(--neon-green)]/10 flex items-center justify-center flex-shrink-0">
                    <Wifi className="w-4 h-4 text-[var(--neon-green)]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--neon-green)] flex items-center gap-1.5 leading-none">
                      ✅ Internet Connection Restored
                    </h3>
                    <p className="text-[9.5px] text-zinc-300 font-sans tracking-wide mt-1">
                      Synchronization secured. Encrypted node channels fully active.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[var(--neon-green)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--neon-green)] animate-bounce" />
                </div>
              </div>
            </motion.div>
          )}

          {/* C: Warning indicator for ultra-slow/restricted connections (Sleek floating top pill) */}
          {status.isOnline && status.isSlow && (
            <motion.div
              key="connectivity-slow-tunnel"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-2.5 right-12 md:right-4 z-[9999] pointer-events-auto font-mono select-none"
            >
              <div className="bg-amber-950/90 backdrop-blur-md border border-amber-500/50 px-2 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
                <span className="text-[7.5px] font-black text-amber-400 uppercase tracking-widest">
                  TUNNEL SLOW ({status.effectiveType || 'RTT'})
                </span>
                <button
                  onClick={() => updateConnectivity()}
                  className="text-[8px] text-amber-400/60 hover:text-amber-300 cursor-pointer pl-0.5 flex items-center justify-center"
                  title="Force re-evaluate link"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {children}
      </div>
    </ConnectivityContext.Provider>
  );
};
