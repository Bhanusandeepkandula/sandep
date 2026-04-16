/* ─── THEME SYSTEM ────────────────────────────────────────────────────── */

const THEMES = {
  default: {
    id: "default", name: "Deep Space", preview: ["#08080F", "#15152A", "#22C55E"],
    bg: "#08080F", surf: "#0F0F1C", card: "#15152A", card2: "#1C1C32",
    bdr: "#242445", bdrH: "#363660",
    acc: "#22C55E", adim: "rgba(34,197,94,0.12)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.10)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.10)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.10)",
    purp: "#A78BFA",
    txt: "#FFFFFF", sub: "#8585AA", mut: "#363660",
    r: 14, rLg: 20,
  },
  midnight: {
    id: "midnight", name: "Midnight", preview: ["#0A0E1A", "#141B2D", "#3B82F6"],
    bg: "#0A0E1A", surf: "#101726", card: "#141B2D", card2: "#1A2238",
    bdr: "#1F2B45", bdrH: "#2D3F5E",
    acc: "#3B82F6", adim: "rgba(59,130,246,0.12)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.10)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.10)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.10)",
    purp: "#818CF8",
    txt: "#E8EDF5", sub: "#6B7FA0", mut: "#2D3F5E",
    r: 14, rLg: 20,
  },
  grey: {
    id: "grey", name: "Dark Grey", preview: ["#1A1A1A", "#2A2A2A", "#10B981"],
    bg: "#1A1A1A", surf: "#222222", card: "#2A2A2A", card2: "#333333",
    bdr: "#404040", bdrH: "#555555",
    acc: "#10B981", adim: "rgba(16,185,129,0.12)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.10)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.10)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.10)",
    purp: "#A78BFA",
    txt: "#F0F0F0", sub: "#999999", mut: "#555555",
    r: 14, rLg: 20,
  },
  jetblack: {
    id: "jetblack", name: "Jet Black", preview: ["#000000", "#111111", "#22C55E"],
    bg: "#000000", surf: "#0A0A0A", card: "#111111", card2: "#1A1A1A",
    bdr: "#262626", bdrH: "#333333",
    acc: "#22C55E", adim: "rgba(34,197,94,0.10)",
    warn: "#EAB308", wdim: "rgba(234,179,8,0.10)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.10)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.10)",
    purp: "#A78BFA",
    txt: "#FFFFFF", sub: "#777777", mut: "#333333",
    r: 14, rLg: 20,
  },
  light: {
    id: "light", name: "Light", preview: ["#F5F5F7", "#FFFFFF", "#16A34A"],
    bg: "#F5F5F7", surf: "#EEEFF2", card: "#FFFFFF", card2: "#F0F1F4",
    bdr: "#D4D6DD", bdrH: "#B8BBC5",
    acc: "#16A34A", adim: "rgba(22,163,74,0.10)",
    warn: "#D97706", wdim: "rgba(217,119,6,0.10)",
    dng: "#DC2626", ddim: "rgba(220,38,38,0.08)",
    blue: "#2563EB", bdim: "rgba(37,99,235,0.10)",
    purp: "#7C3AED",
    txt: "#1A1A2E", sub: "#6B7280", mut: "#B8BBC5",
    r: 14, rLg: 20,
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
  color: on ? (T.id === "light" ? "#FFFFFF" : "#000") : T.sub,
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
}

export function getThemeId() {
  return T.id || "default";
}
