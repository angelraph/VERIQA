-- CreateTable
CREATE TABLE "Merchant" (
    "wallet" TEXT NOT NULL PRIMARY KEY,
    "profileURI" TEXT NOT NULL,
    "qieName" TEXT,
    "passVerified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL,
    "registeredAtBlock" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "receiptId" TEXT NOT NULL PRIMARY KEY,
    "merchantWallet" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "method" INTEGER NOT NULL DEFAULT 0,
    "repaidToPool" TEXT NOT NULL DEFAULT '0',
    CONSTRAINT "Payment_merchantWallet_fkey" FOREIGN KEY ("merchantWallet") REFERENCES "Merchant" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchantWallet" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "periodId" INTEGER NOT NULL,
    "inputsHash" TEXT NOT NULL DEFAULT '',
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedOnChain" BOOLEAN NOT NULL DEFAULT false,
    "publishTxHash" TEXT,
    CONSTRAINT "ScoreHistory_merchantWallet_fkey" FOREIGN KEY ("merchantWallet") REFERENCES "Merchant" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchantWallet" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "repayBps" INTEGER NOT NULL,
    "outstanding" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" DATETIME,
    "txHash" TEXT NOT NULL,
    CONSTRAINT "Advance_merchantWallet_fkey" FOREIGN KEY ("merchantWallet") REFERENCES "Merchant" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvanceRepayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "advanceId" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL,
    "from" TEXT NOT NULL,
    "remaining" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "AdvanceRepayment_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "Advance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchantWallet" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "scoreDelta" INTEGER NOT NULL,
    "revenueChangePct" REAL,
    "uniqueCustomersThisWeek" INTEGER NOT NULL,
    "uniqueCustomersTrailingAvg" REAL NOT NULL,
    "daysSinceTopCustomerLastPaid" INTEGER,
    "newCustomerCount" INTEGER NOT NULL,
    "repeatCustomerRate" REAL NOT NULL,
    "summarySentence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Insight_merchantWallet_fkey" FOREIGN KEY ("merchantWallet") REFERENCES "Merchant" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "lastBlock" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Payment_merchantWallet_timestamp_idx" ON "Payment"("merchantWallet", "timestamp");

-- CreateIndex
CREATE INDEX "Payment_payer_idx" ON "Payment"("payer");

-- CreateIndex
CREATE INDEX "ScoreHistory_merchantWallet_periodId_idx" ON "ScoreHistory"("merchantWallet", "periodId");

-- CreateIndex
CREATE INDEX "Advance_merchantWallet_status_idx" ON "Advance"("merchantWallet", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRepayment_txHash_logIndex_key" ON "AdvanceRepayment"("txHash", "logIndex");

