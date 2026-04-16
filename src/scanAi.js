import { matchCatalogName, parseAmount, parseDateToISO } from "./importParse.js";

/**
 * Force-correct year on a YYYY-MM-DD string:
 * months <= current month → current year, months > current month → previous year.
 */
function forceCorrectDateYear(dateIso) {
  if (!dateIso || typeof dateIso !== "string") return dateIso;
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateIso;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const month = Number(m[2]);
  const year = month > curMonth ? curYear - 1 : curYear;
  return `${year}-${m[2]}-${m[3]}`;
}

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

const MISSING_FIELD_LABELS = {
  total: "the total amount",
  date: "the date",
  category: "the category",
  payment: "the payment method",
  notes: "the merchant or notes",
  line_items: "line-item detail",
};

/**
 * User-facing copy when the model (or heuristics) flagged unreadable fields on a bill image.
 * @param {string[]} missingFields keys: total | date | category | payment | notes | line_items
 */
export function formatMissingScanFieldsMessage(missingFields) {
  if (!Array.isArray(missingFields) || !missingFields.length) return "";
  const keys = [
    ...new Set(
      missingFields
        .map((k) => String(k).trim().toLowerCase())
        .map((k) => (k === "amount" ? "total" : k))
        .filter((k) => MISSING_FIELD_LABELS[k])
    ),
  ];
  const nouns = keys.map((k) => MISSING_FIELD_LABELS[k]);
  if (!nouns.length) return "";
  if (nouns.length === 1) {
    return `We couldn’t read ${nouns[0]} from this bill. Please enter it below before saving.`;
  }
  const list = `${nouns.slice(0, -1).join(", ")}, and ${nouns[nouns.length - 1]}`;
  return `We couldn’t read ${list} from this bill. Please fill in those details below before saving.`;
}

/**
 * Map AI output + catalog to form fields.
 * @param {Record<string, unknown>} raw
 * @param {{ categoryNames: string[]; payments: string[]; defaultPayment: string; defaultDate: string }} ctx
 */
export function normalizeScanResult(raw, ctx) {
  const { categoryNames, payments, defaultPayment, defaultDate } = ctx;

  const rawObj = raw && typeof raw === "object" ? raw : {};
  const mfRaw = rawObj.missing_fields ?? rawObj.missingFields;
  let missingFields = Array.isArray(mfRaw)
    ? mfRaw.map((x) => String(x).trim().toLowerCase().replace(/^amount$/, "total")).filter(Boolean)
    : [];

  const amount = resolveScanAmount(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    if (!missingFields.includes("total")) missingFields.push("total");
  }

  const categoryMissing = missingFields.includes("category");
  const paymentMissing = missingFields.includes("payment");
  const dateMissing = missingFields.includes("date");
  const notesMissing = missingFields.includes("notes");
  const lineItemsMissing = missingFields.includes("line_items");

  const catRaw = rawObj.category;
  let matchedCat = null;
  if (!categoryMissing && typeof catRaw === "string" && catRaw.trim()) {
    matchedCat = matchCatalogName(catRaw, categoryNames);
  }
  const category = categoryMissing ? "" : matchedCat || (categoryNames[0] ?? "");

  const payRaw = rawObj.payment ?? rawObj.payment_hint;
  let matchedPay = null;
  if (!paymentMissing && payRaw != null && String(payRaw).trim() && String(payRaw).trim() !== "null") {
    matchedPay = matchCatalogName(String(payRaw).trim(), payments);
  }
  const payment = paymentMissing ? "" : matchedPay || defaultPayment || (payments[0] ?? "");

  let date = "";
  if (dateMissing) {
    date = "";
  } else if (typeof rawObj.date === "string" && rawObj.date.trim()) {
    date = forceCorrectDateYear(rawObj.date.trim()) || rawObj.date.trim();
  } else {
    date = defaultDate;
  }

  let notes = "";
  if (!notesMissing && rawObj.notes != null) {
    notes = String(rawObj.notes).trim();
  }

  const lineItems =
    lineItemsMissing || !Array.isArray(rawObj.line_items) ? null : rawObj.line_items;

  return {
    amount: Number.isFinite(amount) && amount > 0 ? String(Math.round(amount * 100) / 100) : "",
    category,
    date,
    payment,
    notes,
    lineItems,
    missingFields,
  };
}

/**
 * True when the model classified this as a banking / multi-row screen (not one paper receipt).
 * @param {Record<string, unknown>} raw
 */
export function isVisionTransactionList(raw) {
  if (!raw || typeof raw !== "object") return false;
  const kind = raw.image_kind;
  const txs = raw.transactions;
  if (kind === "transaction_list" && Array.isArray(txs) && txs.length > 0) return true;
  if (Array.isArray(txs) && txs.length >= 2) return true;
  return false;
}

/**
 * One import-preview row per visible expense line from a bank / transactions screenshot.
 * Skips rows marked as income/credit by the model.
 * @param {unknown[]} txs
 * @param {{ categories: string[]; payments: string[] }} ctx
 */
export function buildImportRowsFromVisionTransactions(txs, ctx) {
  const categories = ctx.categories || [];
  const payments = ctx.payments || [];
  const defaultPay = payments[0] || "";

  /** @type {Array<{ line: number; amount: number; date: string; category: string; payment: string; notes: string; tags: string[]; ok: boolean; error?: string }>} */
  const rows = [];
  if (!Array.isArray(txs)) return rows;

  let line = 1;
  for (const t of txs) {
    line++;
    if (!t || typeof t !== "object") continue;
    const o = /** @type {Record<string, unknown>} */ (t);

    if (o.is_credit_or_income === true || o.is_expense === false) continue;

    const amtRaw = o.amount ?? o.total ?? "";
    const amount =
      typeof amtRaw === "number" && Number.isFinite(amtRaw)
        ? Math.abs(amtRaw)
        : parseAmount(String(amtRaw));

    const dateStr = typeof o.date === "string" ? o.date.trim() : "";
    const dateIso = dateStr ? forceCorrectDateYear(parseDateToISO(dateStr)) : null;

    const notes = String(o.notes ?? o.merchant ?? o.description ?? o.payee ?? "").trim();

    const catHint = String(o.category ?? o.category_hint ?? "").trim();
    const cat =
      (catHint ? matchCatalogName(catHint, categories) : null) ??
      (notes ? matchCatalogName(notes, categories) : null) ??
      (categories[0] || null);

    const payRaw = o.payment ?? o.payment_hint;
    const payHint = payRaw != null ? String(payRaw).trim() : "";
    let pay = defaultPay;
    if (payHint && payHint !== "null") {
      const matched = matchCatalogName(payHint, payments);
      if (matched) pay = matched;
    }

    let error = "";
    if (!Number.isFinite(amount) || amount <= 0) {
      error = "Missing or invalid amount";
    } else if (!dateIso) {
      error = "Missing or invalid date";
    } else if (!cat && categories.length > 0) {
      error = "Could not match category — pick from list";
    } else if (!pay && payments.length > 0) {
      error = "Could not match payment method";
    }

    rows.push({
      line,
      amount: Number.isFinite(amount) ? amount : 0,
      date: dateIso || "",
      category: cat || "",
      payment: pay || defaultPay,
      notes,
      tags: [],
      ok: !error,
      error: error || undefined,
    });
  }

  return rows;
}
