/**
 * Direct browser-side OpenAI call for OCR text → expense CSV.
 * Requires VITE_OPENAI_API_KEY to be set at build time.
 */

import { ensureExpenseCsvHeaderRow, matchCatalogName, parseExpenseCsv } from "./importParse.js";

const OPENAI_KEY = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();

const HEADER_LINE = "date,amount,category,payment,notes,tags";

/** Long bank dumps: plain CSV only (JSON line arrays get huge). */
const OCR_JSON_MAX_CHARS = 24_000;

/**
 * Force-correct the year on every YYYY-MM-DD date in CSV data rows.
 * - Months <= current month → current year
 * - Months >  current month → previous year (they haven't happened yet,
 *   so they must belong to the prior year — e.g. Dec when it's Apr 2026 → Dec 2025)
 * This also prevents future expenses and handles year-boundary screenshots
 * (Jan at top, Dec at bottom = two different years).
 */
function forceCorrectYearInCsv(csv, correctYear) {
  if (!csv) return csv;
  const now = new Date();
  const yr = Number(correctYear) || now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  const lines = csv.split("\n");
  return lines
    .map((line, i) => {
      if (i === 0) return line; // header
      return line.replace(/\b\d{4}-(\d{2})-(\d{2})\b/, (_match, mm, dd) => {
        const m = Number(mm);
        const assignedYear = m > curMonth ? yr - 1 : yr;
        return `${assignedYear}-${mm}-${dd}`;
      });
    })
    .join("\n");
}

/**
 * @typedef {{ year?: string; month?: string }} OcrDateContext
 * User-supplied year/month so the model does not guess dates from screenshots.
 */

/**
 * @param {OcrDateContext | undefined} ctx
 * @returns {string} prepended to user messages (empty if no context)
 */
