"use client";

import { useEffect, useRef } from "react";

/**
 * Cinematic starfield (Boiler-Lab style) — ON-DEMAND rendering.
 *
 * Idle: the field is painted ONCE (a still starscape) and then nothing runs —
 * no requestAnimationFrame loop, zero CPU. This is why the login/welcome screens
 * feel instant instead of laggy.
 *
 * On `warp` → true: the animation loop spins up only for the hyperspace jump
 * (stars streak toward the edges), then automatically stops when the flight ends.
 *
 * Respects prefers-reduced-motion (always static, never animates).
 */
export function Starfield({ warp = false }: { warp?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Shared drawing state lives in a ref so the static painter and the on-demand
  // warp loop use the same star array + geometry.
  const engineRef = useRef<{
    paintStatic: () => void;
    startWarp: () => void;
    stopWarp: () => void;
  } | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    interface Star {
      x: number;
      y: number;
      z: number;
      r: number;
      a: number; // fixed alpha (twinkle baked in once — no per-frame recompute)
    }
    let stars: Star[] = [];

    function seed(): Star {
      return {
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 0.9 + 0.1,
        r: Math.random() * 1.1 + 0.4,
        a: 0.35 + Math.random() * 0.55,
      };
    }

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      cx = w / 2;
      cy = h / 2;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(Math.floor((w * h) / 3200), 380);
      stars = Array.from({ length: count }, () => seed());
      paintStatic();
    }

    // --- Static paint: one frame, then nothing (the idle state). -----------
    function paintStatic() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      for (const s of stars) {
        const persp = 0.35 / s.z;
        const px = cx + s.x * persp * cx;
        const py = cy + s.y * persp * cy;
        if (px < 0 || px > w || py < 0 || py > h) continue;
        ctx.globalAlpha = s.a * (1 - s.z * 0.4);
        const size = Math.max(0.7, s.r * persp);
        ctx.fillRect(px, py, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // --- Warp loop: runs ONLY during the transition, then stops. -----------
    let raf = 0;
    let warpVel = 0;

    function warpFrame() {
      warpVel += (0.06 - warpVel) * 0.09;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of stars) {
        s.z -= 0.001 + warpVel;
        if (s.z <= 0.02) {
          Object.assign(s, seed());
          s.z = 1;
        }
        const persp = 0.35 / s.z;
        const px = cx + s.x * persp * cx;
        const py = cy + s.y * persp * cy;
        const prevPersp = 0.35 / (s.z + 0.03 + warpVel);
        const ppx = cx + s.x * prevPersp * cx;
        const ppy = cy + s.y * prevPersp * cy;
        ctx.moveTo(ppx, ppy);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      raf = requestAnimationFrame(warpFrame);
    }

    function startWarp() {
      if (reduce || raf) return; // reduced-motion: stay static; don't double-start
      warpVel = 0;
      raf = requestAnimationFrame(warpFrame);
    }
    function stopWarp() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    engineRef.current = { paintStatic, startWarp, stopWarp };

    resize();
    window.addEventListener("resize", resize);
    return () => {
      stopWarp();
      window.removeEventListener("resize", resize);
      engineRef.current = null;
    };
  }, []);

  // Start/stop the warp loop only when the `warp` prop flips. Idle = no loop.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (warp) engine.startWarp();
    else engine.stopWarp();
  }, [warp]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
      aria-hidden="true"
    />
  );
}
