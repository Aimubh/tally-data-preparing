import { TopBar } from "@/components/topbar";
import { SettingsClient } from "@/components/settings-client";
import { resolvePageContext } from "@/lib/page-context";
import { getCurrentAdminRecord } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { months, selectedMonth, coverage } = await resolvePageContext(month);
  const admin = await getCurrentAdminRecord();
  return (
    <>
      <TopBar
        title="Settings"
        months={months}
        selectedMonth={selectedMonth}
        coverage={coverage}
      />
      <SettingsClient
        profile={{
          name: admin?.name ?? "",
          email: admin?.email ?? "",
          avatarUrl: admin?.avatarUrl ?? null,
          designation: admin?.designation ?? null,
        }}
      />
    </>
  );
}
