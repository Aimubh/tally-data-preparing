"use server";

/**
 * Upload parse action — runs the correct parser on an uploaded Tally export and
 * returns a review preview. This step does NOT write to the database; the human
 * reviews the parsed result (and the Grand-Total / Total validation) before a
 * separate confirm step commits it. Validation is loud: a failed reconciliation
 * returns ok:false with the exact difference.
 */

import { parseTrialBalance } from "@/lib/tally-tb-parser";
import { parseRegister } from "@/lib/tally-register-parser";
import { classifyPLLine, otherCompanyTokens, isInterCompanyLedger } from "@/lib/pl-classify";
import { prisma } from "@/lib/prisma";
import type { PLLine } from "@/lib/enums";

export type UploadKind = "TrialBalance" | "SalesRegister" | "JournalRegister";

export interface PreviewLedger {
  ledgerName: string;
  debit: number;
  credit: number;
  plLine: PLLine;
  isInterCompany: boolean;
}
export interface PreviewVoucher {
  date: string | null;
  particulars: string;
  vchType: string;
  vchNo: string;
  debit: number;
  credit: number;
}

export interface UploadPreview {
  ok: boolean; // false = hard validation failure (cannot commit)
  kind: UploadKind;
  companyName: string | null;
  addressLines: string[];
  periodLabel: string | null;
  // TB shape:
  ledgers?: PreviewLedger[];
  sumDebit: number;
  sumCredit: number;
  grandTotalDebit: number | null;
  grandTotalCredit: number | null;
  totalValidates: boolean;
  // Register shape:
  vouchers?: PreviewVoucher[];
  reportTitle?: string | null;
  errors: string[];
  warnings: { row: number; message: string }[];
  // echo of the form selection
  companyId: string;
  period: string;
  rowCount: number;
}

export async function parseUpload(formData: FormData): Promise<UploadPreview> {
  const companyId = String(formData.get("companyId") ?? "");
  const period = String(formData.get("period") ?? "");
  const kind = String(formData.get("kind") ?? "") as UploadKind;
  const file = formData.get("file") as File | null;

  const base = (extra: Partial<UploadPreview> = {}): UploadPreview => ({
    ok: false,
    kind,
    companyName: null,
    addressLines: [],
    periodLabel: null,
    sumDebit: 0,
    sumCredit: 0,
    grandTotalDebit: null,
    grandTotalCredit: null,
    totalValidates: false,
    errors: [],
    warnings: [],
    companyId,
    period,
    rowCount: 0,
    ...extra,
  });

  // Loud validation of the form itself.
  if (!companyId) return base({ errors: ["Select a company."] });
  if (!period) return base({ errors: ["Select a reporting month."] });
  if (!kind) return base({ errors: ["Select the file type."] });
  if (!file || file.size === 0) return base({ errors: ["Choose a file to upload."] });
  if (!/\.xlsx?$/i.test(file.name)) {
    return base({ errors: [`Unsupported file "${file.name}". Upload a Tally .xlsx export.`] });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Tokens for inter-company detection = the OTHER companies' names.
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, shortName: true },
  });
  const tokens = otherCompanyTokens(companies, companyId);

  try {
    if (kind === "TrialBalance") {
      const r = parseTrialBalance(buf);
      const ledgers: PreviewLedger[] = r.ledgers.map((l) => ({
        ledgerName: l.ledgerName,
        debit: l.debit,
        credit: l.credit,
        plLine: classifyPLLine(l.ledgerName),
        isInterCompany: isInterCompanyLedger(l.ledgerName, tokens),
      }));
      return base({
        ok: r.ok,
        companyName: r.companyName,
        addressLines: r.addressLines,
        periodLabel: r.periodLabel,
        ledgers,
        sumDebit: r.sumDebit,
        sumCredit: r.sumCredit,
        grandTotalDebit: r.grandTotalDebit,
        grandTotalCredit: r.grandTotalCredit,
        totalValidates: r.grandTotalValidates,
        errors: r.errors,
        warnings: r.warnings,
        rowCount: ledgers.length,
      });
    }

    // Sales / Journal register share the same parser.
    const r = parseRegister(buf);
    const vouchers: PreviewVoucher[] = r.rows.map((v) => ({
      date: v.date,
      particulars: v.particulars,
      vchType: v.vchType,
      vchNo: v.vchNo,
      debit: v.debit,
      credit: v.credit,
    }));
    return base({
      ok: r.ok,
      companyName: r.companyName,
      addressLines: r.addressLines,
      periodLabel: r.periodLabel,
      reportTitle: r.reportTitle,
      vouchers,
      sumDebit: r.sumDebit,
      sumCredit: r.sumCredit,
      grandTotalDebit: r.totalDebit,
      grandTotalCredit: r.totalCredit,
      totalValidates: r.totalValidates,
      errors: r.errors,
      warnings: r.warnings,
      rowCount: vouchers.length,
    });
  } catch (e) {
    return base({
      errors: [`Could not read the file: ${e instanceof Error ? e.message : String(e)}`],
    });
  }
}

// ---------------------------------------------------------------------------
/**
 * Delete an upload AND the data it brought in (so users can clear old files /
 * free storage). Destructive: removes the matching data rows for that
 * company + period + fileType, then the Upload bookkeeping row.
 *
 * fileType → data table:
 *   TrialBalance → TBEntry
 *   NoteDayBook  → NoteVoucher
 *   Outstandings → PartyBalance
 * (Sales/Purchase registers, if uploaded, would map to their voucher tables.)
 */
export interface DeleteResult {
  ok: boolean;
  error?: string;
  removedData?: number;
}

export async function deleteUpload(uploadId: string): Promise<DeleteResult> {
  if (!uploadId) return { ok: false, error: "Missing upload id." };

  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return { ok: false, error: "Upload not found (already deleted?)." };

  const { companyId, period, fileType } = upload;
  let removedData = 0;

  try {
    if (fileType === "TrialBalance") {
      const r = await prisma.tBEntry.deleteMany({ where: { companyId, period } });
      removedData = r.count;
    } else if (fileType === "NoteDayBook") {
      const r = await prisma.noteVoucher.deleteMany({ where: { companyId, period } });
      removedData = r.count;
    } else if (fileType === "Outstandings") {
      const r = await prisma.partyBalance.deleteMany({ where: { companyId, period } });
      removedData = r.count;
    }

    await prisma.upload.delete({ where: { id: uploadId } });
    return { ok: true, removedData };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
