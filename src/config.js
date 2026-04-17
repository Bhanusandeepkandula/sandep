/* ─── THEME SYSTEM ────────────────────────────────────────────────────── */

const THEMES = {
  /* iOS 26 Liquid Glass — true black base with system colours */
  default: {
    id: "default", name: "iOS 26", preview: ["#000000", "#1C1C1E", "#30D158"],
    bg: "#000000", surf: "#080808", card: "#111114", card2: "#1C1C1E",
    bdr: "rgba(255,255,255,0.09)", bdrH: "rgba(255,255,255,0.16)",
    acc: "#30D158", adim: "rgba(48,209,88,0.13)",
    warn: "#FF9F0A", wdim: "rgba(255,159,10,0.12)",
    dng: "#FF453A", ddim: "rgba(255,69,58,0.12)",
    blue: "#0A84FF", bdim: "rgba(10,132,255,0.13)",
    purp: "#BF5AF2", pdim: "rgba(191,90,242,0.12)",
    grn: "#30D158",
    txt: "#FFFFFF", sub: "rgba(235,235,245,0.55)", mut: "rgba(255,255,255,0.12)",
    btnTxt: "#000000",
    heroGrad: "linear-gradient(145deg,#161620 0%,#0A0A10 100%)",
    r: 16, rLg: 24,
  },
  midnight: {
    id: "midnight", name: "Midnight Blue", preview: ["#04070E", "#0B1220", "#0A84FF"],
    bg: "#04070E", surf: "#080E1A", card: "#0B1220", card2: "#10182B",
    bdr: "rgba(255,255,255,0.08)", bdrH: "rgba(255,255,255,0.14)",
    acc: "#0A84FF", adim: "rgba(10,132,255,0.14)",
    warn: "#FF9F0A", wdim: "rgba(255,159,10,0.12)",
    dng: "#FF453A", ddim: "rgba(255,69,58,0.12)",
    blue: "#0A84FF", bdim: "rgba(10,132,255,0.12)",
    purp: "#BF5AF2", pdim: "rgba(191,90,242,0.12)",
    grn: "#30D158",
    txt: "#FFFFFF", sub: "rgba(235,235,245,0.50)", mut: "rgba(255,255,255,0.10)",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(145deg,#0E1628 0%,#060C18 100%)",
    r: 16, rLg: 24,
  },
  grey: {
    id: "grey", name: "Titanium", preview: ["#0A0A0A", "#1C1C1E", "#30D158"],
    bg: "#0A0A0A", surf: "#101010", card: "#1C1C1E", card2: "#2C2C2E",
    bdr: "rgba(255,255,255,0.09)", bdrH: "rgba(255,255,255,0.14)",
    acc: "#30D158", adim: "rgba(48,209,88,0.13)",
    warn: "#FF9F0A", wdim: "rgba(255,159,10,0.12)",
    dng: "#FF453A", ddim: "rgba(255,69,58,0.12)",
    blue: "#0A84FF", bdim: "rgba(10,132,255,0.12)",
    purp: "#BF5AF2", pdim: "rgba(191,90,242,0.12)",
    grn: "#30D158",
    txt: "#EBEBF5", sub: "rgba(235,235,245,0.50)", mut: "rgba(255,255,255,0.11)",
    btnTxt: "#000000",
    heroGrad: "linear-gradient(145deg,#1C1C1E 0%,#0D0D0D 100%)",
    r: 16, rLg: 24,
  },
  jetblack: {
    id: "jetblack", name: "Deep Black", preview: ["#000000", "#0A0A0A", "#BF5AF2"],
    bg: "#000000", surf: "#030303", card: "#0D0D0D", card2: "#141414",
    bdr: "rgba(255,255,255,0.08)", bdrH: "rgba(255,255,255,0.13)",
    acc: "#BF5AF2", adim: "rgba(191,90,242,0.13)",
    warn: "#FF9F0A", wdim: "rgba(255,159,10,0.12)",
    dng: "#FF453A", ddim: "rgba(255,69,58,0.11)",
    blue: "#0A84FF", bdim: "rgba(10,132,255,0.11)",
    purp: "#BF5AF2", pdim: "rgba(191,90,242,0.11)",
    grn: "#30D158",
    txt: "#EBEBF5", sub: "rgba(235,235,245,0.45)", mut: "rgba(255,255,255,0.10)",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(145deg,#0D0D0D 0%,#000000 100%)",
    r: 16, rLg: 24,
  },
  /* iOS 26 Light — frosted glass over warm white */
  light: {
    id: "light", name: "Pearl", preview: ["#F2F2F7", "#FFFFFF", "#30D158"],
    bg: "#F2F2F7", surf: "#FFFFFF", card: "#FFFFFF", card2: "#F2F2F7",
    bdr: "rgba(0,0,0,0.08)", bdrH: "rgba(0,0,0,0.13)",
    acc: "#34C759", adim: "rgba(52,199,89,0.10)",
    warn: "#FF9500", wdim: "rgba(255,149,0,0.10)",
    dng: "#FF3B30", ddim: "rgba(255,59,48,0.09)",
    blue: "#007AFF", bdim: "rgba(0,122,255,0.10)",
    purp: "#AF52DE", pdim: "rgba(175,82,222,0.10)",
    grn: "#34C759",
    txt: "#000000", sub: "rgba(60,60,67,0.60)", mut: "rgba(60,60,67,0.18)",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(145deg,#FFFFFF 0%,#F2F2F7 100%)",
    r: 16, rLg: 24,
  },
  /* iOS 26 Light Blue — sky tints */
  lightblue: {
    id: "lightblue", name: "Sky Glass", preview: ["#EEF6FF", "#FFFFFF", "#007AFF"],
    bg: "#EEF6FF", surf: "#F8FAFE", card: "#FFFFFF", card2: "#EEF4FD",
    bdr: "rgba(0,0,0,0.07)", bdrH: "rgba(0,0,0,0.12)",
    acc: "#007AFF", adim: "rgba(0,122,255,0.10)",
    warn: "#FF9500", wdim: "rgba(255,149,0,0.10)",
    dng: "#FF3B30", ddim: "rgba(255,59,48,0.09)",
    blue: "#007AFF", bdim: "rgba(0,122,255,0.10)",
    purp: "#AF52DE", pdim: "rgba(175,82,222,0.10)",
    grn: "#34C759",
    txt: "#000000", sub: "rgba(60,60,67,0.55)", mut: "rgba(0,0,0,0.12)",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(145deg,#E8F4FF 0%,#F4FAFF 100%)",
    r: 16, rLg: 24,
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
  card.borderRadius = T.rLg;
  card.border = `1px solid ${T.bdr}`;
  card2.background = T.card2;
  card2.borderRadius = T.rLg;
  card2.border = `1px solid ${T.bdr}`;
  inp.background = T.card2;
  inp.border = `1px solid ${T.bdr}`;
  inp.borderRadius = T.r;
  inp.color = T.txt;
  lbl.color = T.sub;
  document.body.style.background = T.bg;
  document.body.style.color = T.txt;
  // data-theme enables CSS glass variants
  document.body.setAttribute("data-theme", T.id || "default");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", T.bg);
  document.documentElement.style.background = T.bg;
  const root = document.getElementById("root");
  if (root) root.style.background = T.bg;
}

export function getThemeId() {
  return T.id || "default";
}