function buildDateContextBlock(ctx) {
  const now = new Date();
  const fallbackYear = String(now.getFullYear());
  const curMonth = now.getMonth() + 1;
  const y = (ctx && typeof ctx === "object" && ctx.year && String(ctx.year).trim()) || fallbackYear;
  const prevY = Number(y) - 1;
  const m = ctx && typeof ctx === "object" && ctx.month ? String(ctx.month).trim() : "";
  const lines = [
    "=== MANDATORY DATE RULES (override everything else about year) ===",
    `YEAR: Default year is ${y}. Use ${y} for every date UNLESS the month number is > ${curMonth} (current month), in which case use ${prevY} for that row. This handles year-boundary lists (e.g. Jan at top, Dec at bottom = Jan ${y}, Dec ${prevY}). Do NOT guess any other year. NO future dates allowed.`,
    m
      ? `MONTH FALLBACK: When the source shows only a day number (no month visible), assume month ${m} (01–12) unless the text clearly shows another month.`
      : "",
    "DAY FALLBACK: If the source shows only MONTH + YEAR (no day), use day 01 (YYYY-MM-01).",
    "NO FUTURE DATES: Never output a date that is in the future relative to today.",
    "If a date cannot be determined at all, add a short follow_up_question asking the user — do not silently pick a random date.",
    "=== End date rules ===",
    "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** @param {string} [text] */
export function ocrTextLooksMissingFourDigitYear(text) {
  return !/\b(19|20)\d{2}\b/.test(String(text || ""));
}

const SYSTEM_PROMPT_CSV_PLAIN = `You are an expense data extractor. Given raw OCR text from a receipt, bank statement, or bill, extract expenses and return ONLY a CSV string.

CRITICAL — first line of your reply MUST be this exact header (copy it verbatim, character for character):
${HEADER_LINE}

Do not put a data row on line 1. Do not skip the header. If there is one expense, output exactly two lines: the header line above, then one data line.

Column rules (data rows only, after the header):
- date: YYYY-MM-DD. ALWAYS follow the MANDATORY DATE RULES block in the user message for the year. If ambiguous (e.g. "12/05"), treat as DD/MM. If OCR shows only MONTH+YEAR (no day), use day 01.
- amount: positive number only, no currency symbols or commas in the number.
- category: MUST be copied EXACTLY (same spelling, same case) from the Categories list. Pick the closest match. If nothing fits, use the very first category in the list.
- payment: MUST be copied EXACTLY from the Payments list. Pick the closest match. If nothing fits, use the very first payment in the list.
- notes: merchant/restaurant name or short description (max 60 chars).
- tags: optional; leave the field empty if none (trailing comma is fine).

Amount rules — IMPORTANT:
- For a single receipt/bill (restaurant, shop, etc.): output EXACTLY ONE data row using the GRAND TOTAL / FINAL TOTAL amount. Never split into individual line items.
- For a bank statement or transaction list: output ONE row per **expense / purchase / money going OUT** only. Do NOT output rows for: salary, payroll, interest earned, dividends, bank credits, deposits, transfers received, or any money **coming IN**. Skip those lines entirely.
- If the text only describes income/credits and no purchases, output the header row only (no data rows).
- Always prefer GRAND TOTAL > TOTAL > subtotal for receipts. Taxes and service charges are included in the grand total.

Output rules:
- Return ONLY the CSV text. No markdown, no explanation, no code fences, no leading commentary.
- Use double-quotes around any field that contains a comma.`;

const SYSTEM_PROMPT_OCR_JSON = `You turn noisy OCR text (typos, broken lines, mixed columns) from receipts, bills, and bank snippets into valid expense data.

YOU MUST OUTPUT ONLY VALID JSON. No markdown fences, no commentary before or after.
Shape:
{"csv_lines":["${HEADER_LINE}","<data row 1>", ...], "follow_up_questions":["<question>", ...]}

csv_lines rules:
- Index 0 must be exactly: ${HEADER_LINE}
- Each further element is ONE complete CSV data row (same columns). Use double-quotes inside a row when a field contains commas.
- Work hard on messy OCR: fix common confusions (O/0, l/1, S/5), merge split lines when obvious, infer merchant names from fragments.
- date: YYYY-MM-DD. ALWAYS follow the MANDATORY DATE RULES block in the user message for the year — never guess a different year. If OCR shows only MONTH+YEAR (no day), use day 01. If the bill date is completely missing, use follow_up_questions to ask the user.
- amount: positive number only, no currency symbols inside the number. NEVER guess a total you cannot support from the text; if no plausible total exists, output csv_lines with HEADER ONLY (no data rows) and ask in follow_up_questions for the grand total / missing amounts.
- category and payment: MUST match the user's lists EXACTLY (same spelling and case). Pick the closest semantic match.
- Single paper receipt: EXACTLY ONE data row = grand total (not every line item). Bank list: one row per purchase/debit (money OUT); skip salary, deposits, credits.
- If the snippet is clearly not financial, output header only and one follow_up_question asking for bill or transaction text.

follow_up_questions (required array, can be empty):
- 0–6 short, specific questions in plain language ONLY when data is missing, ambiguous, or should be verified (e.g. "The total is hard to read — what is the amount on the receipt?", "Which currency is this?").
- Use [] when you are confident and all required fields are grounded in the OCR text.
- Do not duplicate questions.`;

/**
 * Force every category/payment cell to exactly match a catalog entry.
 * Falls back to the first item in the list when nothing matches.
 * @param {string} csv
 * @param {string[]} categories
 * @param {string[]} payments
 * @returns {string}
 */
function fixCatalogColumns(csv, categories, payments) {
  if (!categories.length && !payments.length) return csv;
  const lines = csv.split("\n");
  if (lines.length < 2) return csv;

  const header = lines[0];
  const cols = header.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const catIdx = cols.indexOf("category");
  const payIdx = cols.indexOf("payment");

  const fixed = [header];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV row respecting quoted fields
    const cells = parseRow(line);

    if (catIdx >= 0 && categories.length) {
      const raw = cells[catIdx] || "";
      const matched = matchCatalogName(raw, categories);
      cells[catIdx] = matched || categories[0];
    }
    if (payIdx >= 0 && payments.length) {
      const raw = cells[payIdx] || "";
      const matched = matchCatalogName(raw, payments);
      cells[payIdx] = matched || payments[0];
    }

    fixed.push(cells.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","));
  }
  return fixed.join("\n");
}

