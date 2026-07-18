"use client";

import { useState } from "react";
import { useUIState } from "./ui-state";
import { formatRupee, monthLabelShort } from "@/lib/format";
import type { TrendPoint } from "@/lib/mis";

/**
 * Consolidated trend with a REAL-TIME chart-type switcher (segmented pill).
 * Switching is instant — pure client state, no server round-trip — and each
 * switch re-triggers the SVG draw-in animation. Pure SVG, no chart lib.
 *
 * Types: combo (revenue bars + margin lines), bar (revenue), area (revenue
 * line + fill), margins (gross% + net% only).
 */
type ChartType = "combo" | "bar" | "area" | "margins";
type RangeMode = "3" | "6" | "all" | "month";

const TYPES: { value: ChartType; label: string }[] = [
  { value: "combo", label: "Combo" },
  { value: "bar", label: "Profit / Loss" },
  { value: "area", label: "Line" },
  { value: "margins", label: "Margins" },
];

const RANGES: { value: RangeMode; label: string }[] = [
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "all", label: "All months" },
  { value: "month", label: "Pick a month…" },
];

function monthLabelLong(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// PlayStation palette. Combo overlays four metrics, so each gets a distinct hue:
// Revenue = PS blue, Gross% = amber, Net% = violet, Net P/L = green/red.
const GROSS = "#e08a00"; // Gross Margin % — amber (distinct from the blue Revenue area)
const NET = "#7b3fe4"; // Net Margin % — violet (distinct from the green Net P/L line)
const AREA_STROKE = "#0070d1";
// Net Profit/Loss line colors: green when in profit, red when in loss.
const PROFIT_LOSS = { profit: "#0a7d3f", loss: "#c81b3a" };

export function TrendChart({ points: allPoints }: { points: TrendPoint[] }) {
  const { rupeeMode } = useUIState();
  const [type, setType] = useState<ChartType>("combo");
  const [range, setRange] = useState<RangeMode>("6");
  // Default the month picker to the latest month.
  const [endMonth, setEndMonth] = useState<string>(
    allPoints.length ? allPoints[allPoints.length - 1].period : ""
  );
  // Hovered month index (for the cursor-following Net Profit/Loss tooltip).
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 260;
  const padL = 64;
  const padR = 48;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (allPoints.length === 0) {
    return <div className="empty">No trend data.</div>;
  }

  // --- Apply the time-range filter (all client-side, instant) --------------
  // allPoints is sorted ascending by month. "Last N" takes the final N; "month"
  // takes everything up to and including the picked month.
  let points: TrendPoint[];
  if (range === "3") {
    points = allPoints.slice(-3);
  } else if (range === "6") {
    points = allPoints.slice(-6);
  } else if (range === "month") {
    const idx = allPoints.findIndex((p) => p.period === endMonth);
    points = idx >= 0 ? allPoints.slice(0, idx + 1) : allPoints;
  } else {
    points = allPoints;
  }
  if (points.length === 0) points = allPoints;

  // A key that changes with the filter so the SVG remounts + replays the draw-in.
  const animKey = `${type}-${range}-${range === "month" ? endMonth : ""}`;

  const n = points.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.5, 46);
  const xCenter = (i: number) => padL + slot * i + slot / 2;

  // "bar" is now a standalone Net Profit / Loss view (green profit, red loss).
  const showRevenue = type === "combo" || type === "area";
  const showMargins = type === "combo" || type === "margins";
  const isPnl = type === "bar";

  // Revenue axis (left).
  const maxRev = Math.max(...points.map((p) => p.revenue), 1);
  const yRev = (v: number) => padT + plotH - (v / maxRev) * plotH;

  // Percent axis (right / primary in margins mode).
  const pctVals = points.flatMap((p) => [p.grossPct, p.netPct]);
  const maxPct = Math.max(...pctVals, 10);
  const minPct = Math.min(...pctVals, 0);
  const pctSpan = maxPct - minPct || 1;
  const yPct = (v: number) => padT + plotH - ((v - minPct) / pctSpan) * plotH;

  // Net Profit/Loss scale (₹ amounts, can go negative). Its own scale + a zero
  // baseline so losses draw BELOW the line in red, profits ABOVE in green.
  const nets = points.map((p) => p.netProfit);
  const netMax = Math.max(...nets, 0);
  const netMin = Math.min(...nets, 0);
  const netSpan = netMax - netMin || 1;
  // Keep the P&L line in the upper ~70% of the plot so it doesn't collide with bars.
  const pnlTop = padT + 6;
  const pnlH = plotH * 0.62;
  const yNet = (v: number) => pnlTop + pnlH - ((v - netMin) / netSpan) * pnlH;
  const yZero = yNet(0);
  const hasLoss = netMin < 0;

  // Full-height signed scale for the standalone Profit/Loss bar view: bars grow
  // UP from a shared zero baseline in green (profit) and DOWN in red (loss).
  const barPnlMax = Math.max(...nets, 0);
  const barPnlMin = Math.min(...nets, 0);
  const barPnlSpan = barPnlMax - barPnlMin || 1;
  const yBarPnl = (v: number) =>
    padT + plotH - ((v - barPnlMin) / barPnlSpan) * plotH;
  const yBarZero = yBarPnl(0);
  const PROFIT_GREEN = PROFIT_LOSS.profit;
  const LOSS_RED = PROFIT_LOSS.loss;

  const linePath = (yFn: (v: number) => number, key: "grossPct" | "netPct" | "revenue") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yFn(p[key])}`).join(" ");

  const areaPath =
    `M${xCenter(0)},${padT + plotH} ` +
    points.map((p, i) => `L${xCenter(i)},${yRev(p.revenue)}`).join(" ") +
    ` L${xCenter(n - 1)},${padT + plotH} Z`;

  // --- Smooth (Catmull-Rom → cubic Bézier) paths for the Combo area view -----
  // Gives the flowing "natural" curve of the shadcn interactive area chart while
  // staying pure SVG. Returns just the stroke path for the given metric.
  const smoothStroke = (yFn: (v: number) => number, key: "revenue") => {
    const pts = points.map((p, i) => [xCenter(i), yFn(p[key])] as const);
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  // Closed fill = smooth stroke + down to baseline + back to start.
  const smoothArea = (yFn: (v: number) => number, key: "revenue") =>
    `${smoothStroke(yFn, key)} L${xCenter(n - 1)},${padT + plotH} L${xCenter(0)},${
      padT + plotH
    } Z`;

  const approxLen = Math.round(plotW * 1.3);

  // Left-axis labels reflect the primary metric of the current type: revenue for
  // revenue-bearing types, percent for the margins-only view.
  const leftAxisValue = (f: number) =>
    isPnl
      ? formatRupee(barPnlMin + barPnlSpan * f, rupeeMode)
      : showRevenue
      ? formatRupee(maxRev * f, rupeeMode)
      : `${(minPct + pctSpan * f).toFixed(0)}%`;

  return (
    <div>
      {/* --- Toolbar: range filter + real-time chart-type switcher --- */}
      <div className="chart-toolbar">
        <div className="chart-range">
          <select
            className="chart-range-select"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeMode)}
            aria-label="Time range"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {/* On-demand month picker — appears only when 'Pick a month…' is chosen */}
          {range === "month" && (
            <select
              className="chart-range-select"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              aria-label="Up to month"
            >
              {allPoints.map((p) => (
                <option key={p.period} value={p.period}>
                  {monthLabelLong(p.period)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="chart-switch" role="group" aria-label="Chart type">
          {TYPES.map((t) => (
            <button
              key={t.value}
              className={type === t.value ? "on" : ""}
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* animKey remounts the SVG so the draw-in animation replays on any change */}
      <div className="chart-plot">
      <svg
        key={animKey}
        className="trend-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Consolidated trend, ${type} view`}
      >
        <defs>
          {/* Gradient fill for the Combo revenue area (shadcn-style fade). */}
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={AREA_STROKE} stopOpacity={0.35} />
            <stop offset="95%" stopColor={AREA_STROKE} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        {/* gridlines + left axis */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padT + plotH - f * plotH;
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e6ecf4" strokeWidth={1} />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#8a97ab">
                {leftAxisValue(f)}
              </text>
            </g>
          );
        })}

        {/* Combo: smooth Revenue area with gradient fill (shadcn-style) */}
        {type === "combo" && (
          <>
            <path d={smoothArea(yRev, "revenue")} fill="url(#fillRevenue)" className="draw-area" />
            <path
              className="draw-line"
              d={smoothStroke(yRev, "revenue")}
              fill="none"
              stroke={AREA_STROKE}
              strokeWidth={2.5}
              style={{ ["--len" as string]: `${approxLen}` }}
            />
            {points.map((p, i) => (
              <circle key={`rev-${p.period}`} cx={xCenter(i)} cy={yRev(p.revenue)} r={3} fill={AREA_STROKE} />
            ))}
          </>
        )}

        {/* Net Profit / Loss bars (bar view): green up from zero, red down */}
        {isPnl && (
          <>
            {/* emphasised zero baseline */}
            <line
              x1={padL}
              y1={yBarZero}
              x2={W - padR}
              y2={yBarZero}
              stroke="#b7c2d4"
              strokeWidth={1.5}
            />
            {points.map((p, i) => {
              const loss = p.netProfit < 0;
              const top = loss ? yBarZero : yBarPnl(p.netProfit);
              const h = Math.max(Math.abs(yBarPnl(p.netProfit) - yBarZero), 1);
              return (
                <rect
                  key={p.period}
                  className="draw-bar"
                  x={xCenter(i) - barW / 2}
                  y={top}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={loss ? LOSS_RED : PROFIT_GREEN}
                  style={{
                    animationDelay: `${i * 40}ms`,
                    transformOrigin: loss ? "top" : "bottom",
                  }}
                />
              );
            })}
          </>
        )}

        {/* Revenue area (area/line type) */}
        {type === "area" && (
          <>
            <path d={areaPath} fill="rgba(0,112,209,0.12)" className="draw-area" />
            <path
              className="draw-line"
              d={linePath(yRev, "revenue")}
              fill="none"
              stroke={AREA_STROKE}
              strokeWidth={2.5}
              style={{ ["--len" as string]: `${approxLen}` }}
            />
            {points.map((p, i) => (
              <circle key={p.period} cx={xCenter(i)} cy={yRev(p.revenue)} r={3.5} fill={AREA_STROKE} />
            ))}
          </>
        )}

        {/* Margin lines (combo, margins) */}
        {showMargins && (
          <>
            <path
              className="draw-line"
              d={linePath(yPct, "grossPct")}
              fill="none"
              stroke={GROSS}
              strokeWidth={2}
              style={{ ["--len" as string]: `${approxLen}` }}
            />
            <path
              className="draw-line"
              d={linePath(yPct, "netPct")}
              fill="none"
              stroke={NET}
              strokeWidth={2}
              style={{ ["--len" as string]: `${approxLen}` }}
            />
            {points.map((p, i) => (
              <g key={`pt-${p.period}`}>
                <circle cx={xCenter(i)} cy={yPct(p.grossPct)} r={3} fill={GROSS} />
                <circle cx={xCenter(i)} cy={yPct(p.netPct)} r={3} fill={NET} />
              </g>
            ))}
          </>
        )}

        {/* Net Profit / Loss line (combo) — green above zero, red below. */}
        {type === "combo" && (
          <>
            {/* zero baseline (only meaningful when a loss exists) */}
            {hasLoss && (
              <line
                x1={padL}
                y1={yZero}
                x2={W - padR}
                y2={yZero}
                stroke="#b9a94a"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            {/* colored segments */}
            {points.slice(1).map((p, k) => {
              const i = k + 1;
              const prev = points[i - 1];
              const isLossSeg = p.netProfit < 0 || prev.netProfit < 0;
              return (
                <line
                  key={`pnl-${p.period}`}
                  className="draw-pnl"
                  x1={xCenter(i - 1)}
                  y1={yNet(prev.netProfit)}
                  x2={xCenter(i)}
                  y2={yNet(p.netProfit)}
                  stroke={isLossSeg ? PROFIT_LOSS.loss : PROFIT_LOSS.profit}
                  strokeWidth={2.5}
                />
              );
            })}
            {/* dots colored per point */}
            {points.map((p, i) => (
              <circle
                key={`pnl-dot-${p.period}`}
                cx={xCenter(i)}
                cy={yNet(p.netProfit)}
                r={3.5}
                fill={p.netProfit < 0 ? PROFIT_LOSS.loss : PROFIT_LOSS.profit}
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}
          </>
        )}

        {/* x labels */}
        {points.map((p, i) => (
          <text
            key={`x-${p.period}`}
            x={xCenter(i)}
            y={H - 12}
            textAnchor="middle"
            fontSize={10.5}
            fill="#5b6b82"
          >
            {monthLabelShort(p.period)}
          </text>
        ))}

        {/* --- Hover layer: guide line + marker at the hovered month --- */}
        {hover != null && points[hover] && (
          <g pointerEvents="none">
            <line
              x1={xCenter(hover)}
              y1={padT}
              x2={xCenter(hover)}
              y2={padT + plotH}
              stroke="#9db4d6"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={xCenter(hover)}
              cy={
                isPnl
                  ? yBarPnl(points[hover].netProfit)
                  : points[hover].netProfit < 0
                  ? padT + plotH - 4
                  : yRev(points[hover].revenue)
              }
              r={5}
              fill={points[hover].netProfit < 0 ? "#c81b3a" : "#0070d1"}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Invisible per-month hit columns drive the hover tooltip. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.period}`}
            x={padL + slot * i}
            y={padT}
            width={slot}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            style={{ cursor: "pointer" }}
          />
        ))}
      </svg>

      {/* --- Cursor-following tooltip: this month's Net Profit / Loss --- */}
      {hover != null && points[hover] && (
        <div
          className="chart-tooltip"
          style={{ left: `${(xCenter(hover) / W) * 100}%` }}
        >
          <div className="ct-month">{monthLabelLong(points[hover].period)}</div>
          <div
            className={`ct-net ${points[hover].netProfit < 0 ? "loss" : "profit"}`}
          >
            {points[hover].netProfit < 0 ? "Net Loss " : "Net Profit "}
            ₹{formatRupee(Math.abs(points[hover].netProfit), rupeeMode)}
          </div>
          <div className="ct-row">
            Revenue ₹{formatRupee(points[hover].revenue, rupeeMode)}
          </div>
          <div className="ct-row">
            Net margin {points[hover].netPct.toFixed(1)}%
          </div>
        </div>
      )}
      </div>

      {/* Adaptive legend */}
      <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
        {type === "combo" && (
          <Legend color={AREA_STROKE} label="Consolidated Revenue" swatch="line" />
        )}
        {isPnl && (
          <>
            <Legend color={PROFIT_LOSS.profit} label="Net Profit (surplus)" swatch="bar" />
            <Legend color={PROFIT_LOSS.loss} label="Net Loss (deficit)" swatch="bar" />
          </>
        )}
        {type === "area" && (
          <Legend color={AREA_STROKE} label="Consolidated Revenue" swatch="line" />
        )}
        {showMargins && (
          <>
            <Legend color={GROSS} label="Gross Margin %" swatch="line" />
            <Legend color={NET} label="Net Margin %" swatch="line" />
          </>
        )}
        {type === "combo" && (
          <Legend
            color={PROFIT_LOSS.profit}
            label={hasLoss ? "Net Profit / Loss" : "Net Profit"}
            swatch="line"
          />
        )}
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  swatch,
}: {
  color: string;
  label: string;
  swatch: "bar" | "line";
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: swatch === "bar" ? 12 : 16,
          height: swatch === "bar" ? 12 : 3,
          borderRadius: swatch === "bar" ? 3 : 2,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
