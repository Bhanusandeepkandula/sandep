/**
 * Unified document text extractor.
 * Routes by file type:
 *   - images (jpg/png/webp/gif/bmp/tiff) → Tesseract OCR ([tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract) engine via `tesseract.js` in the browser)
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

// ─── Image → Tesseract (LSTM OCR) → text for OpenAI / CSV ─────────────────────

async function extractImage(file, onProgress) {
  const { extractReceiptTextWithOcr } = await import("./receiptOcr.js");
  const dataUrl = await fileToDataUrl(file);
  return extractReceiptTextWithOcr(dataUrl, onProgress);
}

// ─── PDF → PDF.js ─────────────────────────────────────────────────────────────

async function extractPdf(file, onProgress) {
  const buf = await file.arrayBuffer();

  let pdfjsLib;
  try {
    pdfjsLib = await import("pdfjs-dist");
  } catch (e) {
    throw new Error("Could not load PDF reader. Try uploading as CSV or XLSX instead.");
  }

  const ver = pdfjsLib.version || "";
  const cdnBase = `https://unpkg.com/pdfjs-dist@${ver}/`;
  // Needed so CID-encoded / embedded fonts in bank statements decode to real
  // characters instead of empty strings (especially on iOS Safari / PWA).
  const docOpts = {
    data: new Uint8Array(buf),
    cMapUrl: `${cdnBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${cdnBase}standard_fonts/`,
    useSystemFonts: true,
    isEvalSupported: false,
  };

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${cdnBase}build/pdf.worker.min.mjs`;
  } catch {
    // ignore — retried below
  }

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument(docOpts).promise;
  } catch {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${cdnBase}build/pdf.worker.min.js`;
      pdf = await pdfjsLib.getDocument(docOpts).promise;
    } catch {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
        pdf = await pdfjsLib.getDocument({ ...docOpts, disableWorker: true }).promise;
      } catch {
        throw new Error(
          "Could not read this PDF. It may be encrypted or damaged. Try exporting as CSV from your bank app instead."
        );
      }
    }
  }

  const totalPages = pdf.numPages;
  const pageTexts = [];

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pageTexts.push(pageText);
    } catch {
      // skip pages that fail
    }
    onProgress?.(i / totalPages * 0.5);
  }

  if (pageTexts.length > 0) {
    const full = pageTexts.join("\n---\n").trim();
    return full.length > 14000 ? full.slice(0, 14000) : full;
  }

  // Fallback: no embedded text (scanned PDF, or iOS worker quirk that
  // returns empty items). Rasterize each page and OCR it with Tesseract.
  try {
    return await extractPdfViaOcr(pdf, onProgress);
  } catch (ocrErr) {
    throw new Error(
      "No text could be read from this PDF. If it's a scanned statement, try the 'OCR → CSV' flow with a screenshot, or export the statement as CSV from your bank app."
    );
  }
}

/**
 * Rasterize each PDF page to a canvas and OCR it. Used when the PDF has no
 * embedded text layer (scanned statements) or when PDF.js text extraction
 * silently returns nothing (an iOS Safari / PWA quirk).
 */
async function extractPdfViaOcr(pdf, onProgress) {
  const { extractReceiptTextWithOcr } = await import("./receiptOcr.js");
  const totalPages = pdf.numPages;
  // Cap pages we OCR so a 40-page statement doesn't melt the phone.
  const maxPages = Math.min(totalPages, 6);
  const out = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    // Render at ~2x so OCR has enough detail, but clamp width to keep memory sane on mobile.
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = Math.min(1600, Math.max(900, baseViewport.width * 2));
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");

    try {
      const pageText = await extractReceiptTextWithOcr(dataUrl, (p) => {
        onProgress?.(0.5 + ((i - 1 + p) / maxPages) * 0.5);
      });
      if (pageText && pageText.trim()) out.push(pageText.trim());
    } catch {
      // skip failed pages
    }

    canvas.width = 0;
    canvas.height = 0;
  }

  if (out.length === 0) {
    throw new Error("OCR returned no text");
  }

  const full = out.join("\n---\n").trim();
  return full.length > 14000 ? full.slice(0, 14000) : full;
}

// ─── Spreadsheet → SheetJS ────────────────────────────────────────────────────

async function extractSpreadsheet(file) {
  let XLSX;
  try {
    XLSX = await import("xlsx");
  } catch (e) {
    throw new Error("Could not load spreadsheet reader. Try saving as CSV and uploading that instead.");
  }

  const buf = await file.arrayBuffer();
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

/** @param {File} file */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
