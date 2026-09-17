import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// Lab 3 seed (specification.md §7.5)
// ---------------------------------------------------------------------------
// All seeded accounts use the documented shared development initial password:
//
//     INITIAL_PASSWORD = "ChangeMe123!"
//
// Every seeded / migrated account is created with `mustChangePassword = true`,
// so the first login routes to the Change Password screen (D-12, BR-02).
// These credentials are for LOCAL DEVELOPMENT ONLY — never commit real
// personal passwords. Emails follow the `first.last@mail.kmutt.ac.th` pattern
// already used by the Lab 2 seed.
//
// The seed is idempotent: categories/related systems/users/tickets are upserted
// by their natural key and comments/notes are only inserted when the exact
// (ticket, author, content) triple does not already exist. Re-running the seed
// never duplicates rows (MIG-01).
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12; // BR-09: bcrypt, cost factor 12
const INITIAL_PASSWORD = "ChangeMe123!";

const prisma = getPrisma();

type SeedUser = {
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMIN";
  isActive: boolean;
};

const seedUsers: SeedUser[] = [
  // Migrated Requesters (≥4 active + 1 inactive)
  { name: "Alice Johnson",  email: "alice.john@mail.kmutt.ac.th",   role: "REQUESTER", isActive: true  },
  { name: "Bob Smith",      email: "bob.smit@mail.kmutt.ac.th",     role: "REQUESTER", isActive: true  },
  { name: "Carol Martinez", email: "carol.mart@mail.kmutt.ac.th",   role: "REQUESTER", isActive: true  },
  { name: "David Lee",      email: "david.lee1@mail.kmutt.ac.th",   role: "REQUESTER", isActive: true  },
  { name: "Eve Turner",     email: "eve.turn@mail.kmutt.ac.th",     role: "REQUESTER", isActive: false },
  // IT Staff (≥3 active + 1 inactive)
  { name: "Frank Nguyen",   email: "frank.ngu@mail.kmutt.ac.th",    role: "IT_STAFF",  isActive: true  },
  { name: "Grace Patel",    email: "grace.pat@mail.kmutt.ac.th",    role: "IT_STAFF",  isActive: true  },
  { name: "Hannah Kim",     email: "hannah.kim@mail.kmutt.ac.th",   role: "IT_STAFF",  isActive: true  },
  { name: "Ivan Rossi",     email: "ivan.ros@mail.kmutt.ac.th",     role: "IT_STAFF",  isActive: false },
  // Administrators (2 active — one spare so the last-active-Administrator
  // safety rule and self-deactivation tests are possible)
  { name: "Omar Farouk",    email: "omar.far@mail.kmutt.ac.th",     role: "ADMIN",     isActive: true  },
  { name: "Priya Nair",     email: "priya.nai@mail.kmutt.ac.th",    role: "ADMIN",     isActive: true  },
];

type SeedTicket = {
  ticketNumber: string;
  submittedByEmail: string;
  ownerEmail: string | null;
  categoryName: string;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  currentStatus:
    | "NEW"
    | "OPEN"
    | "IN_PROGRESS"
    | "WAITING_FOR_REQUESTER"
    | "RESOLVED"
    | "CLOSED"
    | "REOPENED"
    | "CANCELLED";
  ticketDate: string;
  createdAt: string;
};

