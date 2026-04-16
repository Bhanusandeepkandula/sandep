/**
 * Direct browser-side OpenAI call for OCR text → expense CSV.
 * Requires VITE_OPENAI_API_KEY to be set at build time.
 */

import { ensureExpenseCsvHeaderRow, matchCatalogName } from "./importParse.js";

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
- For a bank statement or transaction list with multiple separate transactions: output one data row per transaction.
- Always prefer GRAND TOTAL > TOTAL > subtotal. Taxes and service charges are included in the grand total.

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

/** Minimal CSV row parser — handles double-quoted fields. */
function parseRow(line) {
  const cells = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
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
