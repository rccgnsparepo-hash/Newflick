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
  
  // 1. Check localStorage first
  const savedUrl = localStorage.getItem('flick_backend_url');
  if (savedUrl) {
    return savedUrl.replace(/\/$/, '');
  }
  
  // 2. If we are running in the browser normally, use the current origin
  if (window.location.protocol !== 'file:' && window.location.hostname !== '') {
    return '';
  }
  
  return '';
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
      const baseUrl = getBackendUrl();
      const response = await fetch(`${baseUrl}/api/bootstrap`);
      if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap config: ${response.status}`);
      }
      bootstrapConfig = await response.json();
      
      // Store in window for compatibility if needed
      (window as any).__BOOTSTRAP_CONFIG__ = bootstrapConfig;
      
      // Keep legacy config compatibility for firebase.ts
      if (bootstrapConfig?.firebaseConfig) {
        (window as any).__FIREBASE_CONFIG__ = bootstrapConfig.firebaseConfig;
      }
      
      return bootstrapConfig as BootstrapConfig;
    } catch (err) {
      console.error('[Bootstrap] Failed to initialize from backend. Falling back to VITE_ env variables if available:', err);
      
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
  if (!bootstrapConfig) {
    throw new Error("Bootstrap configuration not initialized. Call initBootstrap() first.");
  }
  return bootstrapConfig;
}
