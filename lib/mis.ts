/**
 * Consolidation / MIS query layer.
 *
 * Reads seeded TBEntry rows and builds:
 *   - the list of months present in the DB (for the global month selector),
 *   - per-company data coverage for a month (coverage dots),
 *   - the consolidated P&L for a month (per-company columns + Eliminations +
 *     Consolidated), applying the COMPANY SCOPE RULE,
 *   - the inter-company elimination figures + mismatch check,
 *   - the 6-month trend series (revenue, gross %, net %).
 *
 * ⚠ Uses the PROVISIONAL read-time classifier (lib/pl-classify.ts). Amounts are
 * summed from Prisma Decimals converted to JS numbers at the aggregation edge.
 */

import type { PLLine } from "@/lib/enums";
import { prisma } from "./prisma";
import {
  classifyPLLine,
  isInterCompanyLedger,
  otherCompanyTokens,
} from "./pl-classify";

export type CompanyLite = {
  id: string;
  name: string;
  shortName: string;
  chartColor: string;
  isActive: boolean;
};

// A P&L line's net contribution is signed so it can be summed directly:
// income lines are positive, expense lines negative, in P&L terms we track the
// magnitude per line and combine with explicit signs in the subtotal math.

export const PL_LINE_ORDER: PLLine[] = [
  "Revenue",
  "PurchasesCOGS",
  "DirectExpenses",
  "Employee",
  "SellingDistribution",
  "AdminOther",
  "OtherIncome",
  "Finance",
  "Depreciation",
  "Tax",
];

export const PL_LINE_LABEL: Record<PLLine, string> = {
  Revenue: "Revenue",
  OtherIncome: "Other Income",
  PurchasesCOGS: "Purchases / COGS",
  DirectExpenses: "Direct Expenses",
  Employee: "Employee",
  SellingDistribution: "Selling & Distribution",
  AdminOther: "Admin & Other",
  Finance: "Finance",
  Depreciation: "Depreciation",
  Tax: "Tax",
  BalanceSheetOrIgnore: "Balance Sheet / Ignore",
};

// --- Available months --------------------------------------------------------
export async function getMonths(): Promise<string[]> {
  const rows = await prisma.tBEntry.findMany({
    distinct: ["period"],
    select: { period: true },
    orderBy: { period: "asc" },
  });
  return rows.map((r) => r.period);
}

export async function getActiveCompanies(): Promise<CompanyLite[]> {
  return prisma.company.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, shortName: true, chartColor: true, isActive: true },
  });
}

export async function getAllCompanies(): Promise<CompanyLite[]> {
  return prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, shortName: true, chartColor: true, isActive: true },
  });
}

// --- Coverage: which active companies have TB data for a month ---------------
export interface Coverage {
  companyId: string;
  shortName: string;
  hasData: boolean;
}

export async function getCoverage(period: string): Promise<Coverage[]> {
  const companies = await getActiveCompanies();
  const present = await prisma.tBEntry.findMany({
    where: { period },
    distinct: ["companyId"],
    select: { companyId: true },
  });
  const set = new Set(present.map((p) => p.companyId));
  return companies.map((c) => ({
    companyId: c.id,
    shortName: c.shortName,
    hasData: set.has(c.id),
  }));
}

// --- P&L line amounts for one company in one month ---------------------------
// Returns, per P&L line, the total magnitude (income as positive amounts,
// expenses as positive amounts) AND the inter-company portion of each line.
interface CompanyPL {
  companyId: string;
  hasData: boolean;
  // magnitude by line (always positive)
  byLine: Record<PLLine, number>;
  // inter-company magnitude within Revenue and PurchasesCOGS (what gets eliminated)
  icRevenue: number;
  icPurchases: number;
}

function emptyByLine(): Record<PLLine, number> {
  return {
    Revenue: 0,
    OtherIncome: 0,
    PurchasesCOGS: 0,
    DirectExpenses: 0,
    Employee: 0,
    SellingDistribution: 0,
    AdminOther: 0,
    Finance: 0,
    Depreciation: 0,
    Tax: 0,
    BalanceSheetOrIgnore: 0,
  };
}

// A minimal TB entry row (fetched in bulk, then computed in memory).
interface TBRow {
  companyId: string;
  ledgerName: string;
  debit: unknown;
  credit: unknown;
}