/** Minimal CSV row parser — handles double-quoted fields and escaped quotes (""). */
function parseRow(line) {
  const cells = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function requireOpenAiKey() {
  if (!OPENAI_KEY) {
    throw new Error(
      "OpenAI key not configured. Add VITE_OPENAI_API_KEY to your .env.local (dev) or GitHub repository secrets (production), then rebuild."
    );
  }
}

/** @param {unknown[]} items */
function dedupeQuestions(items) {
  const out = [];
  const seen = new Set();
  for (const x of items) {
    const s = String(x || "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * Pull JSON from model reply (may be wrapped in markdown).
 * @param {string} raw
 */
function parseModelJson(raw) {
  const t = String(raw || "")
    .trim()
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  }
  throw new Error("Could not read the AI response. Try again.");
}

/**
 * @param {string} raw
 * @param {string[]} categories
 * @param {string[]} payments
 * @returns {string | null}
 */
function tryRecoverPlainCsvFromRaw(raw, categories, payments) {
  const csv = String(raw || "")
    .replace(/^```(?:csv)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!csv || !/^date\s*,\s*amount/i.test(csv.split("\n")[0] || "")) return null;
  const withHeader = ensureExpenseCsvHeaderRow(csv);
  return fixCatalogColumns(withHeader, categories, payments);
}

/**
 * @param {unknown} parsed
 * @returns {string[]}
 */
function followUpsFromParsed(parsed) {
  const k = parsed && typeof parsed === "object" ? /** @type {Record<string, unknown>} */ (parsed).follow_up_questions : null;
  if (!Array.isArray(k)) return [];
  return k.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

/**
 * @param {unknown} parsed
 * @returns {string}
 */
function csvFromParsedLines(parsed) {
  const p = parsed && typeof parsed === "object" ? /** @type {Record<string, unknown>} */ (parsed) : {};
  if (Array.isArray(p.csv_lines) && p.csv_lines.length > 0) {
    return p.csv_lines.map((x) => String(x).trim()).filter(Boolean).join("\n");
  }
  if (typeof p.csv === "string" && p.csv.trim()) {
    return p.csv.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return "";
}

/**
 * Plain CSV model (best for very long statement text).
 * @param {string} ocrText
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 */
async function convertOcrToCsvLegacy(ocrText, { categories = [], payments = [], dateContext } = {}) {
  requireOpenAiKey();
  const catList = categories.length ? categories.join(", ") : "(none)";
  const payList = payments.length ? payments.join(", ") : "(none)";
  const dc = buildDateContextBlock(dateContext);

  const userMsg = [
    dc,
    `Categories (use exactly as written): ${catList}`,
    `Payments (use exactly as written): ${payList}`,
    `Today's date: ${new Date().toISOString().split("T")[0]}`,
    `First line of your CSV must be exactly: ${HEADER_LINE}`,
    ``,
    `OCR text:`,
    ocrText.trim(),
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_CSV_PLAIN },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `OpenAI error (${res.status})`;
    if (res.status === 401) throw new Error("Invalid OpenAI API key. Check VITE_OPENAI_API_KEY.");
    if (res.status === 429) throw new Error("OpenAI rate limit hit. Wait a moment and try again.");
    throw new Error(msg);
  }

  const data = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!raw) throw new Error("OpenAI returned an empty response. Try again.");

  const csv = raw.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const withHeader = ensureExpenseCsvHeaderRow(csv);
  return fixCatalogColumns(withHeader, categories, payments);
}

/**
 * JSON csv_lines + follow_up_questions (for manual OCR → CSV and shorter statement text).
 * @param {string} ocrText
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 */
async function convertOcrToCsvJson(ocrText, { categories = [], payments = [], dateContext } = {}) {
  requireOpenAiKey();
  const catList = categories.length ? categories.join(", ") : "(none)";
  const payList = payments.length ? payments.join(", ") : "(none)";
  const today = new Date().toISOString().split("T")[0];
  const dc = buildDateContextBlock(dateContext);

  const userMsg = [
    dc,
    `Categories (exact match, same spelling): ${catList}`,
    `Payments (exact match, same spelling): ${payList}`,
    `Today's date: ${today}`,
    ``,
    `OCR / pasted text (may be messy):`,
    ocrText.trim(),
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_OCR_JSON },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `OpenAI error (${res.status})`;
    if (res.status === 401) throw new Error("Invalid OpenAI API key. Check VITE_OPENAI_API_KEY.");
    if (res.status === 429) throw new Error("OpenAI rate limit hit. Wait a moment and try again.");
    throw new Error(msg);
  }

  const data = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!raw) throw new Error("OpenAI returned an empty response. Try again.");

  let parsed;
  try {
    parsed = parseModelJson(raw);
  } catch {
    const recovered = tryRecoverPlainCsvFromRaw(raw, categories, payments);
    if (recovered) {
      return {
        csv: recovered,
        followUpQuestions: [
          "The model did not return valid JSON; this CSV was read from the reply. Please verify amounts, dates, and categories before importing.",
        ],
      };
    }
    throw new Error("Could not parse the AI response. Try again.");
  }

  let inner = csvFromParsedLines(parsed);
  const followUpQuestions = dedupeQuestions(followUpsFromParsed(parsed));

  if (!inner.trim()) {
    const recovered = tryRecoverPlainCsvFromRaw(raw, categories, payments);
    if (recovered) {
      return {
        csv: recovered,
        followUpQuestions: dedupeQuestions([
          ...followUpQuestions,
          "Structured CSV lines were empty; recovered plain CSV from the reply. Please verify every row.",
        ]),
      };
    }
    throw new Error("AI returned no CSV rows. Add clearer totals or dates to the text and try again.");
  }

  const withHeader = ensureExpenseCsvHeaderRow(inner);
  const csv = fixCatalogColumns(withHeader, categories, payments);
  return { csv, followUpQuestions };
}

