-- CreateTable
CREATE TABLE "SalesVoucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "isInterCompany" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SalesVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseVoucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "isInterCompany" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PurchaseVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ledgerName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesVoucher_companyId_period_idx" ON "SalesVoucher"("companyId", "period");

-- CreateIndex
CREATE INDEX "SalesVoucher_partyName_idx" ON "SalesVoucher"("partyName");

-- CreateIndex
CREATE INDEX "PurchaseVoucher_companyId_period_idx" ON "PurchaseVoucher"("companyId", "period");

-- CreateIndex
CREATE INDEX "PurchaseVoucher_partyName_idx" ON "PurchaseVoucher"("partyName");

-- CreateIndex
CREATE INDEX "ExpenseEntry_companyId_period_idx" ON "ExpenseEntry"("companyId", "period");

-- AddForeignKey
ALTER TABLE "SalesVoucher" ADD CONSTRAINT "SalesVoucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseVoucher" ADD CONSTRAINT "PurchaseVoucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
