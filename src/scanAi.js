import { matchCatalogName, parseAmount } from "./importParse.js";

/**
 * Pull JSON from model output (handles markdown fences and extra prose).
 * @param {string} text
 */
export function extractExpenseJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const stripped = raw.replace(/```json?\s*|```/gi, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* fall through */
  }
  const brace = stripped.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]);
    } catch {
      /* ignore */
    }
  }
  return {};
}

function num(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseAmount(String(v));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Resolve total from AI object: prefer explicit totals, else sum line_items.
 * @param {Record<string, unknown>} ex
 */
export function resolveScanAmount(ex) {
  const o = ex && typeof ex === "object" ? ex : {};
  const candidates = [o.total, o.grand_total, o.amount, o.payable, o.net, o.balance];
  for (const c of candidates) {
    const n = num(c);
    if (n > 0) return n;
  }
  const items = Array.isArray(o.line_items) ? o.line_items : [];
  if (items.length) {
    let sum = 0;
    for (const row of items) {
      if (!row || typeof row !== "object") continue;
      const a = num(row.amount ?? row.price ?? row.total);
      if (Number.isFinite(a)) sum += Math.abs(a);
    }
    if (sum > 0) return sum;
  }
  return NaN;
}

/**
 * Map AI output + catalog to form fields.
 * @param {Record<string, unknown>} raw
 * @param {{ categoryNames: string[]; payments: string[]; defaultPayment: string; defaultDate: string }} ctx
 */
export function normalizeScanResult(raw, ctx) {
  const { categoryNames, payments, defaultPayment, defaultDate } = ctx;
  const amount = resolveScanAmount(raw);
  const catRaw = raw && typeof raw === "object" ? raw.category : "";
  const matchedCat =
    typeof catRaw === "string" && catRaw.trim()
      ? matchCatalogName(catRaw, categoryNames)
      : null;
  const category = matchedCat || (categoryNames[0] ?? "");

  const payRaw = raw && typeof raw === "object" ? raw.payment : "";
  const matchedPay =
    typeof payRaw === "string" && payRaw.trim() ? matchCatalogName(payRaw, payments) : null;
  const payment = matchedPay || defaultPayment || (payments[0] ?? "");

  let date = "";
  if (raw && typeof raw === "object" && typeof raw.date === "string" && raw.date.trim()) {
    date = raw.date.trim();
  } else {
    date = defaultDate;
  }

  let notes = "";
  if (raw && typeof raw === "object" && raw.notes != null) {
    notes = String(raw.notes).trim();
  }

  const lineItems = raw && typeof raw === "object" && Array.isArray(raw.line_items) ? raw.line_items : null;

  return {
    amount: Number.isFinite(amount) && amount > 0 ? String(Math.round(amount * 100) / 100) : "",
    category,
    date,
    payment,
    notes,
    lineItems,
  };
}
