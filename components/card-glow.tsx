"use client";

/**
 * MagicBento-style glow layer — DARK MODE ONLY.
 *
 * Adds the reactbits "Magic Bento" signature effects to every card/chart surface
 * without GSAP or a bento-grid rebuild:
 *   - a cursor-following radial SPOTLIGHT over the content area,
 *   - a per-card BORDER GLOW that lights up the edge nearest the cursor,
 *   - a few STAR particles that drift up when the cursor enters a card,
 *   - a click RIPPLE.
 *
 * Cards opt in purely by class name (.panel, .kpi, .company-card, …) — no markup
 * changes needed. Everything is gated behind :root[data-theme="dark"] in CSS and
 * behind `theme === "dark"` here, so light mode is untouched. Respects
 * prefers-reduced-motion (particles/ripple skipped; static glow only).
 */

import { useEffect, useRef } from "react";
import { useUIState } from "./ui-state";

// Purple glow, matching the requested MagicBento glowColor "132, 0, 255".
const GLOW_RGB = "132, 0, 255";
const SPOTLIGHT_RADIUS = 400;
const PARTICLE_COUNT = 12;

// Selector for every surface that should glow. Kept to clean rectangular cards
// (charts live inside .panel). Excludes surfaces that expand/clip content
// (.gst-check, .settings-nav) so overflow:hidden doesn't cut them off.
const CARD_SELECTOR =
  ".panel, .kpi, .company-card, .settings-card, .elim-strip, .upload-panel";

export function CardGlow() {
  const { theme } = useUIState();
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (theme !== "dark") return;
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // --- Global spotlight overlay (follows the cursor) ---
    const spot = document.createElement("div");
    spot.className = "mb-spotlight";
    spot.style.setProperty("--mb-radius", `${SPOTLIGHT_RADIUS}px`);
    spot.style.setProperty("--mb-rgb", GLOW_RGB);
    document.body.appendChild(spot);
    spotlightRef.current = spot;

    let raf = 0;
    function onMove(e: MouseEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Position the global spotlight.
        spot.style.setProperty("--mb-x", `${e.clientX}px`);
        spot.style.setProperty("--mb-y", `${e.clientY}px`);
        spot.style.opacity = "1";

        // Per-card border glow: light the card under / nearest the cursor.
        const cards = document.querySelectorAll<HTMLElement>(CARD_SELECTOR);
        cards.forEach((card) => {
          const r = card.getBoundingClientRect();
          const cx = e.clientX - r.left;
          const cy = e.clientY - r.top;
          card.style.setProperty("--glow-x", `${cx}px`);
          card.style.setProperty("--glow-y", `${cy}px`);
          // Intensity falls off with distance from the card.
          const inside =
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom;
          const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
          const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
          const dist = Math.hypot(dx, dy);
          const intensity = inside
            ? 1
            : Math.max(0, 1 - dist / SPOTLIGHT_RADIUS);
          card.style.setProperty("--glow-intensity", intensity.toFixed(3));
        });
      });
    }

    function onLeave() {
      spot.style.opacity = "0";
    }

    // --- Hover particles + click ripple (per card) ---
    function spawnParticles(card: HTMLElement) {
      if (reduced) return;
      const r = card.getBoundingClientRect();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const dot = document.createElement("span");
        dot.className = "mb-particle";
        dot.style.left = `${Math.random() * r.width}px`;
        dot.style.top = `${Math.random() * r.height}px`;
        dot.style.setProperty("--mb-rgb", GLOW_RGB);
        dot.style.animationDelay = `${(i / PARTICLE_COUNT) * 240}ms`;
        card.appendChild(dot);
        window.setTimeout(() => dot.remove(), 1400);
      }
    }

    function onOver(e: MouseEvent) {
      const card = (e.target as HTMLElement)?.closest<HTMLElement>(
        CARD_SELECTOR
      );
      if (!card || card.dataset.mbActive === "1") return;
      // ignore moving between children of the same card
      const related = (e as MouseEvent & { fromElement?: Node })
        .relatedTarget as Node | null;
      if (related && card.contains(related)) return;
      card.dataset.mbActive = "1";
      card.classList.add("mb-card");
      spawnParticles(card);
    }
    function onOut(e: MouseEvent) {
      const card = (e.target as HTMLElement)?.closest<HTMLElement>(
        CARD_SELECTOR
      );
      if (!card) return;
      const related = e.relatedTarget as Node | null;
      if (related && card.contains(related)) return;
      delete card.dataset.mbActive;
    }
    function onClick(e: MouseEvent) {
      if (reduced) return;
      const card = (e.target as HTMLElement)?.closest<HTMLElement>(
        CARD_SELECTOR
      );
      if (!card) return;
      const r = card.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "mb-ripple";
      ripple.style.left = `${e.clientX - r.left}px`;
      ripple.style.top = `${e.clientY - r.top}px`;
      ripple.style.setProperty("--mb-rgb", GLOW_RGB);
      card.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 700);
    }

    // Tag existing cards so the border-glow CSS hook applies immediately.
    document
      .querySelectorAll<HTMLElement>(CARD_SELECTOR)
      .forEach((c) => c.classList.add("mb-card"));

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("click", onClick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("click", onClick);
      spot.remove();
      spotlightRef.current = null;
      document
        .querySelectorAll<HTMLElement>(".mb-card")
        .forEach((c) => c.classList.remove("mb-card"));
    };
  }, [theme]);

  return null;
}
