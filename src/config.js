/* ─── THEME SYSTEM ──────────────────────────────────────────────────────
 * Radii are intentionally medium (r: 10 / rLg: 14) — tight, modern, and
 * readable without looking over-rounded. heroGrad is just the bg colour
 * (no linear-gradient) so every screen reads as a single plain surface.
 */

const THEMES = {
  default: {
    id: "default", name: "Deep Space", preview: ["#060610", "#12122A", "#22C55E"],
    bg: "#060610", surf: "#0C0C1A", card: "#12122A", card2: "#1A1A30",
    bdr: "#20203E", bdrH: "#2E2E55",
    acc: "#22C55E", adim: "rgba(34,197,94,0.14)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.11)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.11)",
    blue: "#7DA3FF", bdim: "rgba(125,163,255,0.13)",
    purp: "#B69CFF", pdim: "rgba(182,156,255,0.13)",
    grn: "#22C55E",
    txt: "#F1F1F8", sub: "#7878A0", mut: "#2E2E55",
    btnTxt: "#000000",
    heroGrad: "#12122A",
    r: 10, rLg: 14,
  },
  midnight: {
    id: "midnight", name: "Midnight", preview: ["#04070E", "#0B1220", "#3B82F6"],
    bg: "#04070E", surf: "#080E1A", card: "#0B1220", card2: "#10182B",
    bdr: "#162038", bdrH: "#1E2E4A",
    acc: "#3B82F6", adim: "rgba(59,130,246,0.18)",
    warn: "#FBBF24", wdim: "rgba(251,191,36,0.13)",
    dng: "#F87171", ddim: "rgba(248,113,113,0.13)",
    blue: "#3B82F6", bdim: "rgba(59,130,246,0.16)",
    purp: "#6366F1", pdim: "rgba(99,102,241,0.14)",
    grn: "#34D399",
    txt: "#DEE5F0", sub: "#4E6888", mut: "#1E2E4A",
    btnTxt: "#FFFFFF",
    heroGrad: "#0B1220",
    r: 10, rLg: 14,
  },
  grey: {
    id: "grey", name: "Dark Grey", preview: ["#070707", "#141414", "#10B981"],
    bg: "#070707", surf: "#0E0E0E", card: "#141414", card2: "#1C1C1C",
    bdr: "#262626", bdrH: "#363636",
    acc: "#10B981", adim: "rgba(16,185,129,0.14)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.12)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.12)",
    blue: "#3B82F6", bdim: "rgba(59,130,246,0.13)",
    purp: "#A78BFA", pdim: "rgba(167,139,250,0.12)",
    grn: "#10B981",
    txt: "#E4E4E4", sub: "#6E6E6E", mut: "#363636",
    btnTxt: "#000000",
    heroGrad: "#141414",
    r: 10, rLg: 14,
  },
  jetblack: {
    id: "jetblack", name: "Jet Black", preview: ["#000000", "#0A0A0A", "#22C55E"],
    bg: "#000000", surf: "#030303", card: "#0A0A0A", card2: "#111111",
    bdr: "#1A1A1A", bdrH: "#252525",
    acc: "#22C55E", adim: "rgba(34,197,94,0.13)",
    warn: "#EAB308", wdim: "rgba(234,179,8,0.12)",
    dng: "#F87171", ddim: "rgba(248,113,113,0.10)",
    blue: "#38BDF8", bdim: "rgba(56,189,248,0.12)",
    purp: "#C084FC", pdim: "rgba(192,132,252,0.12)",
    grn: "#22C55E",
    txt: "#ECECEC", sub: "#5C5C5C", mut: "#252525",
    btnTxt: "#000000",
    heroGrad: "#0A0A0A",
    r: 10, rLg: 14,
  },
  light: {
    id: "light", name: "Light", preview: ["#F4F5F8", "#FFFFFF", "#16A34A"],
    bg: "#F4F5F8", surf: "#ECEDF1", card: "#FFFFFF", card2: "#F0F1F5",
    bdr: "#D2D4DC", bdrH: "#B5B8C2",
    acc: "#16A34A", adim: "rgba(22,163,74,0.10)",
    warn: "#D97706", wdim: "rgba(217,119,6,0.10)",
    dng: "#DC2626", ddim: "rgba(220,38,38,0.08)",
    blue: "#2563EB", bdim: "rgba(37,99,235,0.10)",
    purp: "#7C3AED", pdim: "rgba(124,58,237,0.10)",
    grn: "#16A34A",
    txt: "#18182B", sub: "#5D6374", mut: "#B5B8C2",
    btnTxt: "#FFFFFF",
    heroGrad: "#FFFFFF",
    r: 10, rLg: 14,
  },
  lightblue: {
    id: "lightblue", name: "Light Blue", preview: ["#F6F9FF", "#FFFFFF", "#2563EB"],
    bg: "#F6F9FF", surf: "#EEF3FC", card: "#FFFFFF", card2: "#F1F5FC",
    bdr: "#DCE4F3", bdrH: "#BFD0EC",
    acc: "#2563EB", adim: "rgba(37,99,235,0.10)",
    warn: "#D97706", wdim: "rgba(217,119,6,0.10)",
    dng: "#DC2626", ddim: "rgba(220,38,38,0.09)",
    blue: "#2563EB", bdim: "rgba(37,99,235,0.10)",
    purp: "#7C3AED", pdim: "rgba(124,58,237,0.10)",
    grn: "#16A34A",
    txt: "#0F172A", sub: "#475569", mut: "#CBD5E1",
    btnTxt: "#FFFFFF",
    heroGrad: "#FFFFFF",
    r: 10, rLg: 14,
  },
};

export { THEMES };

export const T = { ...THEMES.default };

export const card = { background: T.card, borderRadius: T.r, border: `1px solid ${T.bdr}`, padding: 16 };
export const card2 = { background: T.card2, borderRadius: T.r, border: `1px solid ${T.bdr}`, padding: 16 };
export const inp = {
  width: "100%",
  padding: "12px 14px",
  background: T.card2,
  border: `1px solid ${T.bdr}`,
  borderRadius: T.r,
  color: T.txt,
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
};
export const lbl = { fontSize: 12, color: T.sub, marginBottom: 6, display: "block" };
export const pill = (on, col) => ({
  padding: "6px 14px",
  borderRadius: 999,
  border: on ? "none" : `1px solid ${T.bdr}`,
  background: on ? col || T.acc : "transparent",
  color: on ? T.btnTxt : T.sub,
  fontSize: 13,
  fontWeight: on ? 600 : 400,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export function applyTheme(name) {
  const theme = THEMES[name] || THEMES.default;
  Object.assign(T, theme);
  card.background = T.card;
  card.borderRadius = T.r;
  card.border = `1px solid ${T.bdr}`;
  card2.background = T.card2;
  card2.borderRadius = T.r;
  card2.border = `1px solid ${T.bdr}`;
  inp.background = T.card2;
  inp.border = `1px solid ${T.bdr}`;
  inp.borderRadius = T.r;
  inp.color = T.txt;
  lbl.color = T.sub;
  document.body.style.background = T.bg;
  document.body.style.color = T.txt;
  document.body.setAttribute("data-theme", T.id || "default");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", T.bg);
  document.documentElement.style.background = T.card;
  const root = document.getElementById("root");
  if (root) root.style.background = T.bg;
}

export function getThemeId() {
  return T.id || "default";
}
