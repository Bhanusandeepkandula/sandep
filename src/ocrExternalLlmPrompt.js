/**
 * Model-agnostic instructions for vision LLMs (ChatGPT, Claude, Gemini, Copilot, Grok, etc.).
 * User copies this text, attaches an image in the other tool, then pastes the CSV back here.
 */

const HEADER = "date,amount,category,payment,notes,tags";

/**
 * @param {{ categories?: string[]; payments?: string[]; today?: string }} opts
 * @returns {string}
 */
export function buildImageToExpenseCsvPrompt({ categories = [], payments = [], today } = {}) {
  const todayStr = today || new Date().toISOString().split("T")[0];
  const catJoined = categories.length ? categories.join(" | ") : "(not set — use clear English labels; you will fix names in the app later)";
  const payJoined = payments.length ? payments.join(" | ") : "(not set — use Card, Cash, UPI, etc.)";

  return `=== EXPENSE CSV EXTRACTION (vision) — read carefully ===
You will receive one or more images: receipt, invoice, bank/credit app screenshot, UPI statement, shopping order, medical bill, parking ticket, fuel slip, etc.

Your task: extract SPENDING (money OUT) only and return it in a format this budgeting app can import.

REFERENCE DATE (use this calendar year when the document shows day/month but no year): ${todayStr}

--- OUTPUT: choose ONE style (prefer 1) ---

(1) PLAIN CSV (best for ChatGPT, Claude, most web UIs)
- Your reply MUST begin immediately with this exact header line (copy it verbatim):
${HEADER}
- Then add one CSV data row per extracted expense (see rules below).
- Do NOT wrap the CSV in markdown code fences (\`\`\`). Do NOT use a markdown table. Do not put commentary before the first line.
- If you need to add a short note for the human, put ONE blank line after the last CSV row, then plain text.

(2) JSON (use only if the chat UI breaks newlines or merges lines)
Return a single JSON object (valid JSON only):
{"csv_lines":["${HEADER}","<first data row as one string>", "..."],"follow_up_questions":["optional question 1", "..."]}
- csv_lines[0] must be exactly: ${HEADER}
- Each further element is one full CSV row as a single string (commas separate fields; use standard CSV quoting if a field contains a comma).

--- COLUMN RULES (data rows) ---
- date: YYYY-MM-DD. If you see DD/MM or MM/DD without year, assume current year ${todayStr.slice(0, 4)} unless the receipt clearly implies another year. If unreadable, pick best effort and mention uncertainty in notes (prefix "UNCERTAIN_DATE: ").
- amount: positive number only for expenses (no currency symbols in the number, no thousands separators; use dot for decimals, e.g. 12.50). NEVER invent a total: if illegible, skip that row or output header-only and explain after a blank line.
- category: MUST be exactly one of these app category names (match spelling and capitalization):
${catJoined}
Pick the closest semantic match. If none fit, use the first category in the list above.
- payment: MUST be exactly one of these payment method names:
${payJoined}
Pick the closest match. If none fit, use the first payment in the list above.
- notes: short merchant or description (max ~80 chars). Wrap the whole field in double-quotes if it contains a comma.
- tags: optional; may be empty (trailing comma is allowed).

--- RECEIPT vs MULTI-ROW SCREEN ---
- Single paper/e-receipt with one balance due: output EXACTLY ONE data row using the FINAL / GRAND TOTAL (include tax if rolled into that total). Do not explode into every line item unless the image is clearly an itemized return or the user would need separate expenses.
- Bank / card / UPI transaction list: one data row per visible purchase, debit, fee, or outgoing transfer. EXCLUDE rows that are only income: salary, interest earned, cashback credit, incoming transfers, refunds that net to credit-only, deposits. When unsure, exclude rather than invent.

--- QUALITY ---
- Read cropped or blurry text carefully; state guesses only with clear amounts from the image.
- If the image is not a financial document, output only the header line "${HEADER}" and nothing else on CSV lines, then after a blank line explain briefly.

--- END OF INSTRUCTIONS (attach your image(s) below for the model you are using) ===`;
}
