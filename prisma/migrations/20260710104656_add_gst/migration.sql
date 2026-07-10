-- CreateTable
CREATE TABLE "GstEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "ratePct" INTEGER NOT NULL,
    "taxableValue" DECIMAL(18,2) NOT NULL,
    "gstAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "GstEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GstEntry_companyId_period_idx" ON "GstEntry"("companyId", "period");

-- CreateIndex
CREATE INDEX "GstEntry_kind_idx" ON "GstEntry"("kind");

-- AddForeignKey
ALTER TABLE "GstEntry" ADD CONSTRAINT "GstEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
