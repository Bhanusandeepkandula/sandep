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

const MERCHANT_CATEGORY_INTELLIGENCE = `
=== MERCHANT → CATEGORY INTELLIGENCE (use to pick the best category) ===
Categorize by PURPOSE of the spend, not the store name. Use these rules to pick from the user's category list:

FOOD / DINING / RESTAURANTS:
- Restaurant names, "SQ *", Uber Eats, DoorDash, Grubhub, Pei Wei, Chipotle, McDonald's, Starbucks, Dunkin, Chick-fil-A, Panera, Subway, pizza, diner, cafe, bistro, grill, buffet, sushi, ramen, taco, BBQ, bakery
- Keywords: "purchase" at a food establishment, POS terminal at eatery

GROCERIES:
- Walmart (grocery context), Costco, Sam's Club, Kroger, Safeway, Albertsons, Publix, Trader Joe's, Whole Foods, Aldi, H-E-B, Target (grocery), WinCo, Sprouts, Fresh Market, ethnic grocery stores

TRANSPORT / GAS / AUTO:
- Shell, Chevron, BP, ExxonMobil, Texaco, 76, Marathon, Speedway, QuikTrip, Casey's, Wawa (gas)
- Uber, Lyft, taxi, parking, toll, DMV, auto parts, car wash, oil change, tire, mechanic

SHOPPING / RETAIL:
- Amazon, Target, Walmart (non-grocery), Best Buy, Home Depot, Lowe's, IKEA, Costco (non-grocery), TJ Maxx, Marshalls, Ross, Nordstrom, Macy's, clothing stores, electronics stores

BILLS / UTILITIES:
- Electric, gas (utility), water, sewer, trash, internet, phone bill, AT&T, Verizon, T-Mobile, Comcast, Spectrum, Duke Energy, PG&E, municipal utility

SUBSCRIPTIONS:
- Netflix, Spotify, Disney+, Hulu, HBO Max, Apple TV+, YouTube Premium, Amazon Prime, Adobe, Microsoft 365, iCloud, Dropbox, gym membership, newspaper

MEDICAL / HEALTH:
- Pharmacy, CVS, Walgreens, Rite Aid, doctor, dentist, hospital, clinic, urgent care, lab, insurance copay, optical, mental health

TRANSFERS (skip as expense or use Transfer category if available):
- Zelle, Venmo (sent), PayPal (sent), Cash App, bank transfer, wire transfer, ACH, "CAPITAL ONE" (payment to credit card), "DISCOVER" (card payment), mortgage payment between own accounts
- Zelle Money Sent = Transfer. Zelle Money Received = income (SKIP).
- "Transfer" from/to own accounts = NOT an expense, skip or use Transfer category.

INCOME (ALWAYS SKIP — never output as expense row):
- Salary, payroll, direct deposit, interest earned, dividends, refund, cashback reward, tax refund, venmo/zelle received, incoming transfer, deposit, "+$" amounts in green, credits
- Keywords: "deposit", "credit", "received", "incoming", "payroll", "interest"

RENT / HOUSING:
- Rent payment, mortgage, HOA, property management, apartment complex names

EDUCATION:
- Tuition, university, college, school, Coursera, Udemy, textbook, student loan payment

ENTERTAINMENT:
- Movies, concerts, sports tickets, amusement, gaming, Steam, PlayStation, Xbox, Nintendo, bowling, arcade, museum, zoo

TRAVEL:
- Airlines, hotels, Airbnb, booking.com, Expedia, luggage, car rental, Hertz, Enterprise, toll roads
=== End merchant intelligence ===

=== PAYMENT METHOD INTELLIGENCE (use to pick the best payment) ===
Detect the payment method from clues in the receipt, OCR text, or screenshot:

CREDIT CARD indicators:
- "Visa", "Mastercard", "MC", "Amex", "American Express", "Discover" on the receipt
- Card number ending (e.g. "****1234", "x1234", "ending in 1234")
- "Credit", "CR", "credit card" in the payment line
- Online purchases (Amazon, subscriptions) are almost always credit card
- "Purchase" label in a bank app usually means card swipe

DEBIT CARD indicators:
- "Debit", "DB", "debit card", "check card" on receipt or bank statement
- "POS" (Point of Sale) prefix in bank transaction description
- Bank app showing from a checking account
- Grocery/gas station transactions often use debit

CASH indicators:
- "Cash", "CASH TENDERED", "Change due", "CASH PAYMENT" on receipt
- Exact round amounts with no card number shown

DIGITAL / MOBILE PAYMENT indicators:
- "Apple Pay", "Google Pay", "Samsung Pay", "Tap to Pay", "Contactless"
- "PayPal", "Venmo", "Cash App", "Zelle" — use the exact name
- UPI, GPay, PhonePe (India)

BANK TRANSFER indicators:
- "ACH", "Wire", "EFT", "Direct Debit", "Auto-pay", "Bank Transfer"
- Utility bills, rent, mortgage often use bank transfer or auto-pay

CHECK indicators:
- "Check #", "Cheque", check number visible

RULES:
- Match the detected payment type to the CLOSEST entry in the user's Payments list (exact spelling).
- If the receipt shows a card ending (e.g. "Visa ****4521"), and the user has "Visa" or "Credit Card" in their list, pick that.
- If the source is a BANK STATEMENT (not a receipt) and you cannot tell if it's credit or debit from the text, add a follow_up_question: "Is this account a credit card or debit/checking account?" (JSON mode only).
- If no payment clue exists at all, use the first payment in the user's list as default.
=== End payment intelligence ===`;

