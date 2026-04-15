import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgCn-WcO0T69Kcky3A32WS_dQ3YapmXDY",
  authDomain: "sandeep-1fc6b.firebaseapp.com",
  projectId: "sandeep-1fc6b",
  storageBucket: "sandeep-1fc6b.firebasestorage.app",
  messagingSenderId: "947485367975",
  appId: "1:947485367975:web:d5ec70054cf8f3c42d4582",
  measurementId: "G-M5WX44NTWG",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
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
