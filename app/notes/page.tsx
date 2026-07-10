import { TopBar } from "@/components/topbar";
import { CompanyScope } from "@/components/company-scope";
import { NotesBoard } from "@/components/notes-board";
import { StatStrip } from "@/components/stat-strip";
import { resolvePageContext } from "@/lib/page-context";
import { getActiveCompanies } from "@/lib/mis";
import { getNotes } from "@/lib/reports";
import { monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotesPage({
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
    ? await getNotes(selectedMonth, scope)
    : { rows: [], debitTotal: 0, creditTotal: 0, count: 0 };

  return (
    <>
      <TopBar title="Debit/Credit Notes" months={months} selectedMonth={selectedMonth} coverage={coverage} />
      <div className="page">
        <h1 className="page-h">Debit / Credit Notes</h1>
        <p className="page-sub">
          Debit &amp; credit note register{selectedMonth ? ` — ${monthLabel(selectedMonth)}` : ""}. Scope:{" "}
          <strong>{scopeLabel}</strong>.
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
          <CompanyScope companies={companies.map((c) => ({ id: c.id, shortName: c.shortName }))} selected={scope} />
        </div>

        <StatStrip
          stats={[
            { label: "Debit notes", value: report.debitTotal, money: true, accent: "red" },
            { label: "Credit notes", value: report.creditTotal, money: true, accent: "green" },
            { label: "Notes", value: report.count },
          ]}
        />

        <NotesBoard rows={report.rows} showCompany={scope === "all"} />
      </div>
    </>
  );
}
