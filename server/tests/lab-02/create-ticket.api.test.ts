import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Ticket API endpoints (AC-01, AC-03, AC-04, AC-05, AC-08):
//   T-004 – valid ticket creation -> 201 + generated ticket number
//   T-005 – summary < 10 / description > 2000 -> 400 validation
//   T-006 – summary is trimmed before storage
//   T-007 – invalid category / related system / priority / requester -> 400/404
//   T-008 – inactive requester rejected
//   T-011 – My Tickets returns only the requester's tickets, newest first
//   T-012 – search + filters + sort + pagination together
//   T-013 – invalid pageSize defaults to 10
//   T-015 – ticket detail ownership (200 / 403 / 404 / 400)
// Requires the DB to be migrated and seeded (see README.md). Created tickets
// are tracked and deleted in afterAll so the suite is repeatable.

const prisma = getPrisma();

const createdTicketIds: number[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TestRefs {
  requesterId: number;
  otherRequesterId: number;
  inactiveRequesterId: number;
  categoryId: number;
  otherCategoryId: number;
  relatedSystemId: number;
}

const refs: Partial<TestRefs> = {};

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requesterId: refs.requesterId,
    categoryId: refs.categoryId,
    relatedSystemId: refs.relatedSystemId,
    summary: "Laptop battery drains very quickly after update",
    description:
      "My corporate laptop battery drains extremely quickly, lasting only about two hours on a single full charge. This started after the recent system update and is causing major productivity problems.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

async function apiCreate(payload: Record<string, unknown>) {
  const res = await request(app).post("/api/tickets").send(payload);
  if (res.body?.data?.id) createdTicketIds.push(res.body.data.id);
  return res;
}

beforeAll(async () => {
  await prisma.$connect();

  const requesters = await prisma.requester.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  if (requesters.length < 2) {
    throw new Error("Seed must provide at least 2 active requesters");
  }
  refs.requesterId = requesters[0].id;
  refs.otherRequesterId = requesters[1].id;

  const inactive = await prisma.requester.findFirst({
    where: { isActive: false },
  });
  if (!inactive) {
    throw new Error("Seed must provide at least 1 inactive requester");
  }
  refs.inactiveRequesterId = inactive.id;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  if (categories.length < 2) {
    throw new Error("Seed must provide at least 2 active categories");
  }
  refs.categoryId = categories[0].id;
  refs.otherCategoryId = categories[1].id;

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
  await prisma.$disconnect();
});

describe("POST /api/tickets (T-004..T-008)", () => {
  it("T-004: valid ticket is created with generated ticket number and NEW status", async () => {
    const res = await apiCreate(validPayload());
    expect(res.status).toBe(201);

    const t = res.body.data;
    expect(t.ticketNumber).toMatch(/^TKT-\d{6}$/);
    expect(t.ticketNumber).toBe(`TKT-${String(t.id).padStart(6, "0")}`);
    expect(t.currentStatus).toBe("NEW");
    expect(t.ticketDate).toBeDefined();
    expect(t.requester).toHaveProperty("name");
    expect(t.category).toHaveProperty("name");
    expect(t.relatedSystem).toHaveProperty("name");
  });

  it("T-005: summary < 10 chars and description > 2000 chars return 400", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send(validPayload({ summary: "short", description: "x".repeat(2001) }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.summary).toBeDefined();
    expect(res.body.error.details.description).toBeDefined();
  });

  it("T-006: summary with leading/trailing whitespace is trimmed before storage", async () => {
    const res = await apiCreate(
      validPayload({ summary: "   Laptop screen flickers when charging   " })
    );
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toBe("Laptop screen flickers when charging");
  });

  it("T-007: invalid categoryId, relatedSystemId, priority, and requesterId are rejected", async () => {
    const badCategory = await request(app)
      .post("/api/tickets")
      .send(validPayload({ categoryId: 2147483647 }));
    expect(badCategory.status).toBe(404);
    expect(badCategory.body.error.code).toBe("CATEGORY_NOT_FOUND");

    const badSystem = await request(app)
      .post("/api/tickets")
      .send(validPayload({ relatedSystemId: 2147483647 }));
    expect(badSystem.status).toBe(404);
    expect(badSystem.body.error.code).toBe("RELATED_SYSTEM_NOT_FOUND");

    const badPriority = await request(app)
      .post("/api/tickets")
      .send(validPayload({ requestedPriority: "URGENT" }));
    expect(badPriority.status).toBe(400);
    expect(badPriority.body.error.code).toBe("VALIDATION_ERROR");
    expect(badPriority.body.error.details.requestedPriority).toBeDefined();

    const badRequester = await request(app)
      .post("/api/tickets")
      .send(validPayload({ requesterId: 2147483647 }));
    expect(badRequester.status).toBe(404);
    expect(badRequester.body.error.code).toBe("REQUESTER_NOT_FOUND");
  });

  it("T-008: ticket creation for an inactive requester is rejected", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send(validPayload({ requesterId: refs.inactiveRequesterId }));
    expect([400, 403]).toContain(res.status);
  });
});

