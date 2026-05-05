-- CreateTable
CREATE TABLE "BudgetState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "monthKey" TEXT NOT NULL,
    "monthCount" INTEGER NOT NULL DEFAULT 0,
    "dayKey" TEXT NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetState_pkey" PRIMARY KEY ("id")
);
