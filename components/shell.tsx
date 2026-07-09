"use client";

import { Sidebar } from "./sidebar";
import { useUIState } from "./ui-state";

// Client shell wrapper: applies the collapsed class (from remembered UI state)
// around the sidebar + content column. The TopBar is rendered per-page (its
// coverage data is month-specific), so this only owns the sidebar + layout grid.
export function Shell({
  groupName,
  children,
}: {
  groupName: string;
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useUIState();
  return (
    <div className={`app-shell${sidebarCollapsed ? " collapsed" : ""}`}>
      <Sidebar groupName={groupName} />
      <div className="content-col">{children}</div>
    </div>
  );
}
