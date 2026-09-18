import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createTestUser, deleteTestUsers, loginAgent } from "../helpers/testAuth.js";

// T-022 — Seed data correctness and idempotency.
// Reference endpoints (categories, related systems) are verified through the
// API as an authenticated Requester; database counts (categories, related
// systems, users, tickets) and idempotency are verified directly through
// Prisma. Requesters are Users with role = REQUESTER in the Lab 3 model.
// Requires the DB to be migrated and seeded first (see README.md).

const prisma = getPrisma();
const EMAIL = "seed.test.requester@mail.kmutt.ac.th";

describe("Seed data (T-022)", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await createTestUser(prisma, EMAIL, "REQUESTER");
  });

  afterAll(async () => {
    await deleteTestUsers(prisma, [EMAIL]);
    await prisma.$disconnect();
  });

  it("creates the 4 required categories", async () => {
    const names = await prisma.category.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { id: "asc" },
    });
    expect(names.map((c) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });

  it("creates at least 6 active related systems", async () => {
    const count = await prisma.relatedSystem.count({
      where: { isActive: true },
    });
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it("creates at least 4 active Requesters and at least 1 inactive Requester", async () => {
    const activeCount = await prisma.user.count({
      where: { role: "REQUESTER", isActive: true },
    });
    const inactiveCount = await prisma.user.count({
      where: { role: "REQUESTER", isActive: false },
    });
    expect(activeCount).toBeGreaterThanOrEqual(4);
    expect(inactiveCount).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/categories returns only active categories in id order", async () => {
    const agent = await loginAgent(app, EMAIL);
    const res = await agent.get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });
  });

  it("GET /api/related-systems returns only active related systems in id order", async () => {
    const agent = await loginAgent(app, EMAIL);
    const res = await agent.get("/api/related-systems");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { id: 1, name: "Email" },
        { id: 2, name: "Campus Wi-Fi" },
        { id: 3, name: "VPN" },
        { id: 4, name: "LEB2 App" },
        { id: 5, name: "Grade Submission App" },
        { id: 6, name: "Printer" },
        { id: 7, name: "Corporate Laptop" },
      ],
    });
  });

  it("is idempotent: re-running the seed does not duplicate records", async () => {
    const countsBefore = {
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
    };

    await prisma.category.upsert({
      where: { name: "Account and Access" },
      update: {},
      create: { name: "Account and Access", isActive: true },
    });

    const countsAfter = {
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      users: await prisma.user.count(),
      tickets: await prisma.ticket.count(),
    };

    expect(countsAfter).toEqual(countsBefore);
  });
});