/**
 * OCR text → CSV plus optional follow-up questions for the user.
 * @param {string} ocrText
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 * @returns {Promise<{ csv: string; followUpQuestions: string[] }>}
 */
export async function convertOcrToCsvStructured(ocrText, { categories = [], payments = [], dateContext } = {}) {
  const trimmed = ocrText.trim();
  if (!trimmed) {
    return { csv: `${HEADER_LINE}\n`, followUpQuestions: [] };
  }
  if (trimmed.length > OCR_JSON_MAX_CHARS) {
    const csv = await convertOcrToCsvLegacy(trimmed, { categories, payments, dateContext });
    return { csv, followUpQuestions: [] };
  }
  return convertOcrToCsvJson(trimmed, { categories, payments, dateContext });
}

/**
 * Convert raw OCR text to expense CSV using OpenAI (plain CSV path for long text).
 * @param {string} ocrText
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 * @returns {Promise<string>} CSV string including header
 */
export async function convertOcrToCsv(ocrText, { categories = [], payments = [], dateContext } = {}) {
  const { csv } = await convertOcrToCsvStructured(ocrText, { categories, payments, dateContext });
  return csv;
}

/** True when CSV parses to at least one valid expense row. */
function assessExpenseCsvQuality(csvString, categories, payments) {
  const withHeader = ensureExpenseCsvHeaderRow(csvString);
  const { rows, fatal } = parseExpenseCsv(withHeader, { categories, payments });
  if (fatal) return false;
  return rows.some((r) => r.ok);
}

const VISION_SYSTEM_PROMPT = `You analyze photos and screenshots for a personal expense app.

STEP 1 — INTENT (required):
- "supported": The image shows a paper receipt, invoice, bill, bank/credit app transaction list, payment confirmation, or any screen where monetary expenses can be read.
- "unsupported": The image is NOT suitable — e.g. selfie, landscape, chat app, social media, game, settings screen with no amounts, blank, unreadable, or unrelated to spending.

STEP 2 — If "unsupported":
Return ONLY valid JSON: {"intent":"unsupported","message":"Short reason for the user (one sentence)."}
Do not include csv.

STEP 3 — If "supported":
Return ONLY valid JSON:
{"intent":"supported","csv_lines":["date,amount,category,payment,notes,tags","first data row",...],"follow_up_questions":[]}

Use "csv_lines" where index 0 is the header line (exactly matching the header below) and each following element is one CSV data row.

Include "follow_up_questions": array of 0–6 short questions for the user ONLY when something is unclear (unreadable total, ambiguous date, currency, cropped screen). Use [] when confident. Never invent amounts — ask instead.

CSV rules (same as text OCR):
- First line MUST be exactly: ${HEADER_LINE}
- One row per expense (grand total for a single receipt; one row per debit/purchase for bank lists).
- Skip income, deposits, salary, credits (money IN).
- date YYYY-MM-DD, amount positive number, category and payment MUST match the provided lists exactly (copy spelling).
- notes: merchant or label, max ~60 chars.
- If the on-screen date does not show a year (e.g. "Apr 15"), ALWAYS follow the MANDATORY DATE RULES block in the user message for the year — never guess a different year.

If the image is blurry but still financial, do your best; if truly unreadable, use intent unsupported with message explaining.`;

