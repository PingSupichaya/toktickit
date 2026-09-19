import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";
import type {
  RequestedPriority,
  TicketStatus,
  User as PrismaUser,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// lab-03 / staff-queue.api.test.ts — API-15..API-21 (§2.3 tests.md)
//
//   API-15  default ordering (itPriority DESC, ticketDate ASC) + pagination
//   API-16  search over ticketNumber/summary/description/requester name/email
//   API-17  status/itPriority/category/relatedSystem filters combine with AND
//   API-18  assignment (unassigned/assignedToMe/all) and ownerId filters
//   API-19  every sortBy field × asc/desc with the ticketDate tiebreaker
//   API-20  invalid params -> 400 INVALID_PARAMETERS; page/pageSize fallbacks
//   API-21  empty result set + Requester denial (403 FORBIDDEN)
//
// Tickets are created directly through Prisma with explicit ticketDate and
// owner fields so ordering/filter expectations are fully deterministic. All
// rows and users created here are removed in afterAll so the suite repeats.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  staff1: "queue.staff1@mail.kmutt.ac.th",
  staff2: "queue.staff2@mail.kmutt.ac.th",
  reqA: "queue.reqone@mail.kmutt.ac.th",
  reqB: "queue.reqtwo@mail.kmutt.ac.th",
};

// Creation order defines auto-increment ids and therefore ticketNumber order.
// dateIdx is used to build a monotonic-ish ticketDate that is NOT aligned with
// creation order (so default ordering is a genuine re-sort).
interface TicketSpec {
  ref: string;
  req: "reqA" | "reqB";
  owner: "staff1" | "staff2" | null;
  cat: "c1" | "c2";
  sys: "s1" | "s2";
  status: TicketStatus;
  itPrio: RequestedPriority;
  dateIdx: number;
}

const TICKETS: TicketSpec[] = [
  { ref: "A", req: "reqA", owner: null, cat: "c1", sys: "s1", status: "NEW", itPrio: "HIGH", dateIdx: 1 },
  { ref: "B", req: "reqA", owner: "staff1", cat: "c2", sys: "s1", status: "OPEN", itPrio: "HIGH", dateIdx: 2 },
  { ref: "C", req: "reqA", owner: "staff2", cat: "c1", sys: "s2", status: "IN_PROGRESS", itPrio: "MEDIUM", dateIdx: 3 },
  { ref: "D", req: "reqB", owner: null, cat: "c2", sys: "s1", status: "OPEN", itPrio: "MEDIUM", dateIdx: 4 },
  { ref: "E", req: "reqB", owner: "staff1", cat: "c1", sys: "s2", status: "NEW", itPrio: "LOW", dateIdx: 5 },
  { ref: "F", req: "reqB", owner: "staff2", cat: "c2", sys: "s1", status: "WAITING_FOR_REQUESTER", itPrio: "LOW", dateIdx: 6 },
  { ref: "J", req: "reqB", owner: null, cat: "c2", sys: "s1", status: "CANCELLED", itPrio: "MEDIUM", dateIdx: 7 },
  { ref: "I", req: "reqA", owner: "staff2", cat: "c1", sys: "s1", status: "REOPENED", itPrio: "LOW", dateIdx: 8 },
  { ref: "H", req: "reqA", owner: "staff1", cat: "c2", sys: "s2", status: "CLOSED", itPrio: "MEDIUM", dateIdx: 9 },
  { ref: "G", req: "reqA", owner: null, cat: "c1", sys: "s1", status: "RESOLVED", itPrio: "HIGH", dateIdx: 10 },
  { ref: "K", req: "reqB", owner: "staff1", cat: "c1", sys: "s2", status: "NEW", itPrio: "HIGH", dateIdx: 11 },
  { ref: "L", req: "reqB", owner: "staff2", cat: "c2", sys: "s1", status: "IN_PROGRESS", itPrio: "LOW", dateIdx: 12 },
];

// DEFAULT_ORDER = itPriority DESC, ticketDate ASC over the 12 scoped tickets.
const DEFAULT_ORDER: string[] = ["A", "B", "G", "K", "C", "D", "J", "H", "E", "F", "I", "L"];

