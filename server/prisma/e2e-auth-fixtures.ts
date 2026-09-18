import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// E2E-only authentication fixtures (docs/lab-03/tests.md E2E-01..03, E2E-08)
// ---------------------------------------------------------------------------
// Dedicated accounts for the Playwright authentication suite. Upserted by
// email so re-running is idempotent. They never collide with the main seed
// users. The inactive account for E2E-03 is the seeded `eve.turn` account.
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12; // BR-09

const FIXTURES = [
  {
    email: "e2e.auth.pass@mail.kmutt.ac.th",
    name: "E2E Auth Pass",
    role: "REQUESTER" as const,
    isActive: true,
    password: "E2ePassw0rd!",
    mustChangePassword: false,
  },
  {
    email: "e2e.auth.bob@mail.kmutt.ac.th",
    name: "E2E Auth Bob",
    role: "REQUESTER" as const,
    isActive: true,
    password: "ChangeMe123!",
    mustChangePassword: true,
  },
  {
    email: "e2e.auth.grace@mail.kmutt.ac.th",
    name: "E2E Auth Grace",
    role: "IT_STAFF" as const,
    isActive: true,
    password: "E2ePassw0rd!",
    mustChangePassword: false,
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
        isActive: u.isActive,
        passwordHash: bcrypt.hashSync(u.password, BCRYPT_COST),
        mustChangePassword: u.mustChangePassword,
      },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        passwordHash: bcrypt.hashSync(u.password, BCRYPT_COST),
        mustChangePassword: u.mustChangePassword,
      },
    });
  }
  console.log(`Seeded ${FIXTURES.length} E2E authentication fixture user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });