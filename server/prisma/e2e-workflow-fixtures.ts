import { RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// E2E-only reset fixture for the ticket-resolution suite (docs/lab-04
// tests.md E2E-02 + E2E-03, ui-spec §12).
// ---------------------------------------------------------------------------
// E2E-02 resolves the seeded TKT-000010 (OPEN, unassigned) after adding a
// qualifying action; E2E-03 bumps TKT-000016 (IN_PROGRESS) through a stale
// write. Every action created here uses an "E2E-WF:"-prefixed description.
// This script removes only those rows and restores both tickets to their
// seeded baseline (status, itPriority, version), so the suite is re-runnable
// and leaves no residue. Run before and after the suite.
// ---------------------------------------------------------------------------

const MARKER = "E2E-WF:";

const prisma = getPrisma();

async function resetTicket(
  ticketNumber: string,
  baseline: { currentStatus: TicketStatus; itPriority: RequestedPriority }
) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });
  if (!ticket) {
    console.log(`E2E workflow fixture reset: ${ticketNumber} not found.`);
    return;
  }
  await prisma.actionTaken.deleteMany({
    where: { ticketId: ticket.id, description: { startsWith: MARKER } },
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { ...baseline, version: 1 },
  });
}

async function main() {
  await resetTicket("TKT-000010", {
    currentStatus: TicketStatus.OPEN,
    itPriority: RequestedPriority.LOW,
  });
  await resetTicket("TKT-000016", {
    currentStatus: TicketStatus.IN_PROGRESS,
    itPriority: RequestedPriority.LOW,
  });
  console.log("E2E workflow fixture reset complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
