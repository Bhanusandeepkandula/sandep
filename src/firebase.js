import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

function readFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDgCn-WcO0T69Kcky3A32WS_dQ3YapmXDY";
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sandeep-1fc6b.firebaseapp.com";
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "sandeep-1fc6b";
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sandeep-1fc6b.firebasestorage.app";
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "947485367975";
  const appId = import.meta.env.VITE_FIREBASE_APP_ID || "1:947485367975:web:d5ec70054cf8f3c42d4582";
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-M5WX44NTWG";

  const cfg = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
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
