/**
 * Report sample data — populates the Sales, Purchases, Debit/Credit Notes,
 * Debtors, Creditors, and Other Expenses boards with realistic dummy data.
 *
 * Reads the companies + months already in the DB (seeded by seed.ts), then fills:
 *   - SalesVoucher / PurchaseVoucher  (register-style vouchers, incl. inter-company)
 *   - NoteVoucher                     (Debit/Credit notes)
 *   - PartyBalance                    (Debtors + Creditors with ageing buckets)
 *   - ExpenseEntry                    (indirect expenses)
 *
 * ⚠ DUMMY DATA. Deterministic (seeded PRNG) so reruns are reproducible.
 * Run standalone: npx tsx prisma/seed-reports.ts   (or called from seed.ts)
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

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
const rng = makeRng(424242);
const rand = (min: number, max: number) => Math.round(min + rng() * (max - min));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

// Realistic Indian customer/vendor party names for the boards.
const CUSTOMERS = [
  "Reliance Retail Ltd", "Tata Steel Ltd", "Godrej Consumer Products",
  "Asian Paints Ltd", "Larsen & Toubro", "Mahindra Auto Parts",
  "Bajaj Electricals", "Havells India Ltd", "Berger Paints", "Kirloskar Bros",
  "Supreme Industries", "Finolex Cables", "Blue Star Ltd", "Voltas Ltd",
];
const VENDORS = [
  "Jindal Steel & Power", "Hindalco Industries", "Ambuja Cements",
  "SRF Chemicals", "Aarti Industries", "Deepak Nitrite", "Balaji Polymers",
  "Gujarat Fluoro", "Meghmani Organics", "Vinati Organics", "PI Industries",
  "Coromandel International", "UPL Ltd", "Bharat Rasayan",
];

// day-of-month → a Date for a given YYYY-MM period.
function dayIn(period: string, day: number): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, Math.min(day, 28)));
}

async function main() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, shortName: true },
  });
  if (companies.length === 0) {
    console.error("No companies found. Run `npm run seed` first.");
    process.exit(1);
  }
  const periods = (
    await prisma.tBEntry.findMany({ distinct: ["period"], select: { period: true }, orderBy: { period: "asc" } })
  ).map((r) => r.period);
  if (periods.length === 0) {
    console.error("No periods found. Run `npm run seed` first.");
    process.exit(1);
  }

  // Wipe existing report data so reruns are clean.
  await prisma.salesVoucher.deleteMany({});
  await prisma.purchaseVoucher.deleteMany({});
  await prisma.noteVoucher.deleteMany({});
  await prisma.partyBalance.deleteMany({});
  await prisma.expenseEntry.deleteMany({});
  await prisma.gstEntry.deleteMany({});

  const otherCompanyNames = (selfId: string) =>
    companies.filter((c) => c.id !== selfId).map((c) => c.shortName);

  const sales: Prisma.SalesVoucherCreateManyInput[] = [];
  const purchases: Prisma.PurchaseVoucherCreateManyInput[] = [];
  const notes: Prisma.NoteVoucherCreateManyInput[] = [];
  const parties: Prisma.PartyBalanceCreateManyInput[] = [];
  const expenses: Prisma.ExpenseEntryCreateManyInput[] = [];
  const gst: Prisma.GstEntryCreateManyInput[] = [];

  const EXPENSE_LEDGERS: [string, string][] = [
    ["Office Rent", "Admin & Other"],
    ["Legal & Professional Fees", "Admin & Other"],
    ["Printing & Stationery", "Admin & Other"],
    ["Travelling & Conveyance", "Admin & Other"],
    ["Telephone & Internet", "Admin & Other"],
    ["Advertisement & Marketing", "Selling & Distribution"],
    ["Freight Outward", "Selling & Distribution"],
    ["Repairs & Maintenance", "Admin & Other"],
    ["Insurance", "Admin & Other"],
    ["Bank Charges", "Finance"],
  ];

  for (const co of companies) {
    const others = otherCompanyNames(co.id);
    for (const period of periods) {
      // --- Sales vouchers: 5-8 per company/month, some inter-company ---------
      let salesTaxable = 0;
      const nSales = rand(5, 8);
      for (let i = 0; i < nSales; i++) {
        const ic = rng() < 0.18 && others.length > 0;
        const amt = rand(150_000, 3_500_000);
        salesTaxable += amt;
        sales.push({
          companyId: co.id,
          period,
          date: dayIn(period, rand(1, 28)),
          voucherType: ic ? "Sales - Group" : pick(["Sales", "Sales - Local", "Sales - Export"]),
          voucherNo: `S/${period.slice(5)}/${100 + i}`,
          partyName: ic ? pick(others) + " (Group)" : pick(CUSTOMERS),
          isInterCompany: ic,
          amount: D(amt),
        });
      }

      // --- Purchase vouchers -------------------------------------------------
      let purchaseTaxable = 0;
      const nPur = rand(4, 7);
      for (let i = 0; i < nPur; i++) {
        const ic = rng() < 0.15 && others.length > 0;
        const amt = rand(120_000, 2_800_000);
        purchaseTaxable += amt;
        purchases.push({
          companyId: co.id,
          period,
          date: dayIn(period, rand(1, 28)),
          voucherType: ic ? "Purchase - Group" : pick(["Purchase", "Purchase - Raw Material", "Purchase - Import"]),
          voucherNo: `P/${period.slice(5)}/${200 + i}`,
          partyName: ic ? pick(others) + " (Group)" : pick(VENDORS),
          isInterCompany: ic,
          amount: D(amt),
        });
      }

      // --- GST: Output (on sales) + Input (on purchases). --------------------
      // Split each into IGST vs CGST+SGST (intra-state = CGST+SGST at half each).
      // Standard 18% rate for the demo.
      const RATE = 18;
      function addGst(kind: "Output" | "Input", taxable: number) {
        // ~40% of turnover is inter-state (IGST), ~60% intra-state (CGST+SGST).
        const igstBase = Math.round(taxable * 0.4);
        const intraBase = taxable - igstBase;
        // IGST @18%
        gst.push({
          companyId: co.id, period, kind, component: "IGST", ratePct: RATE,
          taxableValue: D(igstBase), gstAmount: D(Math.round(igstBase * RATE / 100)),
        });
        // CGST @9% + SGST @9% on the intra-state base
        gst.push({
          companyId: co.id, period, kind, component: "CGST", ratePct: RATE / 2,
          taxableValue: D(intraBase), gstAmount: D(Math.round(intraBase * (RATE / 2) / 100)),
        });
        gst.push({
          companyId: co.id, period, kind, component: "SGST", ratePct: RATE / 2,
          taxableValue: D(intraBase), gstAmount: D(Math.round(intraBase * (RATE / 2) / 100)),
        });
      }
      addGst("Output", salesTaxable);
      addGst("Input", purchaseTaxable);

      // --- Debit/Credit notes: 2-4 per company/month -------------------------
      const nNotes = rand(2, 4);
      for (let i = 0; i < nNotes; i++) {
        const isDebit = rng() < 0.5;
        notes.push({
          companyId: co.id,
          period,
          date: dayIn(period, rand(1, 28)),
          voucherType: isDebit ? "Debit Note" : "Credit Note",
          voucherNo: `${isDebit ? "DN" : "CN"}/${period.slice(5)}/${10 + i}`,
          partyName: pick(isDebit ? VENDORS : CUSTOMERS),
          amount: D(rand(15_000, 350_000)),
        });
      }

      // --- Party balances (Debtors + Creditors) with ageing ------------------
      // Debtors: 4-6 customers owing money; Creditors: 3-5 vendors owed.
      const nDebtors = rand(4, 6);
      const usedDebtors = new Set<string>();
      for (let i = 0; i < nDebtors; i++) {
        let name = pick(CUSTOMERS);
        while (usedDebtors.has(name)) name = pick(CUSTOMERS);
        usedDebtors.add(name);
        const b0 = rand(50_000, 1_800_000);
        const b1 = rand(0, 900_000);
        const b2 = rand(0, 500_000);
        const b3 = rand(0, 300_000);
        parties.push({
          companyId: co.id, period, side: "Debtor", partyName: name,
          closingBalance: D(b0 + b1 + b2 + b3),
          ageing0_30: D(b0), ageing31_60: D(b1), ageing61_90: D(b2), ageing90plus: D(b3),
        });
      }
      const nCred = rand(3, 5);
      const usedCred = new Set<string>();
      for (let i = 0; i < nCred; i++) {
        let name = pick(VENDORS);
        while (usedCred.has(name)) name = pick(VENDORS);
        usedCred.add(name);
        const b0 = rand(40_000, 1_500_000);
        const b1 = rand(0, 700_000);
        const b2 = rand(0, 400_000);
        const b3 = rand(0, 250_000);
        parties.push({
          companyId: co.id, period, side: "Creditor", partyName: name,
          closingBalance: D(b0 + b1 + b2 + b3),
          ageing0_30: D(b0), ageing31_60: D(b1), ageing61_90: D(b2), ageing90plus: D(b3),
        });
      }

      // --- Other expenses ----------------------------------------------------
      for (const [ledger, category] of EXPENSE_LEDGERS) {
        // month-to-month variation so the MoM flags have something to catch
        expenses.push({
          companyId: co.id, period, ledgerName: ledger, category,
          amount: D(rand(20_000, 380_000)),
        });
      }
    }
  }

  await prisma.salesVoucher.createMany({ data: sales });
  await prisma.purchaseVoucher.createMany({ data: purchases });
  await prisma.noteVoucher.createMany({ data: notes });
  await prisma.partyBalance.createMany({ data: parties });
  await prisma.expenseEntry.createMany({ data: expenses });
  await prisma.gstEntry.createMany({ data: gst });

  console.log("✔  Report sample data seeded:");
  console.log(`   Sales vouchers:    ${sales.length}`);
  console.log(`   Purchase vouchers: ${purchases.length}`);
  console.log(`   Debit/Credit notes:${notes.length}`);
  console.log(`   Party balances:    ${parties.length} (debtors + creditors)`);
  console.log(`   Expense entries:   ${expenses.length}`);
  console.log(`   GST entries:       ${gst.length} (Output + Input, IGST/CGST/SGST)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
