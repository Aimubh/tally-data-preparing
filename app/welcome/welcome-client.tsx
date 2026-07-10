"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Starfield } from "@/components/starfield";
import { GROUP_NAME } from "@/lib/config";

/**
 * Cinematic landing (Boiler-Lab style): black starfield, brand lockup, and an
 * "Enter console" CTA that triggers a hyperspace warp before flying into the
 * dashboard at "/".
 */
export function WelcomeClient() {
  const router = useRouter();
  const [warp, setWarp] = useState(false);
  const [entering, setEntering] = useState(false);

  // Prefetch the dashboard so the flight lands instantly.
  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  function enter() {
    if (entering) return;
    setEntering(true);
    setWarp(true);
    // let the warp build, then fly in
    window.setTimeout(() => router.push("/"), 900);
  }

  return (
    <div className={`welcome${entering ? " entering" : ""}`}>
      <Starfield warp={warp} />

      <div className="welcome-inner">
        <div className="welcome-logo">
          <span className="bolt" aria-hidden="true">
            ⌁
          </span>
          {GROUP_NAME.toUpperCase()}
        </div>

        <h1 className="welcome-title">
          Consolidation MIS
          <br />
          at rocket speed.
        </h1>
        <p className="welcome-sub">
          Every group company&rsquo;s books, one live consolidated view —
          inter-company eliminations handled, variances caught the moment they
          appear.
        </p>

        <button className="welcome-cta" onClick={enter} disabled={entering}>
          {entering ? "Entering…" : "Enter console"}
          <span className="arr" aria-hidden="true">
            →
          </span>
        </button>

        <button
          className="welcome-skip"
          onClick={() => router.push("/")}
          disabled={entering}
        >
          Skip intro
        </button>
      </div>

      <div className="welcome-scroll" aria-hidden="true">
        <span>Let&rsquo;s fly to the numbers</span>
        <span className="chev">⌄</span>
      </div>
    </div>
  );
}
