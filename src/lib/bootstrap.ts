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

/**
 * Fetches the application bootstrap configuration from the backend.
 * This should be called before the React app mounts and before Firebase initializes.
 */
export async function initBootstrap(): Promise<BootstrapConfig> {
  if (bootstrapConfig) return bootstrapConfig;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const response = await fetch('/api/bootstrap');
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
      console.error('[Bootstrap] Failed to initialize:', err);
      // Fallback or return empty struct to prevent crash
      return {
        firebaseConfig: null,
        version: "fallback",
        features: { enableE2EE: true, enablePushNotifications: false },
        publicApiUrls: { backendUrl: "" }
      } as BootstrapConfig;
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
