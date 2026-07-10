/**
 * Query layer for the register / party / expense report boards. Each function
 * is scoped by month and by company ("all" = group view, or a single company id).
 *
 * COMPANY SCOPE RULE:
 *   - "all"  → group view. For Sales/Purchases we also compute the inter-company
 *     portion so it can be shown separately (eliminations), matching the Overview.
 *   - single → that company only (inter-company included).
 */
import { prisma } from "./prisma";

export type Scope = string; // "all" or a company id

function companyWhere(scope: Scope) {
  return scope === "all" ? {} : { companyId: scope };
}

// --- Sales / Purchases (register vouchers) -----------------------------------
export interface VoucherRow {
  id: string;
  date: string; // ISO
  companyShort: string;
  voucherType: string;
  voucherNo: string;
  partyName: string;
  isInterCompany: boolean;
  amount: number;
}
export interface VoucherReport {
  rows: VoucherRow[];
  total: number;
  interCompanyTotal: number;
  count: number;
}

async function loadCompanyShorts(): Promise<Map<string, string>> {
  const cs = await prisma.company.findMany({ select: { id: true, shortName: true } });
  return new Map(cs.map((c) => [c.id, c.shortName]));
}

export async function getSales(period: string, scope: Scope): Promise<VoucherReport> {
  const shorts = await loadCompanyShorts();
  const rows = await prisma.salesVoucher.findMany({
    where: { period, ...companyWhere(scope) },
    orderBy: { date: "asc" },
  });
  return mapVouchers(rows, shorts);
}

export async function getPurchases(period: string, scope: Scope): Promise<VoucherReport> {
  const shorts = await loadCompanyShorts();
  const rows = await prisma.purchaseVoucher.findMany({
    where: { period, ...companyWhere(scope) },
    orderBy: { date: "asc" },
  });
  return mapVouchers(rows, shorts);
}

function mapVouchers(
  rows: {
    id: string; date: Date; companyId: string; voucherType: string;
    voucherNo: string; partyName: string; isInterCompany: boolean; amount: unknown;
  }[],
  shorts: Map<string, string>
): VoucherReport {
  const out: VoucherRow[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    companyShort: shorts.get(r.companyId) ?? "?",
    voucherType: r.voucherType,
    voucherNo: r.voucherNo,
    partyName: r.partyName,
    isInterCompany: r.isInterCompany,
    amount: Number(r.amount),
  }));
  const total = out.reduce((a, r) => a + r.amount, 0);
  const interCompanyTotal = out.filter((r) => r.isInterCompany).reduce((a, r) => a + r.amount, 0);
  return { rows: out, total, interCompanyTotal, count: out.length };
}

// --- Debit/Credit notes ------------------------------------------------------
export interface NoteRow {
  id: string;
  date: string;
  companyShort: string;
  voucherType: string; // Debit Note | Credit Note
  voucherNo: string;
  partyName: string;
  amount: number;
}
export interface NoteReport {
  rows: NoteRow[];
  debitTotal: number;
  creditTotal: number;
  count: number;
}

export async function getNotes(period: string, scope: Scope): Promise<NoteReport> {
  const shorts = await loadCompanyShorts();
  const rows = await prisma.noteVoucher.findMany({
    where: { period, ...companyWhere(scope) },
    orderBy: { date: "asc" },
  });
  const out: NoteRow[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    companyShort: shorts.get(r.companyId) ?? "?",
    voucherType: r.voucherType,
    voucherNo: r.voucherNo,
    partyName: r.partyName,
    amount: Number(r.amount),
  }));
  const debitTotal = out.filter((r) => /debit/i.test(r.voucherType)).reduce((a, r) => a + r.amount, 0);
  const creditTotal = out.filter((r) => /credit/i.test(r.voucherType)).reduce((a, r) => a + r.amount, 0);
  return { rows: out, debitTotal, creditTotal, count: out.length };
}

// --- Debtors / Creditors (party balances + ageing) ---------------------------
export interface PartyRow {
  id: string;
  companyShort: string;
  partyName: string;
  closing: number;
  a0: number; // 0-30
  a1: number; // 31-60
  a2: number; // 61-90
  a3: number; // 90+
}
export interface PartyReport {
  rows: PartyRow[];
  total: number;
  ageing: { a0: number; a1: number; a2: number; a3: number };
  count: number;
}

