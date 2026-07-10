"use client";

import { useEffect, useRef } from "react";

/**
 * Cinematic starfield (Boiler-Lab style): a full-screen black canvas of drifting,
 * twinkling stars. When `warp` flips true, the stars streak outward from center
 * (a hyperspace jump) for the flight-into-the-dashboard transition.
 *
 * Ambient motion only — no data, no layout impact. Respects prefers-reduced-motion
 * (renders a static field, no animation loop).
 */
export function Starfield({ warp = false }: { warp?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warpRef = useRef(warp);
  warpRef.current = warp;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    // Non-null locals so closures below keep the narrowed types.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    interface Star {
      x: number; // -1..1 normalized around center
      y: number;
      z: number; // depth 0..1 (smaller = farther)
      r: number; // base radius
      tw: number; // twinkle phase
      tws: number; // twinkle speed
    }
    let stars: Star[] = [];

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      cx = w / 2;
      cy = h / 2;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // density scales with area
      const count = Math.min(Math.floor((w * h) / 1600), 900);
      stars = Array.from({ length: count }, () => seed());
    }

    // Deterministic-ish seeding is unnecessary here; use Math.random (client only).
    function seed(): Star {
      return {
        x: (Math.random() * 2 - 1),
        y: (Math.random() * 2 - 1),
        z: Math.random() * 0.9 + 0.1,
        r: Math.random() * 1.1 + 0.3,
        tw: Math.random() * Math.PI * 2,
        tws: Math.random() * 0.04 + 0.01,
      };
    }

    let raf = 0;
    let warpVel = 0;

    function frame() {
      ctx.clearRect(0, 0, w, h);
      // subtle vignette-free pure black backdrop
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, h);

      const goingWarp = warpRef.current;
      warpVel += ((goingWarp ? 0.055 : 0) - warpVel) * 0.08;

      for (const s of stars) {
        // drift + warp: push stars outward from center by depth
        if (!reduce) {
          s.z -= 0.0006 + warpVel; // slow approach, fast in warp
          if (s.z <= 0.02) {
            const ns = seed();
            ns.z = 1;
            Object.assign(s, ns);
          }
          s.tw += s.tws;
        }
        const persp = 0.35 / s.z;
        const px = cx + s.x * persp * cx;
        const py = cy + s.y * persp * cy;
        if (px < -50 || px > w + 50 || py < -50 || py > h + 50) continue;

        const twinkle = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(s.tw);
        const radius = Math.max(0.2, s.r * persp * 0.5);
        ctx.globalAlpha = Math.min(1, twinkle * (1 - s.z * 0.4));

        if (warpVel > 0.01 && !reduce) {
          // draw a streak toward center for the hyperspace look
          const prevZ = s.z + 0.02 + warpVel;
          const pPersp = 0.35 / prevZ;
          const ppx = cx + s.x * pPersp * cx;
          const ppy = cy + s.y * pPersp * cy;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = radius;
          ctx.beginPath();
          ctx.moveTo(ppx, ppy);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (reduce) return; // static single frame under reduced motion
      raf = requestAnimationFrame(frame);
    }

    resize();
    frame();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

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
