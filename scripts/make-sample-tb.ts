/**
 * Generates a SAMPLE Tally Trial Balance .xlsx that matches the REAL export
 * structure exactly (validated against ADARSH STAINLESS P. LTD.(HPX) 26-27):
 *
 *   R0        Company name
 *   R1        Address line 1
 *   R2        Address line 2
 *   R3        "Trial Balance"
 *   R4        Period ("1-Sep-25 to 30-Sep-25")
 *   R5        (repeated company name, in COL 1)
 *   R6        "Particulars" | <period>
 *   R7                      | "Closing Balance"
 *   R8                      | "Debit" | "Credit"
 *   R9..      ledger rows   (col0 name; col1 Debit OR col2 Credit)
 *   Rlast     "Grand Total" | ΣDebit | ΣCredit
 *
 * Amounts are written as raw numbers (Tally stores floats; the parser rounds).
 * Output: ./samples/sample-trial-balance.xlsx
 *
 * Usage: npx tsx scripts/make-sample-tb.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

interface SampleLedger {
  name: string;
  debit?: number;
  credit?: number;
}

const COMPANY = "DEMO METALS PVT LTD (SMP) 26-27";
const ADDR1 = "PLOT 14, MIDC INDUSTRIAL AREA";
const ADDR2 = "PIMPRI, PUNE";
const PERIOD = "1-Sep-25 to 30-Sep-25";

// A realistic mixed set covering P&L lines + balance-sheet ledgers, including a
// float artifact and a "Profit & Loss A/c" row (to exercise the override).
const LEDGERS: SampleLedger[] = [
  { name: "Sales - Local", credit: 4820000 },
  { name: "Power/energy Supply -Sale", credit: 1236400.5 },
  { name: "Interest Received", credit: 41250 },
  { name: "Purchase - Raw Material", debit: 3120600.4 },
  { name: "Power/energy Supply - Purchase", debit: 980000 },
  { name: "Freight & Cartage Inward", debit: 142000 },
  { name: "Salaries & Wages", debit: 610000 },
  { name: "Advertisement & Marketing", debit: 88000 },
  { name: "Office Rent", debit: 150000 },
  { name: "Bank Charges", debit: 12450.129999999 }, // deliberate float artifact
  { name: "Depreciation", debit: 164634 },
  { name: "Sundry Debtors", debit: 2977778.13 },
  { name: "State Bank of India", debit: 1353637.19 },
  { name: "ICICI BANK", debit: 47953 },
  { name: "Sundry Creditors", credit: 1437535.09 },
  { name: "GST Payable", credit: 96912.4 },
  { name: "TDS Payable", credit: 20000 },
  { name: "Profit & Loss A/c", credit: 213545.04 },
];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function build(): (string | number)[][] {
  const aoa: (string | number)[][] = [];
  aoa.push([COMPANY]);
  aoa.push([ADDR1]);
  aoa.push([ADDR2]);
  aoa.push(["Trial Balance"]);
  aoa.push([PERIOD]);
  aoa.push(["", COMPANY]); // repeated company name in col 1
  aoa.push(["Particulars", PERIOD]);
  aoa.push(["", "Closing Balance"]);
  aoa.push(["", "Debit", "Credit"]);

  let sumDr = 0;
  let sumCr = 0;
  for (const l of LEDGERS) {
    const d = l.debit ?? 0;
    const c = l.credit ?? 0;
    sumDr = round2(sumDr + d);
    sumCr = round2(sumCr + c);
    aoa.push([l.name, l.debit ?? "", l.credit ?? ""]);
  }

  // Make the sample balance: nudge a plug ledger so ΣDr == ΣCr exactly.
  const diff = round2(sumDr - sumCr);
  if (diff !== 0) {
    // Add a balancing ledger on the lighter side so Grand Total validates.
    if (diff > 0) {
      aoa.push(["Suspense A/c", "", diff]);
      sumCr = round2(sumCr + diff);
    } else {
      aoa.push(["Suspense A/c", -diff, ""]);
      sumDr = round2(sumDr - diff);
    }
  }

  aoa.push(["Grand Total", round2(sumDr), round2(sumCr)]);
  return aoa;
}

function main() {
  const outDir = path.join(process.cwd(), "samples");
  fs.mkdirSync(outDir, { recursive: true });
  const ws = XLSX.utils.aoa_to_sheet(build());
  ws["!cols"] = [{ wch: 42 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
  const outPath = path.join(outDir, "sample-trial-balance.xlsx");
  XLSX.writeFile(wb, outPath);
  console.log(`✔  Wrote ${outPath} — matches the real Tally TB structure.`);
}

main();