const SUMMARY_DESC_TERMS: Record<string, string> = {
  A: "fractal-fix",
  B: "hallowed-bolt",
  C: "cobalt-sweep",
  D: "dune-pivot",
  E: "ember-drift",
  F: "fieldstone-quick",
  J: "jettison-slate",
  I: "ironsand-pit",
  H: "hollow-coil",
  G: "glacial-fetch",
  K: "keeper-lens",
  L: "limnic-foil",
};
const SUMMARIES: Record<string, string> = {
  A: "QueueTest-Alpha printer jam",
  B: "QueueTest-Bravo laptop battery",
  C: "QueueTest-Charlie monitor flicker",
  D: "QueueTest-Delta keyboard torn",
  E: "QueueTest-Echo wifi drops",
  F: "QueueTest-Foxtrot dock usb",
  J: "QueueTest-Juliet headset crackle",
  I: "QueueTest-India camera blank",
  H: "QueueTest-Hotel dongle lost",
  G: "QueueTest-Golf vpn slow",
  K: "QueueTest-Kilo scanner jam",
  L: "QueueTest-Lima power adaptor",
};

const BASE_DATE = new Date("2026-01-10T08:00:00.000Z");

interface Refs {
  staff1Id: number;
  staff2Id: number;
  reqAId: number;
  reqBId: number;
  c1Id: number;
  c2Id: number;
  s1Id: number;
  s2Id: number;
  emptyCategoryId: number;
}

// ref -> ticketNumber resolved from the DB after creation.
const ticketNumberByRef = new Map<string, string>();

// `user` is reserved as a global in some environments; use staffUser.
const staffUser: { staff1: PrismaUser | null; staff2: PrismaUser | null } = {
  staff1: null,
  staff2: null,
};

function ticketNumber(ref: string): string {
  const n = ticketNumberByRef.get(ref);
  if (!n) throw new Error(`No ticket number for ref ${ref}`);
  return n;
}

const refs: Partial<Refs> = {};

const PRIORITY_RANK: Record<RequestedPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const STATUS_ORDER: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const STATUS_RANK: Record<TicketStatus, number> = Object.fromEntries(
  STATUS_ORDER.map((s, i) => [s, i])
) as Record<TicketStatus, number>;

type QueueRow = {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  ticketDate: string;
  updatedAt: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requester: { id: number; name: string; email: string };
  owner: { id: number; name: string; role: string } | null;
  attachmentCount: number;
};

function numbersOf(rows: QueueRow[]): string[] {
  return rows.map((r) => r.ticketNumber);
}

// Asserts rows are ordered by `key(col)` with direction `dir` and, for rows
// that tie on the primary key, ticketDate is non-decreasing (the api-spec
// §4.8 stable tiebreaker).
function assertOrdered(
  rows: QueueRow[],
  key: (row: QueueRow) => number,
  dir: "asc" | "desc"
) {
  for (let i = 1; i < rows.length; i++) {
    const a = key(rows[i - 1]);
    const b = key(rows[i]);
    if (dir === "asc") {
      expect(b).toBeGreaterThanOrEqual(a);
    } else {
      expect(b).toBeLessThanOrEqual(a);
    }
    if (a === b) {
      expect(Date.parse(rows[i].ticketDate)).toBeGreaterThanOrEqual(
        Date.parse(rows[i - 1].ticketDate)
      );
    }
  }
}

async function queueAs(agent: request.Agent, query: Record<string, unknown> = {}) {
  return agent.get("/api/tickets/queue").query(query);
}