// Pure in-memory computation — takes pre-fetched entries for ONE company in ONE
// period. No DB access, so callers can bulk-fetch once and compute many months.
function computeCompanyPL(
  company: CompanyLite,
  allCompanies: CompanyLite[],
  entries: TBRow[]
): CompanyPL {
  const byLine = emptyByLine();
  let icRevenue = 0;
  let icPurchases = 0;
  const tokens = otherCompanyTokens(allCompanies, company.id);

  for (const e of entries) {
    const line = classifyPLLine(e.ledgerName);
    if (line === "BalanceSheetOrIgnore") continue;

    const debit = Number(e.debit);
    const credit = Number(e.credit);
    // Income lines carry their amount on credit; expense lines on debit.
    const isIncome = line === "Revenue" || line === "OtherIncome";
    const magnitude = isIncome ? credit - debit : debit - credit;
    byLine[line] += magnitude;

    if (isInterCompanyLedger(e.ledgerName, tokens)) {
      if (line === "Revenue") icRevenue += magnitude;
      else if (line === "PurchasesCOGS") icPurchases += magnitude;
    }
  }

  return {
    companyId: company.id,
    hasData: entries.length > 0,
    byLine,
    icRevenue,
    icPurchases,
  };
}

// --- Consolidated P&L for a month --------------------------------------------
export interface PLColumn {
  key: string; // company id, or "elim" / "consol"
  label: string;
  chartColor?: string;
  isElimination?: boolean;
  isConsolidated?: boolean;
  byLine: Record<PLLine, number>;
  // Derived subtotals
  grossProfit: number;
  ebitda: number;
  pbt: number;
  netProfit: number;
}

export interface ConsolidatedPL {
  period: string;
  columns: PLColumn[]; // company columns (with data) + elimination + consolidated
  // Elimination strip figures
  icTurnoverEliminated: number;
  icPurchasesEliminated: number;
  // Mismatch: group IC sales vs IC purchases
  icSalesTotal: number;
  icPurchasesTotal: number;
  icGap: number; // icSalesTotal - icPurchasesTotal
  hasMismatch: boolean; // |gap| > 1000
}

const MISMATCH_THRESHOLD = 1000;

function subtotalsFor(byLine: Record<PLLine, number>) {
  const grossProfit =
    byLine.Revenue - byLine.PurchasesCOGS - byLine.DirectExpenses;
  const ebitda =
    grossProfit -
    byLine.Employee -
    byLine.SellingDistribution -
    byLine.AdminOther;
  const pbt = ebitda + byLine.OtherIncome - byLine.Finance - byLine.Depreciation;
  const netProfit = pbt - byLine.Tax;
  return { grossProfit, ebitda, pbt, netProfit };
}

// Build the ConsolidatedPL for one period from already-computed per-company PLs.
// Pure — no DB access.
function assembleConsolidatedPL(
  period: string,
  active: CompanyLite[],
  perCompany: CompanyPL[]
): ConsolidatedPL {
  // Company columns: only those WITH data this month.
  const columns: PLColumn[] = [];
  for (let i = 0; i < active.length; i++) {
    const c = active[i];
    const pl = perCompany[i];
    if (!pl.hasData) continue;
    columns.push({
      key: c.id,
      label: c.shortName,
      chartColor: c.chartColor,
      byLine: pl.byLine,
      ...subtotalsFor(pl.byLine),
    });
  }

  // Elimination column: remove inter-company Revenue & Purchases.
  const icRevenueTotal = perCompany.reduce((a, p) => a + p.icRevenue, 0);
  const icPurchasesTotal = perCompany.reduce((a, p) => a + p.icPurchases, 0);

  const elimByLine = emptyByLine();
  elimByLine.Revenue = -icRevenueTotal;
  elimByLine.PurchasesCOGS = -icPurchasesTotal;
  const elimCol: PLColumn = {
    key: "elim",
    label: "Eliminations",
    isElimination: true,
    byLine: elimByLine,
    ...subtotalsFor(elimByLine),
  };

  // Consolidated column: sum of company columns + eliminations.
  const consolByLine = emptyByLine();
  for (const line of Object.keys(consolByLine) as PLLine[]) {
    let sum = elimByLine[line];
    for (const col of columns) sum += col.byLine[line];
    consolByLine[line] = sum;
  }
  const consolCol: PLColumn = {
    key: "consol",
    label: "Consolidated",
    isConsolidated: true,
    byLine: consolByLine,
    ...subtotalsFor(consolByLine),
  };

  const icGap = icRevenueTotal - icPurchasesTotal;

  return {
    period,
    columns: [...columns, elimCol, consolCol],
    icTurnoverEliminated: icRevenueTotal,
    icPurchasesEliminated: icPurchasesTotal,
    icSalesTotal: icRevenueTotal,
    icPurchasesTotal,
    icGap,
    hasMismatch: Math.abs(icGap) > MISMATCH_THRESHOLD,
  };
}

