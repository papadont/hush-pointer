import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "[REDACTED_GCP_API_KEY]",
  authDomain: "hush-pointer.firebaseapp.com",
  projectId: "hush-pointer",
  storageBucket: "hush-pointer.firebasestorage.app",
  messagingSenderId: "926418008768",
  appId: "1:926418008768:web:a3c20d5a70cfb6a7c10b25",
  measurementId: "G-PWDENYWTRM"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
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
