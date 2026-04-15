import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

function readFirebaseConfig() {
  const {
    VITE_FIREBASE_API_KEY: apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: authDomain,
    VITE_FIREBASE_PROJECT_ID: projectId,
    VITE_FIREBASE_STORAGE_BUCKET: storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
    VITE_FIREBASE_APP_ID: appId,
    VITE_FIREBASE_MEASUREMENT_ID: measurementId,
  } = import.meta.env;

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    throw new Error(
      "Firebase env missing: copy .env.example to .env.local and set VITE_FIREBASE_* from Firebase Console → Project settings."
    );
  }

  const cfg = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
  if (measurementId) cfg.measurementId = measurementId;
  return cfg;
}

const firebaseConfig = readFirebaseConfig();

export const app = initializeApp(firebaseConfig);

/** Prefer streaming; fall back to long-polling when Listen/WebChannel is blocked (firewalls, some extensions). */
function createFirestore() {
  const force =
    import.meta.env.VITE_FIREBASE_FORCE_LONG_POLLING === "1" ||
    import.meta.env.VITE_FIREBASE_FORCE_LONG_POLLING === "true";
  const settings = force
    ? { experimentalForceLongPolling: true }
    : { experimentalAutoDetectLongPolling: true };
  try {
    return initializeFirestore(app, settings);
  } catch {
    return getFirestore(app);
  }
}

export const db = createFirestore();
export const auth = getAuth(app);

let analyticsInit = null;

/** Safe for Vite build + browsers without Analytics support. */
export function initAnalytics() {
  if (analyticsInit) return analyticsInit;
  analyticsInit = (async () => {
    if (typeof window === "undefined") return null;
    if (!(await isSupported())) return null;
    return getAnalytics(app);
  })();
  return analyticsInit;
}
