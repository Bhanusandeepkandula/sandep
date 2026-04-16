import { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { T, inp } from "./config.js";

/**
 * Dictation for OCR → CSV: uses the browser Web Speech API (best in Chrome / Edge).
 * @param {{ onAppend: (text: string) => void; disabled?: boolean; active?: boolean }} props
 */
export function OcrCsvVoiceControls({ onAppend, disabled = false, active = true }) {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const prevListening = useRef(false);

  useEffect(() => {
    if (!active && listening) {
      try {
        SpeechRecognition.stopListening();
      } catch {
        /* ignore */
      }
    }
  }, [active, listening]);

  useEffect(() => {
    if (prevListening.current && !listening && active) {
      const t = transcript.trim();
      if (t) onAppend(t);
      resetTranscript();
    }
    prevListening.current = listening;
  }, [listening, transcript, onAppend, resetTranscript, active]);

  if (!browserSupportsSpeechRecognition) {
    return (
      <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.4, marginBottom: 8 }}>
        Voice typing needs a browser with the Web Speech API (Chrome or Edge on desktop; limited on Safari).
      </div>
    );
  }

  function toggle() {
    if (disabled) return;
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({
        continuous: true,
        language: typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US",
      });
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => toggle()}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        style={{
          ...inp,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 48,
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: 700,
          background: listening ? "rgba(239,68,68,0.15)" : T.card2,
          borderColor: listening ? "rgba(239,68,68,0.45)" : T.bdr,
          color: listening ? T.dng : T.txt,
        }}
      >
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
        {listening ? "Stop & add to text" : "Speak bill / amounts (mic)"}
      </button>
      {listening ? (
        <div style={{ fontSize: 12, color: T.acc, marginTop: 8, lineHeight: 1.45 }}>
          Listening… speak clearly. Tap again when done — text will be added to the box above.
        </div>
      ) : null}
    </div>
  );
}
