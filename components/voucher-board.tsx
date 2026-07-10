"use client";

import { useUIState } from "./ui-state";
import { formatRupee } from "@/lib/format";
import type { VoucherRow } from "@/lib/reports";

/** Sales / Purchases board table (Date · Company · Vch Type · Vch No · Party ·
 *  Amount), with an inter-company chip. Amounts respect the ₹ toggle. */
export function VoucherBoard({
  rows,
  showCompany,
}: {
  rows: VoucherRow[];
  showCompany: boolean;
}) {
  const { rupeeMode } = useUIState();
  if (rows.length === 0) {
    return (
      <div className="empty">
        No vouchers for this scope and month. Choose another month or company.
      </div>
    );
  }
  return (
    <div className="pl-wrap reveal">
      <table className="pl register">
        <thead>
          <tr>
            <th className="rowhead">Date</th>
            {showCompany && <th className="rowhead">Company</th>}
            <th className="rowhead">Vch Type</th>
            <th className="rowhead">Vch No.</th>
            <th className="rowhead">Party</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="line" style={{ ["--i" as string]: i }}>
              <td className="rowhead">{fmtDate(r.date)}</td>
              {showCompany && <td className="rowhead vch">{r.companyShort}</td>}
              <td className="rowhead vch">{r.voucherType}</td>
              <td className="rowhead vch">{r.voucherNo}</td>
              <td className="rowhead">
                {r.partyName}
                {r.isInterCompany && <span className="ic-chip" style={{ marginLeft: 8 }}>IC</span>}
              </td>
              <td className="num">{formatRupee(r.amount, rupeeMode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