describe("GET /api/tickets (T-011..T-013)", () => {
  it("T-011: returns only the requester's tickets, newest first (default sort)", async () => {
    const marker = `MYTKT${Date.now()}`;
    for (let i = 1; i <= 3; i++) {
      await apiCreate(validPayload({ summary: `${marker} issue number ${i}` }));
      await sleep(5);
    }

    // Another requester's ticket using the same search term must be excluded.
    const foreign = await apiCreate({
      ...validPayload({
        requesterId: refs.otherRequesterId,
        summary: `${marker} foreign ticket`,
      }),
    });

    const res = await request(app).get(
      `/api/tickets?requesterId=${refs.requesterId}&pageSize=50&search=${encodeURIComponent(marker)}`
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
    const marker = `FLTR${Date.now()}`;
    const cat = refs.categoryId as number;
    await sleep(5);

    for (let n = 1; n <= 12; n++) {
      await apiCreate(
        validPayload({
          summary: `Bazbus ${marker} filter ${n}`,
          categoryId: cat,
          requestedPriority: "HIGH",
        })
      );
      await sleep(5);
    }

    const res = await request(app).get(
      `/api/tickets?requesterId=${refs.requesterId}` +
        `&search=${encodeURIComponent("bazbus")}` +
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

  it("T-013: invalid pageSize defaults to 10 (invalid page defaults to 1)", async () => {
    const res = await request(app).get(
      `/api/tickets?requesterId=${refs.requesterId}&pageSize=99`
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);

    const res2 = await request(app).get(
      `/api/tickets?requesterId=${refs.requesterId}&page=0&pageSize=25`
    );
    expect(res2.status).toBe(200);
    expect(res2.body.pagination.page).toBe(1);
  });

  it("requires requesterId query parameter", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PARAMETERS");
  });
});

describe("GET /api/tickets/:ticketId (T-015)", () => {
  it("returns 200 for an owned ticket, 403 for a foreign owner, 404 for missing, 400 when requesterId omitted", async () => {
    const created = await apiCreate(validPayload());
    const t = created.body.data;

    const owned = await request(app).get(
      `/api/tickets/${t.id}?requesterId=${refs.requesterId}`
    );
    expect(owned.status).toBe(200);
    const d = owned.body.data;
    expect(d.id).toBe(t.id);
    expect(d.ticketNumber).toBe(t.ticketNumber);
    expect(d.requesterId).toBe(refs.requesterId);
    expect(d.requester).toHaveProperty("email");
    expect(d.category).toHaveProperty("name");
    expect(d.relatedSystem).toHaveProperty("name");
    expect(Array.isArray(d.attachments)).toBe(true);

    const forbidden = await request(app).get(
      `/api/tickets/${t.id}?requesterId=${refs.otherRequesterId}`
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    const notFound = await request(app).get(
      `/api/tickets/2147483647?requesterId=${refs.requesterId}`
    );
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe("TICKET_NOT_FOUND");

    const missing = await request(app).get(`/api/tickets/${t.id}`);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("MISSING_REQUESTER_ID");

    const notFoundOwned = await request(app).get(
      `/api/tickets/2147483647?requesterId=${refs.otherRequesterId}`
    );
    expect(notFoundOwned.status).toBe(404);
  });
});