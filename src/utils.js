export const uid = () => Math.random().toString(36).slice(2, 9);
const localDate = (d) => {
  const dd = d || new Date();
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
};
export const tdStr = () => localDate();
export const dAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
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
/** Coerce a possibly-string amount to a finite number (falls back to 0). */
function coerceAmount(raw) {
  const a = typeof raw === "number" && Number.isFinite(raw) ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(a) ? a : 0;
}

/** Sum all slave settlements recorded on a master-owned tx. */
function sumMasterSettlements(tx) {
  const s = tx?.settlements;
  if (!s || typeof s !== "object") return 0;
  let total = 0;
  for (const k of Object.keys(s)) total += coerceAmount(s[k]?.amount);
  return total;
}

/**
 * Return the amount that actually counts against the current user's ledger,
 * factoring in settlements so spending goes down as bills get paid back.
 *
 *   Slave (mirror): share − settled_by_me         (floors at 0)
 *   Master (owner): total − sum(slave settlements) (floors at 0)
 *
 * When a bill is fully settled this returns 0 so the transaction disappears
 * from totals, category pies, budget usage, etc. — exactly as if it had been
 * reimbursed, which it effectively has.
 */
export function effectiveAmount(tx, selfProfileUuid, selfFbUid) {
  const full = coerceAmount(tx?.amount);
  const isMirror =
    tx && typeof tx.syncedFromUid === "string" && tx.syncedFromUid.trim().length > 0;

  if (isMirror) {
    const people = Array.isArray(tx?.split?.people) ? tx.split.people : [];
    const uuid = String(selfProfileUuid || "").trim();
    const fbUid = String(selfFbUid || "").trim();
    let share = full;
    if (people.length && (uuid || fbUid)) {
      const selfEntry = people.find(
        (p) => (fbUid && p?.fuid === fbUid) || (uuid && p?.u === uuid)
      );
      if (selfEntry) share = coerceAmount(selfEntry.a);
    }
    const settled = coerceAmount(tx?.settlement?.amount);
    return Math.max(0, share - settled);
  }

  return Math.max(0, full - sumMasterSettlements(tx));
}

/** Sum expense amounts; coerces Firestore/string values so totals never break from type drift. */
export const tot = (txs, selfProfileUuid, selfFbUid) =>
  txs.reduce((s, t) => s + effectiveAmount(t, selfProfileUuid, selfFbUid), 0);