// One ticket per status × two per status repetition; priorities and ownership
// are distributed across Requesters / IT Staff / Administrators and cover both
// assigned (owner) and unassigned (owner null) cases (specification.md §7.5).
const seedTickets: SeedTicket[] = [
  {
    ticketNumber: "TKT-000001",
    submittedByEmail: "alice.john@mail.kmutt.ac.th",
    ownerEmail: null,
    categoryName: "Account and Access",
    relatedSystemName: "Email",
    summary: "Cannot sign in to campus email",
    description:
      "I have not been able to sign in to my campus email account for two days. The portal accepts my username but rejects the password with a generic error even after several attempts.",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    ticketDate: "2026-09-01T08:30:00.000Z",
    createdAt: "2026-09-01T08:30:00.000Z",
  },
  {
    ticketNumber: "TKT-000002",
    submittedByEmail: "bob.smit@mail.kmutt.ac.th",
    ownerEmail: "frank.ngu@mail.kmutt.ac.th",
    categoryName: "Hardware",
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description:
      "My corporate laptop battery drops from full to empty in under an hour on battery. The battery report shows 'replace soon' and the device shuts down without warning.",
    requestedPriority: "MEDIUM",
    currentStatus: "OPEN",
    ticketDate: "2026-09-02T10:15:00.000Z",
    createdAt: "2026-09-02T10:15:00.000Z",
  },
  {
    ticketNumber: "TKT-000003",
    submittedByEmail: "carol.mart@mail.kmutt.ac.th",
    ownerEmail: "grace.pat@mail.kmutt.ac.th",
    categoryName: "Network",
    relatedSystemName: "Campus Wi-Fi",
    summary: "Wi-Fi drops in lecture hall B",
    description:
      "The campus Wi-Fi disconnects every few minutes in lecture hall B. The issue affects multiple attendees, so it looks like an access point problem rather than a device problem.",
    requestedPriority: "HIGH",
    currentStatus: "IN_PROGRESS",
    ticketDate: "2026-09-03T14:45:00.000Z",
    createdAt: "2026-09-03T14:45:00.000Z",
  },
  {
    ticketNumber: "TKT-000004",
    submittedByEmail: "david.lee1@mail.kmutt.ac.th",
    ownerEmail: "frank.ngu@mail.kmutt.ac.th",
    categoryName: "Software",
    relatedSystemName: "LEB2 App",
    summary: "LEB2 app fails to open",
    description:
      "The LEB2 app shows a blank white screen after the splash splash. Reinstalling did not help. The account login works on the web version, so the issue is app specific.",
    requestedPriority: "MEDIUM",
    currentStatus: "WAITING_FOR_REQUESTER",
    ticketDate: "2026-09-04T09:00:00.000Z",
    createdAt: "2026-09-04T09:00:00.000Z",
  },
  {
    ticketNumber: "TKT-000005",
    submittedByEmail: "alice.john@mail.kmutt.ac.th",
    ownerEmail: "hannah.kim@mail.kmutt.ac.th",
    categoryName: "Account and Access",
    relatedSystemName: "VPN",
    summary: "VPN profile re-install",
    description:
      "My VPN profile expired after the OS update. I need the profile re-registered so I can connect to the campus network from home.",
    requestedPriority: "LOW",
    currentStatus: "RESOLVED",
    ticketDate: "2026-09-05T11:20:00.000Z",
    createdAt: "2026-09-05T11:20:00.000Z",
  },
  {
    ticketNumber: "TKT-000006",
    submittedByEmail: "bob.smit@mail.kmutt.ac.th",
    ownerEmail: null,
    categoryName: "Hardware",
    relatedSystemName: "Printer",
    summary: "Printer not detecting paper size",
    description:
      "The shared printer on floor 3 reports the wrong paper size for tray 2 and will not print A4. The error clears after a manual override but returns on the next job.",
    requestedPriority: "MEDIUM",
    currentStatus: "CLOSED",
    ticketDate: "2026-09-06T13:40:00.000Z",
    createdAt: "2026-09-06T13:40:00.000Z",
  },
  {
    ticketNumber: "TKT-000007",
    submittedByEmail: "carol.mart@mail.kmutt.ac.th",
    ownerEmail: "grace.pat@mail.kmutt.ac.th",
    categoryName: "Software",
    relatedSystemName: "Grade Submission App",
    summary: "Grade entry lag after update",
    description:
      "The grade submission app became noticeably slow after the weekend update. Entering a grade takes several seconds and the page occasionally freezes on save.",
    requestedPriority: "HIGH",
    currentStatus: "REOPENED",
    ticketDate: "2026-09-07T15:10:00.000Z",
    createdAt: "2026-09-07T15:10:00.000Z",
  },
  {
    ticketNumber: "TKT-000008",
    submittedByEmail: "david.lee1@mail.kmutt.ac.th",
    ownerEmail: null,
    categoryName: "Account and Access",
    relatedSystemName: "Email",
    summary: "Duplicate account cleanup",
    description:
      "I have two inboxes showing with the same name in the address book. Both belong to me; please remove the older duplicate so it stops appearing in shared lists.",
    requestedPriority: "LOW",
    currentStatus: "CANCELLED",
    ticketDate: "2026-09-08T08:55:00.000Z",
    createdAt: "2026-09-08T08:55:00.000Z",
  },
  {
    ticketNumber: "TKT-000009",
    submittedByEmail: "alice.john@mail.kmutt.ac.th",
    ownerEmail: "omar.far@mail.kmutt.ac.th",
    categoryName: "Hardware",
    relatedSystemName: "Corporate Laptop",
    summary: "Keyboard key not responding",
    description:
      "The L key on my laptop keyboard responds only when pressed very hard. Other keys work normally and it has not been dropped or exposed to liquid recently.",
    requestedPriority: "MEDIUM",
    currentStatus: "NEW",
    ticketDate: "2026-09-09T10:05:00.000Z",
    createdAt: "2026-09-09T10:05:00.000Z",
  },
  {
    ticketNumber: "TKT-000010",
    submittedByEmail: "bob.smit@mail.kmutt.ac.th",
    ownerEmail: null,
    categoryName: "Network",
    relatedSystemName: "Campus Wi-Fi",
    summary: "Guests cannot access portal",
    description:
      "Visitors report that the guest Wi-Fi portal loads a certificate warning and rejects the sign-in. Staff devices on the same network connect without problems.",
    requestedPriority: "LOW",
    currentStatus: "OPEN",
    ticketDate: "2026-09-10T12:25:00.000Z",
    createdAt: "2026-09-10T12:25:00.000Z",
  },
  {
    ticketNumber: "TKT-000011",
    submittedByEmail: "carol.mart@mail.kmutt.ac.th",
    ownerEmail: "priya.nai@mail.kmutt.ac.th",
    categoryName: "Software",
    relatedSystemName: "LEB2 App",
    summary: "App notifications delayed",
    description:
      "Push notifications in the LEB2 app arrive ten to fifteen minutes after the event. Class reminders therefore show up when the class has already started.",
    requestedPriority: "MEDIUM",
    currentStatus: "IN_PROGRESS",
    ticketDate: "2026-09-11T09:35:00.000Z",
    createdAt: "2026-09-11T09:35:00.000Z",
  },
  {
    ticketNumber: "TKT-000012",
    submittedByEmail: "david.lee1@mail.kmutt.ac.th",
    ownerEmail: "hannah.kim@mail.kmutt.ac.th",
    categoryName: "Account and Access",
    relatedSystemName: "LEB2 App",
    summary: "Password reset not arriving",
    description:
      "The password reset email for my LEB2 app account does not arrive, even after checking spam. I am locked out and need access before the afternoon lab session.",
    requestedPriority: "HIGH",
    currentStatus: "WAITING_FOR_REQUESTER",
    ticketDate: "2026-09-12T07:50:00.000Z",
    createdAt: "2026-09-12T07:50:00.000Z",
  },
  {
    ticketNumber: "TKT-000013",
    submittedByEmail: "eve.turn@mail.kmutt.ac.th",
    ownerEmail: "frank.ngu@mail.kmutt.ac.th",
    categoryName: "Hardware",
    relatedSystemName: "Printer",
    summary: "Scanner tray error",
    description:
      "The multifunction printer reports a scanner tray error and will not scan documents. Printing still works normally. The error appeared after the morning reboot.",
    requestedPriority: "MEDIUM",
    currentStatus: "OPEN",
    ticketDate: "2026-09-13T16:05:00.000Z",
    createdAt: "2026-09-13T16:05:00.000Z",
  },
  {
    ticketNumber: "TKT-000014",
    submittedByEmail: "alice.john@mail.kmutt.ac.th",
    ownerEmail: null,
    categoryName: "Network",
    relatedSystemName: "VPN",
    summary: "VPN slow after client update",
    description:
      "After the VPN client updated, the connection is noticeably slower for file access. Web browsing is acceptable but mapped network drives time out frequently.",
    requestedPriority: "MEDIUM",
    currentStatus: "RESOLVED",
    ticketDate: "2026-09-14T11:50:00.000Z",
    createdAt: "2026-09-14T11:50:00.000Z",
  },
  {
    ticketNumber: "TKT-000015",
    submittedByEmail: "bob.smit@mail.kmutt.ac.th",
    ownerEmail: "grace.pat@mail.kmutt.ac.th",
    categoryName: "Account and Access",
    relatedSystemName: "Email",
    summary: "Mailbox size alert",
    description:
      "My mailbox reached the size limit and new messages are being rejected. I need the archive policy checked or the quota increased before the end of the month.",
    requestedPriority: "HIGH",
    currentStatus: "CLOSED",
    ticketDate: "2026-09-15T09:40:00.000Z",
    createdAt: "2026-09-15T09:40:00.000Z",
  },
  {
    ticketNumber: "TKT-000016",
    submittedByEmail: "carol.mart@mail.kmutt.ac.th",
    ownerEmail: null,
    categoryName: "Software",
    relatedSystemName: "Grade Submission App",
    summary: "Export button greyed out",
    description:
      "The 'Export to CSV' button in the grade submission app is greyed out for one of my sections while it works for the others. Refreshing does not restore it.",
    requestedPriority: "LOW",
    currentStatus: "IN_PROGRESS",
    ticketDate: "2026-09-16T14:20:00.000Z",
    createdAt: "2026-09-16T14:20:00.000Z",
  },
];

