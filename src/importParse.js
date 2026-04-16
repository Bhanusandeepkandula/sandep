import Papa from "papaparse";

/** @param {string} h */
function normKey(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

const AMOUNT_KEYS = ["amount", "amt", "debit", "credit", "total", "value", "sum"];
const DATE_KEYS = ["date", "txn_date", "transaction_date", "posted", "posted_date", "when"];
const CAT_KEYS = ["category", "cat", "type", "expense_category"];
const PAY_KEYS = ["payment", "pay", "method", "payment_method", "account"];
const NOTES_KEYS = ["notes", "description", "memo", "merchant", "payee", "details", "narration"];
const TAGS_KEYS = ["tags", "tag", "labels"];

/**
 * @param {Record<string, unknown>} rec
 * @param {string[]} keys
 */
function pick(rec, keys) {
  for (const k of keys) {
    const v = rec[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return "";
}

/** @param {string} s */
export function parseAmount(s) {
  const t = String(s)
    .replace(/[₹$€£,\s]/g, "")
    .replace(/[^\d.-]/g, "");
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n === 0) return NaN;
  return Math.abs(n);
}

/** @param {string} input */
export function parseDateToISO(input) {
  const t = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const slash = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    let [, a, b, y] = slash;
    y = y.length === 2 ? `20${y}` : y;
    const ai = +a;
    const bi = +b;
    if (ai > 12) return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (bi > 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

/**
 * @param {string} raw
 * @param {string[]} names exact category names from catalog
 */
export function matchCatalogName(raw, names) {
  const r = String(raw).trim();
  if (!r) return null;
  const rl = r.toLowerCase();
  const exact = names.find((n) => n.toLowerCase() === rl);
  if (exact) return exact;
  const inc = names.find((n) => n.toLowerCase().includes(rl) || rl.includes(n.toLowerCase()));
  return inc || null;
}

/**
 * @typedef {{
 *   line: number;
 *   amount: number;
 *   date: string;
 *   category: string;
 *   payment: string;
 *   notes: string;
 *   tags: string[];
 *   ok: boolean;
 *   error?: string;
 * }} importRow
 */

/** @param {string} csvText @param {{ categories: string[]; payments: string[] }} catalogLists */
export function parseExpenseCsv(csvText, catalogLists) {
  const { categories, payments } = catalogLists;
  const defaultPay = payments[0] || "";

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normKey(h),
  });

  if (parsed.errors?.length) {
    const fatal = parsed.errors.find((e) => e.type === "Quotes" || e.type === "Delimiter");
    if (fatal) {
      return { rows: [], fatal: fatal.message || "Could not parse CSV." };
    }
  }

  const data = parsed.data;
  if (!Array.isArray(data) || data.length === 0) {
    return { rows: [], fatal: "No rows found. Add a header row and at least one data row." };
  }

  /** @type {importRow[]} */
  const rows = [];
  let line = 1;

  for (const raw of data) {
    line++;
    const rec = {};
    for (const [k, v] of Object.entries(raw)) {
      rec[normKey(k)] = v;
    }

    const amtStr = pick(rec, AMOUNT_KEYS);
    const dateStr = pick(rec, DATE_KEYS);
    const catStr = pick(rec, CAT_KEYS);
    const payStr = pick(rec, PAY_KEYS);
    const notesStr = pick(rec, NOTES_KEYS);
    const tagsStr = pick(rec, TAGS_KEYS);

    const amount = parseAmount(amtStr);
    const dateIso = dateStr ? parseDateToISO(dateStr) : null;
    const cat = catStr ? matchCatalogName(catStr, categories) : null;
    const pay = payStr ? matchCatalogName(payStr, payments) : defaultPay;

    const tags = tagsStr
      ? tagsStr
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const allEmpty = Object.values(rec).every((v) => v === undefined || v === null || String(v).trim() === "");
    if (allEmpty) continue;

    let error = "";
    if (!Number.isFinite(amount) || amount <= 0) {
      error = "Missing or invalid amount";
    } else if (!dateIso) {
      error = "Missing or invalid date";
    } else if (!cat) {
      error = categories.length
        ? `Unknown category “${catStr}” — use one of your app categories`
        : "No categories configured";
    } else if (!pay && payments.length) {
      error = "Could not match payment method";
    }

    rows.push({
      line,
      amount,
      date: dateIso || tdStrFallback(),
      category: cat || "",
      payment: pay || defaultPay,
      notes: notesStr,
      tags,
      ok: !error,
      error: error || undefined,
    });
  }

  if (rows.length === 0) {
    return { rows: [], fatal: "No usable rows. Required columns: amount, date, category (see docs)." };
  }

  return { rows, fatal: null };
}

function tdStrFallback() {
  return new Date().toISOString().split("T")[0];
}
