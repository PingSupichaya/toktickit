-- Lab 4 migration (specification.md §9.5): additive only, no data loss.
-- 1. CREATE TABLE "action_taken" (§9.1) — new work-log table, empty on migrate.
-- 2. ALTER TABLE "ticket" ADD COLUMN "version" DEFAULT 1 (§9.2) — every
--    existing row receives version = 1; no other row is modified or deleted.
-- Backfill (D-03): legacy RESOLVED/CLOSED tickets are NOT given backfilled
-- actions; the BR-10 gate applies going forward only.
-- Rollback / recovery (§9.5 step 6): forward-only migration with no destructive
-- DDL. Roll back with `prisma migrate resolve --rolled-back` + DROP TABLE
-- "action_taken" / DROP COLUMN "ticket"."version", or restore the
-- pre-migration backup. Re-running after a failed attempt is safe (MIG-01).

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "action_taken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "performedById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_taken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_taken_ticketId_idx" ON "action_taken"("ticketId");

-- CreateIndex
CREATE INDEX "action_taken_ticketId_actionAt_id_idx" ON "action_taken"("ticketId", "actionAt", "id");

-- AddForeignKey
ALTER TABLE "action_taken" ADD CONSTRAINT "action_taken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_taken" ADD CONSTRAINT "action_taken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_taken" ADD CONSTRAINT "action_taken_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
