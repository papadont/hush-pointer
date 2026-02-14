import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore
} from "firebase/firestore";

const env = import.meta.env as Record<string, string | undefined>;

function getRequiredEnv(name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Firebase env var: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: getRequiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getRequiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID?.trim()
};

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim();

if (appCheckDebugToken) {
  (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | true }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    appCheckDebugToken === "true" ? true : appCheckDebugToken;
}

if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
} else if (import.meta.env.PROD) {
  console.warn("App Check is disabled: VITE_FIREBASE_APPCHECK_SITE_KEY is missing.");
}

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
  });
} catch (error) {
  console.warn("Failed to enable persistent Firestore cache. Falling back to default instance.", error);
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(app);

let anonSignInPromise: Promise<User> | null = null;

export async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  if (!anonSignInPromise) {
    anonSignInPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .finally(() => {
        anonSignInPromise = null;
      });
  }
  return anonSignInPromise;
}
