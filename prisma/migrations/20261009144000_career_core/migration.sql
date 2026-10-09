-- CreateTable
CREATE TABLE "CareerEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "evidenceKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "factsJson" TEXT NOT NULL,
    "protectedPathsJson" TEXT NOT NULL,
    "sourceJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contentHash" TEXT NOT NULL,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareerJobContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "recruitmentType" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "postingKey" TEXT,
    "rawJd" TEXT NOT NULL,
    "rawJdHash" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL,
    "requirementsJson" TEXT NOT NULL,
    "analysisJson" TEXT,
    "referralJson" TEXT,
    "preparationStatus" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CareerJobContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CareerJobContext_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareerMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "materialKey" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceResumeId" TEXT,
    "fileId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "texSource" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CareerMaterial_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CareerMaterial_sourceResumeId_fkey" FOREIGN KEY ("sourceResumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CareerMaterial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "jobId" TEXT,
    "materialId" TEXT,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "accountLockKey" TEXT,
    "requestHash" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "resultJson" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CareerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CareerRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CareerRun_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CareerMaterial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CareerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "operationKey" TEXT,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CareerEvidence_userId_status_idx" ON "CareerEvidence"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CareerEvidence_userId_evidenceKey_revision_key" ON "CareerEvidence"("userId", "evidenceKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "CareerJobContext_jobId_key" ON "CareerJobContext"("jobId");

-- CreateIndex
CREATE INDEX "CareerJobContext_userId_preparationStatus_idx" ON "CareerJobContext"("userId", "preparationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CareerJobContext_userId_postingKey_key" ON "CareerJobContext"("userId", "postingKey");

-- CreateIndex
CREATE INDEX "CareerMaterial_jobId_idx" ON "CareerMaterial"("jobId");

-- CreateIndex
CREATE INDEX "CareerMaterial_fileId_idx" ON "CareerMaterial"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerMaterial_userId_materialKey_key" ON "CareerMaterial"("userId", "materialKey");

-- CreateIndex
CREATE INDEX "CareerRun_status_leaseUntil_idx" ON "CareerRun"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "CareerRun_userId_createdAt_idx" ON "CareerRun"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerRun_userId_operationKey_key" ON "CareerRun"("userId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "CareerRun_userId_idempotencyKey_key" ON "CareerRun"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CareerEvent_userId_createdAt_idx" ON "CareerEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerEvent_userId_eventKey_key" ON "CareerEvent"("userId", "eventKey");


-- One preparation pipeline per job, including pauses that await user review.
CREATE UNIQUE INDEX "CareerRun_active_job_key"
ON "CareerRun"("userId", "jobId")
WHERE "kind" IN ('parse', 'match', 'tailor', 'compile')
  AND "status" IN ('queued', 'running', 'awaiting_review', 'awaiting_human', 'awaiting_receipt');

-- Account keys are owner-scoped and never contain authentication secrets.
CREATE UNIQUE INDEX "CareerRun_active_account_key"
ON "CareerRun"("userId", "accountLockKey")
WHERE "kind" = 'application'
  AND "status" IN ('queued', 'running', 'awaiting_review', 'awaiting_human', 'awaiting_receipt');

CREATE UNIQUE INDEX "CareerRun_active_maintenance_key"
ON "CareerRun"("userId")
WHERE "kind" = 'maintenance' AND "status" = 'running';
