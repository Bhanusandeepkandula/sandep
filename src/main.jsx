import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme } from "./config.js";
import App from "./App.jsx";

try {
  const saved = localStorage.getItem("track_theme");
  if (saved) applyTheme(saved);
} catch {}

function dismissSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 500);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App onReady={dismissSplash} />
  </StrictMode>
);
