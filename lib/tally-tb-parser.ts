/**
 * ============================================================================
 *  Tally Trial Balance parser — HARDENED against a real accountant export.
 * ============================================================================
 *
 * Validated against the real file:
 *   ADARSH STAINLESS P. LTD.(HPX) 26-27 — Trial Balance, 1-Sep-25 to 30-Sep-25.
 *
 * Real-file structure this parser handles (row indices are DISCOVERED, never
 * hardcoded):
 *   R0        Company name              e.g. "ADARSH STAINLESS P. LTD.(HPX) 26-27"
 *   R1..R2    Address line(s)
 *   Rn        "Trial Balance"
 *   Rn        Period                    e.g. "1-Sep-25 to 30-Sep-25"
 *   Rn        (repeated company name, often shifted to col 1)
 *   ---- three-row stacked header ----
 *   Rh        "Particulars" | <period>
 *   Rh+1                     | "Closing Balance"
 *   Rh+2                     | "Debit" | "Credit"
 *   ---- ledger rows ----          col0 = ledger name; col1 = Debit OR col2 = Credit
 *   ...
 *   Rlast     "Grand Total" | <ΣDebit> | <ΣCredit>
 *
 * Guarantees:
 *   - Flexible header detection: finds the "Particulars" row and the "Debit"/
 *     "Credit" labels within the stacked header, locking their column indices
 *     wherever they sit. No fixed row counts.
 *   - All amounts rounded to 2 decimals (kills float artifacts like
 *     20494660.859999999).
 *   - The "Grand Total" row is skipped as a ledger but USED for validation:
 *     parsed ΣDebit and ΣCredit must equal the Grand Total figures, else the
 *     upload is REJECTED with the exact difference.
 */

import * as XLSX from "xlsx";
import { classifyPLLine, isInterCompanyLedger } from "./pl-classify";
import type { PLLine } from "./enums";

export interface ParsedLedger {
  ledgerName: string;
  debit: number; // rounded 2dp
  credit: number; // rounded 2dp
  plLine: PLLine; // suggested classification
  isInterCompany: boolean; // suggested inter-company flag
}

export interface ParseWarning {
  row: number; // 1-based, for the reviewer
  message: string;
}

export interface TBParseResult {
  ok: boolean; // false if a hard validation failure (e.g. Grand Total mismatch)
  companyName: string | null;
  addressLines: string[];
  periodLabel: string | null;
  ledgers: ParsedLedger[];
  sumDebit: number; // Σ parsed ledger debits (2dp)
  sumCredit: number; // Σ parsed ledger credits (2dp)
  grandTotalDebit: number | null; // from the Grand Total row (2dp)
  grandTotalCredit: number | null;
  grandTotalValidates: boolean; // ΣDr==GT.Dr AND ΣCr==GT.Cr (within tolerance)
  errors: string[]; // hard errors that reject the upload
  warnings: ParseWarning[]; // soft issues surfaced to the reviewer (unmapped, etc.)
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// Reconciliation tolerance: a whole rupee. Real TBs balance exactly; this only
// absorbs residual float noise, never a genuine imbalance.
const RECON_TOLERANCE = 1;

function cellStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Parse a Tally amount cell → number (2dp) or null. Handles numeric cells and
 *  comma-formatted / Dr-Cr-suffixed / parenthesised text just in case. */
function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return round2(v);
  let s = String(v).trim();
  if (s === "" || s === "-") return null;
  s = s.replace(/₹|rs\.?/gi, "").trim();
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/\b(dr|cr)\b\.?/gi, "").replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  let n = parseFloat(s);
  if (neg) n = -n;
  return round2(n);
}

