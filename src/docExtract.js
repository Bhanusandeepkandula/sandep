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

  if (isHeic(mt, name)) {
    throw new Error("HEIC/HEIF images are not supported. Please convert to JPG or PNG first.");
  }
  if (!isSupportedType(mt, name)) {
    throw new Error(
      `Unsupported file type: ${file.name}. Supported: JPG, PNG, WebP, PDF, XLSX, XLS, ODS, CSV.`
    );
  }
  if (isPdf(mt, name)) return extractPdf(file, onProgress);
  if (isSpreadsheet(mt, name)) return extractSpreadsheet(file);
  return extractImage(file, onProgress);
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

function isPdf(mt, name) {
  return mt.includes("pdf") || name.endsWith(".pdf");
}

function isHeic(mt, name) {
  return mt.includes("heic") || mt.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

function isSpreadsheet(mt, name) {
  if (
    mt.includes("spreadsheetml") ||
    mt.includes("excel") ||
    mt.includes("vnd.ms-excel") ||
    mt.includes("opendocument.spreadsheet") ||
    mt.includes("text/csv") ||
    mt.includes("text/plain")
  )
    return true;
  return [".xlsx", ".xls", ".ods", ".csv"].some((ext) => name.endsWith(ext));
}

function isImage(mt, name) {
  if (mt.startsWith("image/")) return true;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif"].some((ext) =>
    name.endsWith(ext)
  );
}

function isSupportedType(mt, name) {
  return isPdf(mt, name) || isSpreadsheet(mt, name) || isImage(mt, name);
}

// ─── Image → Tesseract ────────────────────────────────────────────────────────

async function extractImage(file, onProgress) {
  const { extractReceiptTextWithOcr } = await import("./receiptOcr.js");
  const dataUrl = await fileToDataUrl(file);
  return extractReceiptTextWithOcr(dataUrl, onProgress);
}

// ─── PDF → PDF.js ─────────────────────────────────────────────────────────────

async function extractPdf(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist");

  // Use unpkg which mirrors npm exactly — pdfjs-dist v5+ uses .mjs workers
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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

  if (pageTexts.length === 0) {
    throw new Error(
      "No text found in this PDF. It may be a scanned image-only PDF — try converting to JPG and uploading the image instead."
    );
  }

  const full = pageTexts.join("\n---\n").trim();
  return full.length > 14000 ? full.slice(0, 14000) : full;
}

// ─── Spreadsheet → SheetJS ────────────────────────────────────────────────────

async function extractSpreadsheet(file) {
  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(buf), { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in this file.");

  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

  if (!csv.trim()) {
    throw new Error("The spreadsheet appears to be empty. Check the file and try again.");
  }

  return csv.length > 14000 ? csv.slice(0, 14000) : csv;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
