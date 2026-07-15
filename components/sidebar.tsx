"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { NAV_ITEMS } from "./nav-config";
import { Icon } from "./icons";
import { useUIState } from "./ui-state";
import { logout } from "@/app/login/actions";

export function Sidebar({
  groupName,
  adminName,
  adminAvatar,
}: {
  groupName: string;
  adminName?: string | null;
  adminAvatar?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();
  const { sidebarCollapsed, toggleSidebar } = useUIState();
  const navRef = useRef<HTMLDivElement>(null);
  const [accent, setAccent] = useState<{ y: number; show: boolean }>({
    y: 0,
    show: false,
  });

  // Which nav item is active (longest matching prefix; "/" only exact).
  const activeHref =
    NAV_ITEMS.filter((n) =>
      n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
    ).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  // Position the sliding accent bar against the active item.
  useEffect(() => {
    if (!navRef.current || !activeHref) {
      setAccent((a) => ({ ...a, show: false }));
      return;
    }
    const el = navRef.current.querySelector<HTMLElement>(
      `[data-href="${activeHref}"]`
    );
    if (el) {
      const navBox = navRef.current.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setAccent({ y: box.top - navBox.top + navRef.current.scrollTop, show: true });
    }
  }, [activeHref, pathname, sidebarCollapsed]);

  // Header shows the signed-in admin (avatar + name); falls back to the group
  // logo/name when there's no admin (e.g. before first render).
  const displayName = adminName?.trim() || groupName;
  const logoInitials = adminName?.trim()
    ? adminName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "GM";

  return (
    <aside className="sidebar">
      {/* Top: admin avatar + name + expand(→) / collapse(×) toggle */}
      <div className="group-head">
        <span className="group-logo">
          {adminAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="group-logo-img" src={adminAvatar} alt="" />
          ) : (
            logoInitials
          )}
        </span>
        <span className="group-name" title={displayName}>
          {displayName}
        </span>
        <button
          className="sb-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand" : "Collapse"}
        >
          <Icon name={sidebarCollapsed ? "expand" : "close"} />
        </button>
      </div>

      <nav className="nav" ref={navRef}>
        <span
          className="accent"
          style={{
            transform: `translateY(${accent.y}px)`,
            opacity: accent.show ? 1 : 0,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? " active" : ""}`}
              data-href={item.href}
              title={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="ico">
                <Icon name={item.icon} />
              </span>
              <span className="label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: sign out */}
      <div className="sb-footer">
        <button
          className="nav-item signout-btn"
          onClick={() =>
            startSignOut(async () => {
              await logout();
              router.push("/login");
              router.refresh();
            })
          }
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <span className="ico">
            <Icon name="logout" />
          </span>
          <span className="label">{signingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
