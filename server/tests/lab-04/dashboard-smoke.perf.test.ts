import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAgent } from "../helpers/testAuth.js";

// ---------------------------------------------------------------------------
// lab-04 / dashboard-smoke.perf.test.ts — PERF-01 (FR-12 / BR-16).
// Smoke-level timing at seed scale (dozens–low hundreds of Tickets): both
// dashboard endpoints must answer 200 well within the 2s local budget with
// the documented shape. This asserts status + shape + timing only — it is
// explicitly not a load test. Seeded demo accounts; no fixtures created.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const SMOKE_BUDGET_MS = 2000;

const REQUESTER = { email: "alice.john@mail.kmutt.ac.th", password: "Password123!" };
const STAFF = { email: "frank.ngu@mail.kmutt.ac.th", password: "Password123!" };

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PERF-01 — dashboard smoke at seed scale (FR-12 / BR-16)", () => {
  it("GET /api/dashboard/requester responds 200 with shape inside budget", async () => {
    const agent = await loginAgent(app, REQUESTER.email, REQUESTER.password);
    const start = performance.now();
    const res = await agent.get("/api/dashboard/requester");
    const elapsed = performance.now() - start;
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.metrics).sort()).toEqual(
      ["closed", "myOpenTickets", "resolved", "waitingOnYou"].sort()
    );
    expect(Array.isArray(res.body.data.recentTickets)).toBe(true);
    expect(elapsed).toBeLessThan(SMOKE_BUDGET_MS);
  });

  it("GET /api/dashboard/staff responds 200 with shape inside budget", async () => {
    const agent = await loginAgent(app, STAFF.email, STAFF.password);
    const start = performance.now();
    const res = await agent.get("/api/dashboard/staff");
    const elapsed = performance.now() - start;
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.metrics).sort()).toEqual(
      ["byPriority", "inProgress", "myAssigned", "new", "open", "unassigned", "waitingForRequester"].sort()
    );
    expect(Array.isArray(res.body.data.recentTickets)).toBe(true);
    expect(elapsed).toBeLessThan(SMOKE_BUDGET_MS);
  });
});
