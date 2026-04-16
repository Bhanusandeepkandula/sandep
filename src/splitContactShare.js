/** Payload for QR / scan to add someone to split contacts (links sign-in ID + profile id). */

export const SPLIT_QR_PREFIX = "track:split:v1:";

/**
 * @param {{ email?: string; uuid?: string; name?: string }} p
 */
export function buildSplitSharePayload(p) {
  const obj = {
    v: 1,
    e: String(p.email || "").trim(),
    u: String(p.uuid || "").trim(),
    n: String(p.name || "Friend").trim().slice(0, 80),
  };
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return SPLIT_QR_PREFIX + b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * @param {string} s
 * @returns {{ e: string; u: string; n: string } | null}
 */
export function parseSplitSharePayload(s) {
  const t = String(s).trim();
  if (!t.startsWith(SPLIT_QR_PREFIX)) return null;
  let b64 = t.slice(SPLIT_QR_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const j = JSON.parse(json);
    if (j.v !== 1) return null;
    return {
      e: typeof j.e === "string" ? j.e.trim() : "",
      u: typeof j.u === "string" ? j.u.trim() : "",
      n: typeof j.n === "string" ? j.n.trim().slice(0, 80) : "",
    };
  } catch {
    return null;
  }
}

/**
 * @param {unknown} raw
 * @returns {{ n: string; e?: string; u?: string }}
 */
export function normalizePerson(raw) {
  if (typeof raw === "string") {
    const n = raw.trim();
    return n ? { n } : { n: "" };
  }
  if (raw && typeof raw === "object") {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const n = typeof o.n === "string" ? o.n.trim() : "";
    const e = typeof o.e === "string" ? o.e.trim() : "";
    const u = typeof o.u === "string" ? o.u.trim() : "";
    if (!n) return { n: "" };
    const out = { n };
    if (e) out.e = e;
    if (u) out.u = u;
    return out;
  }
  return { n: "" };
}

/**
 * @param {{ n: string; e?: string; u?: string }} a
 * @param {{ n: string; e?: string; u?: string }} b
 */
export function sameSplitPerson(a, b) {
  if (a.n !== b.n) return false;
  if (a.u && b.u) return a.u === b.u;
  if (a.e && b.e) return a.e === b.e;
  return a.n === b.n && !a.u && !b.u && !a.e && !b.e;
}

/**
 * @param {{ n: string; e?: string; u?: string }} p
 */
export function personStableKey(p) {
  const n = p.n || "";
  const u = p.u || "";
  const e = p.e || "";
  return `${n}::${u}::${e}`;
}
