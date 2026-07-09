"use client";

import { useUIState } from "./ui-state";
import { formatRupee, monthLabelShort } from "@/lib/format";
import type { TrendPoint } from "@/lib/mis";

/**
 * Consolidated trend: revenue bars + gross% and net% lines across all months.
 * Draw-in animation on first render (bars grow, lines dash-in), reduced-motion
 * respected via CSS. Pure SVG — no chart lib.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const { rupeeMode } = useUIState();

  const W = 720;
  const H = 260;
  const padL = 64;
  const padR = 48;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (points.length === 0) {
    return <div className="empty">No trend data.</div>;
  }

  const maxRev = Math.max(...points.map((p) => p.revenue), 1);
  const n = points.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.5, 46);

  // Percent axis (right): fit gross/net range with a little headroom.
  const pctVals = points.flatMap((p) => [p.grossPct, p.netPct]);
  const maxPct = Math.max(...pctVals, 10);
  const minPct = Math.min(...pctVals, 0);
  const pctSpan = maxPct - minPct || 1;

  const xCenter = (i: number) => padL + slot * i + slot / 2;
  const yRev = (v: number) => padT + plotH - (v / maxRev) * plotH;
  const yPct = (v: number) =>
    padT + plotH - ((v - minPct) / pctSpan) * plotH;

  const linePath = (key: "grossPct" | "netPct") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yPct(p[key])}`)
      .join(" ");

  // Approximate path length for dash animation.
  const approxLen = Math.round(plotW * 1.3);

  // PlayStation palette: PS-blue gross line, a legible positive green net line,
  // and a soft ash bar so the blue line reads on top.
  const grossColor = "#0070d1";
  const netColor = "#0a7d3f";
  const barColor = "#c9d6e6";

  return (
    <div>
      <svg
        className="trend-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Consolidated revenue with gross and net margin percentage trend"
      >
        {/* horizontal gridlines (revenue axis) */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padT + plotH - f * plotH;
          return (
            <g key={f}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="#e6ecf4"
                strokeWidth={1}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="#8a97ab"
              >
                {formatRupee(maxRev * f, rupeeMode)}
              </text>
            </g>
          );
        })}

        {/* revenue bars */}
        {points.map((p, i) => {
          const h = (p.revenue / maxRev) * plotH;
          return (
            <rect
              key={p.period}
              className="draw-bar"
              x={xCenter(i) - barW / 2}
              y={padT + plotH - h}
              width={barW}
              height={h}
              rx={3}
              fill={barColor}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          );
        })}

        {/* percent lines */}
        <path
          className="draw-line"
          d={linePath("grossPct")}
          fill="none"
          stroke={grossColor}
          strokeWidth={2}
          style={{ ["--len" as string]: `${approxLen}` }}
        />
        <path
          className="draw-line"
          d={linePath("netPct")}
          fill="none"
          stroke={netColor}
          strokeWidth={2}
          strokeDasharray="1"
          style={{ ["--len" as string]: `${approxLen}` }}
        />
        {points.map((p, i) => (
          <g key={`pt-${p.period}`}>
            <circle cx={xCenter(i)} cy={yPct(p.grossPct)} r={3} fill={grossColor} />
            <circle cx={xCenter(i)} cy={yPct(p.netPct)} r={3} fill={netColor} />
          </g>
        ))}

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
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
        <Legend color={barColor} label="Consolidated Revenue" swatch="bar" />
        <Legend color={grossColor} label="Gross Margin %" swatch="line" />
        <Legend color={netColor} label="Net Margin %" swatch="line" />
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