beforeAll(async () => {
  await prisma.$connect();

  const staff1 = await createTestUser(prisma, EMAIL.staff1, "IT_STAFF", { name: "Queuer Staff One" });
  const staff2 = await createTestUser(prisma, EMAIL.staff2, "IT_STAFF", { name: "Queuer Staff Two" });
  const reqA = await createTestUser(prisma, EMAIL.reqA, "REQUESTER", { name: "Queuer One" });
  const reqB = await createTestUser(prisma, EMAIL.reqB, "REQUESTER", { name: "Queuer Two" });
  staffUser.staff1 = staff1;
  staffUser.staff2 = staff2;

  const c1 = await prisma.category.create({ data: { name: "Queue Test Category A" } });
  const c2 = await prisma.category.create({ data: { name: "Queue Test Category B" } });
  const s1 = await prisma.relatedSystem.create({ data: { name: "Queue Test System One" } });
  const s2 = await prisma.relatedSystem.create({ data: { name: "Queue Test System Two" } });
  const emptyCategory = await prisma.category.create({
    data: { name: `Queue Empty Category ${Date.now()}` },
  });

  refs.staff1Id = staff1.id;
  refs.staff2Id = staff2.id;
  refs.reqAId = reqA.id;
  refs.reqBId = reqB.id;
  refs.c1Id = c1.id;
  refs.c2Id = c2.id;
  refs.s1Id = s1.id;
  refs.s2Id = s2.id;
  refs.emptyCategoryId = emptyCategory.id;

  for (let i = 0; i < TICKETS.length; i++) {
    const spec = TICKETS[i];
    const created = await prisma.ticket.create({
      data: {
        ticketNumber: `TKQ-${String(100000 + i + 1)}`,
        submittedById:
          spec.req === "reqA" ? reqA.id : reqB.id,
        ownerId:
          spec.owner === "staff1" ? staff1.id : spec.owner === "staff2" ? staff2.id : null,
        categoryId: spec.cat === "c1" ? c1.id : c2.id,
        relatedSystemId: spec.sys === "s1" ? s1.id : s2.id,
        summary: SUMMARIES[spec.ref],
        description: `QueueTest description for ${spec.ref} with token ${SUMMARY_DESC_TERMS[spec.ref]}.`,
        requestedPriority: spec.itPrio,
        itPriority: spec.itPrio,
        currentStatus: spec.status,
        ticketDate: new Date(BASE_DATE.getTime() + spec.dateIdx * 3_600_000),
      },
    });
    ticketNumberByRef.set(spec.ref, created.ticketNumber);
  }

  expect(ticketNumberByRef.size).toBe(TICKETS.length);
});

afterAll(async () => {
  const ids = Array.from(ticketNumberByRef.values());
  await prisma.ticket.deleteMany({ where: { ticketNumber: { in: ids } } });
  await prisma.category.deleteMany({
    where: {
      name: { in: ["Queue Test Category A", "Queue Test Category B"] },
    },
  });
  await prisma.relatedSystem.deleteMany({
    where: { name: { in: ["Queue Test System One", "Queue Test System Two"] } },
  });
  if (refs.emptyCategoryId !== undefined) {
    await prisma.category.delete({ where: { id: refs.emptyCategoryId } }).catch(() => {});
  }
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-15 — default ordering + pagination metadata (AC-08 / BR-39)", () => {
  it("orders itPriority DESC then ticketDate ASC with no sortBy", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QueueTest", pageSize: 25 });

    expect(res.status).toBe(200);
    expect(numbersOf(res.body.data)).toEqual(
      DEFAULT_ORDER.map(ticketNumber)
    );
  });

  it("returns correct page-1/page-2 metadata for pageSize 10", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);

    const page1 = await queueAs(agent, { search: "QueueTest", page: 1, pageSize: 10 });
    expect(page1.status).toBe(200);
    expect(numbersOf(page1.body.data)).toEqual(
      DEFAULT_ORDER.slice(0, 10).map(ticketNumber)
    );
    expect(page1.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 12,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const page2 = await queueAs(agent, { search: "QueueTest", page: 2, pageSize: 10 });
    expect(page2.status).toBe(200);
    expect(numbersOf(page2.body.data)).toEqual(
      DEFAULT_ORDER.slice(10).map(ticketNumber)
    );
    expect(page2.body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalCount: 12,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it("exposes the documented row shape", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QueueTest", pageSize: 25 });
    const row = res.body.data[0];

    expect(typeof row.id).toBe("number");
    expect(typeof row.ticketNumber).toBe("string");
    expect(typeof row.summary).toBe("string");
    expect(typeof row.requestedPriority).toBe("string");
    expect(typeof row.itPriority).toBe("string");
    expect(typeof row.currentStatus).toBe("string");
    expect(Number.isNaN(Date.parse(row.ticketDate))).toBe(false);
    expect(Number.isNaN(Date.parse(row.updatedAt))).toBe(false);

    expect(row.category).toEqual(expect.objectContaining({ id: expect.any(Number), name: expect.any(String) }));
    expect(row.relatedSystem).toEqual(expect.objectContaining({ id: expect.any(Number), name: expect.any(String) }));
    expect(row.requester).toEqual(
      expect.objectContaining({ id: expect.any(Number), name: expect.any(String), email: expect.any(String) })
    );
    expect(row.owner === null || typeof row.owner.role === "string").toBe(true);
    expect(row.attachmentCount).toBeTypeOf("number");
  });
});

