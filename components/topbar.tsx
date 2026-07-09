"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useUIState } from "./ui-state";
import { monthLabel } from "@/lib/format";

export interface CoverageDot {
  shortName: string;
  hasData: boolean;
}

export function TopBar({
  title,
  months,
  selectedMonth,
  coverage,
}: {
  title: string;
  months: string[];
  selectedMonth: string | null;
  coverage: CoverageDot[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { rupeeMode, toggleRupeeMode } = useUIState();

  function selectMonth(m: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("month", m);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <header className="topbar">
      <span className="page-title">{title}</span>
      <span className="spacer" />

      {/* Month selector — populated from months present in the DB */}
      <div className="control">
        <label className="ctl-label" htmlFor="month-select">
          Month
        </label>
        <select
          id="month-select"
          className="month-select"
          value={selectedMonth ?? ""}
          onChange={(e) => selectMonth(e.target.value)}
          disabled={months.length === 0}
        >
          {months.length === 0 && <option value="">No data</option>}
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* ₹ Full / ₹ Lakh toggle (global, remembered) */}
      <div className="control">
        <span className="rupee-toggle" role="group" aria-label="Rupee display mode">
          <button
            className={rupeeMode === "full" ? "on" : ""}
            onClick={() => rupeeMode !== "full" && toggleRupeeMode()}
            aria-pressed={rupeeMode === "full"}
          >
            ₹ Full
          </button>
          <button
            className={rupeeMode === "lakh" ? "on" : ""}
            onClick={() => rupeeMode !== "lakh" && toggleRupeeMode()}
            aria-pressed={rupeeMode === "lakh"}
          >
            ₹ Lakh
          </button>
        </span>
      </div>

      {/* Data-coverage dots — one per active company for the selected month */}
      {coverage.length > 0 && (
        <div className="coverage" title="TB data coverage this month">
          {coverage.map((c) => (
            <span className="cov-dot" key={c.shortName}>
              <span className={`d ${c.hasData ? "on" : "off"}`} />
              {c.shortName}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
