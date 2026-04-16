import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase.js";

/**
 * Resize JPEG from data URL for smaller Firestore-adjacent storage uploads.
 * @param {string} dataUrl
 * @param {number} maxEdge
 * @param {number} quality 0–1
 * @returns {Promise<Blob>}
 */
export function dataUrlToJpegBlob(dataUrl, maxEdge = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w <= 0 || h <= 0) {
        reject(new Error("Invalid image dimensions"));
        return;
      }
      if (w > maxEdge) {
        h = (h * maxEdge) / w;
        w = maxEdge;
      }
      if (h > maxEdge) {
        w = (w * maxEdge) / h;
        h = maxEdge;
      }
      const c = document.createElement("canvas");
      c.width = Math.round(w);
      c.height = Math.round(h);
      const ctx = c.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Could not encode image"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = dataUrl;
  });
}

/**
 * @param {string} dataUrl
 * @param {string} userId
 * @param {string} txId
 * @returns {Promise<string>} download URL
 */
export async function uploadReceiptImage(dataUrl, userId, txId) {
  const blob = await dataUrlToJpegBlob(dataUrl);
  const path = `users/${userId}/receipts/${txId}.jpg`;
  const sRef = ref(storage, path);
  await uploadBytes(sRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(sRef);
}
