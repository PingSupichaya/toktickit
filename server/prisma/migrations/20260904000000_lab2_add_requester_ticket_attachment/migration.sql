-- Lab 2 migration: add isActive to category, create related_system,
-- requester, ticket, and attachment tables.

-- CreateEnum
CREATE TYPE "RequestedPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW');

-- AlterTable: add isActive to existing category table
ALTER TABLE "category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: related_system
CREATE TABLE "related_system" (
    "id"       SERIAL  NOT NULL,
    "name"     TEXT    NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "related_system_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "related_system_name_key" ON "related_system"("name");

-- CreateTable: requester
CREATE TABLE "requester" (
    "id"        SERIAL      NOT NULL,
    "name"      TEXT        NOT NULL,
    "email"     TEXT        NOT NULL,
    "isActive"  BOOLEAN     NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requester_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "requester_email_key" ON "requester"("email");
CREATE INDEX "requester_isActive_idx" ON "requester"("isActive");

-- CreateTable: ticket
CREATE TABLE "ticket" (
    "id"                SERIAL           NOT NULL,
    "ticketNumber"      TEXT             NOT NULL,
    "requesterId"       INTEGER          NOT NULL,
    "categoryId"        INTEGER          NOT NULL,
    "relatedSystemId"   INTEGER          NOT NULL,
    "summary"           TEXT             NOT NULL,
    "description"       TEXT             NOT NULL,
    "requestedPriority" "RequestedPriority" NOT NULL,
    "currentStatus"     "TicketStatus"   NOT NULL DEFAULT 'NEW',
    "ticketDate"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_ticketNumber_key"       ON "ticket"("ticketNumber");
CREATE INDEX "ticket_requesterId_idx"               ON "ticket"("requesterId");
CREATE INDEX "ticket_ticketDate_idx"                ON "ticket"("ticketDate");
CREATE INDEX "ticket_requesterId_ticketDate_idx"    ON "ticket"("requesterId", "ticketDate");
CREATE INDEX "ticket_currentStatus_idx"             ON "ticket"("currentStatus");
CREATE INDEX "ticket_categoryId_idx"                ON "ticket"("categoryId");
CREATE INDEX "ticket_relatedSystemId_idx"           ON "ticket"("relatedSystemId");

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "requester"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket" ADD CONSTRAINT "ticket_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket" ADD CONSTRAINT "ticket_relatedSystemId_fkey"
    FOREIGN KEY ("relatedSystemId") REFERENCES "related_system"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: attachment
CREATE TABLE "attachment" (
    "id"               SERIAL       NOT NULL,
    "ticketId"         INTEGER      NOT NULL,
    "originalFilename" TEXT         NOT NULL,
    "storedFilename"   TEXT         NOT NULL,
    "fileSizeBytes"    INTEGER      NOT NULL,
    "contentType"      TEXT         NOT NULL,
    "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRemoved"        BOOLEAN      NOT NULL DEFAULT false,
    "removedAt"        TIMESTAMP(3),
    "removalReason"    TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachment_ticketId_idx"            ON "attachment"("ticketId");
CREATE INDEX "attachment_ticketId_isRemoved_idx"  ON "attachment"("ticketId", "isRemoved");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "ticket"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
