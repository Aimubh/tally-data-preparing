/**
 * ⚠ PROVISIONAL read-time P&L classification.
 *
 * Step 2 derives each ledger's P&L line from KEYWORD RULES applied when a report
 * is read — the persistent LedgerMapping table is populated later, with the
 * upload flow. Until then this is the single source of truth for "which P&L line
 * does this ledger belong to", and it MUST be treated as provisional: it is
 * heuristic and will be superseded by explicit mappings validated against real
 * Tally exports.
 *
 * Inter-company detection is also read-time here: a ledger is inter-company if
 * its name contains the name or shortName of another ACTIVE company.
 */

import type { PLLine } from "@/lib/enums";

// Ordered rules: first match wins. Each rule is (line, keywords[]). Keywords are
// lowercased substrings tested against the ledger name. Order matters — more
// specific lines (e.g. Finance "interest on loan") are checked before broad ones.
const RULES: { line: PLLine; keywords: string[] }[] = [
  // Revenue
  { line: "Revenue", keywords: ["sales", "revenue", "turnover"] },
  // Other Income (before generic income words)
  { line: "OtherIncome", keywords: ["interest received", "discount received", "other income", "rent received", "commission received", "indirect income"] },
  // Purchases / COGS
  { line: "PurchasesCOGS", keywords: ["purchase", "cogs", "cost of goods", "raw material", "consumable"] },
  // Depreciation (before Admin/Direct catch-alls)
  { line: "Depreciation", keywords: ["depreciation", "amortis", "amortiz"] },
  // Finance
  { line: "Finance", keywords: ["bank charges", "interest on loan", "interest paid", "finance cost", "loan processing", "interest expense"] },
  // Tax
  { line: "Tax", keywords: ["income tax", "tax provision", "provision for tax", "deferred tax"] },
  // Employee
  { line: "Employee", keywords: ["salar", "wages", "staff", "employee", "pf ", "esic", "gratuity", "bonus"] },
  // Selling & Distribution
  { line: "SellingDistribution", keywords: ["advertis", "marketing", "freight outward", "distribution", "selling", "sales promotion", "commission paid", "brokerage"] },
  // Direct Expenses
  { line: "DirectExpenses", keywords: ["freight & cartage inward", "freight inward", "carriage inward", "power & fuel", "power and fuel", "factory", "direct expense", "wages - direct"] },
  // Admin & Other (broad catch for indirect expenses)
  { line: "AdminOther", keywords: ["rent", "office", "legal", "professional", "audit", "printing", "stationery", "telephone", "internet", "travel", "conveyance", "repairs", "insurance", "misc", "general expense", "admin"] },
  // Balance-sheet / ignore
  { line: "BalanceSheetOrIgnore", keywords: ["debtors", "creditors", "bank", "cash", "gst", "tds", "duties", "taxes payable", "plant", "machinery", "fixed asset", "current asset", "current liab", "loan", "capital", "reserve", "provision", "deposit", "advance"] },
];

/**
 * Classify a ledger name to a P&L line via keyword rules.
 * Falls back to AdminOther for unrecognised expense-like ledgers so nothing is
 * silently dropped; the caller can surface "unclassified" if needed.
 */
export function classifyPLLine(ledgerName: string): PLLine {
  const n = ledgerName.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.line;
  }
  // Unknown: treat as Admin & Other (an expense bucket) rather than dropping.
  return "AdminOther";
}

/**
 * Detect whether a ledger is inter-company: its name contains the name or
 * shortName of ANOTHER company (not its own). `others` is the list of the other
 * active companies' identifying strings (name + shortName), lowercased.
 */
export function isInterCompanyLedger(
  ledgerName: string,
  otherCompanyTokens: string[]
): boolean {
  const n = ledgerName.toLowerCase();
  return otherCompanyTokens.some((tok) => tok.length > 0 && n.includes(tok));
}

/**
 * Build the set of lowercase tokens (name + shortName) for every company EXCEPT
 * `selfId`, used to detect inter-company ledgers on that company's TB.
 */
export function otherCompanyTokens(
  companies: { id: string; name: string; shortName: string }[],
  selfId: string
): string[] {
  const tokens: string[] = [];
  for (const c of companies) {
    if (c.id === selfId) continue;
    tokens.push(c.shortName.toLowerCase());
    tokens.push(c.name.toLowerCase());
  }
  return tokens;
}
