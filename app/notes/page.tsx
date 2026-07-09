import { PlaceholderPage } from "@/components/placeholder-page";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  return <PlaceholderPage title="Debit/Credit Notes" monthParam={month} />;
}
