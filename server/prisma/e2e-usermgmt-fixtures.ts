import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// E2E-only reset fixture for the user-administration suite (tests.md
// E2E-09 / E2E-10, docs/lab-03/ui-spec.md §6.4).
// ---------------------------------------------------------------------------
// The spec creates/edits/deactivates ONE working account under a stable email
// address. This script deletes any leftovers from previous (or aborted) runs
// so the create step always starts from a clean slate. Run before and after
// the suite; it never touches seeded users, so it cannot disturb the API-40
// last-active-Administrator probe (which counts live ADMIN rows live).
// ---------------------------------------------------------------------------

const EMAILS = [
  "e2e.um.created@mail.kmutt.ac.th",
  "e2e.um.edited@mail.kmutt.ac.th",
];

const prisma = getPrisma();

async function main() {
  await prisma.session.deleteMany({
    where: { user: { email: { in: EMAILS } } },
  });
  const r = await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  console.log(
    `E2E user-management fixture reset: removed ${r.count} leftover user(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });