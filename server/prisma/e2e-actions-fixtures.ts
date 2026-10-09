import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// E2E-only reset fixture for the actions-taken-flow suite (docs/lab-04
// tests.md E2E-01 + E2E-05, ui-spec §12).
// ---------------------------------------------------------------------------
// The spec adds/edits Actions Taken on the seeded TKT-000005 (RESOLVED legacy
// ticket with zero actions, submitted by Alice) using "E2E-ACT:"-prefixed
// descriptions. This script removes only those rows, so the suite is
// re-runnable and leaves no residue. Seeded actions on other tickets are
// never touched. Run before and after the suite.
// ---------------------------------------------------------------------------

const MARKER = "E2E-ACT:";
const TICKET_NUMBER = "TKT-000005";

const prisma = getPrisma();

async function main() {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketNumber: TICKET_NUMBER },
    select: { id: true },
  });
  if (ticket) {
    const removed = await prisma.actionTaken.deleteMany({
      where: {
        ticketId: ticket.id,
        description: { startsWith: MARKER },
      },
    });
    console.log(
      `E2E actions fixture reset complete (removed ${removed.count} row(s)).`
    );
  } else {
    console.log(`E2E actions fixture reset: ${TICKET_NUMBER} not found.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
