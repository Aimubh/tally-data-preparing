import { TopBar } from "@/components/topbar";
import { CompanyScope } from "@/components/company-scope";
import { VoucherBoard } from "@/components/voucher-board";
import { StatStrip } from "@/components/stat-strip";
import { resolvePageContext } from "@/lib/page-context";
import { getActiveCompanies } from "@/lib/mis";
import { getPurchases } from "@/lib/reports";
import { monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PurchasesPage({
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
    ? await getPurchases(selectedMonth, scope)
    : { rows: [], total: 0, interCompanyTotal: 0, count: 0 };

  return (
    <>
      <TopBar title="Purchases" months={months} selectedMonth={selectedMonth} coverage={coverage} />
      <div className="page">
        <h1 className="page-h">Purchase Register</h1>
        <p className="page-sub">
          Voucher-level purchases{selectedMonth ? ` — ${monthLabel(selectedMonth)}` : ""}. Scope:{" "}
          <strong>{scopeLabel}</strong>
          {scope === "all" ? " (inter-company purchases flagged separately)." : " (standalone, inter-company included)."}
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
          <CompanyScope companies={companies.map((c) => ({ id: c.id, shortName: c.shortName }))} selected={scope} />
        </div>

        <StatStrip
          stats={[
            { label: "Total purchases", value: report.total, money: true },
            { label: "Inter-company purchases", value: report.interCompanyTotal, money: true, accent: "red" },
            { label: "Vouchers", value: report.count },
          ]}
        />

        <VoucherBoard rows={report.rows} showCompany={scope === "all"} />
      </div>
    </>
  );
}