// Group bulk-fetched TB rows by companyId → per-company entry arrays.
function groupByCompany(active: CompanyLite[], rows: TBRow[]): Map<string, TBRow[]> {
  const map = new Map<string, TBRow[]>();
  for (const c of active) map.set(c.id, []);
  for (const r of rows) map.get(r.companyId)?.push(r);
  return map;
}

export async function getConsolidatedPL(period: string): Promise<ConsolidatedPL> {
  const active = await getActiveCompanies();
  // ONE query for all companies' entries this period (was 1 + N).
  const rows = await prisma.tBEntry.findMany({
    where: { period },
    select: { companyId: true, ledgerName: true, debit: true, credit: true },
  });
  const byCompany = groupByCompany(active, rows);
  const perCompany = active.map((c) =>
    computeCompanyPL(c, active, byCompany.get(c.id) ?? [])
  );
  return assembleConsolidatedPL(period, active, perCompany);
}

// --- KPIs for the selected month (consolidated) ------------------------------
export interface OverviewKPIs {
  consolidatedRevenue: number;
  grossMarginPct: number;
  ebitdaMarginPct: number;
  netProfit: number;
}

export function kpisFromConsolidated(pl: ConsolidatedPL): OverviewKPIs {
  const consol = pl.columns.find((c) => c.isConsolidated);
  if (!consol) {
    return { consolidatedRevenue: 0, grossMarginPct: 0, ebitdaMarginPct: 0, netProfit: 0 };
  }
  const rev = consol.byLine.Revenue;
  return {
    consolidatedRevenue: rev,
    grossMarginPct: rev ? (consol.grossProfit / rev) * 100 : 0,
    ebitdaMarginPct: rev ? (consol.ebitda / rev) * 100 : 0,
    netProfit: consol.netProfit,
  };
}

// --- Trend across all months (consolidated) ----------------------------------
export interface TrendPoint {
  period: string;
  revenue: number;
  grossPct: number;
  netPct: number;
  grossProfit: number; // consolidated ₹ amount
  netProfit: number; // consolidated ₹ amount (negative = loss)
}

export async function getTrend(): Promise<TrendPoint[]> {
  const active = await getActiveCompanies();
  // TWO queries total (was 6 × (1 + N) ≈ 24): all months in one shot, then
  // compute every month's consolidation in memory.
  const allRows = await prisma.tBEntry.findMany({
    select: { companyId: true, period: true, ledgerName: true, debit: true, credit: true },
  });

  // Group rows by period, then by company.
  const byPeriod = new Map<string, TBRow[]>();
  for (const r of allRows) {
    const arr = byPeriod.get(r.period);
    if (arr) arr.push(r);
    else byPeriod.set(r.period, [r]);
  }
  const months = [...byPeriod.keys()].sort();

  const points: TrendPoint[] = [];
  for (const period of months) {
    const rows = byPeriod.get(period) ?? [];
    const byCompany = groupByCompany(active, rows);
    const perCompany = active.map((c) =>
      computeCompanyPL(c, active, byCompany.get(c.id) ?? [])
    );
    const pl = assembleConsolidatedPL(period, active, perCompany);
    const consol = pl.columns.find((c) => c.isConsolidated);
    const rev = consol?.byLine.Revenue ?? 0;
    const grossProfit = consol?.grossProfit ?? 0;
    const netProfit = consol?.netProfit ?? 0;
    points.push({
      period,
      revenue: rev,
      grossPct: rev ? (grossProfit / rev) * 100 : 0,
      netPct: rev ? (netProfit / rev) * 100 : 0,
      grossProfit,
      netProfit,
    });
  }
  return points;
}

// --- Companies page data -----------------------------------------------------
export interface CompanyCard {
  id: string;
  name: string;
  shortName: string;
  chartColor: string;
  isActive: boolean;
  monthsPresent: number;
  latestMonth: string | null;
}

export async function getCompanyCards(): Promise<CompanyCard[]> {
  const companies = await getAllCompanies();
  const cards: CompanyCard[] = [];
  for (const c of companies) {
    const periods = await prisma.tBEntry.findMany({
      where: { companyId: c.id },
      distinct: ["period"],
      select: { period: true },
      orderBy: { period: "desc" },
    });
    cards.push({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      chartColor: c.chartColor,
      isActive: c.isActive,
      monthsPresent: periods.length,
      latestMonth: periods[0]?.period ?? null,
    });
  }
  return cards;
}
