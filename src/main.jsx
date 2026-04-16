import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "./config.js";
import { DialogProvider } from "./AppDialogs.jsx";
import App from "./App.jsx";

try {
  const saved = localStorage.getItem("track_theme");
  if (saved) {
    applyTheme(saved);
    const splash = document.getElementById("splash");
    if (splash) splash.style.background = document.body.style.background;
  }
} catch {}

function dismissSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 500);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DialogProvider>
      <App onReady={dismissSplash} />
    </DialogProvider>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}
