import { useState, useEffect } from "react";

/**
 * Shared layout for phone / tablet / desktop web.
 * Scales max shell width, horizontal padding, and breakpoint flags.
 */
export function useShellLayout() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 400));

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const shellMax =
    w >= 1440
      ? Math.min(1100, Math.floor(w * 0.88))
      : w >= 1200
        ? Math.min(960, Math.floor(w * 0.9))
        : w >= 900
          ? Math.min(800, Math.floor(w * 0.94))
          : w >= 640
            ? Math.min(560, w - 24)
            : Math.min(430, w);

  const px = w >= 1200 ? 32 : w >= 900 ? 28 : w >= 640 ? 22 : w >= 400 ? 18 : 16;

  const twoCol = w >= 900;
  const comfortable = w >= 640;

  const chart = {
    pie: twoCol ? 220 : 190,
    area: twoCol ? 200 : 150,
    bar: twoCol ? 220 : 185,
  };

  const safeBottom = "max(12px, env(safe-area-inset-bottom, 0px))";
  const safeTop = "max(0px, env(safe-area-inset-top, 0px))";

  /** Full-width on phones; px cap on larger screens (avoids side gaps / float). */
  const maxShell = w < 640 ? "100%" : shellMax;

  return {
    w,
    shellMax,
    maxShell,
    px,
    twoCol,
    comfortable,
    chart,
    isMobile: w < 640,
    isDesktop: w >= 900,
    safeBottom,
    safeTop,
  };
}
