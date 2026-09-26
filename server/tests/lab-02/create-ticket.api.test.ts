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

// Ticket API endpoints (AC-01, AC-04):
//   T-004 – valid ticket creation -> 201 + generated ticket number
//   T-005 – summary < 10 / description > 2000 -> 400 validation
//   T-006 – summary is trimmed before storage
//   T-007 – invalid category / related system / priority -> 404/404/400, and
//           requesterId in the body is rejected (session is the submitter)
//   T-008 – an inactive Requester cannot create a ticket (401 at the session)
// The My Tickets list (T-011..T-013) and Ticket Detail (T-015) are covered in
// my-tickets.api.test.ts and ticket-detail.api.test.ts respectively.
// Requires the DB to be migrated and seeded (see README.md). Created tickets
// are tracked and deleted in afterAll so the suite is repeatable.

const prisma = getPrisma();

const EMAIL = {
  submitter: "lab02.create.submitter@mail.kmutt.ac.th",
};

const createdTicketIds: number[] = [];

interface TestRefs {
  submitterId: number;
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
      "My corporate laptop battery drains extremely quickly, lasting only about two hours on a single full charge. This started after the recent system update and is causing major productivity problems.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

async function agentCreate(agent: request.Agent, payload: Record<string, unknown>) {
  const res = await agent
    .post("/api/tickets")
    .set("Origin", TRUSTED_ORIGIN)
    .send(payload);
  if (res.body?.data?.id) createdTicketIds.push(res.body.data.id);
  return res;
}

beforeAll(async () => {
  await prisma.$connect();

  const submitter = await createTestUser(prisma, EMAIL.submitter, "REQUESTER");
  refs.submitterId = submitter.id;

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

describe("POST /api/tickets (T-004..T-008)", () => {
  it("T-004: valid ticket is created from the session user with generated ticket number", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const res = await agentCreate(agent, validPayload());
    expect(res.status).toBe(201);

    const t = res.body.data;
    expect(t.ticketNumber).toMatch(/^TKT-\d{6}$/);
    expect(t.ticketNumber).toBe(`TKT-${String(t.id).padStart(6, "0")}`);
    expect(t.currentStatus).toBe("NEW");
    expect(t.ticketDate).toBeDefined();
    expect(t.submittedById).toBe(refs.submitterId);
    expect(t.itPriority).toBe("MEDIUM");
    expect(t.submitter).toMatchObject({ id: refs.submitterId, name: expect.any(String) });
    expect(t.category).toHaveProperty("name");
    expect(t.relatedSystem).toHaveProperty("name");
  });

  it("T-005: summary < 10 chars and description > 2000 chars return 400", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const res = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ summary: "short", description: "x".repeat(2001) }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.summary).toBeDefined();
    expect(res.body.error.details.description).toBeDefined();
  });

  it("T-006: summary with leading/trailing whitespace is trimmed before storage", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const res = await agentCreate(
      agent,
      validPayload({ summary: "   Laptop screen flickers when charging   " })
    );
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toBe("Laptop screen flickers when charging");
  });

  it("T-007: invalid categoryId, relatedSystemId, priority, and body requesterId are rejected", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);

    const badCategory = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ categoryId: 2147483647 }));
    expect(badCategory.status).toBe(404);
    expect(badCategory.body.error.code).toBe("CATEGORY_NOT_FOUND");

    const badSystem = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ relatedSystemId: 2147483647 }));
    expect(badSystem.status).toBe(404);
    expect(badSystem.body.error.code).toBe("RELATED_SYSTEM_NOT_FOUND");

    const badPriority = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ requestedPriority: "URGENT" }));
    expect(badPriority.status).toBe(400);
    expect(badPriority.body.error.code).toBe("VALIDATION_ERROR");
    expect(badPriority.body.error.details.requestedPriority).toBeDefined();

    // The submitter comes from the session; requesterId is no longer accepted.
    const badRequester = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ requesterId: 2147483647 }));
    expect(badRequester.status).toBe(400);
    expect(badRequester.body.error.code).toBe("VALIDATION_ERROR");
    expect(badRequester.body.error.details.requesterId).toBeDefined();
  });

  it("T-008: an inactive Requester cannot create a ticket", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    await prisma.user.update({
      where: { id: refs.submitterId },
      data: { isActive: false },
    });

    const res = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");

    await prisma.user.update({
      where: { id: refs.submitterId },
      data: { isActive: true },
    });
  });
});