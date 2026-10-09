import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";

// ---------------------------------------------------------------------------
// lab-04 / staff-dashboard.api.test.ts — API-28–API-34, API-36
// (docs/lab-04/tests.md §2.4, api-spec §4.6, BR-15, D-07). API-35 (safe 500)
// belongs to final hardening; API-39 (inactive session) is covered by the
// actions-taken suite through the same global guard.
// ---------------------------------------------------------------------------
// Shared-DB note: queue-wide counts also reflect seed + sibling-suite rows,
// so global metrics are asserted against live-queried expectations (same
// predicates, same instant) while caller-scoped values (myAssigned, recent)
// and the inactive delta (API-36) are exact. Hand-computed counting semantics
// live in UNIT-04 on mocked sets.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  staffA: "sdash.staffa@mail.kmutt.ac.th",
  staffZero: "sdash.staffzero@mail.kmutt.ac.th",
  admin: "sdash.admin@mail.kmutt.ac.th",
  requester: "sdash.requester@mail.kmutt.ac.th",
  submitter: "sdash.submitter@mail.kmutt.ac.th",
};

const CAT = "StaffDash Test Category";
const SYS = "StaffDash Test System";

const refs: { categoryId: number; systemId: number; staffAId: number; submitterId: number } = {
  categoryId: 0,
  systemId: 0,
  staffAId: 0,
  submitterId: 0,
};

async function makeTicket(opts: {
  status: string;
  ownerEmail: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  n: string;
  updatedAt?: Date;
}): Promise<number> {
  const owner = opts.ownerEmail
    ? await prisma.user.findUniqueOrThrow({ where: { email: opts.ownerEmail } })
    : null;
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: opts.n,
      submittedById: refs.submitterId,
      ownerId: owner?.id ?? null,
      categoryId: refs.categoryId,
      relatedSystemId: refs.systemId,
      summary: `StaffDash fixture ${opts.n} summary text`,
      description: `StaffDash fixture ${opts.n} description with enough detail.`,
      requestedPriority: "MEDIUM",
      itPriority: opts.priority ?? "MEDIUM",
      currentStatus: opts.status as never,
    },
  });
  if (opts.updatedAt) {
    await prisma.ticket.update({ where: { id: t.id }, data: { updatedAt: opts.updatedAt } });
  }
  return t.id;
}

const ACTIVE = { currentStatus: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } };

// Retry helper for global-count assertions: suites share one database and run
// in parallel, so a sibling file can insert or remove rows between two reads
// (observed: ±1 NEW ticket, +2 users mid-run). Retrying absorbs transient
// drift; a systematically wrong predicate still fails every attempt because
// the live-queried expectation uses an independent predicate.
async function expectEventuallyConsistent(
  check: () => Promise<void>,
  attempts = 6
): Promise<void> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await check();
      return;
    } catch (err) {
      last = err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw last;
}