// Authors resolve by email; content is created only when the exact
// (ticket, author, content) triple is absent so re-runs never duplicate.
type SeedComment = {
  ticketNumber: string;
  authorEmail: string;
  content: string;
  createdAt: string;
};

const seedPublicComments: SeedComment[] = [
  {
    ticketNumber: "TKT-000001",
    authorEmail: "alice.john@mail.kmutt.ac.th",
    content:
      "I tried again this morning from the web portal and the same error appears. Let me know if you need a screenshot of the message.",
    createdAt: "2026-09-01T09:10:00.000Z",
  },
  {
    ticketNumber: "TKT-000001",
    authorEmail: "grace.pat@mail.kmutt.ac.th",
    content:
      "Thanks Alice, we can see the failed attempts on your account. We are checking the authentication server logs and will follow up shortly.",
    createdAt: "2026-09-02T08:00:00.000Z",
  },
  {
    ticketNumber: "TKT-000003",
    authorEmail: "carol.mart@mail.kmutt.ac.th",
    content:
      "Still happening this morning and now the room 3 seats right next to the projector are affected too.",
    createdAt: "2026-09-04T09:20:00.000Z",
  },
  {
    ticketNumber: "TKT-000003",
    authorEmail: "grace.pat@mail.kmutt.ac.th",
    content:
      "We found an access point near hall B with a failing antenna port. Replacement hardware is on order.",
    createdAt: "2026-09-05T13:15:00.000Z",
  },
  {
    ticketNumber: "TKT-000005",
    authorEmail: "hannah.kim@mail.kmutt.ac.th",
    content:
      "Your VPN profile was re-registered successfully. Please reconnect with the updated profile and confirm.",
    createdAt: "2026-09-06T10:30:00.000Z",
  },
  {
    ticketNumber: "TKT-000007",
    authorEmail: "carol.mart@mail.kmutt.ac.th",
    content:
      "The lag is back after the weekend update went live, so the previous fix did not fully address it.",
    createdAt: "2026-09-09T09:05:00.000Z",
  },
  {
    ticketNumber: "TKT-000012",
    authorEmail: "hannah.kim@mail.kmutt.ac.th",
    content:
      "A new reset link was sent to your inbox. Please check it, including the spam folder, and let us know if it still does not arrive.",
    createdAt: "2026-09-12T09:00:00.000Z",
  },
];

