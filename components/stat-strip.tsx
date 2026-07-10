"use client";

import { useUIState } from "./ui-state";
import { formatRupee } from "@/lib/format";

export interface Stat {
  label: string;
  value: number;
  money?: boolean; // format as ₹ (respects toggle); else raw number
  accent?: "blue" | "red" | "green";
  suffix?: string;
}

/** A row of summary stat cards for the report boards (₹-toggle aware). */
export function StatStrip({ stats }: { stats: Stat[] }) {
  const { rupeeMode } = useUIState();
  return (
    <div className="readouts">
      {stats.map((s, i) => (
        <div
          key={i}
          className={`readout${s.accent === "red" ? " accent-red" : s.accent === "green" ? " accent-green" : ""}`}
        >
          <div className="k">{s.label}</div>
          <div className="v">
            {s.money && <span className="rs">₹</span>}
            {s.money ? formatRupee(s.value, rupeeMode) : s.value.toLocaleString("en-IN")}
            {s.suffix && <span className="unit">{s.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
