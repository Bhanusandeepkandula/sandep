export const uid = () => Math.random().toString(36).slice(2, 9);
export const tdStr = () => new Date().toISOString().split("T")[0];
export const dAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

/** @param {{ n: string, c: string, bg: string, e: string }[]} cats */
export function getCat(cats, n) {
  if (!cats || cats.length === 0) {
    return { n: n || "?", c: "#94A3B8", bg: "rgba(148,163,184,.13)", e: "?" };
  }
  return cats.find((c) => c.n === n) || cats[cats.length - 1];
}

/**
 * @param {number} n
 * @param {{ currency?: string; locale?: string }} opts from Firestore catalog
 */
export function fmt(n, opts = {}) {
  const { currency, locale } = opts;
  if (currency && locale) {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  }
  if (currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export const fDate = (s, loc) => {
  if (s === tdStr()) return "Today";
  if (s === dAgo(1)) return "Yesterday";
  const opts = { day: "numeric", month: "short" };
  return new Date(s + "T00:00:00").toLocaleDateString(loc && String(loc).trim() ? loc : undefined, opts);
};
export const filterTx = (txs, f, cs, ce) => {
  const now = new Date();
  return txs.filter((tx) => {
    const raw = tx.date && String(tx.date).trim();
    if (!raw) return false;
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    if (f === "today") return tx.date === tdStr();
    if (f === "week") {
      const wa = new Date(now);
      wa.setDate(wa.getDate() - 7);
      return d >= wa;
    }
    if (f === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (f === "custom" && cs && ce) return tx.date >= cs && tx.date <= ce;
    return true;
  });
};
/** Sum expense amounts; coerces Firestore/string values so totals never break from type drift. */
export const tot = (txs) =>
  txs.reduce((s, t) => {
    const raw = t?.amount;
    const a = typeof raw === "number" && Number.isFinite(raw) ? raw : parseFloat(String(raw ?? ""));
    return s + (Number.isFinite(a) ? a : 0);
  }, 0);