const seedInternalNotes: SeedComment[] = [
  {
    ticketNumber: "TKT-000002",
    authorEmail: "frank.ngu@mail.kmutt.ac.th",
    content:
      "Battery health report confirms 82% wear after 3 years. Replacement battery ordered; awaiting user confirmation for the swap.",
    createdAt: "2026-09-02T15:00:00.000Z",
  },
  {
    ticketNumber: "TKT-000003",
    authorEmail: "grace.pat@mail.kmutt.ac.th",
    content:
      "Suspect AP-2049 in hall B. Verified failing antenna port; replacement requested from the network vendor.",
    createdAt: "2026-09-05T13:30:00.000Z",
  },
  {
    ticketNumber: "TKT-000005",
    authorEmail: "hannah.kim@mail.kmutt.ac.th",
    content:
      "Re-issued VPN profile and verified a clean connection from the lab network. Ticket can be closed on user confirmation.",
    createdAt: "2026-09-06T10:35:00.000Z",
  },
  {
    ticketNumber: "TKT-000007",
    authorEmail: "grace.pat@mail.kmutt.ac.th",
    content:
      "Rolled back the cache patch that caused the lag. Monitoring the app response time through the end of the week.",
    createdAt: "2026-09-09T09:20:00.000Z",
  },
  {
    ticketNumber: "TKT-000011",
    authorEmail: "priya.nai@mail.kmutt.ac.th",
    content:
      "Notification latency traced to the push service queue. Escalated to the backend team; expected resolution Wednesday.",
    createdAt: "2026-09-11T15:40:00.000Z",
  },
];

