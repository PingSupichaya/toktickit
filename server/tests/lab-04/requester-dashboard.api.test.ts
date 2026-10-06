import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";

// ---------------------------------------------------------------------------
// lab-04 / requester-dashboard.api.test.ts — API-23–API-27
// (docs/lab-04/tests.md §2.3, api-spec §4.5, BR-14).
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  reqA: "dash.reqa@mail.kmutt.ac.th",
  reqB: "dash.reqb@mail.kmutt.ac.th",
  reqZero: "dash.reqzero@mail.kmutt.ac.th",
  staff: "dash.staff@mail.kmutt.ac.th",
  admin: "dash.admin@mail.kmutt.ac.th",
};

const CAT = "Dashboard Test Category";
const SYS = "Dashboard Test System";

const refs: { categoryId: number; systemId: number; reqAId: number; reqBId: number } = {
  categoryId: 0,
  systemId: 0,
  reqAId: 0,
  reqBId: 0,
};

async function makeTicket(
  submittedById: number,
  status: string,
  n: string,
  updatedAt?: Date
): Promise<number> {
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: n,
      submittedById,
      ownerId: null,
      categoryId: refs.categoryId,
      relatedSystemId: refs.systemId,
      summary: `Dashboard fixture ${n} summary text`,
      description: `Dashboard fixture ${n} description with enough detail.`,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status as never,
    },
  });
  if (updatedAt) {
    await prisma.ticket.update({
      where: { id: t.id },
      data: { updatedAt },
    });
  }
  return t.id;
}

beforeAll(async () => {
  await prisma.$connect();

  await createTestUser(prisma, EMAIL.reqA, "REQUESTER", { name: "Dash Req A" });
  await createTestUser(prisma, EMAIL.reqB, "REQUESTER", { name: "Dash Req B" });
  await createTestUser(prisma, EMAIL.reqZero, "REQUESTER", { name: "Dash Req Zero" });
  await createTestUser(prisma, EMAIL.staff, "IT_STAFF", { name: "Dash Staff" });
  await createTestUser(prisma, EMAIL.admin, "ADMIN", { name: "Dash Admin" });

  const category = await prisma.category.create({ data: { name: CAT } });
  const system = await prisma.relatedSystem.create({ data: { name: SYS } });
  refs.categoryId = category.id;
  refs.systemId = system.id;
  refs.reqAId = (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.reqA } })).id;
  refs.reqBId = (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.reqB } })).id;

  // reqA mix (hand-computed expectations below): 2 open-ish, 1 waiting,
  // 1 resolved, 1 closed, 1 cancelled (counted nowhere), +2 extra open for
  // the recent-cap test. Staggered updatedAt fixes the recent order.
  const base = new Date("2026-09-01T00:00:00.000Z").getTime();
  const at = (day: number) => new Date(base + day * 86_400_000);
  const mix: Array<[string, number]> = [
    ["NEW", 1],
    ["IN_PROGRESS", 2],
    ["WAITING_FOR_REQUESTER", 3],
    ["RESOLVED", 4],
    ["CLOSED", 5],
    ["CANCELLED", 6],
    ["OPEN", 7],
    ["REOPENED", 8],
  ];
  let seq = 0;
  for (const [status, day] of mix) {
    seq += 1;
    await makeTicket(refs.reqAId, status, `TKRD-${String(300000 + seq)}`, at(day));
  }

  // reqB owns tickets that must never leak into reqA's metrics.
  await makeTicket(refs.reqBId, "OPEN", "TKRD-400001", at(9));
  await makeTicket(refs.reqBId, "RESOLVED", "TKRD-400002", at(10));
});

afterAll(async () => {
  await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: "TKRD-" } },
  });
  await prisma.category.deleteMany({ where: { name: CAT } });
  await prisma.relatedSystem.deleteMany({ where: { name: SYS } });
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-23 — metrics scoped to own Tickets (AC-02 / BR-14)", () => {
  it("each metric matches the hand-computed count; other owners excluded", async () => {
    const agent = await loginAgent(app, EMAIL.reqA);
    const res = await agent.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    // NEW + IN_PROGRESS + OPEN + REOPENED = 4; reqB's OPEN never counted.
    expect(res.body.data.metrics).toEqual({
      myOpenTickets: 4,
      waitingOnYou: 1,
      resolved: 1,
      closed: 1,
    });
  });
});

describe("API-24 — zero-Ticket Requester (AC-11 / BR-17)", () => {
  it("all metrics 0 with an empty recent list, 200 not an error", async () => {
    const agent = await loginAgent(app, EMAIL.reqZero);
    const res = await agent.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    expect(res.body.data.metrics).toEqual({
      myOpenTickets: 0,
      waitingOnYou: 0,
      resolved: 0,
      closed: 0,
    });
    expect(res.body.data.recentTickets).toEqual([]);
  });
});

describe("API-25 — recent Tickets cap and ordering (BR-14)", () => {
  it("returns at most 5, ordered updatedAt desc", async () => {
    const agent = await loginAgent(app, EMAIL.reqA);
    const res = await agent.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    const recent = res.body.data.recentTickets;
    expect(recent).toHaveLength(5);
    // Days 8,7,6,5,4 → REOPENED, OPEN, CANCELLED, CLOSED, RESOLVED.
    expect(recent.map((t: { currentStatus: string }) => t.currentStatus)).toEqual([
      "REOPENED",
      "OPEN",
      "CANCELLED",
      "CLOSED",
      "RESOLVED",
    ]);
    for (const item of recent) {
      expect(item).toEqual({
        id: expect.any(Number),
        ticketNumber: expect.stringMatching(/^TKRD-/),
        summary: expect.any(String),
        currentStatus: expect.any(String),
        updatedAt: expect.any(String),
      });
    }
  });
});

describe("API-26 — non-Requester denied (FR-10)", () => {
  it("IT_STAFF and ADMIN → 403", async () => {
    for (const email of [EMAIL.staff, EMAIL.admin]) {
      const agent = await loginAgent(app, email);
      const res = await agent.get("/api/dashboard/requester");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });
});

describe("API-27 — timestamps in UTC ISO-8601 (BR-18)", () => {
  it("recentTickets[].updatedAt matches ISO-8601 UTC shape", async () => {
    const agent = await loginAgent(app, EMAIL.reqA);
    const res = await agent.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    for (const item of res.body.data.recentTickets) {
      expect(item.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    }
  });
});

describe("§4.5 drill-down query support on GET /api/tickets", () => {
  it("repeated status params filter to any listed status", async () => {
    const agent = await loginAgent(app, EMAIL.reqA);
    const res = await agent.get(
      "/api/tickets?status=NEW&status=OPEN&status=IN_PROGRESS&status=REOPENED&pageSize=50"
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalCount).toBe(4);
    for (const t of res.body.data) {
      expect(["NEW", "OPEN", "IN_PROGRESS", "REOPENED"]).toContain(t.currentStatus);
    }
  });

  it("an invalid value among repeated params is still 400", async () => {
    const agent = await loginAgent(app, EMAIL.reqA);
    const res = await agent.get("/api/tickets?status=OPEN&status=BOGUS");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PARAMETERS");
  });
});