describe("API-16 — queue search fields (AC-08 / BR-37)", () => {
  it("matches a case-insensitive substring in ticketNumber", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: ticketNumber("A").toLowerCase() });

    expect(res.status).toBe(200);
    expect(numbersOf(res.body.data)).toEqual([ticketNumber("A")]);
  });

  it("matches a case-insensitive substring in summary", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "aLpHa" });

    expect(res.status).toBe(200);
    expect(numbersOf(res.body.data)).toEqual([ticketNumber("A")]);
  });

  it("matches a case-insensitive substring in description", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "FrAcTaL-FiX" });

    expect(res.status).toBe(200);
    expect(numbersOf(res.body.data)).toEqual([ticketNumber("A")]);
  });

  it("matches a substring of the requester name (case-insensitive)", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QUEUER one" });

    expect(res.status).toBe(200);
    const expected = ["A", "B", "C", "G", "H", "I"].map(ticketNumber).sort();
    const got = numbersOf(res.body.data).sort();
    expect(got).toEqual(expected);
    for (const row of res.body.data) {
      expect(row.requester.name).toBe("Queuer One");
    }
  });

  it("matches a substring of the requester email (case-insensitive)", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "ReQtwO" });

    expect(res.status).toBe(200);
    const expected = ["D", "E", "F", "J", "K", "L"].map(ticketNumber).sort();
    const got = numbersOf(res.body.data).sort();
    expect(got).toEqual(expected);
    for (const row of res.body.data) {
      expect(row.requester.email).toBe(EMAIL.reqB);
    }
  });
});

describe("API-17 — status, itPriority, category, relatedSystem filters combine with AND (AC-08 / BR-38)", () => {
  it("filters by status", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QueueTest", status: "NEW" });
    expect(numbersOf(res.body.data).sort()).toEqual(
      ["A", "E", "K"].map(ticketNumber).sort()
    );
  });

  it("filters by itPriority via the priority param", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QueueTest", priority: "HIGH" });
    expect(numbersOf(res.body.data).sort()).toEqual(
      ["A", "B", "G", "K"].map(ticketNumber).sort()
    );
    for (const row of res.body.data) expect(row.itPriority).toBe("HIGH");
  });

  it("filters by categoryId and relatedSystemId", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);

    const byCat = await queueAs(agent, { search: "QueueTest", categoryId: refs.c1Id });
    expect(numbersOf(byCat.body.data).sort()).toEqual(
      ["A", "C", "E", "G", "I", "K"].map(ticketNumber).sort()
    );

    const bySys = await queueAs(agent, { search: "QueueTest", relatedSystemId: refs.s1Id });
    expect(numbersOf(bySys.body.data).sort()).toEqual(
      ["A", "B", "D", "F", "G", "I", "J", "L"].map(ticketNumber).sort()
    );

    const both = await queueAs(agent, {
      search: "QueueTest",
      categoryId: refs.c1Id,
      relatedSystemId: refs.s2Id,
    });
    expect(numbersOf(both.body.data).sort()).toEqual(
      ["C", "E", "K"].map(ticketNumber).sort()
    );
  });

  it("filters with AND logic (each filter narrows the previous)", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);

    const statusOnly = await queueAs(agent, { search: "QueueTest", status: "OPEN" });
    expect(numbersOf(statusOnly.body.data).sort()).toEqual(
      ["B", "D"].map(ticketNumber).sort()
    );

    const statusAndPriority = await queueAs(agent, {
      search: "QueueTest",
      status: "OPEN",
      priority: "HIGH",
    });
    expect(numbersOf(statusAndPriority.body.data).sort()).toEqual(
      [ticketNumber("B")]
    );

    const allFour = await queueAs(agent, {
      search: "QueueTest",
      status: "NEW",
      priority: "HIGH",
      categoryId: refs.c1Id,
      relatedSystemId: refs.s2Id,
    });
    expect(numbersOf(allFour.body.data).sort()).toEqual([ticketNumber("K")]);
  });
});

