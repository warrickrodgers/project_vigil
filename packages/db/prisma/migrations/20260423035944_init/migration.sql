-- CreateTable
CREATE TABLE "Outlet" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT NOT NULL,
    "biasAnchor" DOUBLE PRECISION NOT NULL,
    "reliabilityBase" DOUBLE PRECISION NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawContent" TEXT,
    "outletId" TEXT NOT NULL,
    "biasScore" DOUBLE PRECISION NOT NULL,
    "trustRating" DOUBLE PRECISION NOT NULL,
    "region" TEXT NOT NULL,
    "sectorTags" TEXT NOT NULL,
    "corroboratedById" TEXT,
    "vettingFlag" TEXT,
    "embeddingId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_canonicalName_key" ON "Outlet"("canonicalName");

-- CreateIndex
CREATE INDEX "Outlet_canonicalName_idx" ON "Outlet"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Article_hash_key" ON "Article"("hash");

-- CreateIndex
CREATE INDEX "Article_region_collectedAt_idx" ON "Article"("region", "collectedAt");

-- CreateIndex
CREATE INDEX "Article_outletId_idx" ON "Article"("outletId");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_corroboratedById_fkey" FOREIGN KEY ("corroboratedById") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
