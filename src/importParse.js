import Papa from "papaparse";

/** @param {string} h */
function normKey(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Single amount column (do not include separate debit/credit columns here — handled below). */
const AMOUNT_KEYS = ["amount", "amt", "total", "value", "sum", "balance_amount"];
/** Money out (expense) — bank-style columns */
const DEBIT_COLUMN_KEYS = ["withdrawal", "debit_amount", "debit", "dr_amount", "dr", "paid_out", "outflow", "withdrawals"];
/** Money in (income) — if this is the only amount on the row, skip as expense */
const CREDIT_COLUMN_KEYS = ["deposit", "credit_amount", "credit", "cr_amount", "cr", "paid_in", "inflow", "deposits"];
/** Dr/Cr / income vs expense hint (not merchant category) */
const FLOW_KEYS = ["flow", "entry_type", "transaction_type", "txn_type", "dr_cr", "dc", "indicator"];
const DATE_KEYS = ["date", "txn_date", "transaction_date", "posted", "posted_date", "when"];
const CAT_KEYS = ["category", "cat", "type", "expense_category", "merchant_category"];
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
  const n = parseAmountSigned(s);
  if (!Number.isFinite(n) || n === 0) return NaN;
  return Math.abs(n);
}

/**
 * Parses a possibly signed amount; parentheses often mean negative (credit) on statements.
 * @param {string} s
 * @returns {number}
 */
export function parseAmountSigned(s) {
  if (s === undefined || s === null) return NaN;
  let t = String(s).trim();
  if (!t) return NaN;
  const parenNeg = /^\(.*\)$/.test(t.replace(/\s/g, ""));
  t = t.replace(/[₹$€£,\s]/g, "");
  if (parenNeg) {
    t = "-" + t.replace(/[()]/g, "");
  }
  t = t.replace(/[^\d.-]/g, "");
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n === 0) return NaN;
  return n;
}

/**
 * @param {string} raw
 * @returns {boolean} true = bank labels this row as money in (skip as expense)
 */
function isIncomeFlowCell(raw) {
  const x = String(raw).trim().toLowerCase();
  if (!x) return false;
  if (/^(credit|cr|c|deposit|income|inward|received|salary|interest|dividend)$/.test(x)) return true;
  if (/^(debit|dr|d|withdrawal|expense|paid|out)$/.test(x)) return false;
  return false;
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
  if (!r || !names.length) return null;
  const rl = r.toLowerCase();

  // 1. Exact match
  const exact = names.find((n) => n.toLowerCase() === rl);
  if (exact) return exact;

  // 2. Substring match (either direction)
  const inc = names.find((n) => n.toLowerCase().includes(rl) || rl.includes(n.toLowerCase()));
  if (inc) return inc;

  // 3. Plural/singular normalization: "Groceries" ↔ "Grocery", "Bills" ↔ "Bill"
  const norm = (s) => s.toLowerCase().replace(/ies$/, "y").replace(/s$/, "");
  const rNorm = norm(r);
  const pluralMatch = names.find((n) => norm(n) === rNorm);
  if (pluralMatch) return pluralMatch;

  // 4. Word-level overlap: "Food & Dining" matches "Food" or "Dining"
  const rWords = rl.split(/[\s&/,._-]+/).filter((w) => w.length > 2);
  let bestScore = 0;
  let bestName = null;
  for (const n of names) {
    const nWords = n.toLowerCase().split(/[\s&/,._-]+/).filter((w) => w.length > 2);
    let score = 0;
    for (const rw of rWords) {
      for (const nw of nWords) {
        if (rw === nw || nw.startsWith(rw) || rw.startsWith(nw)) score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestName = n;
    }
  }
  if (bestName && bestScore > 0) return bestName;

  return null;
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

/**
 * When the model omits the header row, Papa treats the first data line as column names and returns zero rows.
 * If the first line looks like values (ISO date + amount, or amount + ISO date), prepend a matching header.
 * @param {string} csvText
 */
export function ensureExpenseCsvHeaderRow(csvText) {
  const trimmed = csvText.trim();
  if (!trimmed) return csvText;

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return csvText;

  const firstLine = lines[0];
  const parsedOne = Papa.parse(firstLine, { header: false });
  const row = parsedOne.data?.[0];
  if (!Array.isArray(row) || row.length < 2) return csvText;

  const c0 = String(row[0] ?? "").trim();
  const c1 = String(row[1] ?? "").trim();
  const l0 = c0.toLowerCase();
  const l1 = c1.toLowerCase();

  // First line already looks like a header row
  if (
    ["amount", "date", "category", "amt", "payment", "notes", "tags"].some((h) => l0 === h || l1 === h)
  ) {
    return csvText;
  }

  const c0Date = /^\d{4}-\d{2}-\d{2}$/.test(c0);
  const c1Date = /^\d{4}-\d{2}-\d{2}$/.test(c1);
  const c0Amt = Number.isFinite(parseAmount(c0)) && parseAmount(c0) > 0;
  const c1Amt = Number.isFinite(parseAmount(c1)) && parseAmount(c1) > 0;

  if (c0Date && c1Amt) {
    return `date,amount,category,payment,notes,tags\n${trimmed}`;
  }
  if (c0Amt && c1Date) {
    return `amount,date,category,payment,notes,tags\n${trimmed}`;
  }

  return csvText;
}

/** @param {string} csvText @param {{ categories: string[]; payments: string[] }} catalogLists */
export function parseExpenseCsv(csvText, catalogLists) {
  const { categories, payments } = catalogLists;
  const defaultPay = payments[0] || "";

  const parsed = Papa.parse(ensureExpenseCsvHeaderRow(csvText), {
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

    const flowStr = pick(rec, FLOW_KEYS);
    const dateStr = pick(rec, DATE_KEYS);
    const catStr = pick(rec, CAT_KEYS);
    const payStr = pick(rec, PAY_KEYS);
    const notesStr = pick(rec, NOTES_KEYS);
    const tagsStr = pick(rec, TAGS_KEYS);

    const debitStr = pick(rec, DEBIT_COLUMN_KEYS);
    const creditStr = pick(rec, CREDIT_COLUMN_KEYS);
    const singleAmtStr = pick(rec, AMOUNT_KEYS);

    let amount = NaN;
    let incomeExcluded = false;

    if (flowStr && isIncomeFlowCell(flowStr)) {
      incomeExcluded = true;
    } else {
      const hasDebitCol = Boolean(debitStr && String(debitStr).trim());
      const hasCreditCol = Boolean(creditStr && String(creditStr).trim());
      if (hasDebitCol || hasCreditCol) {
        const da = hasDebitCol ? parseAmountSigned(debitStr) : NaN;
        const ca = hasCreditCol ? parseAmountSigned(creditStr) : NaN;
        const dAbs = Number.isFinite(da) ? Math.abs(da) : 0;
        const cAbs = Number.isFinite(ca) ? Math.abs(ca) : 0;
        if (dAbs > 0) {
          amount = dAbs;
        } else if (cAbs > 0) {
          incomeExcluded = true;
        }
      } else {
        // Single "amount" column: many banks use negative = debit (expense) and positive = credit.
        // Use magnitude; do not treat a bare negative number as income.
        const signed = parseAmountSigned(singleAmtStr);
        if (Number.isFinite(signed) && signed !== 0) {
          amount = Math.abs(signed);
        }
      }
    }

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
    if (incomeExcluded) {
      error = "Excluded: credit / income (not counted as expense)";
    } else if (!Number.isFinite(amount) || amount <= 0) {
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
