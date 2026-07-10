"use client";

import { useUIState } from "./ui-state";
import { formatRupee } from "@/lib/format";
import type { PartyRow } from "@/lib/reports";

/** Debtors / Creditors board: party closing balance split into ageing buckets.
 *  90+ is tinted as an overdue warning. */
export function PartyBoard({ rows, showCompany }: { rows: PartyRow[]; showCompany: boolean }) {
  const { rupeeMode } = useUIState();
  if (rows.length === 0) {
    return <div className="empty">No outstanding parties for this scope and month.</div>;
  }
  const f = (n: number) => (n ? formatRupee(n, rupeeMode) : "—");
  return (
    <div className="pl-wrap reveal">
      <table className="pl">
        <thead>
          <tr>
            {showCompany && <th className="rowhead">Company</th>}
            <th className="rowhead">Party</th>
            <th className="num">Closing</th>
            <th className="num">0–30</th>
            <th className="num">31–60</th>
            <th className="num">61–90</th>
            <th className="num">90+</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="line" style={{ ["--i" as string]: i }}>
              {showCompany && <td className="rowhead vch">{r.companyShort}</td>}
              <td className="rowhead">{r.partyName}</td>
              <td className="num" style={{ fontWeight: 600 }}>{f(r.closing)}</td>
              <td className="num">{f(r.a0)}</td>
              <td className="num">{f(r.a1)}</td>
              <td className="num">{f(r.a2)}</td>
              <td className={`num${r.a3 > 0 ? " neg" : ""}`}>{f(r.a3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
