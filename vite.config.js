import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

/** Read KEY=value from .env / .env.local without requiring dotenv (Vite loadEnv can miss edge cases). */
function parseEnvFileForKey(cwd, fileName, keyName) {
  try {
    const p = path.join(cwd, fileName);
    if (!fs.existsSync(p)) return "";
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
    const prefix = `${keyName}=`;
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      if (!t.startsWith(prefix)) continue;
      let v = t.slice(prefix.length).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return v.trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

function resolveAnthropicApiKey(mode, cwd) {
  const loaded = loadEnv(mode, cwd, ["ANTHROPIC_", "VITE_ANTHROPIC_"]);
  const fromLoadEnv = String(
    loaded.ANTHROPIC_API_KEY || loaded.VITE_ANTHROPIC_API_KEY || ""
  ).trim();
  if (fromLoadEnv) return fromLoadEnv;
  const fromFile =
    parseEnvFileForKey(cwd, ".env.local", "ANTHROPIC_API_KEY") ||
    parseEnvFileForKey(cwd, ".env.local", "VITE_ANTHROPIC_API_KEY") ||
    parseEnvFileForKey(cwd, ".env", "ANTHROPIC_API_KEY") ||
    parseEnvFileForKey(cwd, ".env", "VITE_ANTHROPIC_API_KEY");
  if (fromFile) return fromFile;
  return String(
    process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || ""
  ).trim();
}

/** Copy dist/index.html → dist/404.html so GitHub Pages serves the SPA on unknown paths (refresh/deep links). */
function ghPages404Plugin() {
  return {
    name: "gh-pages-spa-404",
    closeBundle() {
      const dist = path.join(process.cwd(), "dist");
      const indexHtml = path.join(dist, "index.html");
      const notFoundHtml = path.join(dist, "404.html");
      try {
        if (fs.existsSync(indexHtml)) {
          fs.copyFileSync(indexHtml, notFoundHtml);
        }
      } catch (e) {
        console.warn("[vite] gh-pages-spa-404:", e);
      }
    },
  };
}

function anthropicProxy(mode, cwd) {
  let warnedMissingAnthropicKey = false;
  return {
    target: "https://api.anthropic.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/anthropic/, ""),
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        const key = resolveAnthropicApiKey(mode, cwd);
        if (key) {
          proxyReq.setHeader("x-api-key", key);
        } else if (!warnedMissingAnthropicKey) {
          warnedMissingAnthropicKey = true;
          console.warn(
            "\n[vite] ANTHROPIC_API_KEY is missing or empty. Add it to .env.local in the project root, then restart the dev server.\n" +
              "    Example: ANTHROPIC_API_KEY=sk-ant-api03-...\n"
          );
        }
        proxyReq.setHeader("anthropic-version", "2023-06-01");
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const cwd = process.cwd();
  const proxyAnthropic = anthropicProxy(mode, cwd);
  const v = loadEnv(mode, cwd, ["VITE_"]);
  const rawBase = (v.VITE_BASE_PATH ?? "").trim();
  const base =
    rawBase === "" ? "/" : rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base,
    plugins: [react(), ghPages404Plugin()],
    server: {
      proxy: {
        "/anthropic": proxyAnthropic,
      },
    },
    preview: {
      proxy: {
        "/anthropic": proxyAnthropic,
      },
    },
  };
});
