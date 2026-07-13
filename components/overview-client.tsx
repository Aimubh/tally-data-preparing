"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useUIState } from "./ui-state";
import { CountUp } from "./count-up";
import { TrendChart } from "./trend-chart";
import { formatBracketed, formatRupee, formatPct, monthLabel } from "@/lib/format";
import type { PLLine } from "@/lib/enums";
import type { TrendPoint } from "@/lib/mis";

export interface OverviewFilters {
  companies: { id: string; shortName: string }[];
  scope: string; // "all" or a company id
  months: string[]; // available months (ascending)
  selectedMonth: string;
}

// P&L "focus" groups for the line filter.
type PLFocus = "all" | "income" | "expenses" | "profit";

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
  gst: {
    output: number; // GST collected on sales (outgoing / payable)
    input: number; // GST paid on purchases (ingoing / credit)
    net: number; // output − input
    components: { component: string; output: number; input: number; net: number }[];
  };
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

const INCOME_LINES: PLLine[] = ["Revenue", "OtherIncome"];

// Filter the P&L rows by the chosen focus (client-side, instant).
function rowsForFocus(focus: PLFocus): RowSpec[] {
  if (focus === "all") return ROWS;
  if (focus === "profit") return ROWS.filter((r) => r.kind === "subtotal");
  if (focus === "income")
    return ROWS.filter((r) => r.kind === "line" && INCOME_LINES.includes(r.line));
  // expenses = every "less:" line (not income, not subtotals)
  return ROWS.filter((r) => r.kind === "line" && !INCOME_LINES.includes(r.line));
}

export function OverviewClient({
  data,
  filters,
}: {
  data: OverviewDTO;
  filters: OverviewFilters;
}) {
  const { rupeeMode } = useUIState();
  const unit = rupeeMode === "lakh" ? "₹ L" : "₹";
  const [showGst, setShowGst] = useState(false);
  const [focus, setFocus] = useState<PLFocus>("all"); // P&L line filter (client-side)

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const consol = data.columns.find((c) => c.isConsolidated);
  const revForPct = consol?.byLine.Revenue ?? 0;
  const gstRefund = data.gst.net < 0;

  // --- Filter helpers (company scope + quick-range drive the URL params) ----
  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value === null) sp.delete(key);
    else sp.set(key, value);
    router.push(`${pathname}?${sp.toString()}`);
  }
  function pickCompany(value: string) {
    setParam("company", value === "all" ? null : value);
  }
  // Quick-range presets set the month (and clear any explicit month for YTD start).
  function pickRange(preset: "this" | "l3" | "l6" | "ytd") {
    const ms = filters.months;
    if (ms.length === 0) return;
    const latest = ms[ms.length - 1];
    if (preset === "this") setParam("month", latest);
    else if (preset === "l3") setParam("month", ms[Math.max(0, ms.length - 3)]);
    else if (preset === "l6") setParam("month", ms[Math.max(0, ms.length - 6)]);
    else setParam("month", ms[0]); // YTD → earliest available month
  }

  return (
    <>
      {/* ================= FILTER BAR ================= */}
      <div className="filter-bar reveal">
        <div className="fb-group">
          <label className="fb-label">Company</label>
          <select
            className="month-select"
            value={filters.scope}
            onChange={(e) => pickCompany(e.target.value)}
          >
            <option value="all">All companies</option>
            {filters.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName}
              </option>
            ))}
          </select>
        </div>

        <div className="fb-group">
          <label className="fb-label">P&amp;L focus</label>
          <select
            className="month-select"
            value={focus}
            onChange={(e) => setFocus(e.target.value as PLFocus)}
          >
            <option value="all">Full P&amp;L</option>
            <option value="income">Income only</option>
            <option value="expenses">Expenses only</option>
            <option value="profit">Profit subtotals only</option>
          </select>
        </div>

        <div className="fb-group">
          <label className="fb-label">Quick range</label>
          <div className="fb-presets">
            <button onClick={() => pickRange("this")}>This month</button>
            <button onClick={() => pickRange("l3")}>Last 3</button>
            <button onClick={() => pickRange("l6")}>Last 6</button>
            <button onClick={() => pickRange("ytd")}>YTD</button>
          </div>
        </div>

        {(filters.scope !== "all" || focus !== "all") && (
          <button
            className="fb-clear"
            onClick={() => {
              setFocus("all");
              setParam("company", null);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

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

      {/* --- GST check panel: click to reveal group GST in/out + net --- */}
      <div className="gst-check">
        <button
          className={`gst-check-toggle${showGst ? " on" : ""}`}
          onClick={() => setShowGst((v) => !v)}
          aria-expanded={showGst}
        >
          <span className="gc-check" aria-hidden="true">{showGst ? "✓" : ""}</span>
          Check GST (in / out) for {monthLabel(data.period)}
          <span className="gc-caret" aria-hidden="true">{showGst ? "▲" : "▼"}</span>
        </button>

        {showGst && (
          <div className="gst-check-body">
            <div className="gst-flow">
              <div className="gst-flow-card out">
                <div className="gf-dir">▲ Outgoing</div>
                <div className="gf-label">Output GST — collected on sales</div>
                <div className="gf-value">₹{formatRupee(data.gst.output, rupeeMode)}</div>
              </div>
              <div className="gst-flow-card in">
                <div className="gf-dir">▼ Ingoing</div>
                <div className="gf-label">Input GST — paid on purchases (credit)</div>
                <div className="gf-value">₹{formatRupee(data.gst.input, rupeeMode)}</div>
              </div>
              <div className={`gst-flow-card net ${gstRefund ? "refund" : "payable"}`}>
                <div className="gf-dir">{gstRefund ? "Refund due" : "Net payable"}</div>
                <div className="gf-label">Net GST = Output − Input</div>
                <div className="gf-value">₹{formatRupee(Math.abs(data.gst.net), rupeeMode)}</div>
                <div className="gf-sub">
                  {formatRupee(data.gst.output, rupeeMode)} − {formatRupee(data.gst.input, rupeeMode)}
                </div>
              </div>
            </div>
            <div className="pl-wrap" style={{ marginTop: 12 }}>
              <table className="pl">
                <thead>
                  <tr>
                    <th className="rowhead">Component</th>
                    <th className="num">Output</th>
                    <th className="num">Input</th>
                    <th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gst.components.map((c) => (
                    <tr key={c.component} className="line">
                      <td className="rowhead">{c.component}</td>
                      <td className="num">{c.output ? formatRupee(c.output, rupeeMode) : "—"}</td>
                      <td className="num">{c.input ? formatRupee(c.input, rupeeMode) : "—"}</td>
                      <td className={`num${c.net < 0 ? " neg" : ""}`} style={{ fontWeight: 600 }}>
                        {c.net ? formatRupee(Math.abs(c.net), rupeeMode) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="subtotal major">
                    <td className="rowhead">Total GST</td>
                    <td className="num">{formatRupee(data.gst.output, rupeeMode)}</td>
                    <td className="num">{formatRupee(data.gst.input, rupeeMode)}</td>
                    <td className={`num${gstRefund ? " neg" : ""}`}>
                      {formatRupee(Math.abs(data.gst.net), rupeeMode)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
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
            {rowsForFocus(focus).map((row, i) => {
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
