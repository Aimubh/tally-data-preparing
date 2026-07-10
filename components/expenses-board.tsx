"use client";

import { useUIState } from "./ui-state";
import { formatRupee } from "@/lib/format";
import type { ExpenseRow } from "@/lib/reports";

/** Other Expenses board: ledger · category · this month · last month · MoM %.
 *  A month-on-month jump beyond ±15% is flagged (up = red, down = green). */
export function ExpensesBoard({ rows }: { rows: ExpenseRow[] }) {
  const { rupeeMode } = useUIState();
  if (rows.length === 0) {
    return <div className="empty">No expenses for this scope and month.</div>;
  }
  const f = (n: number | null) => (n == null ? "—" : formatRupee(n, rupeeMode));
  return (
    <div className="pl-wrap reveal">
      <table className="pl">
        <thead>
          <tr>
            <th className="rowhead">Expense ledger</th>
            <th className="rowhead">Category</th>
            <th className="num">This month</th>
            <th className="num">Last month</th>
            <th className="num">MoM change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const flagged = r.momPct != null && Math.abs(r.momPct) >= 15;
            const up = (r.momPct ?? 0) > 0;
            return (
              <tr key={r.ledgerName} className="line" style={{ ["--i" as string]: i }}>
                <td className="rowhead">{r.ledgerName}</td>
                <td className="rowhead vch">{r.category}</td>
                <td className="num" style={{ fontWeight: 600 }}>{f(r.amount)}</td>
                <td className="num">{f(r.prevAmount)}</td>
                <td className="num">
                  {r.momPct == null ? (
                    "—"
                  ) : (
                    <span className={`mom-chip ${flagged ? (up ? "up" : "down") : "flat"}`}>
                      {up ? "▲" : "▼"} {Math.abs(r.momPct).toFixed(0)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
