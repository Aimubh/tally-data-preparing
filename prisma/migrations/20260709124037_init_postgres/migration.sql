-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "chartColor" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TBEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ledgerName" TEXT NOT NULL,
    "parentGroup" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "TBEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteVoucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "NoteVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "ageing0_30" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ageing31_60" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ageing61_90" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ageing90plus" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PartyBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ledgerName" TEXT NOT NULL,
    "plLine" TEXT NOT NULL,
    "isInterCompany" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LedgerMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyAlias" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT NOT NULL,

    CONSTRAINT "PartyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_shortName_key" ON "Company"("shortName");

-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- CreateIndex
CREATE INDEX "Upload_companyId_period_idx" ON "Upload"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_companyId_period_fileType_key" ON "Upload"("companyId", "period", "fileType");

-- CreateIndex
CREATE INDEX "TBEntry_companyId_period_idx" ON "TBEntry"("companyId", "period");

-- CreateIndex
CREATE INDEX "TBEntry_ledgerName_idx" ON "TBEntry"("ledgerName");

-- CreateIndex
CREATE INDEX "NoteVoucher_companyId_period_idx" ON "NoteVoucher"("companyId", "period");

-- CreateIndex
CREATE INDEX "NoteVoucher_partyName_idx" ON "NoteVoucher"("partyName");

-- CreateIndex
CREATE INDEX "PartyBalance_companyId_period_idx" ON "PartyBalance"("companyId", "period");

-- CreateIndex
CREATE INDEX "PartyBalance_partyName_idx" ON "PartyBalance"("partyName");

-- CreateIndex
CREATE INDEX "LedgerMapping_companyId_idx" ON "LedgerMapping"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerMapping_companyId_ledgerName_key" ON "LedgerMapping"("companyId", "ledgerName");

-- CreateIndex
CREATE UNIQUE INDEX "PartyAlias_canonicalName_key" ON "PartyAlias"("canonicalName");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TBEntry" ADD CONSTRAINT "TBEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVoucher" ADD CONSTRAINT "NoteVoucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBalance" ADD CONSTRAINT "PartyBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMapping" ADD CONSTRAINT "LedgerMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