export async function getParties(
  period: string,
  scope: Scope,
  side: "Debtor" | "Creditor"
): Promise<PartyReport> {
  const shorts = await loadCompanyShorts();
  const rows = await prisma.partyBalance.findMany({
    where: { period, side, ...companyWhere(scope) },
    orderBy: { closingBalance: "desc" },
  });
  const out: PartyRow[] = rows.map((r) => ({
    id: r.id,
    companyShort: shorts.get(r.companyId) ?? "?",
    partyName: r.partyName,
    closing: Number(r.closingBalance),
    a0: Number(r.ageing0_30),
    a1: Number(r.ageing31_60),
    a2: Number(r.ageing61_90),
    a3: Number(r.ageing90plus),
  }));
  const total = out.reduce((a, r) => a + r.closing, 0);
  const ageing = out.reduce(
    (acc, r) => ({ a0: acc.a0 + r.a0, a1: acc.a1 + r.a1, a2: acc.a2 + r.a2, a3: acc.a3 + r.a3 }),
    { a0: 0, a1: 0, a2: 0, a3: 0 }
  );
  return { rows: out, total, ageing, count: out.length };
}

// --- Other expenses (with month-on-month flag) -------------------------------
export interface ExpenseRow {
  ledgerName: string;
  category: string;
  amount: number;
  prevAmount: number | null;
  momPct: number | null; // month-on-month % change
}
export interface ExpenseReport {
  rows: ExpenseRow[];
  total: number;
  prevTotal: number | null;
}

function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getExpenses(period: string, scope: Scope): Promise<ExpenseReport> {
  const prev = prevPeriod(period);
  const [cur, previous] = await Promise.all([
    prisma.expenseEntry.findMany({ where: { period, ...companyWhere(scope) } }),
    prisma.expenseEntry.findMany({ where: { period: prev, ...companyWhere(scope) } }),
  ]);

  // Sum by ledger (across companies in "all" scope).
  const sumBy = (rows: { ledgerName: string; category: string; amount: unknown }[]) => {
    const m = new Map<string, { category: string; amount: number }>();
    for (const r of rows) {
      const e = m.get(r.ledgerName) ?? { category: r.category, amount: 0 };
      e.amount += Number(r.amount);
      m.set(r.ledgerName, e);
    }
    return m;
  };
  const curMap = sumBy(cur);
  const prevMap = sumBy(previous);

  const rows: ExpenseRow[] = [...curMap.entries()]
    .map(([ledgerName, { category, amount }]) => {
      const prevAmount = prevMap.has(ledgerName) ? prevMap.get(ledgerName)!.amount : null;
      const momPct = prevAmount && prevAmount !== 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
      return { ledgerName, category, amount, prevAmount, momPct };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = rows.reduce((a, r) => a + r.amount, 0);
  const prevTotal = previous.length ? previous.reduce((a, r) => a + Number(r.amount), 0) : null;
  return { rows, total, prevTotal };
}

// --- GST (Output = collected on sales; Input = paid on purchases) ------------
export interface GstComponent {
  component: string; // IGST | CGST | SGST
  outputTaxable: number;
  outputGst: number;
  inputTaxable: number;
  inputGst: number;
  netGst: number; // output − input
}
export interface GstReport {
  components: GstComponent[];
  outputTotal: number; // Σ GST collected (outgoing / payable)
  inputTotal: number; // Σ GST paid (ingoing / credit)
  netPayable: number; // output − input (positive = you owe; negative = refund)
  outputTaxableTotal: number;
  inputTaxableTotal: number;
}

export async function getGst(period: string, scope: Scope): Promise<GstReport> {
  const rows = await prisma.gstEntry.findMany({
    where: { period, ...companyWhere(scope) },
  });

  const order = ["IGST", "CGST", "SGST"];
  const map = new Map<string, GstComponent>();
  for (const c of order) {
    map.set(c, { component: c, outputTaxable: 0, outputGst: 0, inputTaxable: 0, inputGst: 0, netGst: 0 });
  }
  for (const r of rows) {
    const e = map.get(r.component) ?? {
      component: r.component, outputTaxable: 0, outputGst: 0, inputTaxable: 0, inputGst: 0, netGst: 0,
    };
    if (r.kind === "Output") {
      e.outputTaxable += Number(r.taxableValue);
      e.outputGst += Number(r.gstAmount);
    } else {
      e.inputTaxable += Number(r.taxableValue);
      e.inputGst += Number(r.gstAmount);
    }
    map.set(r.component, e);
  }
  const components = order.map((c) => {
    const e = map.get(c)!;
    e.netGst = e.outputGst - e.inputGst;
    return e;
  });

  const outputTotal = components.reduce((a, c) => a + c.outputGst, 0);
  const inputTotal = components.reduce((a, c) => a + c.inputGst, 0);
  return {
    components,
    outputTotal,
    inputTotal,
    netPayable: outputTotal - inputTotal,
    outputTaxableTotal: components.reduce((a, c) => a + c.outputTaxable, 0),
    inputTaxableTotal: components.reduce((a, c) => a + c.inputTaxable, 0),
  };
}
