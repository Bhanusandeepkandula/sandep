import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { AlertTriangle, CheckCircle2, Info, X, AlertCircle } from "lucide-react";
import { T } from "./config.js";

const DialogCtx = createContext(null);

export function useDialog() {
  return useContext(DialogCtx);
}

export function DialogProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const toastId = useRef(0);

  const toast = useCallback((msg, opts = {}) => {
    const id = ++toastId.current;
    const dur = opts.duration ?? 3000;
    const type = opts.type ?? "info";
    const onClick = typeof opts.onClick === "function" ? opts.onClick : null;
    const actionLabel = opts.actionLabel || null;
    const title = opts.title || null;
    setToasts((p) => [...p, { id, msg, type, leaving: false, onClick, actionLabel, title }]);
    setTimeout(() => {
      setToasts((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 320);
    }, dur);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 320);
  }, []);

  const alert = useCallback((msg, opts = {}) => {
    return new Promise((resolve) => {
      setConfirm({
        title: opts.title ?? "Notice",
        msg,
        type: opts.type ?? "info",
        confirmLabel: "OK",
        cancelLabel: null,
        onConfirm: () => { setConfirm(null); resolve(true); },
        onCancel: () => { setConfirm(null); resolve(false); },
      });
    });
  }, []);

  const showConfirm = useCallback((msg, opts = {}) => {
    return new Promise((resolve) => {
      setConfirm({
        title: opts.title ?? "Confirm",
        msg,
        type: opts.type ?? "warn",
        confirmLabel: opts.confirmLabel ?? "Confirm",
        cancelLabel: opts.cancelLabel ?? "Cancel",
        danger: opts.danger ?? false,
        onConfirm: () => { setConfirm(null); resolve(true); },
        onCancel: () => { setConfirm(null); resolve(false); },
      });
    });
  }, []);

  const ctx = { toast, alert, confirm: showConfirm, dismissToast };

  return (
    <DialogCtx.Provider value={ctx}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {confirm && <ConfirmOverlay {...confirm} />}
    </DialogCtx.Provider>
  );
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};
const COLORS = {
  success: () => T.acc,
  error: () => T.dng,
  warn: () => T.warn,
  info: () => T.blue,
};

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10500, display: "flex", flexDirection: "column", alignItems: "center", padding: "max(env(safe-area-inset-top, 12px), 12px) 16px 0", pointerEvents: "none" }}>
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        const color = (COLORS[t.type] || COLORS.info)();
        const clickable = !!t.onClick;
        return (
          <div
            key={t.id}
            className="g-toast"
            onClick={clickable ? () => { try { t.onClick(); } finally { onDismiss && onDismiss(t.id); } } : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            style={{
              pointerEvents: "auto",
              width: "100%",
              maxWidth: 400,
              marginBottom: 8,
              padding: "12px 14px",
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              gap: 10,
              animation: t.leaving ? "toast-out .3s ease-in forwards" : "ios-notify-drop .35s cubic-bezier(0.34,1.56,0.64,1)",
              cursor: clickable ? "pointer" : "default",
            }}
          >
            <Icon size={18} color={color} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title ? (
                <div style={{ fontSize: 13, fontWeight: 800, color: T.txt, lineHeight: 1.25 }}>{t.title}</div>
              ) : null}
              <div style={{ fontSize: t.title ? 12 : 13, fontWeight: t.title ? 500 : 600, color: t.title ? T.sub : T.txt, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.msg}
              </div>
            </div>
            {t.actionLabel && clickable ? (
              <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0, padding: "4px 10px", borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33` }}>{t.actionLabel}</span>
            ) : null}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDismiss && onDismiss(t.id); }}
              aria-label="Dismiss"
              style={{ background: "transparent", border: "none", color: T.mut, cursor: "pointer", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmOverlay({ title, msg, type, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  const [show, setShow] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  const Icon = ICONS[type] || Info;
  const color = danger ? T.dng : (COLORS[type] || COLORS.info)();

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: show ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        transition: "background .2s ease",
      }}
    >
      <div
        className="g-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 22,
          padding: 24,
          transform: show ? "scale(1) translateY(0)" : "scale(0.92) translateY(12px)",
          opacity: show ? 1 : 0,
          transition: "transform .3s cubic-bezier(.34,1.56,.64,1), opacity .22s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} color={color} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.txt }}>{title}</div>
        </div>
        <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, marginBottom: 20 }}>{msg}</div>
        <div style={{ display: "flex", gap: 10 }}>
          {cancelLabel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: 13,
                borderRadius: 12,
                border: `1px solid ${T.bdr}`,
                background: "transparent",
                color: T.sub,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 12,
              border: "none",
              background: danger ? T.dng : T.acc,
              color: danger ? "#fff" : T.btnTxt,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
