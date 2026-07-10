import { TopBar } from "@/components/topbar";
import { CompanyScope } from "@/components/company-scope";
import { PartyBoard } from "@/components/party-board";
import { StatStrip } from "@/components/stat-strip";
import { resolvePageContext } from "@/lib/page-context";
import { getActiveCompanies } from "@/lib/mis";
import { getParties } from "@/lib/reports";
import { monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DebtorsPage({
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
    ? await getParties(selectedMonth, scope, "Debtor")
    : { rows: [], total: 0, ageing: { a0: 0, a1: 0, a2: 0, a3: 0 }, count: 0 };

  return (
    <>
      <TopBar title="Debtors" months={months} selectedMonth={selectedMonth} coverage={coverage} />
      <div className="page">
        <h1 className="page-h">Debtors — Outstanding</h1>
        <p className="page-sub">
          Amounts receivable from customers, with ageing{selectedMonth ? ` — ${monthLabel(selectedMonth)}` : ""}. Scope:{" "}
          <strong>{scopeLabel}</strong>.
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
          <CompanyScope companies={companies.map((c) => ({ id: c.id, shortName: c.shortName }))} selected={scope} />
        </div>

        <StatStrip
          stats={[
            { label: "Total receivable", value: report.total, money: true },
            { label: "Current (0–30)", value: report.ageing.a0, money: true, accent: "green" },
            { label: "Overdue 90+", value: report.ageing.a3, money: true, accent: "red" },
            { label: "Parties", value: report.count },
          ]}
        />

        <PartyBoard rows={report.rows} showCompany={scope === "all"} />
      </div>
    </>
  );
}
