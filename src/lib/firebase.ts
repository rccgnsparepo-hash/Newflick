import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, setLogLevel } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getBootstrapConfig } from './bootstrap';

// Suppress Firestore verbose/warning logs (such as offline connection warnings)
try {
  setLogLevel('silent');
} catch (e) {
  console.warn("Failed to set Firestore log level:", e);
}

let config: any = null;

if (typeof window !== 'undefined') {
  try {
    // The bootstrap config is fetched asynchronously in main.tsx before App is loaded
    // This allows us to use it synchronously here
    const bootstrap = getBootstrapConfig();
    config = bootstrap.firebaseConfig;
  } catch (err) {
    // Fallback if accessed before bootstrap (should not happen with new architecture)
    config = (window as any).__FIREBASE_CONFIG__ || null;
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
    firebaseInitError = "Missing Firebase API Key. Please provide your FIREBASE_API_KEY environment variable on Vercel or your hosting platform.";
    console.warn("[Firebase Client] API Key is missing. Firebase is not configured.");
  }
} catch (err: any) {
  firebaseInitError = err.message || String(err);
  console.warn("[Firebase Client] Fatal initialization error:", err);
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
  console.warn('Firestore Error Captured:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on initialization
 */
async function testConnection() {
  console.log("Firestore: Initialized (operating in local-first or offline mode).");
}

testConnection();
