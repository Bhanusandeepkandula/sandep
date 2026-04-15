/* ─── THEME (layout tokens only — not user data) ─────────────────────── */
export const T = {
  bg: "#08080F",
  surf: "#0F0F1C",
  card: "#15152A",
  card2: "#1C1C32",
  bdr: "#242445",
  bdrH: "#363660",
  acc: "#22C55E",
  adim: "rgba(34,197,94,0.12)",
  warn: "#F59E0B",
  wdim: "rgba(245,158,11,0.10)",
  dng: "#EF4444",
  ddim: "rgba(239,68,68,0.10)",
  blue: "#60A5FA",
  bdim: "rgba(96,165,250,0.10)",
  purp: "#A78BFA",
  txt: "#FFFFFF",
  sub: "#8585AA",
  mut: "#363660",
  r: 14,
  rLg: 20,
};

export const card = { background: T.card, borderRadius: T.r, border: `1px solid ${T.bdr}`, padding: 16 };
export const card2 = { background: T.card2, borderRadius: T.r, border: `1px solid ${T.bdr}`, padding: 16 };
export const inp = {
  width: "100%",
  padding: "12px 14px",
  background: T.card2,
  border: `1px solid ${T.bdr}`,
  borderRadius: T.r,
  color: T.txt,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
export const lbl = { fontSize: 12, color: T.sub, marginBottom: 6, display: "block" };
export const pill = (on, col) => ({
  padding: "6px 14px",
  borderRadius: 999,
  border: on ? "none" : `1px solid ${T.bdr}`,
  background: on ? col || T.acc : "transparent",
  color: on ? "#000" : T.sub,
  fontSize: 13,
  fontWeight: on ? 600 : 400,
  cursor: "pointer",
  whiteSpace: "nowrap",
});
