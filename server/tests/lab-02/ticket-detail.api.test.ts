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

// Ticket Detail endpoint (AC-03 / BR-04):
//   T-015 – owned ticket returns full detail; a foreign owner is
//           indistinguishable from a missing ticket (404, D-03);
//           non-existent 404; invalid ticketId 400
// Requires the DB to be migrated and seeded (see README.md). Created tickets
// are tracked and deleted in afterAll so the suite is repeatable.

const prisma = getPrisma();

const EMAIL = {
  submitter: "lab02.detail.submitter@mail.kmutt.ac.th",
  foreigner: "lab02.detail.foreigner@mail.kmutt.ac.th",
};

const createdTicketIds: number[] = [];

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
  await prisma.$connect();

  const submitter = await createTestUser(prisma, EMAIL.submitter, "REQUESTER");
  const foreigner = await createTestUser(prisma, EMAIL.foreigner, "REQUESTER");
  refs.submitterId = submitter.id;
  refs.foreignerId = foreigner.id;

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
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("GET /api/tickets/:ticketId (T-015)", () => {
  it("returns 200 with full detail for an owned ticket", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const created = await apiCreate(agent, validPayload());
    const t = created.body.data;
    expect(created.status).toBe(201);

    const owned = await agent.get(`/api/tickets/${t.id}`);
    expect(owned.status).toBe(200);
    const d = owned.body.data;
    expect(d.id).toBe(t.id);
    expect(d.ticketNumber).toBe(t.ticketNumber);
    expect(d.submittedById).toBe(refs.submitterId);
    expect(d.submitter).toMatchObject({ id: refs.submitterId, email: expect.any(String) });
    expect(d.category).toHaveProperty("name");
    expect(d.relatedSystem).toHaveProperty("name");
    expect(d.summary).toBeTruthy();
    expect(d.description).toBeTruthy();
    expect(Array.isArray(d.attachments)).toBe(true);
  });

  it("returns 404 for a foreign owner (cross-owner is 404, D-03)", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);
    const created = await apiCreate(agent, validPayload());
    const t = created.body.data;

    const hidden = await foreignAgent.get(`/api/tickets/${t.id}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("returns 404 for a non-existent ticket", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);

    const notFound = await agent.get("/api/tickets/2147483647");
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe("TICKET_NOT_FOUND");

    const notFoundForeign = await foreignAgent.get("/api/tickets/2147483647");
    expect(notFoundForeign.status).toBe(404);
  });

  it("returns 400 for an invalid ticketId", async () => {
    const agent = await loginAgent(app, EMAIL.submitter);
    const res = await agent.get("/api/tickets/abc");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TICKET_ID");
  });
});