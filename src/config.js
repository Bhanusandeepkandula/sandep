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
    id: "grey", name: "Dark Grey", preview: ["#0A0A0A", "#161616", "#10B981"],
    bg: "#0A0A0A", surf: "#101010", card: "#151515", card2: "#1C1C1C",
    bdr: "#262626", bdrH: "#333333",
    acc: "#10B981", adim: "rgba(16,185,129,0.14)",
    warn: "#F59E0B", wdim: "rgba(245,158,11,0.12)",
    dng: "#EF4444", ddim: "rgba(239,68,68,0.12)",
    blue: "#60A5FA", bdim: "rgba(96,165,250,0.12)",
    purp: "#A78BFA", pdim: "rgba(167,139,250,0.12)",
    txt: "#E4E4E4", sub: "#6E6E6E", mut: "#333333",
    btnTxt: "#000000",
    heroGrad: "linear-gradient(135deg,#161616 0%,#0D0D0D 100%)",
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
  /* Monochrome light — pure grayscale surfaces with near-black accents.
   * Red is kept (but muted) for destructive actions; warn/blue/purp are
   * mapped to darker greys so the UI reads as single-hue but keeps enough
   * semantic differentiation to stay usable. */
  light: {
    id: "light", name: "Monochrome", preview: ["#FAFAFA", "#FFFFFF", "#0A0A0A"],
    bg: "#FAFAFA", surf: "#F4F4F5", card: "#FFFFFF", card2: "#F4F4F5",
    bdr: "#E4E4E7", bdrH: "#D4D4D8",
    acc: "#0A0A0A", adim: "rgba(10,10,10,0.06)",
    warn: "#52525B", wdim: "rgba(82,82,91,0.09)",
    dng: "#B91C1C", ddim: "rgba(185,28,28,0.07)",
    blue: "#3F3F46", bdim: "rgba(63,63,70,0.07)",
    purp: "#18181B", pdim: "rgba(24,24,27,0.06)",
    txt: "#09090B", sub: "#71717A", mut: "#D4D4D8",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(135deg,#FFFFFF 0%,#F4F4F5 100%)",
    r: 14, rLg: 20,
  },
  /* Crisp light theme with a clean blue accent — the inverse of Midnight.
   * Neutral off-white surfaces, high-contrast ink text, and a saturated
   * royal-blue primary so call-to-action buttons, charts and pills still
   * stand out against the bright background. */
  lightblue: {
    id: "lightblue", name: "Light Blue", preview: ["#F6F9FF", "#FFFFFF", "#2563EB"],
    bg: "#F6F9FF", surf: "#EEF3FC", card: "#FFFFFF", card2: "#F1F5FC",
    bdr: "#DCE4F3", bdrH: "#BFD0EC",
    acc: "#2563EB", adim: "rgba(37,99,235,0.10)",
    warn: "#D97706", wdim: "rgba(217,119,6,0.10)",
    dng: "#DC2626", ddim: "rgba(220,38,38,0.09)",
    blue: "#2563EB", bdim: "rgba(37,99,235,0.10)",
    purp: "#7C3AED", pdim: "rgba(124,58,237,0.10)",
    txt: "#0F172A", sub: "#475569", mut: "#CBD5E1",
    btnTxt: "#FFFFFF",
    heroGrad: "linear-gradient(135deg,#DBEAFE 0%,#EFF6FF 100%)",
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
