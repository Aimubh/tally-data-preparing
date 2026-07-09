"use client";

/**
 * Global UI state remembered across sessions via localStorage:
 *   - rupeeMode: "full" | "lakh"   (₹ Full / ₹ Lakh toggle)
 *   - sidebarCollapsed: boolean     (icons-only sidebar)
 *
 * The selected MONTH is intentionally NOT here — it lives in the URL (?month=)
 * so server components rendering report data can read it directly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { RupeeMode } from "@/lib/format";

interface UIState {
  rupeeMode: RupeeMode;
  toggleRupeeMode: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  hydrated: boolean;
}

const Ctx = createContext<UIState | null>(null);

const LS_RUPEE = "gmis.rupeeMode";
const LS_SIDEBAR = "gmis.sidebarCollapsed";

export function UIStateProvider({ children }: { children: React.ReactNode }) {
  const [rupeeMode, setRupeeMode] = useState<RupeeMode>("full");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state after mount (avoids SSR/client mismatch).
  useEffect(() => {
    try {
      const r = localStorage.getItem(LS_RUPEE);
      if (r === "full" || r === "lakh") setRupeeMode(r);
      const s = localStorage.getItem(LS_SIDEBAR);
      if (s === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore storage errors */
    }
    setHydrated(true);
  }, []);

  const toggleRupeeMode = useCallback(() => {
    setRupeeMode((prev) => {
      const next = prev === "full" ? "lakh" : "full";
      try {
        localStorage.setItem(LS_RUPEE, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_SIDEBAR, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <Ctx.Provider
      value={{
        rupeeMode,
        toggleRupeeMode,
        sidebarCollapsed,
        toggleSidebar,
        hydrated,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUIState(): UIState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUIState must be used within UIStateProvider");
  return ctx;
}
