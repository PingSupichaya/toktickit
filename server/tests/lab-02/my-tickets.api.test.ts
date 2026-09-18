import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  TRUSTED_ORIGIN,
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";

// My Tickets endpoint (AC-05 / AC-08, BR-04):
//   T-011 – GET /api/tickets returns only the session user's tickets, newest
//           first
//   T-012 – search + category/priority filters + sort + pagination together;
//           requesterId query params are ignored (owner comes from the session)
//   T-013 – invalid pageSize defaults to 10 / invalid page defaults to 1
// Requires the DB to be migrated and seeded (see README.md). Created tickets
// are tracked and deleted in afterAll so the suite is repeatable.

const prisma = getPrisma();

const EMAIL = {
  submitter: "lab02.mylist.submitter@mail.kmutt.ac.th",
  foreigner: "lab02.mylist.foreigner@mail.kmutt.ac.th",
};

const createdTicketIds: number[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TestRefs {
  submitterId: number;
  foreignerId: number;
  categoryId: number;
  relatedSystemId: number;
}

const refs: Partial<TestRefs> = {};

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    categoryId: refs.categoryId,
    relatedSystemId: refs.relatedSystemId,
    summary: "Laptop battery drains very quickly after update",
    description:
      "My corporate laptop battery drains extremely quickly, lasting only about two hours on a single full charge.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

async function apiCreate(agent: request.Agent, payload: Record<string, unknown>) {
  const res = await agent
    .post("/api/tickets")
    .set("Origin", TRUSTED_ORIGIN)
    .send(payload);
  if (res.body?.data?.id) createdTicketIds.push(res.body.data.id);
  return res;
}

beforeAll(async () => {
  await getPrisma().$connect();

  const submitter = await createTestUser(prisma, EMAIL.submitter, "REQUESTER");
  const foreigner = await createTestUser(prisma, EMAIL.foreigner, "REQUESTER");
  refs.submitterId = submitter.id;
  refs.foreignerId = foreigner.id;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 1,
  });
  if (categories.length < 1) {
    throw new Error("Seed must provide at least 1 active category");
  }
  refs.categoryId = categories[0].id;

  refs.relatedSystemId = (
    await prisma.relatedSystem.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { id: "asc" },
    })
  ).id;
});

afterAll(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({
      where: { id: { in: createdTicketIds } },
    });
  }
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("GET /api/tickets (T-011..T-013)", () => {
  it("T-011: returns only the session user's tickets, newest first (default sort)", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);

    const marker = `MYTKT${Date.now()}`;
    for (let i = 1; i <= 3; i++) {
      await apiCreate(agent, validPayload({ summary: `${marker} issue number ${i}` }));
      await sleep(5);
    }

    // Another user's ticket using the same search term must be excluded.
    const foreign = await apiCreate(
      foreignAgent,
      validPayload({ summary: `${marker} foreign ticket` })
    );

    const res = await agent.get(
      `/api/tickets?pageSize=50&search=${encodeURIComponent(marker)}`
    );
    expect(res.status).toBe(200);

    const rows = res.body.data;
    expect(rows.length).toBe(3);
    expect(rows.map((r: { ticketNumber: string }) => r.ticketNumber)).not.toContain(
      foreign.body.data.ticketNumber
    );

    const dates = rows.map((r: { ticketDate: string }) => r.ticketDate);
    expect(dates).toEqual([...dates].sort((a: string, b: string) => b.localeCompare(a)));
  });

  it("T-012: search + category/priority filters + sort + pagination work together", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);

    const marker = `FLTR${Date.now()}`;
    const cat = refs.categoryId as number;
    await sleep(5);

    for (let n = 1; n <= 12; n++) {
      await apiCreate(
        agent,
        validPayload({
          summary: `Bazbus ${marker} filter ${n}`,
          categoryId: cat,
          requestedPriority: "HIGH",
        })
      );
      await sleep(5);
    }

    const res = await agent.get(
      `/api/tickets` +
        `?search=${encodeURIComponent("bazbus")}` +
        `&categoryId=${cat}` +
        `&priority=HIGH` +
        `&sortBy=ticketDate&sortOrder=asc` +
        `&page=2&pageSize=10`
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 2,
      pageSize: 10,
      totalCount: 12,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    const rows = res.body.data;
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.summary.toLowerCase()).toContain("bazbus");
      expect(row.category.id).toBe(cat);
      expect(row.requestedPriority).toBe("HIGH");
    }

    const dates = rows.map((r: { ticketDate: string }) => r.ticketDate);
    expect(dates).toEqual([...dates].sort((a: string, b: string) => a.localeCompare(b)));
  });

  it("T-012b: ignores a requesterId query param — ownership comes from the session", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);

    const marker = `IGNO${Date.now()}`;
    await apiCreate(agent, validPayload({ summary: `${marker} mine` }));
    await foreignAgent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ summary: `${marker} theirs` }))
      .then((res) => {
        if (res.body?.data?.id) createdTicketIds.push(res.body.data.id);
      });

    // Even with the (removed) requesterId query param pointing at the foreign
    // user, the session user's tickets are returned.
    const res = await agent.get(
      `/api/tickets?requesterId=${refs.foreignerId}&search=${encodeURIComponent(marker)}`
    );
    expect(res.status).toBe(200);
    const rows = res.body.data;
    expect(rows.length).toBe(1);
    expect(rows[0].summary).toBe(`${marker} mine`);
  });

  it("T-013: invalid pageSize defaults to 10 (invalid page defaults to 1)", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);

    const res = await agent.get("/api/tickets?pageSize=99");
    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);

    const res2 = await agent.get("/api/tickets?page=0&pageSize=25");
    expect(res2.status).toBe(200);
    expect(res2.body.pagination.page).toBe(1);
  });
});