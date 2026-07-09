# Group MIS Console — Project Context

Permanent context for this project. Read before making changes.

> **Standalone project.** Its own directory, its own git repo
> (`Aimubh/tally-data-preparing`), its own local Postgres database, its own
> port. **No connection to any other project** — no shared code, schema, or
> routes. Do not couple it to anything else.

## Purpose

Consolidation MIS for a business group. The group's companies keep their books
in **Tally**. Data enters this system by **manual upload of Tally exports**:

- **Trial Balance**
- **Debit/Credit Note day book**
- **Outstandings** (party balances / ageing)

A direct **Tally XML feed** may be added later, so **ingestion must stay
modular** — parsing/ingestion is isolated behind a clear boundary so a new
source (XML) can be slotted in without touching reports.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Prisma** ORM
- **Database — Postgres.**
  - **Deployed (Vercel):** **Neon** serverless Postgres. ⚠ This overrides the
    original "on-premise / NOT Neon" rule — done per explicit user direction to
    deploy on Vercel (which cannot host a local SQLite/on-prem DB). `DATABASE_URL`
    = Neon **pooled** connection (runtime); `DIRECT_URL` = Neon **unpooled**
    (migrations). Both live in Vercel env vars + local `.env` (gitignored).
  - **Local dev option:** flip `provider` to `sqlite` + `DATABASE_URL="file:./dev.db"`
    and drop the `@db.Decimal` attrs to run offline with no server.
  - Schema notes: enum-like fields are `String` (validated in `lib/enums.ts`),
    `PartyAlias.aliases` is a JSON `String`. Money is `@db.Decimal(18,2)`.
- **Port `3400`** locally (Vercel serves on its own domain).

Run: `npm run dev` → http://localhost:3400

## Companies are DATA, never structure

Companies live in the `Company` table (`id, name, shortName, chartColor,
isActive, createdAt`). **Unlimited count. Add/archive from the UI with zero code
changes.** Never hard-code a company anywhere. Group companies trade with each
other, so **inter-company elimination is core logic**.

## COMPANY SCOPE RULE (applies to every report page)

Every report page has a **company dropdown**. Its first option is **"All
companies"**:

- **All companies** = combined **group view** with **inter-company entries
  excluded**, and the eliminated amount **shown as a separate elimination
  figure** (never silently dropped).
- **Single company** = **standalone view** that **includes** inter-company
  entries.

## UI

