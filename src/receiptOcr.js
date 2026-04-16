/**
 * In-browser OCR using the same engine family as
 * [Tesseract Open Source OCR](https://github.com/tesseract-ocr/tesseract) (LSTM line recognition).
 * This app uses [`tesseract.js`](https://github.com/naptha/tesseract.js) (WASM) so extraction runs
 * entirely in the browser — no native `tesseract` binary required.
 *
 * Extracted text is intended to be passed to OpenAI (see `ocrConvert.js` / `docExtract.js`) for
 * structured expense CSV.
 */

/**
 * @param {string} mediaType MIME from File.type
 * @param {boolean} isStatement user chose statement flow (may be PDF)
 */
export function canRunBrowserOcr(mediaType, isStatement) {
  if (isStatement) {
    const mt = (mediaType || "").toLowerCase();
    if (mt.includes("pdf")) return false;
  }
  const mt = (mediaType || "").toLowerCase();
  if (mt.includes("pdf")) return false;
  if (mt.includes("heic") || mt.includes("heif")) return false;
  return true;
}

/**
 * Normalize OCR text: keep line breaks (helps OpenAI see totals / columns), trim noise.
 * @param {string} raw
 */
function normalizeOcrText(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v]+/g, " ").replace(/ +/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{5,}/g, "\n\n\n\n")
    .trim();
}

/**
 * @param {string} dataUrl full data URL (e.g. from FileReader.readAsDataURL)
 * @param {(progress01: number) => void} [onProgress]
 * @returns {Promise<string>} plain text (capped for API context)
 */
export async function extractReceiptTextWithOcr(dataUrl, onProgress) {
  const { createWorker, setLogging, PSM, OEM } = await import("tesseract.js");
  setLogging(false);

  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.min(1, Math.max(0, m.progress)));
      }
    },
  });

  try {
    // Aligns with CLI `tesseract ... --psm 3` style: full auto page segmentation (receipts + screenshots).
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });

    const { data } = await worker.recognize(dataUrl);
    const t = normalizeOcrText(data?.text || "");
    return t.length > 14_000 ? t.slice(0, 14_000) : t;
  } finally {
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
  }
}
