"use client";

import { useUIState } from "./ui-state";
import { formatRupee } from "@/lib/format";
import type { GstReport } from "@/lib/reports";

/**
 * GST board: Output GST (collected on sales — outgoing/payable) vs Input GST
 * (paid on purchases — ingoing/creditable), broken down by IGST/CGST/SGST, with
 * the Net GST payable (Output − Input). ₹-toggle aware.
 */
export function GstBoard({ report }: { report: GstReport }) {
  const { rupeeMode } = useUIState();
  const f = (n: number) => formatRupee(n, rupeeMode);

  if (report.outputTotal === 0 && report.inputTotal === 0) {
    return <div className="empty">No GST data for this scope and month.</div>;
  }

  const refund = report.netPayable < 0;

  return (
    <>
      {/* Direction summary: Output (out) vs Input (in) vs Net */}
      <div className="gst-flow reveal">
        <div className="gst-flow-card out">
          <div className="gf-dir">▲ Outgoing</div>
          <div className="gf-label">Output GST — collected on sales</div>
          <div className="gf-value">₹{f(report.outputTotal)}</div>
          <div className="gf-sub">on ₹{f(report.outputTaxableTotal)} taxable</div>
        </div>
        <div className="gst-flow-card in">
          <div className="gf-dir">▼ Ingoing</div>
          <div className="gf-label">Input GST — paid on purchases (credit)</div>
          <div className="gf-value">₹{f(report.inputTotal)}</div>
          <div className="gf-sub">on ₹{f(report.inputTaxableTotal)} taxable</div>
        </div>
        <div className={`gst-flow-card net ${refund ? "refund" : "payable"}`}>
          <div className="gf-dir">{refund ? "Refund due" : "Net payable"}</div>
          <div className="gf-label">
            Net GST = Output − Input {refund ? "(credit balance)" : "(owed to govt)"}
          </div>
          <div className="gf-value">₹{f(Math.abs(report.netPayable))}</div>
          <div className="gf-sub">
            {f(report.outputTotal)} − {f(report.inputTotal)}
          </div>
        </div>
      </div>

      {/* Component breakdown table */}
      <div className="pl-wrap reveal">
        <table className="pl">
          <thead>
            <tr>
              <th className="rowhead">Component</th>
              <th className="num">Output (sales)</th>
              <th className="num">Input (purchases)</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {report.components.map((c, i) => (
              <tr key={c.component} className="line" style={{ ["--i" as string]: i }}>
                <td className="rowhead">{c.component}</td>
                <td className="num">{c.outputGst ? f(c.outputGst) : "—"}</td>
                <td className="num">{c.inputGst ? f(c.inputGst) : "—"}</td>
                <td className={`num${c.netGst < 0 ? " neg" : ""}`} style={{ fontWeight: 600 }}>
                  {c.netGst ? f(Math.abs(c.netGst)) : "—"}
                </td>
              </tr>
            ))}
            <tr className="subtotal major">
              <td className="rowhead">Total GST</td>
              <td className="num">{f(report.outputTotal)}</td>
              <td className="num">{f(report.inputTotal)}</td>
              <td className={`num${refund ? " neg" : ""}`}>{f(Math.abs(report.netPayable))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
