# Group MIS Console

A consolidation MIS (Management Information System) for a business group whose
companies keep their books in **Tally**. It ingests Tally exports, consolidates
all companies into one view, **eliminates inter-company transactions**, and
presents group-wide P&L, GST, sales/purchases, debtors/creditors, and expense
reports.

> **New here? This README is the single source of truth.** It explains what the
> project is, how it's built, how to run it, and where everything lives — enough
> to be productive without reading anything else.

---

## 1. What problem it solves

Group companies keep separate Tally books maintained by different accountants.
Answering *"how did the whole group do last month?"* normally means collecting
reports and stitching them in Excel — slow, error-prone, and **wrong by
default**: companies trade with each other, so naively summing them
double-counts inter-company sales/purchases and inflates revenue.

This app does that consolidation correctly and continuously:

- **Ingests Tally exports** (Trial Balance, registers) per company per month.
- **Eliminates inter-company transactions** — the architectural centerpiece. In
  the group view, intra-group trade is stripped out and shown as a separate
  *elimination* figure. A **mismatch warning** fires when one company's
  inter-company sales don't equal the counterparty's recorded purchases
  (fake-profit detection).
- **Reports** group-wide numbers, each viewable per company or as "All
  companies", with a global month selector and ₹ / ₹ Lakh toggle.

---

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 15** (App Router, TypeScript, React 19, Server Components + Server Actions) |
| ORM | **Prisma** |
| Database | **PostgreSQL** — local Postgres for dev, **Neon** (serverless Postgres) for the Vercel deploy |
| Auth | Admin login: **bcryptjs** password hash + **jose** signed-JWT session cookie |
| Spreadsheet parsing | **xlsx** (SheetJS) for Tally `.xlsx` exports |
| Styling | Plain CSS (`app/globals.css`), no CSS framework. PlayStation-inspired design system |
| Fonts | Roboto (display) + Inter (body) via `next/font` |
| Deploy | **Vercel** (auto-deploys from `main`) |

**Port:** the dev server runs on **http://localhost:3400**.

---

## 3. Quick start

```bash
# 1. install
npm install

# 2. configure the database — copy the example and set your connection string
cp .env.example .env
#    Local Postgres example:
#    DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/group_mis?schema=public"
#    DIRECT_URL="postgresql://postgres:PASSWORD@localhost:5432/group_mis?schema=public"
#    Also set: AUTH_SECRET (any long random string), ADMIN_EMAIL, ADMIN_PASSWORD

# 3. create the schema
npx prisma migrate dev

# 4. seed sample data (dummy — see "Data rules")
npm run seed          # 3 companies × 6 months of trial-balance data + 1 seeded mismatch + 1 loss month
npm run seed:reports  # sales, purchases, notes, debtors/creditors, expenses, GST
npm run seed:admin    # creates the admin login from ADMIN_EMAIL / ADMIN_PASSWORD

# 5. run
npm run dev           # → http://localhost:3400
```

**Default dev login:** `admin@groupmis.local` / `GroupMIS@2026`
⚠ Change this before any real use (update `ADMIN_PASSWORD`, re-run `seed:admin`,
and rotate `AUTH_SECRET`).

### Environment variables (`.env`, gitignored)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres runtime connection (Neon **pooled** in prod) |
| `DIRECT_URL` | Postgres connection for migrations (Neon **unpooled** in prod) |
| `AUTH_SECRET` | Signing key for the session JWT |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin credentials |

---

## 4. Core concepts (read these — they explain the whole design)

### Companies are DATA, never structure
Companies live in the `Company` table. **Add or archive them from the UI with
zero code changes** — the count is unlimited and nothing is hard-coded. Every
report derives from the current company list.

### The COMPANY SCOPE rule (on every report page)
Each report has a company dropdown whose first option is **"All companies"**:
- **All companies** = combined **group view**, inter-company entries **excluded**
  and shown separately as *eliminations*.
- **A single company** = **standalone view**, inter-company **included**.

