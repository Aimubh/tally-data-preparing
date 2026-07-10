import { TopBar } from "@/components/topbar";
import { CompanyScope } from "@/components/company-scope";
import { GstBoard } from "@/components/gst-board";
import { resolvePageContext } from "@/lib/page-context";
import { getActiveCompanies } from "@/lib/mis";
import { getGst } from "@/lib/reports";
import { monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GstPage({
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
    ? await getGst(selectedMonth, scope)
    : {
        components: [],
        outputTotal: 0,
        inputTotal: 0,
        netPayable: 0,
        outputTaxableTotal: 0,
        inputTaxableTotal: 0,
      };

  return (
    <>
      <TopBar title="GST" months={months} selectedMonth={selectedMonth} coverage={coverage} />
      <div className="page">
        <h1 className="page-h">GST — Input &amp; Output</h1>
        <p className="page-sub">
          GST collected on sales (outgoing) vs GST paid on purchases (ingoing), and the net payable
          {selectedMonth ? ` — ${monthLabel(selectedMonth)}` : ""}. Scope: <strong>{scopeLabel}</strong>.
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
          <CompanyScope companies={companies.map((c) => ({ id: c.id, shortName: c.shortName }))} selected={scope} />
        </div>

        <GstBoard report={report} />
      </div>
    </>
  );
}
