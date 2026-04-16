/**
 * In-browser OCR using Tesseract (same engine as desktop tools such as
 * [Textemage](https://github.com/Akascape/TEXTEMAGE); that project is Python+GUI,
 * this app uses the official `tesseract.js` package for the web).
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
 * @param {string} dataUrl full data URL (e.g. from FileReader.readAsDataURL)
 * @param {(progress01: number) => void} [onProgress]
 * @returns {Promise<string>} trimmed plain text (capped for API context)
 */
export async function extractReceiptTextWithOcr(dataUrl, onProgress) {
  const { recognize, setLogging } = await import("tesseract.js");
  setLogging(false);
  const { data } = await recognize(dataUrl, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.min(1, Math.max(0, m.progress)));
      }
    },
  });
  const t = String(data?.text || "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > 14000 ? t.slice(0, 14000) : t;
}
