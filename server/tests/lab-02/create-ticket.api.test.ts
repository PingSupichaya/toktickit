import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Ticket API endpoints (AC-01, AC-04):
//   T-004 – valid ticket creation -> 201 + generated ticket number
//   T-005 – summary < 10 / description > 2000 -> 400 validation
//   T-006 – summary is trimmed before storage
//   T-007 – invalid category / related system / priority / requester -> 400/404
//   T-008 – inactive requester rejected
// The My Tickets list (T-011..T-013) and Ticket Detail (T-015) are covered in
// my-tickets.api.test.ts and ticket-detail.api.test.ts respectively.
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