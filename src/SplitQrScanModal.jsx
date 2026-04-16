import { useEffect, useRef, useState } from "react";
import { T } from "./config.js";
import { X } from "lucide-react";

/**
 * Camera QR scan + paste fallback for split-contact payloads.
 * @param {{ open: boolean; onClose: () => void; onDecoded: (text: string) => void }} props
 */
export function SplitQrScanModal({ open, onClose, onDecoded }) {
  const onDecodedRef = useRef(onDecoded);
  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);
  const [paste, setPaste] = useState("");
  const [camErr, setCamErr] = useState("");
  const scannerRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPaste("");
      setCamErr("");
      return;
    }
    let cancelled = false;
    const elId = "split-qr-camera-region";
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const h = new Html5Qrcode(elId, /* verbose */ false);
        scannerRef.current = h;
        await h.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (cancelled || !decodedText) return;
            try {
              h.stop();
            } catch {
              /* ignore */
            }
            onDecodedRef.current(decodedText);
          },
          () => {
            /* frame scan — ignore */
          }
        );
        startedRef.current = true;
        setCamErr("");
      } catch (e) {
        console.warn(e);
        setCamErr(
          typeof e?.message === "string" ? e.message : "Camera unavailable — paste the code below instead."
        );
      }
    })();
    return () => {
      cancelled = true;
      startedRef.current = false;
      const h = scannerRef.current;
      scannerRef.current = null;
      if (h) {
        h.stop()
          .then(() => h.clear())
          .catch(() => {});
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 540,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: T.card,
          borderRadius: 16,
          padding: 20,
          border: `1px solid ${T.bdr}`,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Scan split contact</div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: "none",
              background: T.card2,
              borderRadius: 8,
              padding: 8,
              cursor: "pointer",
              color: T.sub,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.45, marginBottom: 12 }}>
          Point the camera at your friend’s QR from Profile. They’ll be added to Split contacts with their name and linked ID for shared splits.
        </div>
        <div
          id="split-qr-camera-region"
          style={{
            width: "100%",
            minHeight: 200,
            borderRadius: 12,
            overflow: "hidden",
            background: "#000",
            marginBottom: 12,
          }}
        />
        {camErr ? (
          <div style={{ fontSize: 12, color: T.warn, marginBottom: 10 }}>{camErr}</div>
        ) : null}
        <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Or paste code</label>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="track:split:v1:…"
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 10,
            border: `1px solid ${T.bdr}`,
            background: T.surf,
            color: T.txt,
            padding: 10,
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            marginBottom: 10,
            resize: "vertical",
          }}
        />
        <button
          type="button"
          onClick={() => {
            const t = paste.trim();
            if (t) onDecodedRef.current(t);
          }}
          disabled={!paste.trim()}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: paste.trim() ? T.acc : T.mut,
            color: "#000",
            fontWeight: 800,
            cursor: paste.trim() ? "pointer" : "not-allowed",
          }}
        >
          Use pasted code
        </button>
      </div>
    </div>
  );
}
