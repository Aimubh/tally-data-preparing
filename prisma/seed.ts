/**
 * Seed script — the ONLY entry point for dummy data.
 *
 * Rules (permanent project policy — see CLAUDE.md):
 *   - Dummy data enters ONLY through this script.
 *   - `--clear` wipes ALL data so real and dummy data never coexist.
 *   - Real and dummy data must never be mixed.
 *
 * Usage:
 *   npm run seed          # wipe + generate dummy data
 *   npm run seed:clear    # wipe every table, seed nothing
 *
 * ⚠ DUMMY DATA. Fabricated — not derived from any real Tally export.
 *
 * What it generates:
 *   - 3 companies (add/archive is a UI concern; these are just seed rows).
 *   - 6 months of Trial Balance entries per company, with realistic Indian
 *     ledger names covering every P&L line, plus balance-sheet ledgers.
 *   - Inter-company ledgers named after the counterparty company so the
 *     read-time keyword rule (ledger name contains another company's name)
 *     detects and eliminates them.
 *   - ONE intentional inter-company MISMATCH (group IC sales != IC purchases
 *     by > ₹1,000) on the latest month, to exercise the Overview warning banner.
 *   - An Upload row per company × month for TrialBalance so coverage dots show.
 */

import { Prisma, type Company } from "@prisma/client";
import { prisma } from "../lib/prisma";

// --- Deterministic PRNG (mulberry32) — reproducible reseeds, no Math.random ---
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260709);
const randBetween = (min: number, max: number) =>
  Math.round(min + rng() * (max - min));

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

// --- Companies ---------------------------------------------------------------
const COMPANIES = [
  { name: "Apex Polymers Pvt Ltd", shortName: "Apex", chartColor: "#1E4E79" },
  { name: "Beacon Textiles Pvt Ltd", shortName: "Beacon", chartColor: "#2E8B57" },
  { name: "Crest Engineering Pvt Ltd", shortName: "Crest", chartColor: "#B8860B" },
];

// --- Ledger catalogue: name, Tally parent group, normal side (Dr/Cr) ---------
// Names are chosen so the Overview's keyword classifier lands each on the right
// P&L line (see lib/pl-classify.ts). "side" decides which TB column carries the
// figure. Amounts are per-month magnitude ranges (INR).
type Side = "debit" | "credit";
interface Ledger {
  name: string;
  parentGroup: string;
  side: Side;
  min: number;
  max: number;
}

const LEDGERS: Ledger[] = [
  // Revenue (credit)
  { name: "Sales - Local", parentGroup: "Sales Accounts", side: "credit", min: 4_500_000, max: 9_500_000 },
  { name: "Sales - Export", parentGroup: "Sales Accounts", side: "credit", min: 1_500_000, max: 5_000_000 },
  // Other Income (credit)
  { name: "Interest Received", parentGroup: "Indirect Incomes", side: "credit", min: 40_000, max: 180_000 },
  { name: "Discount Received", parentGroup: "Indirect Incomes", side: "credit", min: 20_000, max: 120_000 },
  // Purchases / COGS (debit)
  { name: "Purchase - Raw Material", parentGroup: "Purchase Accounts", side: "debit", min: 3_000_000, max: 6_500_000 },
  { name: "Purchase - Consumables", parentGroup: "Purchase Accounts", side: "debit", min: 300_000, max: 900_000 },
  // Direct Expenses (debit)
  { name: "Freight & Cartage Inward", parentGroup: "Direct Expenses", side: "debit", min: 120_000, max: 420_000 },
  { name: "Power & Fuel", parentGroup: "Direct Expenses", side: "debit", min: 200_000, max: 650_000 },
  // Employee (debit)
  { name: "Salaries & Wages", parentGroup: "Indirect Expenses", side: "debit", min: 800_000, max: 1_700_000 },
  { name: "Staff Welfare", parentGroup: "Indirect Expenses", side: "debit", min: 40_000, max: 160_000 },
  // Selling & Distribution (debit)
  { name: "Advertisement & Marketing", parentGroup: "Indirect Expenses", side: "debit", min: 90_000, max: 380_000 },
  { name: "Freight Outward", parentGroup: "Indirect Expenses", side: "debit", min: 80_000, max: 300_000 },
  // Admin & Other (debit)
  { name: "Office Rent", parentGroup: "Indirect Expenses", side: "debit", min: 150_000, max: 350_000 },
  { name: "Office Expenses", parentGroup: "Indirect Expenses", side: "debit", min: 60_000, max: 220_000 },
  { name: "Legal & Professional Fees", parentGroup: "Indirect Expenses", side: "debit", min: 40_000, max: 200_000 },
  // Finance (debit)
  { name: "Bank Charges", parentGroup: "Indirect Expenses", side: "debit", min: 8_000, max: 42_000 },
  { name: "Interest on Loan", parentGroup: "Indirect Expenses", side: "debit", min: 120_000, max: 380_000 },
  // Depreciation (debit)
  { name: "Depreciation", parentGroup: "Indirect Expenses", side: "debit", min: 150_000, max: 400_000 },
  // Tax (debit)
  { name: "Income Tax Provision", parentGroup: "Provisions", side: "debit", min: 200_000, max: 700_000 },
  // Balance-sheet / ignore
  { name: "Sundry Debtors", parentGroup: "Current Assets", side: "debit", min: 5_000_000, max: 11_000_000 },
  { name: "Sundry Creditors", parentGroup: "Current Liabilities", side: "credit", min: 3_000_000, max: 8_000_000 },
  { name: "HDFC Bank", parentGroup: "Bank Accounts", side: "debit", min: 1_500_000, max: 6_000_000 },
  { name: "GST Payable", parentGroup: "Duties & Taxes", side: "credit", min: 400_000, max: 1_200_000 },
  { name: "Plant & Machinery", parentGroup: "Fixed Assets", side: "debit", min: 8_000_000, max: 18_000_000 },
];

