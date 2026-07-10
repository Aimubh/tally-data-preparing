"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Starfield } from "@/components/starfield";
import { login } from "./actions";
import { GROUP_NAME } from "@/lib/config";

/**
 * Admin login on the same cinematic starfield (Boiler-Lab style). On success the
 * stars warp and the screen flies into the dashboard.
 */
export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [warp, setWarp] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await login(formData);
      if (res.ok) {
        setEntering(true);
        setWarp(true);
        window.setTimeout(() => {
          router.push(next);
          router.refresh();
        }, 900);
      } else {
        setError(res.error ?? "Could not sign in.");
      }
    });
  }

  return (
    <div className={`welcome${entering ? " entering" : ""}`}>
      <Starfield warp={warp} />

      <div className="welcome-inner login-inner">
        <div className="welcome-logo">
          <span className="bolt" aria-hidden="true">
            ⌁
          </span>
          {GROUP_NAME.toUpperCase()}
        </div>

        <h1 className="welcome-title login-title">Admin sign in</h1>
        <p className="welcome-sub login-sub">
          Restricted console. Sign in to reach the consolidated MIS.
        </p>

        <form action={submit} className="login-card">
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="admin@groupmis.local"
              autoFocus
              disabled={pending || entering}
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={pending || entering}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="welcome-cta login-cta"
            disabled={pending || entering}
          >
            {entering ? "Entering…" : pending ? "Signing in…" : "Sign in"}
            <span className="arr" aria-hidden="true">
              →
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
