import { TopBar } from "@/components/topbar";
import { OverviewClient, type OverviewDTO } from "@/components/overview-client";
import { resolvePageContext } from "@/lib/page-context";
import {
  getConsolidatedPL,
  kpisFromConsolidated,
  getTrend,
} from "@/lib/mis";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { months, selectedMonth, coverage } = await resolvePageContext(month);

  // No data at all → empty state (nothing seeded / migrated yet).
  if (!selectedMonth) {
    return (
      <>
        <TopBar title="Overview" months={months} selectedMonth={null} coverage={coverage} />
        <div className="page">
          <h1 className="page-h">Overview</h1>
          <div className="empty">
            No data yet. Seed the database (<code>npm run seed</code>) or add an
            upload, then pick a month.
          </div>
        </div>
      </>
    );
  }

  const pl = await getConsolidatedPL(selectedMonth);
  const kpis = kpisFromConsolidated(pl);
  const trend = await getTrend();

  // Convert to a serializable DTO for the client component.
  const data: OverviewDTO = {
    period: pl.period,
    columns: pl.columns.map((c) => ({
      key: c.key,
      label: c.label,
      isElimination: c.isElimination,
      isConsolidated: c.isConsolidated,
      byLine: c.byLine,
      grossProfit: c.grossProfit,
      ebitda: c.ebitda,
      pbt: c.pbt,
      netProfit: c.netProfit,
    })),
    icTurnoverEliminated: pl.icTurnoverEliminated,
    icPurchasesEliminated: pl.icPurchasesEliminated,
    icSalesTotal: pl.icSalesTotal,
    icPurchasesTotal: pl.icPurchasesTotal,
    icGap: pl.icGap,
    hasMismatch: pl.hasMismatch,
    kpis,
    trend,
  };

  return (
    <>
      <TopBar
        title="Overview"
        months={months}
        selectedMonth={selectedMonth}
        coverage={coverage}
      />
      <div className="page">
        <h1 className="page-h">Overview — Consolidated P&amp;L</h1>
        <p className="page-sub">
          Group view: inter-company entries excluded and shown separately as
          eliminations.
        </p>
        <OverviewClient data={data} />
      </div>
    </>
  );
}
