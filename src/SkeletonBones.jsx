import { Skeleton, configureBoneyard } from "boneyard-js/react";
import { T } from "./config.js";

configureBoneyard({
  color: "rgba(255,255,255,0.06)",
  darkColor: "rgba(255,255,255,0.06)",
  animate: "shimmer",
});

function shimmerStyle() {
  const isLight = T.id === "light";
  const base = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.04)";
  const hi = isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.10)";
  return {
    background: `linear-gradient(90deg, ${base} 25%, ${hi} 50%, ${base} 75%)`,
    backgroundSize: "200% 100%",
    animation: "bone-shimmer 1.5s linear infinite",
  };
}

export function Bone({ w = "100%", h = 14, r = 6, style, mb = 0 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, ...shimmerStyle(), marginBottom: mb, flexShrink: 0, ...style }} />
  );
}

export function BoneCircle({ size = 40, style }) {
  return <Bone w={size} h={size} r="50%" style={style} />;
}

export function HomeSkeleton({ px = 20 }) {
  const isLight = T.id === "light";
  const dimBg = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)";
  return (
    <div style={{ padding: `${px + 8}px ${px}px ${px}px` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Bone w={120} h={12} mb={8} />
          <Bone w={160} h={24} r={8} />
        </div>
        <Bone w={40} h={40} r={12} />
      </div>
      <div style={{ background: T.heroGrad, borderRadius: 20, padding: 22, border: `1px solid ${T.bdr}`, marginBottom: 14 }}>
        <Bone w={90} h={12} mb={6} />
        <Bone w={200} h={36} r={8} mb={10} />
        <Bone w="80%" h={10} mb={16} />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: dimBg, borderRadius: 12, padding: "10px 14px" }}>
            <Bone w={50} h={10} mb={6} />
            <Bone w={80} h={18} r={6} />
          </div>
          <div style={{ flex: 1, background: dimBg, borderRadius: 12, padding: "10px 14px" }}>
            <Bone w={60} h={10} mb={6} />
            <Bone w={80} h={18} r={6} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "hidden" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: "0 0 64px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Bone w={48} h={48} r={14} />
            <Bone w={40} h={8} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <Bone w={70} h={16} r={6} />
        <Bone w={50} h={14} />
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.bdr}` }}>
          <Bone w={40} h={40} r={12} />
          <div style={{ flex: 1 }}>
            <Bone w={`${50 + (i % 3) * 15}%`} h={13} mb={6} />
            <Bone w={70} h={10} />
          </div>
          <div style={{ textAlign: "right" }}>
            <Bone w={60} h={14} mb={4} />
            <Bone w={40} h={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsSkeleton({ px = 20 }) {
  return (
    <div style={{ padding: `${px + 8}px ${px}px ${px}px` }}>
      <Bone w={130} h={24} r={8} mb={20} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[70, 60, 80, 50].map((w, i) => <Bone key={i} w={w} h={32} r={16} />)}
      </div>
      <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.bdr}`, padding: 16, marginBottom: 20, height: 200, display: "flex", alignItems: "flex-end", gap: 8 }}>
        {[60, 80, 45, 90, 70, 50, 85].map((h, i) => <Bone key={i} w="100%" h={h} r={4} style={{ maxWidth: 32 }} />)}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Bone w={36} h={36} r={10} />
          <div style={{ flex: 1 }}>
            <Bone w={`${40 + i * 10}%`} h={12} mb={6} />
            <Bone w="100%" h={6} r={3} />
          </div>
          <Bone w={55} h={14} />
        </div>
      ))}
    </div>
  );
}

export function BudgetsSkeleton({ px = 20 }) {
  return (
    <div style={{ padding: `${px}px` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <Bone w={100} h={22} r={8} />
        <Bone w={100} h={36} r={10} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.bdr}`, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Bone w={32} h={32} r={8} />
              <Bone w={80} h={14} />
            </div>
            <Bone w={60} h={14} />
          </div>
          <Bone w="100%" h={8} r={4} />
        </div>
      ))}
    </div>
  );
}

export { Skeleton };
