// Enum-like unions stored as String in SQLite (Prisma enums aren't supported on
// SQLite). These are the single source of truth for the allowed values and are
// used across the app in place of `@prisma/client` enum types.

export type PLLine =
  | "Revenue"
  | "OtherIncome"
  | "PurchasesCOGS"
  | "DirectExpenses"
  | "Employee"
  | "SellingDistribution"
  | "AdminOther"
  | "Finance"
  | "Depreciation"
  | "Tax"
  | "BalanceSheetOrIgnore";

export type FileType = "TrialBalance" | "NoteDayBook" | "Outstandings";

export type PartySide = "Debtor" | "Creditor";

export const PL_LINES: PLLine[] = [
  "Revenue",
  "OtherIncome",
  "PurchasesCOGS",
  "DirectExpenses",
  "Employee",
  "SellingDistribution",
  "AdminOther",
  "Finance",
  "Depreciation",
  "Tax",
  "BalanceSheetOrIgnore",
];
