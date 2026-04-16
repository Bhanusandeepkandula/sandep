/* ─── THEME SYSTEM ────────────────────────────────────────────────────── */

const THEMES = {
  default: {
    id: "default", name: "Deep Space", preview: ["#060610", "#12122A", "#22C55E"],
    bg: "#060610", surf: "#0C0C1A", card: "#12122A", card2: "#1A1A30",
    bdr: "#20203E", bdrH: "#2E2E55",
    acc: "#22C55E", adim: "rgba(34,197,94,0.13)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.11)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.11)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.11)",
    purp: "#A78BFA", pdim: "rgba(167,139,250,0.11)",
    txt: "#F1F1F8", sub: "#7878A0", mut: "#2E2E55",
    btnTxt: "#000000",
    heroGrad: "linear-gradient(135deg,#141432 0%,#0A0F22 100%)",
    r: 14, rLg: 20,
  },
  midnight: {
    id: "midnight", name: "Midnight", preview: ["#04070E", "#0B1220", "#3B82F6"],
    bg: "#04070E", surf: "#080E1A", card: "#0B1220", card2: "#10182B",
    bdr: "#162038", bdrH: "#1E2E4A",
    acc: "#3B82F6", adim: "rgba(59,130,246,0.15)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.12)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.12)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.12)",
    purp: "#818CF8", pdim: "rgba(129,140,248,0.12)",
    txt: "#DEE5F0", sub: "#4E6888", mut: "#1E2E4A",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(135deg,#0C1420 0%,#060C18 100%)",
    r: 14, rLg: 20,
  },
  grey: {
    id: "grey", name: "Dark Grey", preview: ["#101010", "#1C1C1C", "#10B981"],
    bg: "#101010", surf: "#161616", card: "#1C1C1C", card2: "#242424",
    bdr: "#303030", bdrH: "#404040",
    acc: "#10B981", adim: "rgba(16,185,129,0.14)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.12)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.12)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.12)",
    purp: "#A78BFA", pdim: "rgba(167,139,250,0.12)",
    txt: "#E4E4E4", sub: "#7A7A7A", mut: "#404040",
    btnTxt: "#000000",
    heroGrad: "linear-gradient(135deg,#1C1C1C 0%,#141414 100%)",
    r: 14, rLg: 20,
  },
  jetblack: {
    id: "jetblack", name: "Jet Black", preview: ["#000000", "#0A0A0A", "#22C55E"],
    bg: "#000000", surf: "#030303", card: "#0A0A0A", card2: "#111111",
    bdr: "#1A1A1A", bdrH: "#252525",
    acc: "#22C55E", adim: "rgba(34,197,94,0.12)",
    warn: "#EAB308", wdim: "rgba(234,179,8,0.12)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.10)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.10)",
    purp: "#A78BFA", pdim: "rgba(167,139,250,0.10)",
    txt: "#ECECEC", sub: "#5C5C5C", mut: "#252525",
    btnTxt: "#000000",
    heroGrad: "linear-gradient(135deg,#0A0A0A 0%,#030303 100%)",
    r: 14, rLg: 20,
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
    txt: "#18182B", sub: "#5D6374", mut: "#B5B8C2",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(135deg,#FFFFFF 0%,#F0F1F5 100%)",
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", T.bg);
  document.documentElement.style.background = T.bg;
  const root = document.getElementById("root");
  if (root) root.style.background = T.bg;
}

export function getThemeId() {
  return T.id || "default";
}
