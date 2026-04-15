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
  const loaded = loadEnv(mode, cwd, "");
  const fromLoadEnv = String(loaded.ANTHROPIC_API_KEY || "").trim();
  if (fromLoadEnv) return fromLoadEnv;
  const fromFile =
    parseEnvFileForKey(cwd, ".env.local", "ANTHROPIC_API_KEY") ||
    parseEnvFileForKey(cwd, ".env", "ANTHROPIC_API_KEY");
  if (fromFile) return fromFile;
  return String(process.env.ANTHROPIC_API_KEY || "").trim();
}

export default defineConfig(({ mode }) => {
  const cwd = process.cwd();
  let warnedMissingAnthropicKey = false;

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/anthropic": {
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
                  "\n[vite] ANTHROPIC_API_KEY is missing or empty. Statement/receipt scan needs it in .env.local (then restart `npm run dev`).\n"
                );
              }
              proxyReq.setHeader("anthropic-version", "2023-06-01");
            });
          },
        },
      },
    },
  };
});
