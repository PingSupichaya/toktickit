import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// Ticket Detail endpoint (AC-03 / BR-04):
//   T-015 – owned ticket returns full detail; wrong requester 403;
//           non-existent 404; invalid/missing requesterId 400
// Requires the DB to be migrated and seeded (see README.md). Created tickets
// are tracked and deleted in afterAll so the suite is repeatable.

const prisma = getPrisma();

const createdTicketIds: number[] = [];

interface TestRefs {
  requesterId: number;
  otherRequesterId: number;
  categoryId: number;
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
      "My corporate laptop battery drains extremely quickly, lasting only about two hours on a single full charge.",
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

  refs.categoryId = (
    await prisma.category.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { id: "asc" },
    })
  ).id;

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

describe("GET /api/tickets/:ticketId (T-015)", () => {
  it("returns 200 with full detail for an owned ticket", async () => {
    const created = await apiCreate(validPayload());
    const t = created.body.data;
    expect(created.status).toBe(201);

    const owned = await request(app).get(
      `/api/tickets/${t.id}?requesterId=${refs.requesterId}`
    );
    expect(owned.status).toBe(200);
    const d = owned.body.data;
    expect(d.id).toBe(t.id);
    expect(d.ticketNumber).toBe(t.ticketNumber);
    expect(d.requesterId).toBe(refs.requesterId);
    expect(d.requester).toMatchObject({ id: refs.requesterId, email: expect.any(String) });
    expect(d.category).toHaveProperty("name");
    expect(d.relatedSystem).toHaveProperty("name");
    expect(d.summary).toBeTruthy();
    expect(d.description).toBeTruthy();
    expect(Array.isArray(d.attachments)).toBe(true);
  });

  it("returns 403 for a foreign owner (ownership enforced)", async () => {
    const created = await apiCreate(validPayload());
    const t = created.body.data;

    const forbidden = await request(app).get(
      `/api/tickets/${t.id}?requesterId=${refs.otherRequesterId}`
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a non-existent ticket", async () => {
    const notFound = await request(app).get(
      `/api/tickets/2147483647?requesterId=${refs.requesterId}`
    );
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe("TICKET_NOT_FOUND");

    const notFoundForeign = await request(app).get(
      `/api/tickets/2147483647?requesterId=${refs.otherRequesterId}`
    );
    expect(notFoundForeign.status).toBe(404);
  });

  it("returns 400 when requesterId is missing or when ticketId is invalid", async () => {
    const created = await apiCreate(validPayload());
    const t = created.body.data;

    const missing = await request(app).get(`/api/tickets/${t.id}`);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("MISSING_REQUESTER_ID");

    const invalidId = await request(app).get(
      `/api/tickets/abc?requesterId=${refs.requesterId}`
    );
    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error.code).toBe("INVALID_TICKET_ID");
  });
});