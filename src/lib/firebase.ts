import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

let config: any = null;

if (typeof window !== 'undefined') {
  config = (window as any).__FIREBASE_CONFIG__;
  if (!config) {
    // 1. Check if client-side VITE_ environment variables are provided (e.g., on Vercel)
    const env = (import.meta as any).env || {};
    const viteProjectId = env.VITE_FIREBASE_PROJECT_ID;
    const viteApiKey = env.VITE_FIREBASE_API_KEY;
    if (viteProjectId && viteApiKey) {
      config = {
        projectId: viteProjectId,
        apiKey: viteApiKey,
        appId: env.VITE_FIREBASE_APP_ID || "",
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${viteProjectId}.firebaseapp.com`,
        firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2",
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${viteProjectId}.appspot.com`,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
        measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || ""
      };
      (window as any).__FIREBASE_CONFIG__ = config;
    }
  }

  if (!config) {
    try {
      // Use synchronous XHR to resolve config immediately on demand from our secure backend API route
      if (typeof XMLHttpRequest !== 'undefined') {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/firebase-config', false);
        xhr.send(null);
        if (xhr.status === 200) {
          config = JSON.parse(xhr.responseText);
          (window as any).__FIREBASE_CONFIG__ = config;
        }
      }
    } catch (err) {
      console.warn('[Firebase Client Initialization] Dynamic server config fetch unavailable. Using fallback credentials.', err);
    }
  }
}

// Fallback to avoid crashes if backend is temporarily unreachable
if (!config) {
  config = {
    projectId: "gen-lang-client-0982710068",
    firestoreDatabaseId: "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2"
  };
}

export let app: any = null;
export let db: any = null;
export let auth: any = null;
export let rtdb: any = null;
export let isFirebaseConfigured = false;
export let firebaseInitError: string | null = null;

try {
  if (config && config.apiKey) {
    app = initializeApp(config);
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, config.firestoreDatabaseId || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2");
    auth = getAuth(app);
    const rtdbUrl = config.databaseURL || `https://${config.projectId || 'gen-lang-client-0982710068'}-default-rtdb.firebaseio.com`;
    rtdb = getDatabase(app, rtdbUrl);
    isFirebaseConfigured = true;
    console.log("[Firebase Client] Initialized successfully.");
  } else {
    firebaseInitError = "Missing Firebase API Key. Please provide your VITE_FIREBASE_API_KEY environment variable on Vercel.";
    console.warn("[Firebase Client] API Key is missing. Firebase is not configured.");
  }
} catch (err: any) {
  firebaseInitError = err.message || String(err);
  console.error("[Firebase Client] Fatal initialization error:", err);
}

// Verification tracking types
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Enhanced Firestore Error Handler that throws a JSON string containing the context.
 * Required by Firebase integration skill checklist to diagnostics policies.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Captured:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on initialization
 */
async function testConnection() {
  if (!isFirebaseConfigured || !db) return;
  if (typeof window !== 'undefined' && !navigator.onLine) {
    console.info("Firestore: Device is offline. Operating in offline cache mode.");
    return;
  }
  try {
    // Avoid blocking for 10 seconds by racing the server fetch with a fast 2-second timeout fallback
    const promise = getDocFromServer(doc(db, 'test', 'connection'));
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
    await Promise.race([promise, timeout]);
    console.log("Firebase Connection verified successfully.");
  } catch (error) {
    console.info("Firestore: Local cache active (operating in local-first or offline mode).");
  }
}

testConnection();
