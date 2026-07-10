/**
 * Tally REGISTER parser — for Sales Register / Journal Register / Purchase
 * Register exports (as opposed to the Trial Balance, which has a different
 * column shape and lives in lib/tally-tb-parser.ts).
 *
 * Validated against the real files:
 *   - HPX sales Sept 2025 (Sales Register)
 *   - Journal entry Sept 2025 (Journal Register)
 *
 * Real structure (row indices DISCOVERED, never hardcoded):
 *   R0        Company name
 *   R1..R2    Address line(s)
 *   Rn        "<Report> Register"   e.g. "Sales Register", "Journal Register"
 *   Rn        Period                e.g. "1-Sep-25 to 30-Sep-25"
 *   ---- two-row stacked header ----
 *   Rh        "Date" | "Particulars" | "Vch Type" | "Vch No." | "Debit" | "Credit"
 *   Rh+1                                                        | "Amount" | "Amount"
 *   ---- voucher rows ----
 *   ...       <date-serial> | <party> | <vch type> | <vch no> | <debit> | <credit>
 *   Rlast     "Total:" | ... | <ΣDebit> | <ΣCredit>
 *
 * Amounts rounded to 2 decimals. The "Total:" row is skipped as data but used to
 * validate: ΣDebit / ΣCredit must match, else the upload is rejected.
 */

import * as XLSX from "xlsx";

export interface RegisterRow {
  date: string | null; // ISO yyyy-mm-dd (from Excel serial) or raw string
  particulars: string;
  vchType: string;
  vchNo: string;
  debit: number; // 2dp
  credit: number; // 2dp
}