**Design system: PlayStation** (applied from `DESIGN-playstation.md`). Tokens +
chrome vocabulary mapped onto the data dashboard (not the full-bleed marketing
layout — that archetype doesn't fit an MIS):

- **Chrome = PlayStation black** (`#000`) sidebar/nav with a sliding **PS Blue
  `#0070d1`** active accent; content on light canvas.
- **PS Blue `#0070d1`** is the universal primary: pill CTAs, active toggle,
  coverage dots, the Consolidated P&L column, gross%/trend accents.
- **Type:** PlayStation SST is proprietary → substitutes **Roboto Light (300)**
  for display (the signature airy weight) + **Inter** for body/chrome, loaded via
  `next/font`. Signature tracking preserved.
- **Shape:** `full` pills for every CTA, `8px` cards, `4px` inputs. **Flat
  elevation** — no resting shadows; cards lift only on press.
- **Warning** uses PS `#c81b3a`.
- **Indian number format** everywhere (`12,34,567`), global **₹ Full / ₹ Lakh
  toggle**, global **month selector** in the top bar.
- The original navy `#0F2A4A` sidebar spec was superseded by the PlayStation
  black chrome per user direction.

## Animations

Purposeful only. **150–300ms ease-out.** Respect `prefers-reduced-motion`.
Allowed: KPI count-ups, chart draw-ins, 150ms page fades. **Never** decorative
loops. **Never** delay data behind animation.

## Validation

**Reject bad data loudly.** Nothing is ever excluded silently. If an upload has
problems, surface them — do not quietly drop rows.

## Re-upload rule

Re-uploading the **same company + period + fileType** **replaces it fully**
(enforced by a unique constraint on `Upload(companyId, period, fileType)`).

## P&L lines (`PLLine` enum)

`Revenue, OtherIncome, PurchasesCOGS, DirectExpenses, Employee,
SellingDistribution, AdminOther, Finance, Depreciation, Tax,
BalanceSheetOrIgnore`.

## Dummy-data rules

- Dummy data enters **ONLY** via the seed script (`npm run seed`).
- **One `--clear` command** wipes it (`npm run seed:clear`).
- **Real and dummy data never coexist.**
- **Parsers stay flagged `PROVISIONAL`** until validated against real Tally
  exports.

## Data model (`prisma/schema.prisma`)

| Model | Purpose |
| --- | --- |
| **Company** | `id, name, shortName, chartColor, isActive, createdAt` — the UI-managed company list. |
| **Upload** | `companyId, period, fileType, uploadedAt` — one manual upload; unique on `(companyId, period, fileType)` for the replace rule. |
| **TBEntry** | `companyId, period, ledgerName, parentGroup, debit, credit` — trial-balance lines. |
| **NoteVoucher** | `companyId, period, date, voucherType, voucherNo, partyName, amount` — debit/credit notes. |
| **PartyBalance** | `companyId, period, side, partyName, closingBalance, ageing0_30, ageing31_60, ageing61_90, ageing90plus` — outstandings/ageing. |
| **LedgerMapping** | `companyId, ledgerName, plLine, isInterCompany` — maps ledgers to P&L lines; flags inter-company ledgers for elimination. |
| **PartyAlias** | `canonicalName, aliases[]` — reconciles differently-spelled party names to one entity. |

Money columns are `Decimal(18,2)` (exact currency math — never Float).

## Working agreement

**Work in steps. STOP for confirmation at the end of each step.** Do not run
ahead to the next step without an explicit go-ahead.

### Status

- **Step 1 — Scaffold:** Next.js + Prisma + local Postgres, schema defined, app
  boots on port 3400. Seed script has a working `--clear`.
  ⚠ **Migration not yet run** and DB not yet seeded (awaiting local `postgres`
  password) — see "Pending" below.
- **Step 2 — App shell + Overview (code complete, DB-unverified):**
  - Fixed navy sidebar (collapsible, remembered; sliding light-blue active
    accent). Nav: Overview + Companies are real; the rest are placeholders.
  - Top bar: month selector (from DB months), ₹ Full/₹ Lakh toggle (remembered),
    per-company coverage dots.
  - Companies page: card grid, add-company modal (auto colour, loud validation),
    archive/unarchive.
  - Overview: KPI count-ups, consolidated P&L table (company cols + Eliminations
    + Consolidated), elimination strip, inter-company mismatch **warning banner**
    (fires when |IC sales − IC purchases| > ₹1,000), 6-month trend chart.
  - P&L line + inter-company classification is **read-time & PROVISIONAL**
    (`lib/pl-classify.ts`) — superseded by `LedgerMapping` in the upload step.

  **Pending before Step 2 is verified:** provide the local `postgres` password
  so the migration + seed can run; then verify the Overview numbers against the
  seed summary and confirm the warning banner fires on the seeded mismatch month.

### Key files (Step 2)

- `lib/pl-classify.ts` — PROVISIONAL read-time P&L-line + inter-company rules.
- `lib/mis.ts` — consolidation queries (coverage, consolidated P&L, trend).
- `lib/format.ts` — Indian number format + ₹ Full/Lakh + bracketed negatives.
- `components/` — `shell`, `sidebar`, `topbar`, `overview-client`, `trend-chart`,
  `count-up`, `companies-client`, `ui-state`.
- `prisma/seed.ts` — dummy data generator (3 companies × 6 months + 1 seeded
  inter-company mismatch on the latest month).