// --- Period helpers: last 6 completed month labels "YYYY-MM" ------------------
function lastSixMonths(now: Date): string[] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out: string[] = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(Date.UTC(y, m - i + 1, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

async function clearAll() {
  await prisma.tBEntry.deleteMany({});
  await prisma.noteVoucher.deleteMany({});
  await prisma.partyBalance.deleteMany({});
  await prisma.ledgerMapping.deleteMany({});
  await prisma.upload.deleteMany({});
  await prisma.partyAlias.deleteMany({});
  await prisma.company.deleteMany({});
}

async function main() {
  if (process.argv.includes("--clear")) {
    console.log("⚠  --clear: deleting ALL data...");
    await clearAll();
    console.log("✔  Database cleared. No data seeded.");
    return;
  }

  console.log("Seeding dummy data (fabricated — not from real Tally)...");
  await clearAll();

  const months = lastSixMonths(new Date());
  const latest = months[months.length - 1];
  console.log(`Months: ${months.join(", ")}  (latest = ${latest})`);

  // Companies
  const companies: Company[] = [];
  for (const c of COMPANIES) companies.push(await prisma.company.create({ data: c }));
  const [apex, beacon, crest] = companies;

  // Per-company size factor so figures differ but stay internally consistent.
  const scale = new Map<string, number>([
    [apex.id, 1.0],
    [beacon.id, 0.78],
    [crest.id, 1.22],
  ]);

  const tbRows: Prisma.TBEntryCreateManyInput[] = [];
  const uploadRows: Prisma.UploadCreateManyInput[] = [];

  // One deliberate LOSS month so the trend chart's Net Profit/Loss line dips
  // below zero (red) — otherwise every month is a profit and the loss styling
  // is never visible. The 3rd month gets slashed revenue + inflated expenses.
  const lossMonth = months[2];

  // Regular ledgers for every company × month.
  for (const company of companies) {
    const s = scale.get(company.id) ?? 1;
    for (const period of months) {
      uploadRows.push({ companyId: company.id, period, fileType: "TrialBalance" });
      const isLoss = period === lossMonth;
      for (const l of LEDGERS) {
        let amt = Math.round(randBetween(l.min, l.max) * s);
        // In the loss month: cut income (credit/revenue-side) sharply and push
        // up expenses (debit-side P&L) so the group nets a loss.
        if (isLoss) {
          const isIncome = l.side === "credit" && l.parentGroup.includes("Sales");
          const isExpense = l.side === "debit" && l.parentGroup.includes("Expenses");
          if (isIncome) amt = Math.round(amt * 0.45);
          else if (isExpense) amt = Math.round(amt * 1.7);
        }
        tbRows.push({
          companyId: company.id,
          period,
          ledgerName: l.name,
          parentGroup: l.parentGroup,
          debit: l.side === "debit" ? D(amt) : D(0),
          credit: l.side === "credit" ? D(amt) : D(0),
        });
      }
    }
  }

  // --- Inter-company ledgers ------------------------------------------------
  // Seller books "Sales - <Counterparty shortName>" (credit, Revenue).
  // Buyer books "Purchase - <Counterparty shortName>" (debit, COGS).
  // The read-time classifier flags these as inter-company because the ledger
  // name contains another active company's name/shortName.
  //
  // Apex -> Beacon (one per month; latest month is the INTENTIONAL MISMATCH).
  // Beacon -> Crest (clean every month).
  function addIntercompany(
    seller: Company,
    buyer: Company,
    period: string,
    sellAmount: number,
    buyAmount: number
  ) {
    tbRows.push({
      companyId: seller.id,
      period,
      ledgerName: `Sales - ${buyer.shortName}`,
      parentGroup: "Sales Accounts",
      debit: D(0),
      credit: D(sellAmount),
    });
    tbRows.push({
      companyId: buyer.id,
      period,
      ledgerName: `Purchase - ${seller.shortName}`,
      parentGroup: "Purchase Accounts",
      debit: D(buyAmount),
      credit: D(0),
    });
  }

  let mismatchInfo = "";
  for (const period of months) {
    const sale = randBetween(2_000_000, 3_500_000);
    if (period === latest) {
      // Buyer under-records by ₹1,25,000 (> ₹1,000 → banner must fire).
      const buy = sale - 125_000;
      addIntercompany(apex, beacon, period, sale, buy);
      mismatchInfo = `Apex→Beacon ${period}: sales ₹${sale.toLocaleString("en-IN")} vs purchases ₹${buy.toLocaleString("en-IN")} (gap ₹${(sale - buy).toLocaleString("en-IN")})`;
    } else {
      addIntercompany(apex, beacon, period, sale, sale);
    }
    const sale2 = randBetween(1_200_000, 2_400_000);
    addIntercompany(beacon, crest, period, sale2, sale2);
  }

  await prisma.upload.createMany({ data: uploadRows });
  await prisma.tBEntry.createMany({ data: tbRows });

  console.log("\n✔  Seed complete.");
  console.log(`   Companies:        ${companies.length}`);
  console.log(`   Months:           ${months.length}`);
  console.log(`   TB entries:       ${tbRows.length}`);
  console.log(`   Uploads:          ${uploadRows.length}`);
  console.log(`   Intentional mismatch: ${mismatchInfo}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
