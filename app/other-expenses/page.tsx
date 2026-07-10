import { TopBar } from "@/components/topbar";
import { CompanyScope } from "@/components/company-scope";
import { ExpensesBoard } from "@/components/expenses-board";
import { StatStrip } from "@/components/stat-strip";
import { resolvePageContext } from "@/lib/page-context";
import { getActiveCompanies } from "@/lib/mis";
import { getExpenses } from "@/lib/reports";
import { monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OtherExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; company?: string }>;
}) {
  const { month, company } = await searchParams;
  const { months, selectedMonth, coverage } = await resolvePageContext(month);
  const companies = await getActiveCompanies();
  const scope = company && companies.some((c) => c.id === company) ? company : "all";
  const scopeLabel =
    scope === "all" ? "All companies" : companies.find((c) => c.id === scope)?.shortName ?? "All companies";

  const report = selectedMonth
    ? await getExpenses(selectedMonth, scope)
    : { rows: [], total: 0, prevTotal: null };

  const momTotalPct =
    report.prevTotal && report.prevTotal !== 0
      ? ((report.total - report.prevTotal) / report.prevTotal) * 100
      : null;

  return (
    <>
      <TopBar title="Other Expenses" months={months} selectedMonth={selectedMonth} coverage={coverage} />
      <div className="page">
        <h1 className="page-h">Other Expenses</h1>
        <p className="page-sub">
          Indirect expenses with month-on-month movement{selectedMonth ? ` — ${monthLabel(selectedMonth)}` : ""}. Scope:{" "}
          <strong>{scopeLabel}</strong>. Changes beyond ±15% are flagged.
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
          <CompanyScope companies={companies.map((c) => ({ id: c.id, shortName: c.shortName }))} selected={scope} />
        </div>

        <StatStrip
          stats={[
            { label: "Total expenses", value: report.total, money: true },
            { label: "Last month", value: report.prevTotal ?? 0, money: true },
            {
              label: "MoM change",
              value: momTotalPct == null ? 0 : Math.round(momTotalPct),
              suffix: "%",
              accent: momTotalPct != null && momTotalPct > 0 ? "red" : "green",
            },
          ]}
        />

        <ExpensesBoard rows={report.rows} />
      </div>
    </>
  );
}