### Inter-company elimination + mismatch warning
When Company A sells to Company B, that turnover is intra-group and must net to
zero on consolidation. The Overview shows an *Eliminations* column and a
**red warning banner** when group inter-company sales ≠ purchases beyond ₹1,000
(i.e. fake profit that won't net to zero until the counterparties agree).

### Data rules (dummy vs real)
- Dummy/sample data enters **only** via the seed scripts.
- `npm run seed:clear` wipes everything.
- **Real and dummy data never coexist** — when real Tally exports are loaded,
  clear the dummy data first.
- Money is stored as `Decimal(18,2)` (exact currency math, never Float).
- All amounts render in **Indian format** (`12,34,567`) with a global
  **₹ Full / ₹ Lakh** toggle.

### Re-upload rule
Re-uploading the same **company + period + fileType** replaces it fully
(enforced by a unique constraint on `Upload`).

---

## 5. Pages / features

All pages are gated by admin login (`middleware.ts`). `/login` and `/welcome`
are the only public routes (both share a cinematic starfield intro).

| Route | What it shows |
| --- | --- |
| `/` **Overview** | **Consolidated P&L**: per-company columns → Revenue → Gross Profit → EBITDA → PBT → Net Profit (with margins) + Eliminations + Consolidated. KPI cards (count-up), inter-company mismatch warning, elimination strip, a **GST check panel** (Output vs Input vs Net, on click), and a **trend chart** (real-time type switcher + range filter + Net Profit/Loss line with hover tooltip). |
| `/sales` | Sales Register — voucher table (date, company, vch type/no, party, amount), inter-company flagged. |
| `/purchases` | Purchase Register — same voucher format. |
| `/notes` | Debit / Credit Notes register. |
| `/debtors` | Receivables with **ageing buckets** (0-30 / 31-60 / 61-90 / 90+). |
| `/creditors` | Payables with the same ageing. |
| `/other-expenses` | Indirect expenses with **month-on-month % flags** (±15% highlighted). |
| `/gst` | Dedicated GST board: Output GST (on sales), Input GST (on purchases), Net payable, split by IGST/CGST/SGST. |
| `/uploads` | Upload a Tally `.xlsx` → **parse & review** (no commit until confirmed) → loud validation. Lists existing uploads with **delete** (removes the upload + its data). |
| `/companies` | Company cards (add / archive / **delete-with-all-its-data**). |
| `/settings` | Placeholder (not yet built). |

---

## 6. Project structure

```
app/                         # Next.js App Router pages (one folder per route)
  page.tsx                   # Overview (consolidated P&L dashboard)
  <report>/page.tsx          # sales, purchases, notes, debtors, creditors, other-expenses, gst
  uploads/                   # upload page + actions.ts (parse/delete server actions)
  companies/                 # companies page + actions.ts (add/archive/delete)
  login/  welcome/           # auth + cinematic intro
  globals.css                # the entire design system (no CSS framework)
  layout.tsx                 # root layout, fonts, shell

components/                  # client components
  shell / sidebar / topbar   # app chrome (floating sidebar, month/₹ controls)
  overview-client            # the Overview dashboard (KPIs, P&L table, GST panel)
  trend-chart                # SVG chart: type switcher, range filter, P&L line, tooltip
  *-board                    # voucher-board, party-board, notes-board, expenses-board, gst-board, register-table
  company-scope / stat-strip # shared report controls
  count-up / starfield / ui-state / icons / nav-config

lib/                         # server/data logic
  prisma.ts                  # Prisma client singleton
  mis.ts                     # consolidation: coverage, consolidated P&L, KPIs, trend
  reports.ts                 # sales/purchases/notes/parties/expenses/GST queries (company-scoped)
  tally-tb-parser.ts         # HARDENED Trial Balance parser (validated vs a real export)
  tally-register-parser.ts   # Sales/Journal register parser
  pl-classify.ts             # ADVISORY read-time ledger → P&L-line + inter-company classifier
  format.ts                  # Indian number format + ₹/₹L + bracketed negatives
  page-context.ts            # resolves months + coverage + selected month per page
  auth.ts / session.ts       # bcrypt + jose JWT session (session.ts is edge-safe)
  enums.ts / config.ts       # string-union "enums" and app config

prisma/
  schema.prisma              # data model (see below)
  migrations/                # SQL migrations
  seed.ts                    # dummy TB data (3 companies × 6 months, seeded mismatch + loss month)
  seed-reports.ts            # dummy sales/purchases/notes/parties/expenses/GST
  seed-admin.ts              # bootstrap the admin login

scripts/make-sample-tb.ts    # generates a sample Tally TB .xlsx matching the real structure
middleware.ts                # auth gate (redirects to /login)
```

---

## 7. Data model (`prisma/schema.prisma`)

| Model | Purpose |
| --- | --- |
| **Company** | `name, shortName, chartColor, isActive` — the UI-managed company list. `onDelete: Cascade` on all relations, so deleting a company wipes its data. |
| **Upload** | one upload per `(company, period, fileType)` — the replace rule. |
| **TBEntry** | trial-balance lines (`ledgerName, parentGroup, debit, credit`) — feeds the consolidated P&L. |
| **SalesVoucher / PurchaseVoucher** | register vouchers (date, party, vch type/no, amount, `isInterCompany`). |
| **NoteVoucher** | debit/credit notes. |
| **PartyBalance** | debtor/creditor closing balance + ageing buckets. |
| **ExpenseEntry** | indirect expenses (ledger, category, amount). |
| **GstEntry** | GST lines: `kind` (Output/Input), `component` (IGST/CGST/SGST), taxable value + GST amount. |
| **LedgerMapping** | *(reserved)* persistent ledger → P&L-line mapping (not yet wired; classification is currently read-time). |
| **PartyAlias** | *(reserved)* canonical party name + aliases for party merging. |
| **Admin** | login (email + bcrypt `passwordHash`). |

---

## 8. npm scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :3400 |
| `npm run build` | `prisma generate` → `migrate deploy` → seed admin → `next build` (used by Vercel) |
| `npm run seed` | Seed dummy trial-balance data (wipes + reseeds) |
| `npm run seed:clear` | Wipe **all** data |
| `npm run seed:reports` | Seed dummy sales/purchases/notes/parties/expenses/GST |
| `npm run seed:admin` | Create/update the admin login from env |
| `npm run prisma:studio` | Open Prisma Studio to browse the DB |

---

## 9. Tally ingestion (parsers)

The **Trial Balance parser** (`lib/tally-tb-parser.ts`) is **hardened and
validated** against a real accountant export
(`ADARSH STAINLESS P. LTD.(HPX) 26-27`): flexible detection of the 3-row stacked
header, 2-decimal rounding (kills float artifacts), and **Grand-Total
reconciliation** that **rejects the upload** if parsed Σ Debit / Σ Credit don't
match the Grand Total. The register parser handles Sales/Journal registers.

The **P&L classifier** (`lib/pl-classify.ts`) is **advisory** — it *suggests*
each ledger's P&L line + inter-company flag on the upload review screen using
keyword rules. A human confirms/corrects; it is not authoritative. (The
persistent `LedgerMapping` "learned once, remembered" flow is reserved for
later.)

Ingestion is deliberately **modular** so a direct Tally XML feed can be slotted
in later without touching the reports.

---

## 10. Current status & known gaps

**Runs on Neon (cloud) via Vercel with seeded dummy data, behind admin login.**

**Built & working:** consolidated P&L + elimination + mismatch warning; all
report boards (Sales, Purchases, Notes, Debtors, Creditors, Other Expenses, GST)
with company scope + month selector; trend chart with P&L line; upload
parse-and-review flow; company & upload delete; admin auth; cinematic login.

**Known gaps / next up:**
- **Upload → commit-to-DB** isn't wired yet. `/uploads` parses and reviews, but
  confirming does not yet persist rows — data still enters via the seed scripts.
  Real ingestion is the next milestone.
- **`LedgerMapping`** (persistent "learned once" mapping) and **`PartyAlias`**
  (party merging) tables exist but are not yet used.
- **Settings** page is a placeholder.
- All current data is **dummy/sample** — validate against real Tally exports
  before production use.

---

## 11. Deployment (Vercel + Neon)

- Auto-deploys from `main`. The `build` script runs `prisma migrate deploy` +
  `seed:admin` against **Neon**, so schema and the admin are provisioned on each
  deploy.
- Set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` as Vercel env vars.
- `.env` is gitignored — **no secrets are in the repo**.

---

## 12. Security notes (before real use)

- **Change the default admin password** and rotate `AUTH_SECRET`.
- The app is admin-gated but there's **no rate-limiting / multi-user** yet.
- `.env` must never be committed (it's gitignored). If credentials were ever
  exposed, rotate them (Neon password, `AUTH_SECRET`).
