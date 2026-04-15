/**
 * Used only when Firestore `config/app` is missing/empty or Firebase is unavailable,
 * so the UI (category chips, payment methods, currency) still works.
 */
export const FALLBACK_CATALOG = {
  categories: [
    { n: "Food", c: "#FF6B35", bg: "rgba(255,107,53,.13)", e: "🍔" },
    { n: "Travel", c: "#60A5FA", bg: "rgba(96,165,250,.13)", e: "✈️" },
    { n: "Rent", c: "#A78BFA", bg: "rgba(167,139,250,.13)", e: "🏠" },
    { n: "Shopping", c: "#F472B6", bg: "rgba(244,114,182,.13)", e: "🛍️" },
    { n: "Bills", c: "#FBBF24", bg: "rgba(251,191,36,.13)", e: "⚡" },
    { n: "Entertainment", c: "#22D3EE", bg: "rgba(34,211,238,.13)", e: "🎬" },
    { n: "Health", c: "#4ADE80", bg: "rgba(74,222,128,.13)", e: "❤️" },
    { n: "Education", c: "#FB923C", bg: "rgba(251,146,60,.13)", e: "📚" },
    { n: "Subscriptions", c: "#E879F9", bg: "rgba(232,121,249,.13)", e: "🔄" },
    { n: "Groceries", c: "#86EFAC", bg: "rgba(134,239,172,.13)", e: "🛒" },
    { n: "Transport", c: "#93C5FD", bg: "rgba(147,197,253,.13)", e: "🚗" },
    { n: "Investments", c: "#A3E635", bg: "rgba(163,230,53,.13)", e: "📈" },
    { n: "Others", c: "#94A3B8", bg: "rgba(148,163,184,.13)", e: "📦" },
  ],
  payments: ["Cash", "Credit Card", "Debit Card", "UPI", "Net Banking", "Wallet"],
  currencyCode: "INR",
  locale: "en-IN",
  dateLocale: "en-IN",
  footerLine1: "",
  footerLine2: "",
};

export const OFFLINE_STORAGE_KEY = "track_offline_v1";

/** Per Firebase uid so multiple profiles on one device do not mix offline caches. */
export function offlineStorageKey(uid) {
  if (!uid) return OFFLINE_STORAGE_KEY;
  return `${OFFLINE_STORAGE_KEY}_${uid}`;
}
