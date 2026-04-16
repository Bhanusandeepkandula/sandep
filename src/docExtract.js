/**
 * Unified document text extractor.
 * Routes by file type:
 *   - images (jpg/png/webp/gif/bmp/tiff) → Tesseract OCR (existing)
 *   - PDF                                 → PDF.js text extraction
 *   - XLSX / XLS / ODS / CSV             → SheetJS → CSV text
 *
 * All processing happens in-browser — no server, no API key required.
 *
 * @param {File} file
 * @param {(progress: number) => void} [onProgress]  0–1
 * @returns {Promise<string>} extracted text
 */
export async function extractTextFromFile(file, onProgress) {
  const mt = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();

  if (isPdf(mt, name)) return extractPdf(file, onProgress);
  if (isSpreadsheet(mt, name)) return extractSpreadsheet(file);
  // Default: treat as image and run Tesseract
  return extractImage(file, onProgress);
}

// ─── Type helpers ────────────────────────────────────────────────────────────

function isPdf(mt, name) {
  return mt.includes("pdf") || name.endsWith(".pdf");
}

function isSpreadsheet(mt, name) {
  if (
    mt.includes("spreadsheetml") ||
    mt.includes("excel") ||
    mt.includes("vnd.ms-excel") ||
    mt.includes("opendocument.spreadsheet")
  )
    return true;
  return [".xlsx", ".xls", ".ods"].some((ext) => name.endsWith(ext));
}

// ─── Image → Tesseract ───────────────────────────────────────────────────────

async function extractImage(file, onProgress) {
  const { extractReceiptTextWithOcr } = await import("./receiptOcr.js");
  const dataUrl = await fileToDataUrl(file);
  return extractReceiptTextWithOcr(dataUrl, onProgress);
}

// ─── PDF → PDF.js ────────────────────────────────────────────────────────────

async function extractPdf(file, onProgress) {
  const buf = await file.arrayBuffer();

  // Lazy-load pdfjs-dist so it only enters the bundle when needed
  const pdfjsLib = await import("pdfjs-dist");

  // Use the bundled legacy worker via a CDN URL so Vite doesn't need to
  // special-case the worker file (avoids the "worker not found" Vite issue).
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const totalPages = pdf.numPages;
  const pageTexts = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pageTexts.push(pageText);
    onProgress?.(i / totalPages);
  }

  const full = pageTexts.join("\n---\n").trim();
  // Cap at 14 000 chars to stay within OpenAI context limits
  return full.length > 14000 ? full.slice(0, 14000) : full;
}

// ─── Spreadsheet → SheetJS ───────────────────────────────────────────────────

async function extractSpreadsheet(file) {
  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(buf), { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in this file.");

  const sheet = workbook.Sheets[sheetName];
  // sheet_to_csv gives us a clean tabular text that OpenAI handles very well
  const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  return csv.length > 14000 ? csv.slice(0, 14000) : csv;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
