"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "./nav-config";
import { Icon } from "./icons";
import { useUIState } from "./ui-state";

export function Sidebar({ groupName }: { groupName: string }) {
  const pathname = usePathname();
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

  return (
    <aside className="sidebar">
      <div className="group-head">
        <span className="group-logo">GM</span>
        <span className="group-name">{groupName}</span>
      </div>

      <nav className="nav" ref={navRef}>
        <span
          className="accent"
          style={{
            transform: `translateY(${accent.y + 0}px)`,
            opacity: accent.show ? 1 : 0,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          const cls = `nav-item${isActive ? " active" : ""}${
            item.real ? "" : ""
          }`;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cls}
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

      <button
        className="collapse-btn"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Expand" : "Collapse"}
      >
        <Icon
          name="collapse"
          style={{
            transform: sidebarCollapsed ? "rotate(180deg)" : "none",
            transition: "transform 200ms cubic-bezier(0.22,0.61,0.36,1)",
          }}
        />
        <span className="label">Collapse</span>
      </button>
    </aside>
  );
}
