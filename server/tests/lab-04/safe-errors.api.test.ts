import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAgent } from "../helpers/testAuth.js";

// ---------------------------------------------------------------------------
// lab-04 / safe-errors.api.test.ts — API-35 (FR-12 / safe failure).
// Forces a database failure and asserts every Lab 4 read endpoint still
// answers 500 with { error: { message, code: INTERNAL_SERVER_ERROR } } and
// leaks no stack or technical detail. Uses seeded demo accounts so no
// fixtures are created; the Prisma delegate is spied to throw only around
// each probe and restored immediately after.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const REQUESTER = { email: "alice.john@mail.kmutt.ac.th", password: "Password123!" };
const STAFF = { email: "frank.ngu@mail.kmutt.ac.th", password: "Password123!" };

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.$disconnect();
});

function expectSafe500(res: request.Response) {
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  expect(typeof res.body.error.message).toBe("string");
  expect(JSON.stringify(res.body)).not.toMatch(/stack|prisma|at .*\(/i);
}

describe("API-35 — safe 500 shape on Lab 4 endpoints (FR-12)", () => {
  it("GET /api/dashboard/requester fails safe on database error", async () => {
    const agent = await loginAgent(app, REQUESTER.email, REQUESTER.password);
    const spy = vi.spyOn(prisma.ticket, "count").mockRejectedValueOnce(new Error("db down"));
    const res = await agent.get("/api/dashboard/requester");
    spy.mockRestore();
    expectSafe500(res);
  });

  it("GET /api/dashboard/staff fails safe on database error", async () => {
    const agent = await loginAgent(app, STAFF.email, STAFF.password);
    const spy = vi.spyOn(prisma.ticket, "count").mockRejectedValueOnce(new Error("db down"));
    const res = await agent.get("/api/dashboard/staff");
    spy.mockRestore();
    expectSafe500(res);
  });

  it("GET /api/tickets/:id/actions fails safe on database error", async () => {
    const agent = await loginAgent(app, STAFF.email, STAFF.password);
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-000001" },
      select: { id: true },
    });
    const spy = vi.spyOn(prisma.actionTaken, "findMany").mockRejectedValueOnce(new Error("db down"));
    const res = await agent.get(`/api/tickets/${ticket.id}/actions`);
    spy.mockRestore();
    expectSafe500(res);
  });
});
