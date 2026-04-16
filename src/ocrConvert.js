/**
 * Direct browser-side OpenAI call for OCR text → expense CSV.
 * Requires VITE_OPENAI_API_KEY to be set at build time.
 */

import { ensureExpenseCsvHeaderRow, matchCatalogName, parseExpenseCsv } from "./importParse.js";

const OPENAI_KEY = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();

const HEADER_LINE = "date,amount,category,payment,notes,tags";

const SYSTEM_PROMPT = `You are an expense data extractor. Given raw OCR text from a receipt, bank statement, or bill, extract expenses and return ONLY a CSV string.

CRITICAL — first line of your reply MUST be this exact header (copy it verbatim, character for character):
${HEADER_LINE}

Do not put a data row on line 1. Do not skip the header. If there is one expense, output exactly two lines: the header line above, then one data line.

Column rules (data rows only, after the header):
- date: YYYY-MM-DD. If only day/month visible, use current year. If ambiguous (e.g. "12/05"), treat as DD/MM.
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

/**
 * Convert raw OCR text to expense CSV using OpenAI.
 * @param {string} ocrText
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 * @returns {Promise<string>} CSV string including header
 */
export async function convertOcrToCsv(ocrText, { categories = [], payments = [] } = {}) {
  if (!OPENAI_KEY) {
    throw new Error(
      "OpenAI key not configured. Add VITE_OPENAI_API_KEY to your .env.local (dev) or GitHub repository secrets (production), then rebuild."
    );
  }

  const catList = categories.length ? categories.join(", ") : "(none)";
  const payList = payments.length ? payments.join(", ") : "(none)";

  const userMsg = [
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
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

  // Strip markdown code fences if model wraps output
  const csv = raw.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  const withHeader = ensureExpenseCsvHeaderRow(csv);
  // Post-process: guarantee category/payment exactly match catalog entries
  return fixCatalogColumns(withHeader, categories, payments);
}

/** True when CSV parses to at least one valid expense row. */
function assessExpenseCsvQuality(csvString, categories, payments) {
  const withHeader = ensureExpenseCsvHeaderRow(csvString);
  const { rows, fatal } = parseExpenseCsv(withHeader, { categories, payments });
  if (fatal) return false;
  return rows.some((r) => r.ok);
}

/**
 * Pull JSON from vision model (may be wrapped in markdown).
 * @param {string} raw
 */
function parseVisionIntentJson(raw) {
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

const VISION_SYSTEM_PROMPT = `You analyze photos and screenshots for a personal expense app.

STEP 1 — INTENT (required):
- "supported": The image shows a paper receipt, invoice, bill, bank/credit app transaction list, payment confirmation, or any screen where monetary expenses can be read.
- "unsupported": The image is NOT suitable — e.g. selfie, landscape, chat app, social media, game, settings screen with no amounts, blank, unreadable, or unrelated to spending.

STEP 2 — If "unsupported":
Return ONLY valid JSON: {"intent":"unsupported","message":"Short reason for the user (one sentence)."}
Do not include csv.

STEP 3 — If "supported":
Return ONLY valid JSON: {"intent":"supported","csv_lines":["date,amount,category,payment,notes,tags","first data row",...]}
Use the array "csv_lines" where index 0 is the header line (exactly matching the header below) and each following element is one CSV data row. This avoids escaping issues.

CSV rules (same as text OCR):
- First line MUST be exactly: ${HEADER_LINE}
- One row per expense (grand total for a single receipt; one row per debit/purchase for bank lists).
- Skip income, deposits, salary, credits (money IN).
- date YYYY-MM-DD, amount positive number, category and payment MUST match the provided lists exactly (copy spelling).
- notes: merchant or label, max ~60 chars.

If the image is blurry but still financial, do your best; if truly unreadable, use intent unsupported with message explaining.`;

/**
 * Image → CSV via vision (no local OCR). Validates intent and CSV quality.
 * @param {string} imageDataUrl data:image/...
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 */
export async function convertBillImageToCsvVision(imageDataUrl, { categories = [], payments = [] } = {}) {
  if (!OPENAI_KEY) {
    throw new Error(
      "OpenAI key not configured. Add VITE_OPENAI_API_KEY to your .env.local (dev) or GitHub repository secrets (production), then rebuild."
    );
  }

  const catList = categories.length ? categories.join(", ") : "(none)";
  const payList = payments.length ? payments.join(", ") : "(none)";
  const today = new Date().toISOString().split("T")[0];

  const userContent = [
    { type: "text", text: `Categories (exact match): ${catList}\nPayments (exact match): ${payList}\nToday's date: ${today}\n\nAnalyze the image and respond with JSON only, following the system rules.` },
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
    parsed = parseVisionIntentJson(raw);
  } catch {
    throw new Error("Could not parse the AI response. Try again with a clearer image.");
  }

  if (parsed.intent === "unsupported") {
    const m = typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : "This image does not look like a bill or transaction screen.";
    throw new Error(m);
  }

  let csv = "";
  if (Array.isArray(parsed.csv_lines) && parsed.csv_lines.length > 0) {
    csv = parsed.csv_lines.map((/** @type {unknown} */ x) => String(x).trim()).filter(Boolean).join("\n");
  } else if (typeof parsed.csv === "string" && parsed.csv.trim()) {
    csv = parsed.csv.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }

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

  return fixed;
}

/**
 * 1) Local OCR text → OpenAI → CSV. If quality is poor and an image is available, 2) send the image to vision.
 * @param {string} ocrText from Tesseract / paste / PDF text
 * @param {string | null} imageDataUrl optional screenshot/photo data URL for fallback
 * @param {{ categories?: string[]; payments?: string[] }} catalog
 */
export async function convertBillToCsvRobust(ocrText, imageDataUrl, { categories = [], payments = [] } = {}) {
  const trimmed = ocrText.trim();
  let textCsv = null;

  if (trimmed.length) {
    textCsv = await convertOcrToCsv(trimmed, { categories, payments });
    if (assessExpenseCsvQuality(textCsv, categories, payments)) {
      return textCsv;
    }
  }

  if (imageDataUrl && String(imageDataUrl).startsWith("data:image/")) {
    return await convertBillImageToCsvVision(imageDataUrl, { categories, payments });
  }

  if (textCsv) {
    return textCsv;
  }

  throw new Error("Paste or upload bill text, or upload an image so we can read it with AI.");
}