async function main() {
  // Categories (unchanged from Lab 2)
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

  // Related systems (unchanged from Lab 2)
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

  // Users. Requesters that were migrated from Lab 2 are preserved as-is
  // (`update: {}`); new accounts are created with the documented development
  // initial password and `mustChangePassword = true`.
  await prisma.$transaction(
    seedUsers.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          passwordHash: bcrypt.hashSync(INITIAL_PASSWORD, BCRYPT_COST),
          mustChangePassword: true,
        },
      })
    )
  );

  const byEmail = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(byEmail.map((u) => [u.email, u.id]));
  const categoryByName = new Map(
    (await prisma.category.findMany()).map((c) => [c.name, c.id])
  );
  const systemByName = new Map(
    (await prisma.relatedSystem.findMany()).map((s) => [s.name, s.id])
  );

  // Tickets: upserted by ticketNumber so re-runs never create duplicates.
  // The `update` branch restores the seed definition, keeping the dataset
  // deterministic for the test suite.
  await prisma.$transaction(
    seedTickets.map((t) => {
      const data = {
        ticketNumber: t.ticketNumber,
        submittedById: userByEmail.get(t.submittedByEmail)!,
        ownerId: t.ownerEmail ? userByEmail.get(t.ownerEmail) : null,
        categoryId: categoryByName.get(t.categoryName)!,
        relatedSystemId: systemByName.get(t.relatedSystemName)!,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.requestedPriority, // copied from requestedPriority at creation
        currentStatus: t.currentStatus,
        ticketDate: new Date(t.ticketDate),
        createdAt: new Date(t.createdAt),
      };
      return prisma.ticket.upsert({
        where: { ticketNumber: t.ticketNumber },
        update: data,
        create: data,
      });
    })
  );

  const ticketByNumber = new Map(
    (await prisma.ticket.findMany({ select: { id: true, ticketNumber: true } })).map(
      (t) => [t.ticketNumber, t.id]
    )
  );

  // Comments / notes are inserted only when the exact triple is missing.
  for (const c of seedPublicComments) {
    const ticketId = ticketByNumber.get(c.ticketNumber)!;
    const authorId = userByEmail.get(c.authorEmail)!;
    const existing = await prisma.publicComment.count({
      where: { ticketId, authorId, content: c.content },
    });
    if (existing === 0) {
      await prisma.publicComment.create({
        data: {
          ticketId,
          authorId,
          content: c.content,
          createdAt: new Date(c.createdAt),
        },
      });
    }
  }

  for (const n of seedInternalNotes) {
    const ticketId = ticketByNumber.get(n.ticketNumber)!;
    const authorId = userByEmail.get(n.authorEmail)!;
    const existing = await prisma.internalNote.count({
      where: { ticketId, authorId, content: n.content },
    });
    if (existing === 0) {
      await prisma.internalNote.create({
        data: {
          ticketId,
          authorId,
          content: n.content,
          createdAt: new Date(n.createdAt),
        },
      });
    }
  }

  await report();
}

async function report() {
  const users = await prisma.user.findMany();
  const roleCount = (role: string) => users.filter((u) => u.role === role).length;
  const activeCount = (role: string) =>
    users.filter((u) => u.role === role && u.isActive).length;
  const inactiveCount = (role: string) =>
    users.filter((u) => u.role === role && !u.isActive).length;

  console.log(`Seeded ${(await prisma.category.count())} categories.`);
  console.log(`Seeded ${(await prisma.relatedSystem.count())} related systems.`);
  console.log(
    `Seeded ${activeCount("REQUESTER")} active + ${inactiveCount("REQUESTER")} inactive Requester(s).`
  );
  console.log(
    `Seeded ${activeCount("IT_STAFF")} active + ${inactiveCount("IT_STAFF")} inactive IT Staff.`
  );
  console.log(`Seeded ${activeCount("ADMIN")} active Administrator(s).`);
  console.log(`Seeded ${(await prisma.ticket.count())} tickets.`);
  console.log(`Seeded ${(await prisma.publicComment.count())} public comment(s).`);
  console.log(`Seeded ${(await prisma.internalNote.count())} internal note(s).`);
}

main()
  .then(() => {
    console.log(
      `\nSeed complete. All accounts use the shared development initial password` +
        ` "${INITIAL_PASSWORD}" and must change it at first login (mustChangePassword).\n` +
        `  e.g. alice.john@mail.kmutt.ac.th / ${INITIAL_PASSWORD} (Requester),\n` +
        `       frank.ngu@mail.kmutt.ac.th     / ${INITIAL_PASSWORD} (IT Staff),\n` +
        `       omar.far@mail.kmutt.ac.th      / ${INITIAL_PASSWORD} (Admin).`
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });