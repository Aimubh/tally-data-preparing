"use client";

import { useUIState } from "./ui-state";
import { CountUp } from "./count-up";
import { TrendChart } from "./trend-chart";
import { formatBracketed, formatRupee, formatPct, monthLabel } from "@/lib/format";
import type { PLLine } from "@/lib/enums";
import type { TrendPoint } from "@/lib/mis";

// Serializable P&L payload (Decimals already converted to numbers server-side).
export interface PLColumnDTO {
  key: string;
  label: string;
  isElimination?: boolean;
  isConsolidated?: boolean;
  byLine: Record<PLLine, number>;
  grossProfit: number;
  ebitda: number;
  pbt: number;
  netProfit: number;
}

export interface OverviewDTO {
  period: string;
  columns: PLColumnDTO[];
  icTurnoverEliminated: number;
  icPurchasesEliminated: number;
  icSalesTotal: number;
  icPurchasesTotal: number;
  icGap: number;
  hasMismatch: boolean;
  kpis: {
    consolidatedRevenue: number;
    grossMarginPct: number;
    ebitdaMarginPct: number;
    netProfit: number;
  };
  trend: TrendPoint[];
}

// P&L row spec: either a line (value pulled from byLine) or a computed subtotal.
type RowSpec =
  | { kind: "line"; line: PLLine; label: string; op: "less" | "plus" | "first" }
  | { kind: "subtotal"; label: string; field: "grossProfit" | "ebitda" | "pbt" | "netProfit"; major?: boolean };

const ROWS: RowSpec[] = [
  { kind: "line", line: "Revenue", label: "Revenue", op: "first" },
  { kind: "line", line: "PurchasesCOGS", label: "less: Purchases / COGS", op: "less" },
  { kind: "line", line: "DirectExpenses", label: "less: Direct Expenses", op: "less" },
  { kind: "subtotal", label: "Gross Profit", field: "grossProfit", major: true },
  { kind: "line", line: "Employee", label: "less: Employee", op: "less" },
  { kind: "line", line: "SellingDistribution", label: "less: Selling & Distribution", op: "less" },
  { kind: "line", line: "AdminOther", label: "less: Admin & Other", op: "less" },
  { kind: "subtotal", label: "EBITDA", field: "ebitda", major: true },
  { kind: "line", line: "OtherIncome", label: "add: Other Income", op: "plus" },
  { kind: "line", line: "Finance", label: "less: Finance", op: "less" },
  { kind: "line", line: "Depreciation", label: "less: Depreciation", op: "less" },
  { kind: "subtotal", label: "PBT", field: "pbt" },
  { kind: "line", line: "Tax", label: "less: Tax", op: "less" },
  { kind: "subtotal", label: "Net Profit", field: "netProfit", major: true },
];

