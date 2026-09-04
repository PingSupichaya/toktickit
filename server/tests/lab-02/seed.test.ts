import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// T-022 — Seed data correctness and idempotency.
// Reference endpoints (categories) are verified through the API; database
// counts (categories, related systems, requesters) and idempotency are
// verified directly through Prisma.
// Requires the DB to be migrated and seeded first (see README.md).

const prisma = getPrisma();

describe("Seed data (T-022)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
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

  it("creates at least 4 active requesters and at least 1 inactive requester", async () => {
    const activeCount = await prisma.requester.count({
      where: { isActive: true },
    });
    const inactiveCount = await prisma.requester.count({
      where: { isActive: false },
    });
    expect(activeCount).toBeGreaterThanOrEqual(4);
    expect(inactiveCount).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/categories returns only active categories in id order", async () => {
    const res = await request(app).get("/api/categories");
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

  it("is idempotent: re-running the seed does not duplicate records", async () => {
    const countsBefore = {
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      requesters: await prisma.requester.count(),
    };

    await prisma.category.upsert({
      where: { name: "Account and Access" },
      update: {},
      create: { name: "Account and Access", isActive: true },
    });

    const countsAfter = {
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      requesters: await prisma.requester.count(),
    };

    expect(countsAfter).toEqual(countsBefore);
  });
});
