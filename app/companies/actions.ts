"use server";

/**
 * Server actions for the Companies page.
 *
 * Companies are DATA: adding one instantly makes it appear in coverage dots and
 * all report logic (with "no data" states) — no code changes. Validation is
 * loud: bad input is rejected with a clear message, nothing silently dropped.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// A small, distinct palette auto-assigned to new companies in order of creation.
const PALETTE = [
  "#1E4E79",
  "#2E8B57",
  "#B8860B",
  "#8E44AD",
  "#C0392B",
  "#16A085",
  "#D35400",
  "#2C3E50",
  "#7F8C8D",
  "#27AE60",
];

async function nextColor(): Promise<string> {
  const count = await prisma.company.count();
  return PALETTE[count % PALETTE.length];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function addCompany(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("shortName") ?? "").trim();

  // Loud validation — reject clearly.
  if (!name) return { ok: false, error: "Company name is required." };
  if (!shortName) return { ok: false, error: "Short name is required." };
  if (shortName.length > 20)
    return { ok: false, error: "Short name must be 20 characters or fewer." };

  // Uniqueness (name & shortName are unique in the schema).
  const clash = await prisma.company.findFirst({
    where: { OR: [{ name }, { shortName }] },
    select: { name: true, shortName: true },
  });
  if (clash) {
    const which = clash.name === name ? "name" : "short name";
    return { ok: false, error: `A company with this ${which} already exists.` };
  }

  const chartColor = await nextColor();
  await prisma.company.create({ data: { name, shortName, chartColor } });

  revalidatePath("/companies");
  revalidatePath("/");
  return { ok: true };
}

export async function setArchived(
  companyId: string,
  archived: boolean
): Promise<ActionResult> {
  if (!companyId) return { ok: false, error: "Missing company id." };
  await prisma.company.update({
    where: { id: companyId },
    data: { isActive: !archived },
  });
  revalidatePath("/companies");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Permanently delete a company AND all of its data. The schema's onDelete:
 * Cascade on every Company relation means removing the Company row also removes
 * its uploads, TB entries, sales/purchase vouchers, notes, party balances,
 * ledger mappings, and expenses in one operation.
 *
 * DESTRUCTIVE — the caller must confirm first. Returns a count of what was
 * removed so the UI can report it.
 */
export interface DeleteCompanyResult extends ActionResult {
  companyName?: string;
  removed?: number; // total data rows removed across all tables
}

export async function deleteCompany(companyId: string): Promise<DeleteCompanyResult> {
  if (!companyId) return { ok: false, error: "Missing company id." };

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "Company not found (already deleted?)." };

  // Count what will cascade away, for an honest confirmation message.
  const [tb, up, sv, pv, nv, pb, lm, ex] = await Promise.all([
    prisma.tBEntry.count({ where: { companyId } }),
    prisma.upload.count({ where: { companyId } }),
    prisma.salesVoucher.count({ where: { companyId } }),
    prisma.purchaseVoucher.count({ where: { companyId } }),
    prisma.noteVoucher.count({ where: { companyId } }),
    prisma.partyBalance.count({ where: { companyId } }),
    prisma.ledgerMapping.count({ where: { companyId } }),
    prisma.expenseEntry.count({ where: { companyId } }),
  ]);
  const removed = tb + up + sv + pv + nv + pb + lm + ex;

  // One delete — cascade removes all related rows.
  await prisma.company.delete({ where: { id: companyId } });

  revalidatePath("/companies");
  revalidatePath("/");
  return { ok: true, companyName: company.name, removed };
}
