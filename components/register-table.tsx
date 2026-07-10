"use client";

import { useUIState } from "./ui-state";
import { formatBracketed } from "@/lib/format";

/**
 * Renders a Tally register (Sales / Purchase / Journal) exactly in the shape the
 * real exports use: Date · Particulars · Vch Type · Vch No · Debit · Credit, with
 * a Total row. Serializable row shape so a server page can pass DB rows straight
 * in. Amounts respect the global ₹ Full / ₹ Lakh toggle.
 */
export interface RegisterRowDTO {
  date: string | null; // ISO or display string
  particulars: string;
  vchType: string;
  vchNo: string;
  debit: number;
  credit: number;
}

function dateLabel(d: string | null): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RegisterTable({
  rows,
  totalDebit,
  totalCredit,
}: {
  rows: RegisterRowDTO[];
  totalDebit: number;
  totalCredit: number;
}) {
  const { rupeeMode } = useUIState();

  if (rows.length === 0) {
    return (
      <div className="empty">
        No entries for this company and month yet. Upload the Sales Register
        export to populate this view.
      </div>
    );
  }

  return (
    <div className="pl-wrap reveal">
      <table className="pl register">
        <thead>
          <tr>
            <th className="rowhead">Date</th>
            <th className="rowhead">Particulars</th>
            <th className="rowhead">Vch Type</th>
            <th className="rowhead">Vch No.</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const dr = formatBracketed(r.debit, rupeeMode);
            const cr = formatBracketed(r.credit, rupeeMode);
            return (
              <tr key={i} className="line" style={{ ["--i" as string]: i }}>
                <td className="rowhead">{dateLabel(r.date)}</td>
                <td className="rowhead">{r.particulars}</td>
                <td className="rowhead vch">{r.vchType}</td>
                <td className="rowhead vch">{r.vchNo}</td>
                <td className={`num${dr.isNegative ? " neg" : ""}`}>{dr.text}</td>
                <td className={`num${cr.isNegative ? " neg" : ""}`}>{cr.text}</td>
              </tr>
            );
          })}
          <tr className="subtotal major">
            <td className="rowhead" colSpan={4}>
              Total
            </td>
            <td className="num">{formatBracketed(totalDebit, rupeeMode).text}</td>
            <td className="num">{formatBracketed(totalCredit, rupeeMode).text}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