/**
 * Image → CSV via vision (no local OCR). Validates intent and CSV quality.
 * @param {string} imageDataUrl data:image/...
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 * @returns {Promise<{ csv: string; followUpQuestions: string[] }>}
 */
export async function convertBillImageToCsvVision(imageDataUrl, { categories = [], payments = [], dateContext } = {}) {
  requireOpenAiKey();

  const catList = categories.length ? categories.join(", ") : "(none)";
  const payList = payments.length ? payments.join(", ") : "(none)";
  const today = new Date().toISOString().split("T")[0];
  const dc = buildDateContextBlock(dateContext);

  const userContent = [
    {
      type: "text",
      text: `${dc}Categories (exact match): ${catList}\nPayments (exact match): ${payList}\nToday's date: ${today}\n\nAnalyze the image and respond with JSON only, following the system rules.`,
    },
    { type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `OpenAI error (${res.status})`;
    if (res.status === 401) throw new Error("Invalid OpenAI API key. Check VITE_OPENAI_API_KEY.");
    if (res.status === 429) throw new Error("OpenAI rate limit hit. Wait a moment and try again.");
    throw new Error(msg);
  }

  const data = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!raw) throw new Error("OpenAI returned an empty response. Try again.");

  let parsed;
  try {
    parsed = parseModelJson(raw);
  } catch {
    throw new Error("Could not parse the AI response. Try again with a clearer image.");
  }

  if (parsed.intent === "unsupported") {
    const m = typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : "This image does not look like a bill or transaction screen.";
    throw new Error(m);
  }

  const csv = csvFromParsedLines(parsed);
  const followUpQuestions = dedupeQuestions(followUpsFromParsed(parsed));

  if (parsed.intent !== "supported" || !csv.trim()) {
    throw new Error("Could not extract expenses from this image. Try a receipt or bank transaction screenshot.");
  }
  const withHeader = ensureExpenseCsvHeaderRow(csv);
  const fixed = fixCatalogColumns(withHeader, categories, payments);

  if (!assessExpenseCsvQuality(fixed, categories, payments)) {
    throw new Error(
      "The image was recognized but no valid expense rows could be built. Try a clearer photo, stronger lighting, or crop to the transaction area."
    );
  }

  return { csv: fixed, followUpQuestions };
}

/**
 * 1) Local OCR text → OpenAI → CSV (+ follow-ups). If quality is poor and an image is available, 2) send the image to vision.
 * @param {string} ocrText from Tesseract / paste / PDF text
 * @param {string | null} imageDataUrl optional screenshot/photo data URL for fallback
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 * @returns {Promise<{ csv: string; followUpQuestions: string[] }>}
 */
export async function convertBillToCsvRobust(ocrText, imageDataUrl, { categories = [], payments = [], dateContext } = {}) {
  const trimmed = ocrText.trim();
  let textCsv = null;
  /** @type {string[]} */
  let followAccum = [];

  const forcedYear = dateContext?.year || String(new Date().getFullYear());
  const applyYearFix = (csv) => forceCorrectYearInCsv(csv, forcedYear);

  if (trimmed.length) {
    const structured = await convertOcrToCsvStructured(trimmed, { categories, payments, dateContext });
    textCsv = applyYearFix(structured.csv);
    followAccum = structured.followUpQuestions.slice();
    if (assessExpenseCsvQuality(textCsv, categories, payments)) {
      return { csv: textCsv, followUpQuestions: dedupeQuestions(followAccum) };
    }
  }

  if (imageDataUrl && String(imageDataUrl).startsWith("data:image/")) {
    const { csv, followUpQuestions } = await convertBillImageToCsvVision(imageDataUrl, { categories, payments, dateContext });
    return { csv: applyYearFix(csv), followUpQuestions: dedupeQuestions([...followAccum, ...followUpQuestions]) };
  }

  if (textCsv) {
    const weak = [...followAccum];
    if (!assessExpenseCsvQuality(textCsv, categories, payments)) {
      weak.push(
        "No row passed validation yet. Each line needs: amount greater than zero, date as YYYY-MM-DD, and category and payment that exactly match your app lists. Add missing numbers or dates to the text box, then tap Convert again, or upload a clearer photo for AI vision."
      );
    }
    return { csv: textCsv, followUpQuestions: dedupeQuestions(weak) };
  }

  throw new Error("Paste or upload bill text, or upload an image so we can read it with AI.");
}
