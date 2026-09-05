import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  await prisma.$transaction(
    categories.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name, isActive: true },
      })
    )
  );
  console.log(`Seeded ${categories.length} categories.`);

  const relatedSystems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];

  await prisma.$transaction(
    relatedSystems.map((name) =>
      prisma.relatedSystem.upsert({
        where: { name },
        update: {},
        create: { name, isActive: true },
      })
    )
  );
  console.log(`Seeded ${relatedSystems.length} related systems.`);

  // 4 active requesters and 1 inactive requester
  
  const requesters = [
    { name: "Alice Johnson",  email: "alice.john@mail.kmutt.co.th",  isActive: true  },
    { name: "Bob Smith",      email: "bob.smit@mail.kmutt.co.th",      isActive: true  },
    { name: "Carol Martinez", email: "carol.mart@mail.kmutt.co.th", isActive: true  },
    { name: "David Lee",      email: "david.lee1@mail.kmutt.co.th",      isActive: true  },
    { name: "Eve Turner",     email: "eve.turn@mail.kmutt.co.th",     isActive: false }, // inactive
  ];

  await prisma.$transaction(
    requesters.map(({ name, email, isActive }) =>
      prisma.requester.upsert({
        where: { email },
        update: {},
        create: { name, email, isActive },
      })
    )
  );

  const activeCount   = requesters.filter((r) => r.isActive).length;
  const inactiveCount = requesters.filter((r) => !r.isActive).length;
  console.log(`Seeded ${activeCount} active requester(s), ${inactiveCount} inactive requester(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
