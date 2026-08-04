-- CreateTable
CREATE TABLE "Merchant" (
    "wallet" TEXT NOT NULL PRIMARY KEY,
    "profileURI" TEXT NOT NULL,
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
    CONSTRAINT "Payment_merchantWallet_fkey" FOREIGN KEY ("merchantWallet") REFERENCES "Merchant" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchantWallet" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "periodId" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedOnChain" BOOLEAN NOT NULL DEFAULT false,
    "publishTxHash" TEXT,
    CONSTRAINT "ScoreHistory_merchantWallet_fkey" FOREIGN KEY ("merchantWallet") REFERENCES "Merchant" ("wallet") ON DELETE RESTRICT ON UPDATE CASCADE
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