// Live-queried expectation using the same predicates as the route.
async function expectedMetrics() {
  const [fresh, open, inProgress, waitingForRequester, unassigned, low, medium, high] =
    await Promise.all([
      prisma.ticket.count({ where: { currentStatus: "NEW" } }),
      prisma.ticket.count({ where: { currentStatus: "OPEN" } }),
      prisma.ticket.count({ where: { currentStatus: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { ...ACTIVE, ownerId: null } }),
      prisma.ticket.count({ where: { ...ACTIVE, itPriority: "LOW" } }),
      prisma.ticket.count({ where: { ...ACTIVE, itPriority: "MEDIUM" } }),
      prisma.ticket.count({ where: { ...ACTIVE, itPriority: "HIGH" } }),
    ]);
  return {
    new: fresh,
    open,
    inProgress,
    waitingForRequester,
    unassigned,
    byPriority: { low, medium, high },
  };
}

beforeAll(async () => {
  await prisma.$connect();

  await createTestUser(prisma, EMAIL.staffA, "IT_STAFF", { name: "SDash Staff A" });
  await createTestUser(prisma, EMAIL.staffZero, "IT_STAFF", { name: "SDash Staff Zero" });
  await createTestUser(prisma, EMAIL.admin, "ADMIN", { name: "SDash Admin" });
  await createTestUser(prisma, EMAIL.requester, "REQUESTER", { name: "SDash Requester" });
  await createTestUser(prisma, EMAIL.submitter, "REQUESTER", { name: "SDash Submitter" });

  const category = await prisma.category.create({ data: { name: CAT } });
  const system = await prisma.relatedSystem.create({ data: { name: SYS } });
  refs.categoryId = category.id;
  refs.systemId = system.id;
  refs.staffAId = (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staffA } })).id;
  refs.submitterId = (
    await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.submitter } })
  ).id;

  // staffA-owned mix: 2 active + 3 terminal (excluded from myAssigned).
  const base = new Date("2026-09-10T00:00:00.000Z").getTime();
  const at = (hour: number) => new Date(base + hour * 3_600_000);
  await makeTicket({ status: "OPEN", ownerEmail: EMAIL.staffA, n: "TKSD-500001", updatedAt: at(1) });
  await makeTicket({ status: "IN_PROGRESS", ownerEmail: EMAIL.staffA, priority: "HIGH", n: "TKSD-500002", updatedAt: at(2) });
  await makeTicket({ status: "RESOLVED", ownerEmail: EMAIL.staffA, n: "TKSD-500003", updatedAt: at(3) });
  await makeTicket({ status: "CLOSED", ownerEmail: EMAIL.staffA, n: "TKSD-500004", updatedAt: at(4) });
  await makeTicket({ status: "CANCELLED", ownerEmail: EMAIL.staffA, n: "TKSD-500005", updatedAt: at(5) });
  // Queue-wide fixtures: one NEW unassigned + one OPEN unassigned (LOW).
  await makeTicket({ status: "NEW", ownerEmail: null, priority: "LOW", n: "TKSD-500006" });
  await makeTicket({ status: "OPEN", ownerEmail: null, priority: "LOW", n: "TKSD-500007" });
});

afterAll(async () => {
  await prisma.actionTaken.deleteMany({
    where: { ticket: { ticketNumber: { startsWith: "TKSD-" } } },
  });
  await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: "TKSD-" } },
  });
  await prisma.category.deleteMany({ where: { name: CAT } });
  await prisma.relatedSystem.deleteMany({ where: { name: SYS } });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "sdash.inactive" } },
  });
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-28 — queue-wide status metrics (AC-10 / BR-15)", () => {
  it("new/open/inProgress/waitingForRequester match live expectations", async () => {
    const agent = await loginAgent(app, EMAIL.staffA);
    await expectEventuallyConsistent(async () => {
      const res = await agent.get("/api/dashboard/staff");
      expect(res.status).toBe(200);
      const expected = await expectedMetrics();
      expect(res.body.data.metrics).toMatchObject({
        new: expected.new,
        open: expected.open,
        inProgress: expected.inProgress,
        waitingForRequester: expected.waitingForRequester,
      });
    });
    // Own NEW fixture guarantees signal regardless of sibling suites.
    const res = await agent.get("/api/dashboard/staff");
    expect(res.body.data.metrics.new).toBeGreaterThanOrEqual(1);
  });
});

describe("API-29 — myAssigned excludes terminal statuses (BR-15)", () => {
  it("counts only active Tickets owned by the caller", async () => {
    const agent = await loginAgent(app, EMAIL.staffA);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);
    // 2 active owned (OPEN, IN_PROGRESS); RESOLVED/CLOSED/CANCELLED excluded.
    expect(res.body.data.metrics.myAssigned).toBe(2);
  });
});

describe("API-30 — zero-assignment Staff user (AC-10 / BR-17)", () => {
  it("myAssigned 0 with an empty recent list, 200 not an error", async () => {
    const agent = await loginAgent(app, EMAIL.staffZero);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);
    expect(res.body.data.metrics.myAssigned).toBe(0);
    expect(res.body.data.recentTickets).toEqual([]);
  });
});

