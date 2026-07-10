// Sidebar navigation config. `real: false` items render a placeholder page.
export interface NavItem {
  href: string;
  label: string;
  icon: string; // key into components/icons.tsx
  real: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: "overview", real: true },
  { href: "/sales", label: "Sales", icon: "sales", real: false },
  { href: "/purchases", label: "Purchases", icon: "purchases", real: false },
  { href: "/notes", label: "Debit/Credit Notes", icon: "notes", real: false },
  { href: "/debtors", label: "Debtors", icon: "debtors", real: false },
  { href: "/creditors", label: "Creditors", icon: "creditors", real: false },
  { href: "/other-expenses", label: "Other Expenses", icon: "expenses", real: false },
  { href: "/gst", label: "GST", icon: "gst", real: true },
  { href: "/uploads", label: "Uploads", icon: "uploads", real: false },
  { href: "/companies", label: "Companies", icon: "companies", real: true },
  { href: "/settings", label: "Settings", icon: "settings", real: false },
];