export function OverviewClient({ data }: { data: OverviewDTO }) {
  const { rupeeMode } = useUIState();
  const unit = rupeeMode === "lakh" ? "₹ L" : "₹";

  const consol = data.columns.find((c) => c.isConsolidated);
  const revForPct = consol?.byLine.Revenue ?? 0;

  return (
    <>
      {/* --- Warning banner (slides down, stays) --- */}
      {data.hasMismatch && (
        <div className="warn-banner" role="alert">
          <span className="wico">!</span>
          <div>
            <div className="wt">
              Inter-company mismatch — sales and purchases don&rsquo;t agree
            </div>
            <div className="wb">
              For {monthLabel(data.period)}, group inter-company sales
              ({formatRupee(data.icSalesTotal, rupeeMode)}) and purchases
              ({formatRupee(data.icPurchasesTotal, rupeeMode)}) differ by{" "}
              <strong>{formatRupee(Math.abs(data.icGap), rupeeMode)}</strong>.
              The elimination will not net to zero until the counterparties
              agree (likely an invoice recorded by one side but not the other).
            </div>
          </div>
        </div>
      )}

      {/* --- KPI cards with count-up --- */}
      <div className="kpi-row">
        <div className="kpi" style={{ ["--i" as string]: 0 }}>
          <div className="k">Consolidated Revenue</div>
          <div className="v">
            <CountUp
              value={data.kpis.consolidatedRevenue}
              render={(n) => formatRupee(n, rupeeMode)}
            />
            <span className="unit">{unit}</span>
          </div>
        </div>
        <div className="kpi" style={{ ["--i" as string]: 1 }}>
          <div className="k">Gross Margin %</div>
          <div className="v">
            <CountUp value={data.kpis.grossMarginPct} render={(n) => `${n.toFixed(1)}%`} />
          </div>
        </div>
        <div className="kpi" style={{ ["--i" as string]: 2 }}>
          <div className="k">EBITDA Margin %</div>
          <div className="v">
            <CountUp value={data.kpis.ebitdaMarginPct} render={(n) => `${n.toFixed(1)}%`} />
          </div>
        </div>
        <div
          className={`kpi${data.kpis.netProfit < 0 ? " neg" : ""}`}
          style={{ ["--i" as string]: 3 }}
        >
          <div className="k">Net Profit</div>
          <div className="v">
            <CountUp value={data.kpis.netProfit} render={(n) => formatRupee(n, rupeeMode)} />
            <span className="unit">{unit}</span>
          </div>
        </div>
      </div>

      {/* --- Elimination strip --- */}
      <div className="elim-strip reveal" style={{ ["--i" as string]: 4 }}>
        <div className="item">
          <div className="k">Inter-company turnover eliminated</div>
          <div className="v">{formatRupee(data.icTurnoverEliminated, rupeeMode)}</div>
        </div>
        <div className="item">
          <div className="k">Inter-company purchases eliminated</div>
          <div className="v">{formatRupee(data.icPurchasesEliminated, rupeeMode)}</div>
        </div>
        <div className="item">
          <div className="k">Net elimination gap</div>
          <div
            className="v"
            style={{ color: data.hasMismatch ? "var(--warning)" : "inherit" }}
          >
            {formatRupee(data.icGap, rupeeMode)}
          </div>
        </div>
      </div>

      {/* --- Consolidated P&L table --- */}
      <div className="pl-wrap reveal" style={{ ["--i" as string]: 5 }}>
        <table className="pl">
          <thead>
            <tr>
              <th className="rowhead">Consolidated P&amp;L — {monthLabel(data.period)}</th>
              {data.columns.map((c) => (
                <th
                  key={c.key}
                  className={
                    c.isConsolidated ? "col-consol" : c.isElimination ? "col-elim" : ""
                  }
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              if (row.kind === "subtotal") {
                return (
                  <tr
                    key={i}
                    className={`subtotal${row.major ? " major" : ""}`}
                    style={{ ["--i" as string]: i }}
                  >
                    <td className="rowhead">
                      {row.label}
                      {["grossProfit", "ebitda", "netProfit"].includes(row.field) && (
                        <PctInline
                          value={pickSubtotal(consol, row.field)}
                          base={revForPct}
                        />
                      )}
                    </td>
                    {data.columns.map((c) => {
                      const val = pickSubtotal(c, row.field);
                      const a = formatBracketed(val, rupeeMode);
                      return (
                        <td
                          key={c.key}
                          className={`num${a.isNegative ? " neg" : ""}${
                            c.isConsolidated ? " col-consol" : ""
                          }`}
                        >
                          {a.text}
                        </td>
                      );
                    })}
                  </tr>
                );
              }
              // line row
              return (
                <tr key={i} className="line" style={{ ["--i" as string]: i }}>
                  <td className="rowhead">{row.label}</td>
                  {data.columns.map((c) => {
                    const raw = c.byLine[row.line];
                    // Display expense lines as their magnitude (already positive
                    // in byLine); eliminations may be negative → brackets.
                    const a = formatBracketed(raw, rupeeMode);
                    return (
                      <td
                        key={c.key}
                        className={`num${a.isNegative ? " neg" : ""}${
                          c.isConsolidated ? " col-consol" : ""
                        }`}
                      >
                        {a.text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- Trend chart --- */}
      <div className="panel reveal" style={{ marginTop: 18, ["--i" as string]: 6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Consolidated trend — last {data.trend.length} months
        </div>
        <TrendChart points={data.trend} />
      </div>
    </>
  );
}

function pickSubtotal(
  col: PLColumnDTO | undefined,
  field: "grossProfit" | "ebitda" | "pbt" | "netProfit"
): number {
  return col ? col[field] : 0;
}

function PctInline({ value, base }: { value: number; base: number }) {
  return <span className="pct"> · {formatPct(value, base)}</span>;
}