export function parseTrialBalance(input: Buffer | ArrayBuffer): TBParseResult {
  const wb = XLSX.read(input, { type: input instanceof Buffer ? "buffer" : "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: true,
    defval: "",
    raw: true,
  });

  const errors: string[] = [];
  const warnings: ParseWarning[] = [];

  // --- Locate the header block flexibly -----------------------------------
  // Find the row whose first cell is "Particulars".
  let particularsRow = -1;
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const first = cellStr(aoa[i]?.[0]).toLowerCase();
    if (first === "particulars" || first.startsWith("particulars")) {
      particularsRow = i;
      break;
    }
  }
  if (particularsRow === -1) {
    errors.push(
      "Could not find the 'Particulars' header row — this file does not look like a Tally Trial Balance export."
    );
    return emptyResult(errors, warnings);
  }

  // Within the stacked header (Particulars row + next ~3 rows), find the cells
  // labelled "Debit" and "Credit" and lock their column indices.
  let colDebit = -1;
  let colCredit = -1;
  let headerEnd = particularsRow;
  for (let i = particularsRow; i < Math.min(particularsRow + 4, aoa.length); i++) {
    const row = aoa[i] ?? [];
    for (let j = 0; j < row.length; j++) {
      const label = cellStr(row[j]).toLowerCase();
      if (label === "debit" && colDebit === -1) {
        colDebit = j;
        headerEnd = Math.max(headerEnd, i);
      }
      if (label === "credit" && colCredit === -1) {
        colCredit = j;
        headerEnd = Math.max(headerEnd, i);
      }
    }
    if (colDebit !== -1 && colCredit !== -1) break;
  }
  if (colDebit === -1 || colCredit === -1) {
    errors.push(
      "Could not locate the 'Debit' and 'Credit' column headers in the stacked header block."
    );
    return emptyResult(errors, warnings);
  }

  // --- Title block (everything above the Particulars row) ------------------
  // First non-empty cell = company name; a row with " to " = period; a row that
  // equals "Trial Balance" is the report title; other non-empty rows before the
  // period are treated as address lines.
  let companyName: string | null = null;
  let periodLabel: string | null = null;
  const addressLines: string[] = [];
  for (let i = 0; i < particularsRow; i++) {
    const first = cellStr(aoa[i]?.[0]) || cellStr(aoa[i]?.[1]);
    if (!first) continue;
    if (companyName === null) {
      companyName = first;
      continue;
    }
    if (/\bto\b/i.test(first) && /\d/.test(first) && periodLabel === null) {
      periodLabel = first;
      continue;
    }
    if (/^trial balance$/i.test(first)) continue; // report title
    if (first === companyName) continue; // repeated company-name row
    if (periodLabel === null) addressLines.push(first); // address line
  }

  // --- Walk ledger rows below the header ----------------------------------
  const ledgers: ParsedLedger[] = [];
  let sumDebit = 0;
  let sumCredit = 0;
  let grandTotalDebit: number | null = null;
  let grandTotalCredit: number | null = null;

  for (let i = headerEnd + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const name = cellStr(row[0]);
    const debit = parseAmount(row[colDebit]);
    const credit = parseAmount(row[colCredit]);

    if (name === "" && debit === null && credit === null) continue; // blank

    // Grand Total: skip as a ledger, capture for validation.
    if (/^grand\s*total$/i.test(name) || name.toLowerCase() === "total") {
      grandTotalDebit = debit ?? 0;
      grandTotalCredit = credit ?? 0;
      continue;
    }

    if (name === "") {
      warnings.push({ row: i + 1, message: "Row has an amount but no ledger name; skipped." });
      continue;
    }

    const d = debit ?? 0;
    const c = credit ?? 0;
    sumDebit = round2(sumDebit + d);
    sumCredit = round2(sumCredit + c);

    const plLine = classifyPLLine(name);
    // isInterCompany filled by the caller (needs the other companies' names).
    ledgers.push({ ledgerName: name, debit: d, credit: c, plLine, isInterCompany: false });
  }

  // --- Grand Total validation (HARD — rejects the upload) -----------------
  let grandTotalValidates = false;
  if (grandTotalDebit === null && grandTotalCredit === null) {
    errors.push("No 'Grand Total' row found — cannot validate the trial balance totals.");
  } else {
    const dDiff = round2(sumDebit - (grandTotalDebit ?? 0));
    const cDiff = round2(sumCredit - (grandTotalCredit ?? 0));
    const dOk = Math.abs(dDiff) <= RECON_TOLERANCE;
    const cOk = Math.abs(cDiff) <= RECON_TOLERANCE;
    grandTotalValidates = dOk && cOk;
    if (!dOk) {
      errors.push(
        `Debit total mismatch: parsed ₹${fmt(sumDebit)} vs Grand Total ₹${fmt(
          grandTotalDebit ?? 0
        )} (difference ₹${fmt(dDiff)}). Upload rejected.`
      );
    }
    if (!cOk) {
      errors.push(
        `Credit total mismatch: parsed ₹${fmt(sumCredit)} vs Grand Total ₹${fmt(
          grandTotalCredit ?? 0
        )} (difference ₹${fmt(cDiff)}). Upload rejected.`
      );
    }
  }

  return {
    ok: errors.length === 0,
    companyName,
    addressLines,
    periodLabel,
    ledgers,
    sumDebit,
    sumCredit,
    grandTotalDebit,
    grandTotalCredit,
    grandTotalValidates,
    errors,
    warnings,
  };
}

/** Fill the inter-company flag on each ledger given the OTHER companies' name
 *  tokens (lowercased name + shortName of every company except the uploader). */
export function flagInterCompany(
  result: TBParseResult,
  otherCompanyTokens: string[]
): TBParseResult {
  for (const l of result.ledgers) {
    l.isInterCompany = isInterCompanyLedger(l.ledgerName, otherCompanyTokens);
  }
  return result;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emptyResult(errors: string[], warnings: ParseWarning[]): TBParseResult {
  return {
    ok: false,
    companyName: null,
    addressLines: [],
    periodLabel: null,
    ledgers: [],
    sumDebit: 0,
    sumCredit: 0,
    grandTotalDebit: null,
    grandTotalCredit: null,
    grandTotalValidates: false,
    errors,
    warnings,
  };
}
