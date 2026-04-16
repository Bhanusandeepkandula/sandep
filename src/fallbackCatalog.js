/**
 * Used only when Firestore `config/app` is missing/empty or Firebase is unavailable,
 * so the UI (category chips, payment methods, currency) still works.
 */
export const FALLBACK_CATALOG = {
  categories: [
    { n: "Food", c: "#FF6B35", bg: "rgba(255,107,53,.13)", e: "Food" },
    { n: "Travel", c: "#60A5FA", bg: "rgba(96,165,250,.13)", e: "Travel" },
    { n: "Rent", c: "#A78BFA", bg: "rgba(167,139,250,.13)", e: "Rent" },
    { n: "Shopping", c: "#F472B6", bg: "rgba(244,114,182,.13)", e: "Shopping" },
    { n: "Bills", c: "#FBBF24", bg: "rgba(251,191,36,.13)", e: "Bills" },
    { n: "Entertainment", c: "#22D3EE", bg: "rgba(34,211,238,.13)", e: "Entertainment" },
    { n: "Health", c: "#4ADE80", bg: "rgba(74,222,128,.13)", e: "Health" },
    { n: "Education", c: "#FB923C", bg: "rgba(251,146,60,.13)", e: "Education" },
    { n: "Subscriptions", c: "#E879F9", bg: "rgba(232,121,249,.13)", e: "Subscriptions" },
    { n: "Groceries", c: "#86EFAC", bg: "rgba(134,239,172,.13)", e: "Groceries" },
    { n: "Transport", c: "#93C5FD", bg: "rgba(147,197,253,.13)", e: "Transport" },
    { n: "Investments", c: "#A3E635", bg: "rgba(163,230,53,.13)", e: "Investments" },
    { n: "Insurance", c: "#38BDF8", bg: "rgba(56,189,248,.13)", e: "Insurance" },
    { n: "EMI", c: "#FB7185", bg: "rgba(251,113,133,.13)", e: "EMI" },
    { n: "Others", c: "#94A3B8", bg: "rgba(148,163,184,.13)", e: "Others" },
  ],
  payments: ["Cash", "Credit Card", "Debit Card", "UPI", "Net Banking", "Wallet"],
  currencyCode: "INR",
  locale: "en-IN",
  dateLocale: "en-IN",
  footerLine1: "",
  footerLine2: "",
};

/** Pre-built fixed expense templates the user can pick from when adding mandatory expenses. */
export const FIXED_EXPENSE_TEMPLATES = [
  { name: "House Rent", category: "Rent", icon: "Rent" },
  { name: "Electricity Bill", category: "Bills", icon: "Bills" },
  { name: "Water Bill", category: "Bills", icon: "Bills" },
  { name: "Gas / LPG", category: "Bills", icon: "Bills" },
  { name: "Internet / Broadband", category: "Subscriptions", icon: "Subscriptions" },
  { name: "Mobile Recharge", category: "Subscriptions", icon: "Subscriptions" },
  { name: "Insurance Premium", category: "Insurance", icon: "Insurance" },
  { name: "Loan EMI", category: "EMI", icon: "EMI" },
  { name: "Vehicle EMI", category: "EMI", icon: "EMI" },
  { name: "Streaming (Netflix, etc.)", category: "Subscriptions", icon: "Subscriptions" },
  { name: "Gym / Fitness", category: "Health", icon: "Health" },
  { name: "Groceries (Monthly)", category: "Groceries", icon: "Groceries" },
  { name: "Maid / Cook Salary", category: "Others", icon: "Others" },
  { name: "Society Maintenance", category: "Rent", icon: "Rent" },
  { name: "School / Tuition Fees", category: "Education", icon: "Education" },
  { name: "Transport Pass", category: "Transport", icon: "Transport" },
];

export const OFFLINE_STORAGE_KEY = "track_offline_v1";

/** Per Firebase uid so multiple profiles on one device do not mix offline caches. */
export function offlineStorageKey(uid) {
  if (!uid) return OFFLINE_STORAGE_KEY;
  return `${OFFLINE_STORAGE_KEY}_${uid}`;
}
