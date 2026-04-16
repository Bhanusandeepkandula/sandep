import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { T, inp } from "./config.js";

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/**
 * Dictation for OCR → CSV: uses the browser Web Speech API directly.
 * Works in Chrome, Edge, and Safari 14.1+.
 */
export function OcrCsvVoiceControls({ onAppend, disabled = false, active = true }) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const resultRef = useRef("");

  const stop = useCallback(() => {
    try { recogRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!active && listening) stop();
  }, [active, listening, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  if (!SpeechRecognitionAPI) {
    return (
      <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.4, marginBottom: 8 }}>
        Voice typing needs a browser with Speech Recognition (Chrome, Edge, or Safari 14.1+).
      </div>
    );
  }

  function toggle() {
    if (disabled) return;
    if (listening) {
      stop();
      return;
    }
    resultRef.current = "";
    const recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = navigator.language || "en-US";

    recog.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text.trim()) resultRef.current += (resultRef.current ? " " : "") + text.trim();
    };
    recog.onend = () => {
      setListening(false);
      const t = resultRef.current.trim();
      if (t) onAppend(t);
      resultRef.current = "";
      recogRef.current = null;
    };
    recog.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      setListening(false);
      recogRef.current = null;
    };

    recogRef.current = recog;
    try {
      recog.start();
      setListening(true);
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        style={{
          ...inp,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: 13,
          background: listening ? "rgba(239,68,68,0.15)" : T.card2,
          borderColor: listening ? "rgba(239,68,68,0.45)" : T.bdr,
          color: listening ? T.dng : T.txt,
        }}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
        {listening ? "Stop & add to text" : "Voice input"}
      </button>
      {listening && (
        <div style={{ fontSize: 12, color: T.acc, marginTop: 6, lineHeight: 1.4 }}>
          Listening… speak clearly. Tap again when done.
        </div>
      )}
    </div>
  );
}
