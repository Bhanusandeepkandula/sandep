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

function resolveOpenAiApiKey(mode, cwd) {
  const loaded = loadEnv(mode, cwd, ["OPENAI_", "VITE_OPENAI_"]);
  const fromLoadEnv = String(loaded.OPENAI_API_KEY || loaded.VITE_OPENAI_API_KEY || "").trim();
  if (fromLoadEnv) return fromLoadEnv;
  const fromFile =
    parseEnvFileForKey(cwd, ".env.local", "OPENAI_API_KEY") ||
    parseEnvFileForKey(cwd, ".env.local", "VITE_OPENAI_API_KEY") ||
    parseEnvFileForKey(cwd, ".env", "OPENAI_API_KEY") ||
    parseEnvFileForKey(cwd, ".env", "VITE_OPENAI_API_KEY");
  if (fromFile) return fromFile;
  return String(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "").trim();
}

/** If .env* contains OPENAI_API_KEY= but value is blank, return that filename (else ""). */
function openAiKeyLinePresentButEmpty(cwd) {
  const files = [".env.local", ".env"];
  const prefixes = ["OPENAI_API_KEY=", "VITE_OPENAI_API_KEY="];
  for (const fileName of files) {
    try {
      const p = path.join(cwd, fileName);
      if (!fs.existsSync(p)) continue;
      for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        for (const prefix of prefixes) {
          if (!t.startsWith(prefix)) continue;
          let v = t.slice(prefix.length).trim();
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1).trim();
          }
          if (!v) return fileName;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return "";
}

function openAiKeyMissingMessage(cwd) {
  const blankFile = openAiKeyLinePresentButEmpty(cwd);
  if (blankFile) {
    return `OPENAI_API_KEY is listed in ${blankFile} but the value is empty. Paste your secret key from https://platform.openai.com/api-keys after the equals sign (no spaces around =), save the file, and restart npm run dev.`;
  }
  return "OPENAI_API_KEY is not set. Add it to project-root .env.local or .env (see .env.example), or export OPENAI_API_KEY in your shell, then restart the dev server.";
}

/** Read JSON POST body (dev / preview only). */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const s = Buffer.concat(chunks).toString("utf8");
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function openAiOcrToCsv(apiKey, ocrText) {
  const system = `You convert noisy OCR receipt or restaurant bill text into a strict CSV for expense import.

Output ONLY raw CSV text. No markdown fences, no commentary before or after.

The first line MUST be exactly:
amount,date,category,payment_method,notes,tags

Column rules:
- amount: decimal number only (no Rs, ₹, currency symbols, no commas in the number)
- date: YYYY-MM-DD for the receipt; if the receipt has no date, use a reasonable guess from context or today's date in the same format for all rows from one receipt
- category: MUST be exactly one of: Food, Travel, Rent, Shopping, Bills, Entertainment, Health, Education, Subscriptions, Groceries, Transport, Investments, Others
- payment_method: one of Cash, Credit Card, Debit Card, UPI, Net Banking, Wallet — if unknown use Debit Card
- notes: clean line-item name in Title Case, single line; merge broken OCR lines for one item into one phrase (e.g. "Grilled And Sauteed Vegetables")
- tags: optional lowercase tag or empty (trailing comma allowed)

Data rules:
- Emit ONE data row per purchased line item (dishes, drinks, packaged goods the customer bought). Do NOT emit rows for: Grand Total, Subtotal, Total, Tax, GST, SGST, CGST, Service Charge, Packing Charge, Discount lines that are not a product, header/footer text, address, phone, GSTIN.
- For bank or card **statements**: only include **debits / purchases / money OUT**. Do NOT emit rows for salary, deposits, credits, interest received, or transfers IN — those are not expenses for this import.
- Ignore duplicate repeated lines.
- Fix obvious OCR typos in notes.
- If there are no line items, output the header row only.`;

  const user = `OCR text:\n\n${ocrText.slice(0, 120000)}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j.error?.message || JSON.stringify(j).slice(0, 200) || r.statusText;
    throw new Error(msg);
  }
  let text = String(j.choices?.[0]?.message?.content || "").trim();
  text = text.replace(/^```(?:csv)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!text.toLowerCase().startsWith("amount,date,category")) {
    const m = text.match(/amount,date,category[^\n]*\n[\s\S]*/i);
    if (m) text = m[0].trim();
  }
  return text;
}

function ocrCsvApiPlugin(mode, cwd) {
  let warnedMissingOpenAi = false;
  return {
    name: "ocr-csv-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (!path.endsWith("/api/convert") || req.method !== "POST") return next();
        try {
          const body = await readJsonBody(req);
          const ocrText = String(body.ocrText || "").trim();
          if (!ocrText) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "ocrText is required" }));
            return;
          }
          const key = resolveOpenAiApiKey(mode, cwd);
          if (!key) {
            if (!warnedMissingOpenAi) {
              warnedMissingOpenAi = true;
              console.warn(
                `\n[vite] ${openAiKeyMissingMessage(cwd)}\n`
              );
            }
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: openAiKeyMissingMessage(cwd) }));
            return;
          }
          const csv = await openAiOcrToCsv(key, ocrText);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ csv }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: e?.message || String(e) }));
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (!path.endsWith("/api/convert") || req.method !== "POST") return next();
        try {
          const body = await readJsonBody(req);
          const ocrText = String(body.ocrText || "").trim();
          if (!ocrText) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "ocrText is required" }));
            return;
          }
          const key = resolveOpenAiApiKey(mode, cwd);
          if (!key) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: openAiKeyMissingMessage(cwd) }));
            return;
          }
          const csv = await openAiOcrToCsv(key, ocrText);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ csv }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: e?.message || String(e) }));
        }
      });
    },
  };
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
    plugins: [react(), ghPages404Plugin(), ocrCsvApiPlugin(mode, cwd)],
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
