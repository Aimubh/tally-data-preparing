import { TopBar } from "@/components/topbar";
import { resolvePageContext } from "@/lib/page-context";
import { getActiveCompanies, getMonths } from "@/lib/mis";
import { prisma } from "@/lib/prisma";
import { UploadsClient, type ExistingUpload } from "./uploads-client";

export const dynamic = "force-dynamic";

export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { months, selectedMonth, coverage } = await resolvePageContext(month);
  const companies = await getActiveCompanies();
  const dbMonths = await getMonths();

  const rawUploads = await prisma.upload.findMany({
    orderBy: [{ period: "desc" }, { uploadedAt: "desc" }],
    include: { company: { select: { shortName: true } } },
    take: 100,
  });
  const existing: ExistingUpload[] = rawUploads.map((u) => ({
    id: u.id,
    companyShort: u.company.shortName,
    period: u.period,
    fileType: u.fileType,
    uploadedAt: u.uploadedAt.toISOString().slice(0, 10),
  }));

  return (
    <>
      <TopBar
        title="Uploads"
        months={months}
        selectedMonth={selectedMonth}
        coverage={coverage}
      />
      <div className="page">
        <h1 className="page-h">Upload Tally exports</h1>
        <p className="page-sub">
          Upload a company&rsquo;s Tally export for a month, review what was
          parsed, and confirm to save. Nothing is stored until you review and
          confirm — and bad data is rejected loudly.
        </p>

        <UploadsClient
          companies={companies.map((c) => ({ id: c.id, shortName: c.shortName, name: c.name }))}
          months={dbMonths}
          existing={existing}
        />
      </div>
    </>
  );
}
