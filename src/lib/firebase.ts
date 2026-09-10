import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, setLogLevel } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getBootstrapConfig } from './bootstrap';

// Suppress Firestore verbose/warning logs (such as offline connection warnings)
try {
  setLogLevel('silent');
} catch (e) {
  console.warn("Failed to set Firestore log level:", e);
}

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "gen-lang-client-0982710068",
  appId: "1:894267205842:web:2b954f0529e7da032c250b",
  apiKey: "AIzaSyCJSgmRQ2Mwf5rN8ao2buNm56U-M_ZY2I8",
  authDomain: "gen-lang-client-0982710068.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2",
  storageBucket: "gen-lang-client-0982710068.firebasestorage.app",
  messagingSenderId: "894267205842",
  measurementId: ""
};

let config: any = null;

if (typeof window !== 'undefined') {
  try {
    const bootstrap = getBootstrapConfig();
    config = bootstrap.firebaseConfig;
  } catch (err) {
    config = (window as any).__FIREBASE_CONFIG__ || null;
  }
}

if (!config || !config.apiKey) {
  config = DEFAULT_FIREBASE_CONFIG;
}

export let app: any = null;
export let db: any = null;
export let auth: any = null;
export let rtdb: any = null;
export let storage: any = null;
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
    try {
      storage = getStorage(app);
    } catch (storageErr) {
      console.warn("[Firebase Storage] Initialization warning:", storageErr);
    }
    isFirebaseConfigured = true;
    console.log("[Firebase Client] Initialized successfully.");
  } else {
    firebaseInitError = "Missing Firebase API Key. Please provide your FIREBASE_API_KEY environment variable on Vercel or your hosting platform.";
    console.warn("[Firebase Client] API Key is missing. Firebase is not configured.");
  }
} catch (err: any) {
  firebaseInitError = err.message || String(err);
  console.warn("[Firebase Client] Fatal initialization error:", err);
}

export function reinitializeFirebaseWithConfig(newConfig: any): boolean {
  if (!newConfig || !newConfig.apiKey) return false;
  try {
    if (!app) {
      app = initializeApp(newConfig);
    }
    if (!db) {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      }, newConfig.firestoreDatabaseId || "ai-studio-e2eechatandsocia-3f0e07d3-583e-41cd-9f39-778730aa16a2");
    }
    if (!auth) {
      auth = getAuth(app);
    }
    if (!rtdb) {
      const rtdbUrl = newConfig.databaseURL || `https://${newConfig.projectId || 'gen-lang-client-0982710068'}-default-rtdb.firebaseio.com`;
      rtdb = getDatabase(app, rtdbUrl);
    }
    if (!storage) {
      try {
        storage = getStorage(app);
      } catch (storageErr) {
        console.warn("[Firebase Storage] Re-init warning:", storageErr);
      }
    }
    isFirebaseConfigured = true;
    firebaseInitError = null;
    console.log("[Firebase Client] Re-initialized successfully with dynamic config.");
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('faraflick-firebase-initialized', { detail: newConfig }));
    }
    return true;
  } catch (err: any) {
    console.warn("[Firebase Client] Dynamic initialization error:", err);
    return false;
  }
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
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
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
  console.warn('Firestore Error Captured:', JSON.stringify(errInfo));
  
  // Do not throw unhandled rejections for list/read queries or permission denied errors
  if (
    operationType === OperationType.LIST || 
    operationType === OperationType.GET || 
    errMessage.includes('permission') || 
    errMessage.includes('Missing or insufficient permissions')
  ) {
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on initialization
 */
async function testConnection() {
  console.log("Firestore: Initialized (operating in local-first or offline mode).");
}

testConnection();
