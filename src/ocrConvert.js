/**
 * Direct browser-side OpenAI call for OCR text → expense CSV.
 * Requires VITE_OPENAI_API_KEY to be set at build time.
 */

const OPENAI_KEY = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();

const SYSTEM_PROMPT = `You are an expense data extractor. Given raw OCR text from a receipt, bank statement, or bill, extract every expense/transaction and return ONLY a CSV string.

CSV format (include this exact header line):
date,amount,category,payment,notes,tags

Column rules:
- date: YYYY-MM-DD. If only day/month visible, use current year. If ambiguous (e.g. "12/05"), treat as DD/MM.
- amount: positive number only, no currency symbols or commas.
- category: pick the closest match from the provided Categories list. If nothing fits, use the first category.
- payment: pick the closest match from the provided Payments list. If nothing fits, use the first payment.
- notes: merchant name or short description (max 60 chars).
- tags: optional comma-separated keywords (leave empty if unsure).

Output rules:
- Return ONLY the CSV text. No markdown, no explanation, no code fences.
- One row per expense/line-item. If the receipt is a single purchase, output one row.
- Skip header/footer lines like totals, taxes, subtotals — only output individual items or the grand total if no line items.
- Use double-quotes around any field that contains a comma.`;

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

  const catList = categories.length ? categories.join(", ") : "(none — use a generic label)";
  const payList = payments.length ? payments.join(", ") : "(none — use a generic label)";

  const userMsg = [
    `Categories: ${catList}`,
    `Payments: ${payList}`,
    `Today's date: ${new Date().toISOString().split("T")[0]}`,
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

  // Strip markdown code fences if the model wraps output in ```csv ... ```
  return raw.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}
