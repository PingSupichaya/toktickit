-- Lab 3 migration: add `indicatedResolvedAt` to Ticket so the Requester's
-- "Problem Appears Resolved" action is recorded and cannot be repeated
-- (BR-21). Nullable; existing Tickets are PRESERVED (verified by MIG-02).

-- AlterTable: Ticket.indicatedResolvedAt
ALTER TABLE "ticket" ADD COLUMN "indicatedResolvedAt" TIMESTAMP(3);