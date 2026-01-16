// src/services/firebaseConfig.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserSessionPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const missingKeys = requiredKeys.filter((key) => !import.meta.env[key]);

export const firebaseConfigStatus = {
  ready: missingKeys.length === 0,
  missingKeys,
};

export const firebaseConfigError = firebaseConfigStatus.ready
  ? null
  : `Firebase env missing: ${missingKeys.join(", ")}`;

const firebaseConfig = firebaseConfigStatus.ready
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    }
  : null;

if (!firebaseConfigStatus.ready) {
  console.error(`[FIREBASE] Missing env keys: ${missingKeys.join(", ")}`);
}

const app = firebaseConfig ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const googleProvider = new GoogleAuthProvider();

export const firebaseSignInWithPopup = signInWithPopup;
export const firebaseSignInWithRedirect = signInWithRedirect;
export const firebaseSignOut = signOut;
export { signInWithPopup, signInWithRedirect, signOut };

export const ensureAuthPersistence = async (mode: "local" | "session" = "local") => {
  if (!auth) return;
  try {
    if (mode === "session") {
      await setPersistence(auth, browserSessionPersistence);
      return;
    }

    // Prefer indexedDB for iOS PWA stability; fallback gracefully
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
      return;
    } catch (e) {
      console.warn("[FIREBASE] indexedDB persistence failed, falling back to browserLocalPersistence.", e);
    }

    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("[FIREBASE] Failed to set auth persistence.", error);
  }
};
