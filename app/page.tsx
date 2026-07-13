import { TopBar } from "@/components/topbar";
import { OverviewClient, type OverviewDTO } from "@/components/overview-client";
import { resolvePageContext } from "@/lib/page-context";
import {
  getConsolidatedPL,
  kpisFromConsolidated,
  getTrend,
  getActiveCompanies,
} from "@/lib/mis";
import { getGst } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; company?: string }>;
}) {
  const { month, company } = await searchParams;
  // page-context (months/coverage) and the trend are independent — overlap them.
  const [ctx, trend, allCompanies] = await Promise.all([
    resolvePageContext(month),
    getTrend(),
    getActiveCompanies(),
  ]);
  const { months, selectedMonth, coverage } = ctx;

  // Company scope filter: "all" (group) or a single company id.
  const scope =
    company && allCompanies.some((c) => c.id === company) ? company : "all";

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

  const [pl, gst] = await Promise.all([
    getConsolidatedPL(selectedMonth, scope),
    getGst(selectedMonth, scope), // GST respects the company scope too
  ]);
  const kpis = kpisFromConsolidated(pl);

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
    gst: {
      output: gst.outputTotal,
      input: gst.inputTotal,
      net: gst.netPayable,
      components: gst.components.map((c) => ({
        component: c.component,
        output: c.outputGst,
        input: c.inputGst,
        net: c.netGst,
      })),
    },
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
          {scope === "all"
            ? "Group view: inter-company entries excluded and shown separately as eliminations."
            : `Standalone view for ${allCompanies.find((c) => c.id === scope)?.shortName ?? ""} (inter-company included).`}
        </p>
        <OverviewClient
          data={data}
          filters={{
            companies: allCompanies.map((c) => ({ id: c.id, shortName: c.shortName })),
            scope,
            months,
            selectedMonth,
          }}
        />
      </div>
    </>
  );
}