const SYSTEM_PROMPT_CSV_PLAIN = `You are an expert expense data extractor with merchant intelligence. Given raw OCR text from a receipt, bank statement, or bill, extract expenses and return ONLY a CSV string.

CRITICAL — first line of your reply MUST be this exact header (copy it verbatim, character for character):
${HEADER_LINE}

Do not put a data row on line 1. Do not skip the header. If there is one expense, output exactly two lines: the header line above, then one data line.

${MERCHANT_CATEGORY_INTELLIGENCE}

Column rules (data rows only, after the header):
- date: YYYY-MM-DD. ALWAYS follow the MANDATORY DATE RULES block in the user message for the year. If ambiguous (e.g. "12/05"), treat as DD/MM. If OCR shows only MONTH+YEAR (no day), use day 01.
- amount: positive number only, no currency symbols or commas in the number. Read the EXACT amount from the text — never round or guess.
- category: Use the MERCHANT CATEGORY INTELLIGENCE above to understand the transaction, then pick the CLOSEST match from the user's Categories list. MUST be copied EXACTLY (same spelling, same case). If nothing fits, use the very first category in the list.
- payment: Use PAYMENT METHOD INTELLIGENCE to detect the payment method from receipt clues (card type, "Cash", "Debit", card ending, POS, etc.), then pick the CLOSEST match from the user's Payments list. MUST be copied EXACTLY. If nothing fits, use the first payment in the list.
- notes: merchant/restaurant CLEAN name (remove "SQ *", "TST*", store numbers, "#1234"). Max 60 chars.
- tags: optional; leave the field empty if none (trailing comma is fine).

AMOUNT EXTRACTION — CRITICAL:
- For a single receipt/bill (restaurant, shop, etc.): output EXACTLY ONE data row using the GRAND TOTAL / FINAL TOTAL amount. Never split into individual line items. Prefer: Grand Total > Total Due > Total > Balance Due > Subtotal+Tax.
- For a bank statement or transaction list: output ONE row per expense/purchase/money going OUT only.
- SKIP these entirely (do NOT output rows): salary, payroll, interest earned, dividends, bank credits, deposits, transfers received, refunds, cashback, any money COMING IN, "+$" green amounts.
- If the text only describes income/credits and no purchases, output the header row only (no data rows).

OCR ERROR CORRECTION:
- Fix common OCR confusions: O↔0, l↔1, S↔5, B↔8, Z↔2, comma↔period in amounts.
- Merge split lines: if a merchant name is on one line and the amount on the next, combine them.
- "SQ *MERCHANT" → notes: "Merchant". "TST* RESTAURANT" → notes: "Restaurant". Strip prefixes.

Output rules:
- Return ONLY the CSV text. No markdown, no explanation, no code fences, no leading commentary.
- Use double-quotes around any field that contains a comma.`;

