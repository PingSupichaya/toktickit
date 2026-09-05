import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// T-001 — GET /api/requesters endpoint.
// - Returns only ACTIVE requesters (FR-02, BR-05); inactive requesters
//   (e.g. Eve Turner) must never appear.
// - Handles database errors with a 500 + structured error response.
// Requires DB migrated + seeded for the success cases.

const prisma = getPrisma();

describe("GET /api/requesters (T-001)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 200 with only active requesters, ordered by id ascending", async () => {
    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);

    const ids = res.body.data.map((r: { id: number }) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));

    for (const r of res.body.data) {
      expect(typeof r.id).toBe("number");
      expect(typeof r.name).toBe("string");
      expect(typeof r.email).toBe("string");
    }
  });

  it("excludes inactive requesters from the response", async () => {
    const inactive = await prisma.requester.findMany({
      where: { isActive: false },
      select: { email: true },
    });

    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(200);
    const returnedEmails = res.body.data.map((r: { email: string }) => r.email);

    expect(inactive.length).toBeGreaterThan(0);
    for (const row of inactive) {
      expect(returnedEmails).not.toContain(row.email);
    }
  });

  it("returns 500 with a structured error when the database query fails", async () => {
    const spy = vi
      .spyOn(prisma.requester, "findMany")
      .mockRejectedValueOnce(new Error("database down"));

    const res = await request(app).get("/api/requesters");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        message: "Failed to fetch requesters",
        code: "INTERNAL_SERVER_ERROR",
      },
    });

    spy.mockRestore();
  });
});