describe("API-31 — unassigned metric (AC-10 / BR-15)", () => {
  it("counts active ownerless Tickets, matching live expectation", async () => {
    const agent = await loginAgent(app, EMAIL.staffA);
    await expectEventuallyConsistent(async () => {
      const res = await agent.get("/api/dashboard/staff");
      expect(res.status).toBe(200);
      const expected = await expectedMetrics();
      expect(res.body.data.metrics.unassigned).toBe(expected.unassigned);
    });
    // Own unassigned fixtures guarantee signal regardless of sibling suites.
    const res = await agent.get("/api/dashboard/staff");
    expect(res.body.data.metrics.unassigned).toBeGreaterThanOrEqual(2);
  });
});

describe("API-32 — byPriority breakdown (AC-10 / BR-15)", () => {
  it("low/medium/high over active Tickets only, matching live expectation", async () => {
    const agent = await loginAgent(app, EMAIL.staffA);
    await expectEventuallyConsistent(async () => {
      const res = await agent.get("/api/dashboard/staff");
      expect(res.status).toBe(200);
      const expected = await expectedMetrics();
      expect(res.body.data.metrics.byPriority).toEqual(expected.byPriority);
    });
  });

  it("recentTickets holds the caller's 5 most recent owned Tickets", async () => {
    const agent = await loginAgent(app, EMAIL.staffA);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);
    const recent = res.body.data.recentTickets;
    expect(recent).toHaveLength(5);
    // Hours 5..1 → CANCELLED, CLOSED, RESOLVED, IN_PROGRESS, OPEN.
    expect(recent.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual([
      "TKSD-500005",
      "TKSD-500004",
      "TKSD-500003",
      "TKSD-500002",
      "TKSD-500001",
    ]);
  });
});

describe("API-33 — Requester denied (FR-11)", () => {
  it("Requester calling the staff endpoint → 403", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("API-34 — ADMIN sees userCounts, IT_STAFF omits it (FR-11 / BR-15, D-07)", () => {
  it("ADMIN receives identical queue metrics plus live-verified userCounts", async () => {
    const admin = await loginAgent(app, EMAIL.admin);
    await expectEventuallyConsistent(async () => {
      const res = await admin.get("/api/dashboard/staff");
      expect(res.status).toBe(200);
      const [requesters, itStaff, admins] = await Promise.all([
        prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
        prisma.user.count({ where: { role: "IT_STAFF", isActive: true } }),
        prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
      ]);
      expect(res.body.data.userCounts).toEqual({ requesters, itStaff, admins });
      expect(requesters).toBeGreaterThan(0);
    });
  });

  it("IT_STAFF response omits userCounts entirely (not null)", async () => {
    const agent = await loginAgent(app, EMAIL.staffA);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);
    expect("userCounts" in res.body.data).toBe(false);
  });
});

describe("API-36 — userCounts counts active users only (FR-11 / BR-15)", () => {
  it("newly deactivated users leave all three sub-counts unchanged", async () => {
    const admin = await loginAgent(app, EMAIL.admin);
    await createTestUser(prisma, "sdash.inactivereqr@mail.kmutt.ac.th", "REQUESTER", {
      name: "SDash Inactive R",
      isActive: false,
    });
    await createTestUser(prisma, "sdash.inactivestaff@mail.kmutt.ac.th", "IT_STAFF", {
      name: "SDash Inactive S",
      isActive: false,
    });

    // Inactive rows must never move the counts: compare two consecutive reads
    // with retries so concurrent sibling-suite writes cannot flake the test.
    await expectEventuallyConsistent(async () => {
      const first = (await admin.get("/api/dashboard/staff")).body.data.userCounts;
      const second = (await admin.get("/api/dashboard/staff")).body.data.userCounts;
      expect(second).toEqual(first);
      const live = {
        requesters: await prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
        itStaff: await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } }),
        admins: await prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
      };
      expect(second).toEqual(live);
    });
  });
});
