import { TopBar } from "@/components/topbar";
import { resolvePageContext } from "@/lib/page-context";
import { getCompanyCards } from "@/lib/mis";
import { CompaniesClient } from "./companies-client";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { months, selectedMonth, coverage } = await resolvePageContext(month);
  const cards = await getCompanyCards();

  return (
    <>
      <TopBar
        title="Companies"
        months={months}
        selectedMonth={selectedMonth}
        coverage={coverage}
      />
      <div className="page">
        <h1 className="page-h">Companies</h1>
        <p className="page-sub">
          Companies are data, not structure — add or archive from here and every
          report updates automatically.
        </p>
        <CompaniesClient cards={cards} />
      </div>
    </>
  );
}
