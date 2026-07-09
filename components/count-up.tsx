"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up animation for KPI values (150–300ms range → 260ms here), ease-out.
 * Respects prefers-reduced-motion by jumping straight to the final value.
 * `render` formats the current animated number for display.
 */
export function CountUp({
  value,
  durationMs = 260,
  render,
}: {
  value: number;
  durationMs?: number;
  render: (n: number) => string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    let start: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      setDisplay(from + (to - from) * ease(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <>{render(display)}</>;
}
