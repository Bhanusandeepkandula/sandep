import { createPortal } from "react-dom";

/**
 * Renders children into `document.body` so they escape any ancestor stacking
 * context. Use this to wrap full-screen overlays / bottom sheets / modals
 * that must sit above the floating tab bar. Without this, a parent like
 * `.glass-content { position: relative; z-index: 1 }` traps children at
 * layer 1 regardless of their own inline z-index, and they render beneath
 * the tab bar on iOS Safari.
 *
 * @param {{ children: import("react").ReactNode }} props
 */
export function SheetPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
