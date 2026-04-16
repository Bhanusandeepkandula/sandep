import { useState, useRef, useEffect } from "react";
import { T } from "./config.js";

const THRESHOLD = 68;
const MAX_PULL = 110;

export function PullToRefresh({ scrollRef, onRefresh }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;

    function onTouchStart(e) {
      if (refreshingRef.current) return;
      if (el.scrollTop > 2) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }

    function onTouchMove(e) {
      if (!pulling.current || refreshingRef.current) return;
      if (el.scrollTop > 2) {
        pulling.current = false;
        pullRef.current = 0;
        setPullY(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy < 0) { pullRef.current = 0; setPullY(0); return; }
      const v = Math.min(MAX_PULL, dy * 0.42);
      pullRef.current = v;
      setPullY(v);
    }

    async function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      const py = pullRef.current;
      if (py >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        pullRef.current = THRESHOLD * 0.55;
        setPullY(THRESHOLD * 0.55);
        try { await onRefreshRef.current?.(); } catch {}
        await new Promise((r) => setTimeout(r, 500));
        refreshingRef.current = false;
        setRefreshing(false);
      }
      pullRef.current = 0;
      setPullY(0);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [scrollRef]);

  const progress = Math.min(1, pullY / THRESHOLD);
  if (pullY < 3 && !refreshing) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        display: "flex",
        justifyContent: "center",
        paddingTop: Math.max(8, pullY - 16),
        transition: pulling.current ? "none" : "padding-top .35s cubic-bezier(.22,1,.36,1)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 99,
          background: T.card,
          border: `1px solid ${T.bdr}`,
          boxShadow: `0 4px 20px rgba(0,0,0,${T.id === "light" ? 0.12 : 0.4})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.4 + progress * 0.6})`,
          opacity: 0.2 + progress * 0.8,
          transition: pulling.current ? "none" : "all .35s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.acc}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: refreshing ? "none" : `rotate(${progress * 270}deg)`,
            transition: pulling.current ? "none" : "transform .3s ease",
            animation: refreshing ? "ptr-spin .65s linear infinite" : "none",
          }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    </div>
  );
}
