/**
 * Indian number formatting + ₹ Full / ₹ Lakh display mode.
 *
 * - Full mode:  12,34,567  (Indian grouping, no decimals)
 * - Lakh mode:  12.35 L    (value / 1e5, two decimals, " L" suffix)
 *
 * Negatives are rendered in brackets by `formatBracketed` (the P&L convention);
 * colour (red) is applied by the component via the returned `isNegative`.
 */

export type RupeeMode = "full" | "lakh";

/** Indian-grouped integer string, e.g. 1234567 -> "12,34,567". */
export function indianInt(n: number): string {
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  const s = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return neg ? `-${s}` : s;
}

/** Format a rupee amount per the current mode (no sign handling of brackets). */
export function formatRupee(n: number, mode: RupeeMode): string {
  if (mode === "lakh") {
    const v = n / 100000;
    const neg = v < 0;
    const s = Math.abs(v).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${neg ? "-" : ""}${s} L`;
  }
  return indianInt(n);
}

export interface BracketedAmount {
  text: string; // e.g. "(12,34,567)" for negatives, "12,34,567" otherwise
  isNegative: boolean;
}

/**
 * P&L-style amount: negatives wrapped in brackets (sign removed), so the
 * component can colour negatives red. Zero renders as "-".
 */
export function formatBracketed(n: number, mode: RupeeMode): BracketedAmount {
  if (Math.round(n) === 0) return { text: "-", isNegative: false };
  const isNegative = n < 0;
  const body = formatRupee(Math.abs(n), mode);
  return { text: isNegative ? `(${body})` : body, isNegative };
}

/** Percentage with one decimal, e.g. 0.2345 -> "23.4%". Guards divide-by-zero. */
export function formatPct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  const pct = (numerator / denominator) * 100;
  return `${pct.toFixed(1)}%`;
}

/** Raw ratio for count-up/animation targets (returns number, not string). */
export function pctValue(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

/** Human month label from "YYYY-MM", e.g. "2026-06" -> "Jun 2026". */
export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Short month label, e.g. "2026-06" -> "Jun 26". */
export function monthLabelShort(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}