const SYSTEM_PROMPT_OCR_JSON = `You are an expert expense data extractor with merchant intelligence. You turn noisy OCR text (typos, broken lines, mixed columns) from receipts, bills, and bank snippets into valid expense data.

YOU MUST OUTPUT ONLY VALID JSON. No markdown fences, no commentary before or after.
Shape:
{"csv_lines":["${HEADER_LINE}","<data row 1>", ...], "follow_up_questions":["<question>", ...]}

${MERCHANT_CATEGORY_INTELLIGENCE}

csv_lines rules:
- Index 0 must be exactly: ${HEADER_LINE}
- Each further element is ONE complete CSV data row (same columns). Use double-quotes inside a row when a field contains commas.

OCR ERROR CORRECTION (apply aggressively):
- Fix common confusions: O↔0, l↔1, S↔5, B↔8, Z↔2, comma↔period in dollar amounts.
- Merge split lines: if a merchant name is on one line and the amount on the next, combine them into one row.
- Reconstruct merchant names from fragments: "STAR BUCKS" → "Starbucks", "WAL MART" → "Walmart", "CHICK FIL" → "Chick-fil-A".
- Clean prefixes: "SQ *MERCHANT" → "Merchant", "TST* RESTAURANT" → "Restaurant", "PP*PAYPAL" → actual merchant.
- If text has columns (date | description | amount | balance), read each column correctly — balance is NOT the expense amount.

FIELD RULES:
- date: YYYY-MM-DD. ALWAYS follow the MANDATORY DATE RULES block in the user message — never guess a different year. If OCR shows only MONTH+YEAR (no day), use day 01. If the bill date is completely missing, use follow_up_questions to ask the user.
- amount: positive number only, no currency symbols. Read the EXACT number from the text. For receipts, use GRAND TOTAL (includes tax+tip). NEVER guess a total you cannot support from the text; if no plausible total exists, output csv_lines with HEADER ONLY and ask in follow_up_questions.
- category: Use MERCHANT CATEGORY INTELLIGENCE to understand the transaction, then pick the CLOSEST match from the user's category list. MUST match EXACTLY (same spelling and case).
- payment: Use PAYMENT METHOD INTELLIGENCE to detect payment from receipt/statement clues (card brand, "Cash", "Debit", "POS", card ending). MUST match the user's payment list EXACTLY. If source is a bank statement and credit vs debit is unclear, ask in follow_up_questions.
- notes: CLEAN merchant name (no store numbers, no "SQ*", no "#1234"). Max 60 chars.
- tags: optional; leave empty if none.

AMOUNT + ROW RULES:
- Single paper receipt: EXACTLY ONE data row = grand total. Never split line items into separate rows.
- Bank/transaction list: one row per purchase/debit (money OUT). SKIP: salary, payroll, deposits, interest, refunds, cashback, transfers received, "+$" credits, any money coming IN.
- "Zelle Money Sent" = expense (Transfer). "Zelle Money Received" = income (SKIP). "Transfer" between own accounts = check context.
- If the snippet is clearly not financial, output header only and one follow_up_question.

follow_up_questions (required array, can be empty):
- 0–6 short, specific questions ONLY when data is genuinely missing or ambiguous.
- Examples: "The total is hard to read — what is the amount?", "Is the $5,249.82 from BLUEICON INC income or an expense?"
- Use [] when confident. Do not duplicate. Do not ask unnecessary questions.`;

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
  let t = String(raw || "")
    .trim()
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Strip any leading prose before the JSON (model sometimes adds explanation)
  const firstBrace = t.indexOf("{");
  if (firstBrace > 0) {
    t = t.slice(firstBrace);
  }

  // Try direct parse
  try {
    return JSON.parse(t);
  } catch { /* continue */ }

  // Try extracting the outermost JSON object
  const m = t.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* continue */ }
  }

  // Try fixing common JSON issues: trailing commas, single quotes
  try {
    const fixed = t
      .replace(/,\s*([}\]])/g, "$1") // trailing commas
      .replace(/'/g, '"');           // single quotes → double
    return JSON.parse(fixed);
  } catch { /* continue */ }

  // Last resort: try extracting JSON array (some models return [])
  const arrMatch = t.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return { csv_lines: JSON.parse(arrMatch[0]), follow_up_questions: [] }; } catch { /* continue */ }
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
  let csv = String(raw || "")
    .replace(/^```(?:csv)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Strip any leading prose before the CSV header
  const lines = csv.split("\n");
  const headerIdx = lines.findIndex((l) => /^date\s*,\s*amount/i.test(l.trim()));
  if (headerIdx > 0) {
    csv = lines.slice(headerIdx).join("\n");
  } else if (headerIdx < 0) {
    // Try to find any line that looks like CSV data (YYYY-MM-DD,number,...)
    const dataIdx = lines.findIndex((l) => /^\d{4}-\d{2}-\d{2}\s*,/.test(l.trim()));
    if (dataIdx >= 0) {
      csv = HEADER_LINE + "\n" + lines.slice(dataIdx).join("\n");
    } else {
      return null;
    }
  }

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

const VISION_SYSTEM_PROMPT = `You are an expert expense extractor with merchant intelligence. You analyze photos and screenshots for a personal expense tracking app.

STEP 1 — INTENT (required):
- "supported": The image shows a paper receipt, invoice, bill, bank/credit app transaction list, payment confirmation, Zelle/Venmo screen, or any screen where monetary expenses can be read.
- "unsupported": The image is NOT suitable — e.g. selfie, landscape, chat app, social media, game, settings screen with no amounts, blank, unreadable, or unrelated to spending.

STEP 2 — If "unsupported":
Return ONLY valid JSON: {"intent":"unsupported","message":"Short reason for the user (one sentence)."}

STEP 3 — If "supported":
Return ONLY valid JSON:
{"intent":"supported","csv_lines":["${HEADER_LINE}","first data row",...],"follow_up_questions":[]}

${MERCHANT_CATEGORY_INTELLIGENCE}

CSV FIELD RULES:
- csv_lines[0] MUST be exactly: ${HEADER_LINE}
- Each following element = one CSV data row. Use double-quotes if a field contains commas.

- date: YYYY-MM-DD. ALWAYS follow the MANDATORY DATE RULES block in the user message — never guess a different year. If the screen shows "Apr 15" with no year, use the year from MANDATORY DATE RULES.
- amount: positive number, EXACT as shown on screen. No currency symbols, no commas. For receipts: use GRAND TOTAL (includes tax+tip). For bank lists: use the transaction amount (NOT the running balance column).
- category: Use MERCHANT CATEGORY INTELLIGENCE to understand the merchant/transaction, then pick the CLOSEST match from the user's Categories list. Copy EXACTLY (same spelling, same case).
- payment: Use PAYMENT METHOD INTELLIGENCE to detect from visual clues (card logo, "Visa ****1234", "Cash", "Debit", bank app name). Copy EXACTLY from user's Payments list. If bank statement and credit vs debit is unclear, ask in follow_up_questions.
- notes: CLEAN merchant name — remove "SQ *", "TST*", store numbers, "#1234", "Purchase", "Transfer" prefixes. Just the merchant name. Max 60 chars.
- tags: optional; leave empty.

ROW RULES:
- Single receipt/bill: EXACTLY ONE row = grand total. Never split into line items.
- Bank/transaction list screenshot: ONE row per expense (money OUT). Read EVERY visible row, top to bottom.
- SKIP (never output as expense): deposits, salary, interest, refunds, cashback, incoming transfers, Zelle received, green "+$" amounts, credits.
- "Zelle Money Sent" → expense. "Zelle Money Received" / incoming transfer → SKIP.
- Balance column (running total after each transaction) is NOT the expense amount — use the transaction amount column.

follow_up_questions: 0–6 short questions ONLY when genuinely ambiguous. Use [] when confident. Never invent amounts — ask instead.

If the image is blurry but still financial, extract what you can; if truly unreadable, use intent unsupported.`;

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
