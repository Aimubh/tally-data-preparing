"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { CardGlow } from "./card-glow";
import { useUIState } from "./ui-state";

// Routes that render full-bleed WITHOUT the dashboard chrome (sidebar/topbar).
const CHROMELESS = ["/welcome", "/login"];

// Client shell wrapper: applies the collapsed class (from remembered UI state)
// around the sidebar + content column. The TopBar is rendered per-page (its
// coverage data is month-specific), so this only owns the sidebar + layout grid.
export function Shell({
  groupName,
  adminName,
  adminAvatar,
  children,
}: {
  groupName: string;
  adminName?: string | null;
  adminAvatar?: string | null;
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useUIState();
  const pathname = usePathname();

  // The cinematic landing renders on its own, no sidebar.
  if (CHROMELESS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? " collapsed" : ""}`}>
      <CardGlow />
      <Sidebar
        groupName={groupName}
        adminName={adminName}
        adminAvatar={adminAvatar}
      />
      <div className="content-col">{children}</div>
    </div>
  );
}
