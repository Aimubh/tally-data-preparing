/**
 * Shared server helper: resolves the top-bar context (months present, the
 * selected month from the URL, and per-company coverage dots) for any page.
 */

import { getMonths, getCoverage } from "./mis";
import type { CoverageDot } from "@/components/topbar";

export interface PageContext {
  months: string[];
  selectedMonth: string | null;
  coverage: CoverageDot[];
}

export async function resolvePageContext(
  monthParam?: string
): Promise<PageContext> {
  const months = await getMonths();
  // Selected month: URL param if valid, else the latest available.
  const selectedMonth =
    (monthParam && months.includes(monthParam) ? monthParam : null) ??
    months[months.length - 1] ??
    null;

  const coverage: CoverageDot[] = selectedMonth
    ? (await getCoverage(selectedMonth)).map((c) => ({
        shortName: c.shortName,
        hasData: c.hasData,
      }))
    : [];

  return { months, selectedMonth, coverage };
}
