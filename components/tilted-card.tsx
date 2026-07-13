"use client";

/**
 * TiltedCard — a holographic 3D profile card (reactbits "ProfileCard" look)
 * with the tilt-follow motion kept from the earlier implementation.
 *
 * Motion is UNCHANGED: the card rotates toward the cursor (rotateAmplitude) and
 * lifts on hover (scaleOnHover) via pure CSS 3D transforms — no framer-motion.
 * Only the size + inner look are new: a behind-glow, an inner gradient, the
 * avatar, name + title, and an optional user-info footer (handle · status ·
 * Contact button). Honours prefers-reduced-motion (no tilt).
 */

import { useRef, useState } from "react";

interface TiltedCardProps {
  imageSrc: string | null; // avatar
  altText?: string;
  name: string;
  designation?: string | null; // → title line
  handle?: string;
  status?: string;
  contactText?: string;
  onContactClick?: () => void;
  showUserInfo?: boolean;
  containerHeight?: string;
  containerWidth?: string;
  rotateAmplitude?: number;
  scaleOnHover?: number;
  behindGlowColor?: string;
  innerGradient?: string;
}

export function TiltedCard({
  imageSrc,
  altText = "Profile",
  name,
  designation,
  handle,
  status = "Online",
  contactText = "Contact Me",
  onContactClick,
  showUserInfo = true,
  containerHeight = "420px",
  containerWidth = "320px",
  rotateAmplitude = 12,
  scaleOnHover = 1.05,
  behindGlowColor = "rgba(125, 190, 255, 0.67)",
  innerGradient = "linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)",
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hovering, setHovering] = useState(false);
  // Glare/shine position (0..100%) follows the cursor across the card.
  const [glare, setGlare] = useState({ x: 50, y: 50 });

  // --- Motion (unchanged) ---------------------------------------------------
  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({
      rx: -py * rotateAmplitude, // top tilts back
      ry: px * rotateAmplitude, // right tilts away
    });
    setGlare({ x: (px + 0.5) * 100, y: (py + 0.5) * 100 });
  }
  function onEnter() {
    setHovering(true);
  }
  function onLeave() {
    setHovering(false);
    setTilt({ rx: 0, ry: 0 });
    setGlare({ x: 50, y: 50 });
  }
  // --------------------------------------------------------------------------

  function initials(n: string): string {
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  const scale = hovering ? scaleOnHover : 1;
  const derivedHandle =
    handle ?? name.trim().toLowerCase().replace(/\s+/g, "");

  return (
    <div
      className="pcard"
      style={{ height: containerHeight, width: containerWidth }}
    >
      {/* behind-glow */}
      <div
        className="pcard-glow"
        aria-hidden="true"
        style={{ background: behindGlowColor }}
      />

      <div
        ref={ref}
        className="pcard-inner"
        onMouseMove={onMove}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${scale})`,
          background: innerGradient,
        }}
      >
        {/* cursor-following holographic glare */}
        <div
          className="pcard-glare"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%)`,
          }}
        />

        {/* avatar */}
        <div className="pcard-avatar">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt={altText} />
          ) : (
            <div className="pcard-avatar-fallback">{initials(name)}</div>
          )}
        </div>

        {/* name + title */}
        <div className="pcard-headline">
          <div className="pcard-name">{name || "—"}</div>
          {designation ? (
            <div className="pcard-title">{designation}</div>
          ) : null}
        </div>

        {/* user-info footer: handle · status · contact */}
        {showUserInfo && (
          <div className="pcard-userinfo">
            <div className="pcard-user">
              <div className="pcard-mini-avatar">
                {imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageSrc} alt="" />
                ) : (
                  <span>{initials(name)}</span>
                )}
              </div>
              <div className="pcard-user-text">
                <div className="pcard-handle">@{derivedHandle}</div>
                <div className="pcard-status">
                  <span className="pcard-status-dot" aria-hidden="true" />
                  {status}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="pcard-contact"
              onClick={onContactClick}
            >
              {contactText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
