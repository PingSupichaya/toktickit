-- Lab 3 migration: replace Requester with User, add Session / PublicComment /
-- InternalNote, expand TicketStatus, and add ownership + IT Priority to Ticket.
-- Existing Requester, Ticket, and Attachment rows are PRESERVED
-- (see specification.md §7.4; verified by MIG-01 / MIG-02).

-- CreateEnum: UserRole
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMIN');

-- AlterEnum: expand TicketStatus with the seven workflow states added in Lab 3.
-- (New values are not referenced below, so this is safe inside the migration.)
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- RenameTable: requester -> user (data preserved)
ALTER TABLE "requester" RENAME TO "user";

-- RenameTable: keep Prisma's expected constraint / index / sequence names.
ALTER TABLE "user" RENAME CONSTRAINT "requester_pkey" TO "user_pkey";
ALTER INDEX "requester_email_key" RENAME TO "user_email_key";
ALTER INDEX "requester_isActive_idx" RENAME TO "user_isActive_idx";
ALTER SEQUENCE "requester_id_seq" RENAME TO "user_id_seq";

-- AlterTable: add the User columns from specification.md §7.1.
-- Migrated Requesters keep their row and are mapped to role REQUESTER,
-- mustChangePassword = true, and a bcrypt hash (cost 12) of the documented
-- development initial password 'ChangeMe123!' (D-12 / §7.4 step 3).
ALTER TABLE "user" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER';
ALTER TABLE "user" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '$2b$12$wKXmba/bNuc23X/8dn6oeup4JI0.kaJtIDjBpYR9gKkrhi7zEGTNO';
ALTER TABLE "user" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);

-- AlterTable: drop the temporary defaults the Prisma schema does not declare.
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- CreateIndex: user.role (queue/staff authorization lookups)
CREATE INDEX "user_role_idx" ON "user"("role");

-- AlterTable: ticket.requesterId -> submittedById (values preserved 1:1),
-- add ownerId (nullable) and itPriority (backfilled from requestedPriority).
ALTER TABLE "ticket" RENAME COLUMN "requesterId" TO "submittedById";
ALTER TABLE "ticket" ADD COLUMN "ownerId" INTEGER;
ALTER TABLE "ticket" ADD COLUMN "itPriority" "RequestedPriority" NOT NULL DEFAULT 'MEDIUM';
UPDATE "ticket" SET "itPriority" = "requestedPriority";
ALTER TABLE "ticket" ALTER COLUMN "itPriority" DROP DEFAULT;

-- RenameIndex / RenameConstraint: match the new Prisma field names so the
-- shadow database diff stays clean and the migration history is consistent.
ALTER TABLE "ticket" RENAME CONSTRAINT "ticket_requesterId_fkey" TO "ticket_submittedById_fkey";
ALTER INDEX "ticket_requesterId_idx" RENAME TO "ticket_submittedById_idx";
ALTER INDEX "ticket_requesterId_ticketDate_idx" RENAME TO "ticket_submittedById_ticketDate_idx";

-- CreateIndex: new ticket indexes required by the queue + detail queries
-- (specification.md §7.1 Ticket indexes).
CREATE INDEX "ticket_ownerId_idx" ON "ticket"("ownerId");
CREATE INDEX "ticket_itPriority_idx" ON "ticket"("itPriority");
CREATE INDEX "ticket_itPriority_ticketDate_idx" ON "ticket"("itPriority", "ticketDate");
CREATE INDEX "ticket_currentStatus_ticketDate_idx" ON "ticket"("currentStatus", "ticketDate");

-- AddForeignKey: ticket.ownerId -> user.id (nullable; SET NULL on delete)
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: session (opaque cookie token hashed with SHA-256)
CREATE TABLE "session" (
    "id"        SERIAL       NOT NULL,
    "tokenHash" TEXT         NOT NULL,
    "userId"    INTEGER      NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_tokenHash_key" ON "session"("tokenHash");
CREATE INDEX "session_userId_idx"   ON "session"("userId");
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: public_comment
CREATE TABLE "public_comment" (
    "id"        SERIAL       NOT NULL,
    "ticketId"  INTEGER      NOT NULL,
    "authorId"  INTEGER      NOT NULL,
    "content"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "public_comment_ticketId_idx"            ON "public_comment"("ticketId");
CREATE INDEX "public_comment_ticketId_createdAt_idx"  ON "public_comment"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "public_comment" ADD CONSTRAINT "public_comment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ticket"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_comment" ADD CONSTRAINT "public_comment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: internal_note
CREATE TABLE "internal_note" (
    "id"        SERIAL       NOT NULL,
    "ticketId"  INTEGER      NOT NULL,
    "authorId"  INTEGER      NOT NULL,
    "content"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "internal_note_ticketId_idx"            ON "internal_note"("ticketId");
CREATE INDEX "internal_note_ticketId_createdAt_idx"  ON "internal_note"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ticket"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;