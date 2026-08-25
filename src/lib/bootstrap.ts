import { reinitializeFirebaseWithConfig } from './firebase';

export interface BootstrapConfig {
  firebaseConfig: {
    projectId: string;
    apiKey: string;
    appId: string;
    authDomain?: string;
    firestoreDatabaseId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    measurementId?: string;
  } | null;
  version: string;
  features: {
    enableE2EE: boolean;
    enablePushNotifications: boolean;
  };
  publicApiUrls: {
    backendUrl: string;
  };
}

let bootstrapConfig: BootstrapConfig | null = null;
let bootstrapPromise: Promise<BootstrapConfig> | null = null;

export function getBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  
  // 1. Check localStorage for user-overridden backend server URL
  const savedUrl = localStorage.getItem('flick_backend_url');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/$/, '');
  }
  
  // 2. Check build-time environment variable
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL || (import.meta as any).env?.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 3. Detect standalone desktop executable (Electron file:/app: protocol) or Capacitor APK (capacitor:// / localhost)
  const isStandalone = (
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'app:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000') ||
    (window.location.hostname === '127.0.0.1' && window.location.port !== '3000')
  );

  if (isStandalone) {
    // Connect to live Cloud Run server for Flick News wire feeds, Father AI, Flick Arena sports, and Firebase pairing
    const remoteBackend = (import.meta as any).env?.VITE_REMOTE_BACKEND_URL || 
      (typeof window !== 'undefined' && window.location.origin.startsWith('https://ais-') ? window.location.origin : "https://ais-dev-zu5wepafp2hyqxyhqmj344-930155083055.europe-west2.run.app");
    return remoteBackend.replace(/\/$/, '');
  }

  // 4. Default web browser origin
  return window.location.origin || '';
}

/**
 * Fetches the application bootstrap configuration from the backend.
 * This should be called before the React app mounts and before Firebase initializes.
 */
export async function initBootstrap(): Promise<BootstrapConfig> {
  if (bootstrapConfig) return bootstrapConfig;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      // 1. Check if there is a manually pasted Firebase Config in localStorage
      const savedConfigStr = localStorage.getItem('flick_firebase_config');
      if (savedConfigStr) {
        try {
          const manualFirebaseConfig = JSON.parse(savedConfigStr);
          if (manualFirebaseConfig && manualFirebaseConfig.apiKey) {
            console.log('[Bootstrap] Using manually entered Firebase configuration.');
            bootstrapConfig = {
              firebaseConfig: manualFirebaseConfig,
              version: "manual-standalone",
              features: { enableE2EE: true, enablePushNotifications: false },
              publicApiUrls: { backendUrl: getBackendUrl() }
            };
            
            (window as any).__BOOTSTRAP_CONFIG__ = bootstrapConfig;
            (window as any).__FIREBASE_CONFIG__ = manualFirebaseConfig;
            return bootstrapConfig;
          }
        } catch (e) {
          console.error('[Bootstrap] Failed to parse manual Firebase config:', e);
        }
      }

      const baseUrl = getBackendUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(new Error("Bootstrap configuration request timed out after 8000ms"));
      }, 8000);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/bootstrap`, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap config: HTTP ${response.status}`);
      }
      bootstrapConfig = await response.json();
      
      // Store in window for compatibility if needed
      (window as any).__BOOTSTRAP_CONFIG__ = bootstrapConfig;
      
      // Keep legacy config compatibility for firebase.ts
      if (bootstrapConfig?.firebaseConfig) {
        (window as any).__FIREBASE_CONFIG__ = bootstrapConfig.firebaseConfig;
        reinitializeFirebaseWithConfig(bootstrapConfig.firebaseConfig);
      }
      
      return bootstrapConfig as BootstrapConfig;
    } catch (err: any) {
      const isAbortError = err?.name === 'AbortError' || (err?.message && (err.message.includes('aborted') || err.message.includes('timed out')));
      const errorDetail = isAbortError ? "Backend request timed out or was aborted" : (err?.message || String(err));
      
      console.warn(`[Bootstrap] Info: Dynamic backend config load bypassed (${errorDetail}). Initializing client with local fallback configuration.`);
      
      const env = (import.meta as any).env || {};
      const viteProjectId = env.VITE_FIREBASE_PROJECT_ID;
      const viteApiKey = env.VITE_FIREBASE_API_KEY;
      
      let fallbackFirebaseConfig = null;
      if (viteProjectId && viteApiKey) {
        fallbackFirebaseConfig = {
          projectId: viteProjectId,
          apiKey: viteApiKey,
          appId: env.VITE_FIREBASE_APP_ID || "",
          authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${viteProjectId}.firebaseapp.com`,
          firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2",
          storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${viteProjectId}.appspot.com`,
          messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
          measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || ""
        };
      }

      bootstrapConfig = {
        firebaseConfig: fallbackFirebaseConfig,
        version: "fallback",
        features: { enableE2EE: true, enablePushNotifications: false },
        publicApiUrls: { backendUrl: "" }
      } as BootstrapConfig;

      // Store in window for compatibility
      (window as any).__BOOTSTRAP_CONFIG__ = bootstrapConfig;
      if (fallbackFirebaseConfig) {
        (window as any).__FIREBASE_CONFIG__ = fallbackFirebaseConfig;
      }

      return bootstrapConfig;
    }
  })();

  return bootstrapPromise;
}

export function getBootstrapConfig(): BootstrapConfig {
  if (bootstrapConfig) return bootstrapConfig;
  
  const env = (import.meta as any).env || {};
  const viteProjectId = env.VITE_FIREBASE_PROJECT_ID;
  const viteApiKey = env.VITE_FIREBASE_API_KEY;

  let fallbackConfig: any = (window as any).__FIREBASE_CONFIG__ || null;
  if (!fallbackConfig && viteProjectId && viteApiKey) {
    fallbackConfig = {
      projectId: viteProjectId,
      apiKey: viteApiKey,
      appId: env.VITE_FIREBASE_APP_ID || "",
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${viteProjectId}.firebaseapp.com`,
      firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2",
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${viteProjectId}.appspot.com`,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || ""
    };
  }

  return {
    firebaseConfig: fallbackConfig,
    version: "1.0.0",
    features: {
      enableE2EE: true,
      enablePushNotifications: false,
    },
    publicApiUrls: {
      backendUrl: getBackendUrl(),
    },
  };
}