describe("API-18 — assignment and ownerId filters (AC-08 / BR-38)", () => {
  it("assignment=unassigned returns only null owners", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QueueTest", assignment: "unassigned" });
    expect(numbersOf(res.body.data).sort()).toEqual(
      ["A", "D", "G", "J"].map(ticketNumber).sort()
    );
    for (const row of res.body.data) expect(row.owner).toBeNull();
  });

  it("assignment=assignedToMe returns only the caller's tickets", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "QueueTest", assignment: "assignedToMe" });
    expect(numbersOf(res.body.data).sort()).toEqual(
      ["B", "E", "H", "K"].map(ticketNumber).sort()
    );
    for (const row of res.body.data) expect(row.owner.id).toBe(staffUser.staff1!.id);
  });

  it("assignment=assignedToMe scoped to a second staff user", async () => {
    const agent = await loginAgent(app, EMAIL.staff2);
    const res = await queueAs(agent, { search: "QueueTest", assignment: "assignedToMe" });
    expect(numbersOf(res.body.data).sort()).toEqual(
      ["C", "F", "I", "L"].map(ticketNumber).sort()
    );
    for (const row of res.body.data) expect(row.owner.id).toBe(staffUser.staff2!.id);
  });

  it("ownerId narrows to that owner, and works with assignment=all", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);

    const byOwner = await queueAs(agent, { search: "QueueTest", ownerId: refs.staff2Id });
    expect(numbersOf(byOwner.body.data).sort()).toEqual(
      ["C", "F", "I", "L"].map(ticketNumber).sort()
    );

    const all = await queueAs(agent, {
      search: "QueueTest",
      assignment: "all",
      ownerId: refs.staff2Id,
    });
    expect(numbersOf(all.body.data).sort()).toEqual(
      ["C", "F", "I", "L"].map(ticketNumber).sort()
    );
  });

  it("ownerId is ignored when assignment is unassigned", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, {
      search: "QueueTest",
      assignment: "unassigned",
      ownerId: refs.staff1Id,
    });
    expect(numbersOf(res.body.data).sort()).toEqual(
      ["A", "D", "G", "J"].map(ticketNumber).sort()
    );
  });
});

describe("API-19 — sort fields and direction (AC-08 / BR-39)", () => {
  it("sorts by itPriority asc/desc with ticketDate asc tiebreaker", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);

    const asc = await queueAs(agent, { search: "QueueTest", sortBy: "itPriority", sortOrder: "asc", pageSize: 25 });
    assertOrdered(asc.body.data, (r) => PRIORITY_RANK[r.itPriority], "asc");
    expect(asc.body.data[0].itPriority).toBe("LOW");

    const desc = await queueAs(agent, { search: "QueueTest", sortBy: "itPriority", sortOrder: "desc", pageSize: 25 });
    assertOrdered(desc.body.data, (r) => PRIORITY_RANK[r.itPriority], "desc");
    expect(desc.body.data[0].itPriority).toBe("HIGH");
  });

  it("sorts by requestedPriority asc/desc", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const asc = await queueAs(agent, { search: "QueueTest", sortBy: "requestedPriority", sortOrder: "asc", pageSize: 25 });
    assertOrdered(asc.body.data, (r) => PRIORITY_RANK[r.requestedPriority], "asc");

    const desc = await queueAs(agent, { search: "QueueTest", sortBy: "requestedPriority", sortOrder: "desc", pageSize: 25 });
    assertOrdered(desc.body.data, (r) => PRIORITY_RANK[r.requestedPriority], "desc");
  });

  it("sorts by ticketDate asc/desc", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const asc = await queueAs(agent, { search: "QueueTest", sortBy: "ticketDate", sortOrder: "asc", pageSize: 25 });
    assertOrdered(asc.body.data, (r) => Date.parse(r.ticketDate), "asc");

    const desc = await queueAs(agent, { search: "QueueTest", sortBy: "ticketDate", sortOrder: "desc", pageSize: 25 });
    assertOrdered(desc.body.data, (r) => Date.parse(r.ticketDate), "desc");
    expect(desc.body.data[0].ticketDate).toBe(
      new Date(BASE_DATE.getTime() + 12 * 3_600_000).toISOString()
    );
  });

  it("sorts by updatedAt asc/desc", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const asc = await queueAs(agent, { search: "QueueTest", sortBy: "updatedAt", sortOrder: "asc", pageSize: 25 });
    assertOrdered(asc.body.data, (r) => Date.parse(r.updatedAt), "asc");

    const desc = await queueAs(agent, { search: "QueueTest", sortBy: "updatedAt", sortOrder: "desc", pageSize: 25 });
    assertOrdered(desc.body.data, (r) => Date.parse(r.updatedAt), "desc");
  });

  it("sorts by ticketNumber asc/desc", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const asc = await queueAs(agent, { search: "QueueTest", sortBy: "ticketNumber", sortOrder: "asc", pageSize: 25 });
    const createdOrder = TICKETS.map((t) => t.ref);
    expect(numbersOf(asc.body.data)).toEqual(createdOrder.map(ticketNumber));

    const desc = await queueAs(agent, { search: "QueueTest", sortBy: "ticketNumber", sortOrder: "desc", pageSize: 25 });
    expect(numbersOf(desc.body.data)).toEqual(
      [...createdOrder].reverse().map(ticketNumber)
    );
  });

  it("sorts the 8 statuses by currentStatus asc/desc following enum order", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const asc = await queueAs(agent, { search: "QueueTest", sortBy: "currentStatus", sortOrder: "asc", pageSize: 25 });
    assertOrdered(asc.body.data, (r) => STATUS_RANK[r.currentStatus], "asc");

    const desc = await queueAs(agent, { search: "QueueTest", sortBy: "currentStatus", sortOrder: "desc", pageSize: 25 });
    assertOrdered(desc.body.data, (r) => STATUS_RANK[r.currentStatus], "desc");
  });
});