export interface RegisterParseResult {
  ok: boolean;
  companyName: string | null;
  addressLines: string[];
  reportTitle: string | null; // e.g. "Sales Register"
  periodLabel: string | null;
  rows: RegisterRow[];
  sumDebit: number;
  sumCredit: number;
  totalDebit: number | null; // from the "Total:" row
  totalCredit: number | null;
  totalValidates: boolean;
  errors: string[];
  warnings: { row: number; message: string }[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const RECON_TOLERANCE = 1;

function cellStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function parseAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return round2(v);
  let s = String(v).trim();
  if (s === "" || s === "-") return null;
  s = s.replace(/₹|rs\.?/gi, "").replace(/,/g, "").replace(/[()]/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return round2(parseFloat(s));
}

// Excel serial date → ISO yyyy-mm-dd (1900 date system). Returns raw string if
// the cell isn't a serial number.
function excelDateToISO(v: unknown): string | null {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") {
    // Excel epoch: serial 25569 = 1970-01-01; day 0 = 1899-12-30.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return String(v);
    return d.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

export function parseRegister(input: Buffer | ArrayBuffer): RegisterParseResult {
  const wb = XLSX.read(input, { type: input instanceof Buffer ? "buffer" : "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: true,
    defval: "",
    raw: true,
  });

  const errors: string[] = [];
  const warnings: { row: number; message: string }[] = [];

  // --- Locate the header row (contains "Date" + "Particulars"). ------------
  let headerRow = -1;
  let col: Record<string, number> = {};
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = (aoa[i] ?? []).map((c) => cellStr(c).toLowerCase());
    if (row.includes("date") && row.includes("particulars")) {
      headerRow = i;
      col = {
        date: row.indexOf("date"),
        particulars: row.indexOf("particulars"),
        vchType: row.findIndex((c) => c.includes("vch type") || c.includes("voucher type")),
        vchNo: row.findIndex((c) => c.includes("vch no") || c.includes("voucher no")),
        debit: row.indexOf("debit"),
        credit: row.indexOf("credit"),
      };
      break;
    }
  }
  if (headerRow === -1 || col.debit === -1 || col.credit === -1) {
    errors.push(
      "Could not find the register header (Date / Particulars / Debit / Credit). This does not look like a Tally register export."
    );
    return empty(errors, warnings);
  }

  // Second header row ("Amount | Amount") — skip it if present.
  let dataStart = headerRow + 1;
  const nextRow = (aoa[headerRow + 1] ?? []).map((c) => cellStr(c).toLowerCase());
  if (nextRow[col.debit] === "amount" || nextRow[col.credit] === "amount") {
    dataStart = headerRow + 2;
  }

  // --- Title block (above the header). -------------------------------------
  let companyName: string | null = null;
  let reportTitle: string | null = null;
  let periodLabel: string | null = null;
  const addressLines: string[] = [];
  for (let i = 0; i < headerRow; i++) {
    const first = cellStr(aoa[i]?.[0]);
    if (!first) continue;
    if (companyName === null) {
      companyName = first;
      continue;
    }
    if (/register$/i.test(first)) {
      reportTitle = first;
      continue;
    }
    if (/\bto\b/i.test(first) && /\d/.test(first) && periodLabel === null) {
      periodLabel = first;
      continue;
    }
    if (periodLabel === null && reportTitle === null) addressLines.push(first);
  }

  // --- Voucher rows. -------------------------------------------------------
  const rows: RegisterRow[] = [];
  let sumDebit = 0;
  let sumCredit = 0;
  let totalDebit: number | null = null;
  let totalCredit: number | null = null;

  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const particulars = cellStr(row[col.particulars]) || cellStr(row[col.date]);
    const debit = parseAmount(row[col.debit]);
    const credit = parseAmount(row[col.credit]);

    if (particulars === "" && debit === null && credit === null) continue;

    // "Total:" row → capture, skip.
    if (/^total\s*:?$/i.test(cellStr(row[col.date])) || /^total\s*:?$/i.test(particulars)) {
      totalDebit = debit ?? 0;
      totalCredit = credit ?? 0;
      continue;
    }

    const d = debit ?? 0;
    const c = credit ?? 0;
    sumDebit = round2(sumDebit + d);
    sumCredit = round2(sumCredit + c);

    rows.push({
      date: excelDateToISO(row[col.date]),
      particulars: cellStr(row[col.particulars]),
      vchType: col.vchType >= 0 ? cellStr(row[col.vchType]) : "",
      vchNo: col.vchNo >= 0 ? cellStr(row[col.vchNo]) : "",
      debit: d,
      credit: c,
    });
  }

  // --- Total validation. ---------------------------------------------------
  let totalValidates = false;
  if (totalDebit === null && totalCredit === null) {
    warnings.push({ row: 0, message: "No 'Total:' row found — could not validate register totals." });
  } else {
    const dOk = Math.abs(round2(sumDebit - (totalDebit ?? 0))) <= RECON_TOLERANCE;
    const cOk = Math.abs(round2(sumCredit - (totalCredit ?? 0))) <= RECON_TOLERANCE;
    totalValidates = dOk && cOk;
    if (!dOk)
      errors.push(
        `Debit total mismatch: parsed ${fmt(sumDebit)} vs Total ${fmt(totalDebit ?? 0)}. Upload rejected.`
      );
    if (!cOk)
      errors.push(
        `Credit total mismatch: parsed ${fmt(sumCredit)} vs Total ${fmt(totalCredit ?? 0)}. Upload rejected.`
      );
  }

  return {
    ok: errors.length === 0,
    companyName,
    addressLines,
    reportTitle,
    periodLabel,
    rows,
    sumDebit,
    sumCredit,
    totalDebit,
    totalCredit,
    totalValidates,
    errors,
    warnings,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function empty(errors: string[], warnings: { row: number; message: string }[]): RegisterParseResult {
  return {
    ok: false,
    companyName: null,
    addressLines: [],
    reportTitle: null,
    periodLabel: null,
    rows: [],
    sumDebit: 0,
    sumCredit: 0,
    totalDebit: null,
    totalCredit: null,
    totalValidates: false,
    errors,
    warnings,
  };
}
