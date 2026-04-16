import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

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