describe("API-20 — invalid params and page-size fallback (AC-08 / BR-39)", () => {
  it("returns 400 INVALID_PARAMETERS for invalid enum/assignment/owner values", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);

    const cases: Array<[string, unknown]> = [
      ["status", "GARBAGE"],
      ["status", "OPENN"],
      ["priority", "URGENT"],
      ["assignment", "assignedToSomeoneElse"],
      ["ownerId", "abc"],
      ["ownerId", "-3"],
      ["categoryId", "0"],
      ["relatedSystemId", "1.5"],
    ];
    for (const [param, value] of cases) {
      const res = await queueAs(agent, { [param]: value });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PARAMETERS");
      expect(res.body.error.details[param]).toBeTypeOf("string");
    }
  });

  it("falls back to pageSize 10 and page 1 for invalid pagination values", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const search = { search: "QueueTest" };

    const badSize = await queueAs(agent, { ...search, pageSize: 99 });
    expect(badSize.status).toBe(200);
    expect(badSize.body.pagination.pageSize).toBe(10);

    const badPage = await queueAs(agent, { ...search, page: 0 });
    expect(badPage.status).toBe(200);
    expect(badPage.body.pagination.page).toBe(1);

    const garbage = await queueAs(agent, { ...search, page: "abc", pageSize: "nope" });
    expect(garbage.status).toBe(200);
    expect(garbage.body.pagination).toEqual(
      expect.objectContaining({ page: 1, pageSize: 10 })
    );

    const size25 = await queueAs(agent, { ...search, pageSize: 25 });
    expect(size25.status).toBe(200);
    expect(size25.body.pagination.pageSize).toBe(25);
  });
});

describe("API-21 — empty queue and Requester denial (AC-08 / BR-36)", () => {
  it("returns an empty data set with correct pagination for an unfiltered-empty view", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { search: "zzz-no-such-ticket-token" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("returns an empty data set when filtering a category with no tickets", async () => {
    const agent = await loginAgent(app, EMAIL.staff1);
    const res = await queueAs(agent, { categoryId: refs.emptyCategoryId });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalCount).toBe(0);
  });

  it("rejects a Requester with 403 FORBIDDEN", async () => {
    const agent = await loginAgent(app, EMAIL.reqA);
    const res = await queueAs(agent);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an anonymous request with 401 UNAUTHORIZED", async () => {
    const res = await request(app).get("/api/tickets/queue");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});