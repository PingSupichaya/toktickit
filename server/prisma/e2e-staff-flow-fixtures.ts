import { RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// E2E-only reset fixture for the staff-ticket-flow suite (tests.md
// E2E-04..E2E-07, docs/lab-03/ui-spec.md §12).
// ---------------------------------------------------------------------------
// The spec walks the full staff workflow on two seeded tickets (claim,
// priority, status transitions, comments, notes). This script restores those
// tickets to their seeded baseline and removes only the rows this suite
// created (marker-prefixed content), so the suite is re-runnable and leaves
// no residue. Seeded sample comments/notes are never touched. Run before and
// after the suite.
// ---------------------------------------------------------------------------

const MARKER = "E2E-STAFF:";
const CLAIM_TICKET = "TKT-000001"; // NEW, unassigned, submitted by Alice
const FLOW_TICKET = "TKT-000009"; // NEW, owned by Omar, submitted by Alice
const OMAR_EMAIL = "omar.far@mail.kmutt.ac.th";

const prisma = getPrisma();

async function main() {
  const omar = await prisma.user.findUniqueOrThrow({
    where: { email: OMAR_EMAIL },
  });
  const tickets = await prisma.ticket.findMany({
    where: { ticketNumber: { in: [CLAIM_TICKET, FLOW_TICKET] } },
    select: { id: true, ticketNumber: true },
  });
  const byNumber = new Map(tickets.map((t) => [t.ticketNumber, t.id]));

  const claimId = byNumber.get(CLAIM_TICKET);
  if (claimId !== undefined) {
    await prisma.publicComment.deleteMany({
      where: { ticketId: claimId, content: { startsWith: MARKER } },
    });
    await prisma.internalNote.deleteMany({
      where: { ticketId: claimId, content: { startsWith: MARKER } },
    });
    await prisma.ticket.update({
      where: { id: claimId },
      data: {
        currentStatus: TicketStatus.NEW,
        ownerId: null,
        itPriority: RequestedPriority.HIGH,
        indicatedResolvedAt: null,
      },
    });
  }

  const flowId = byNumber.get(FLOW_TICKET);
  if (flowId !== undefined) {
    await prisma.publicComment.deleteMany({
      where: { ticketId: flowId, content: { startsWith: MARKER } },
    });
    await prisma.internalNote.deleteMany({
      where: { ticketId: flowId, content: { startsWith: MARKER } },
    });
    await prisma.ticket.update({
      where: { id: flowId },
      data: {
        currentStatus: TicketStatus.NEW,
        ownerId: omar.id,
        itPriority: RequestedPriority.MEDIUM,
        indicatedResolvedAt: null,
      },
    });
  }

  console.log("E2E staff-flow fixture reset complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });