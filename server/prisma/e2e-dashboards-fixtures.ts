import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// E2E-only dashboard fixtures (docs/lab-04/tests.md E2E-04 + E2E-06,
// ui-spec §12).
// ---------------------------------------------------------------------------
// Non-zero dashboards use seeded accounts (Alice/Frank/Omar) and seeded
// tickets, so metric values are real. Empty states need users that own and
// submit nothing — these dedicated accounts are upserted by email (lowercase,
// login normalizes case) with mustChangePassword = false so browser login
// needs no password-change detour and re-runs stay idempotent. They never
// collide with the main seed or other suites' fixtures.
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12; // BR-09
const PASSWORD = "E2ePassw0rd!";

const FIXTURES = [
  {
    email: "e2e.dash.zero@mail.kmutt.ac.th",
    name: "E2E Dash Zero",
    role: "REQUESTER" as const,
  },
  {
    email: "e2e.dash.zerostaff@mail.kmutt.ac.th",
    name: "E2E Dash Zero Staff",
    role: "IT_STAFF" as const,
  },
];

const prisma = getPrisma();

async function main() {
  for (const u of FIXTURES) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        isActive: true,
        passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST),
        mustChangePassword: false,
      },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: true,
        passwordHash: bcrypt.hashSync(PASSWORD, BCRYPT_COST),
        mustChangePassword: false,
      },
    });
  }
  console.log(`Seeded ${FIXTURES.length} E2E dashboard fixture user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
