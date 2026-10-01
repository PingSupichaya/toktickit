import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createTestUser, deleteTestUsers, loginAgent } from "../helpers/testAuth.js";

const EMAIL = "lab-01.categories@mail.kmutt.ac.th";

describe("GET /api/categories", () => {
  beforeAll(async () => {
    const prisma = getPrisma();
    await prisma.$connect();
    await createTestUser(prisma, EMAIL, "REQUESTER");
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await deleteTestUsers(prisma, [EMAIL]);
    await prisma.$disconnect();
  });

  // NOTE: sibling suites (staff-queue, comments-notes) insert their own
  // category fixtures into this same shared database and run in parallel
  // workers, so the full list may legitimately contain extra rows while this
  // test runs. Filter to the seed names and check those are present, correct,
  // and in id order — rather than exact-matching the whole table.
  it("returns the four seeded categories in id order for an authenticated Requester", async () => {
    const agent = await loginAgent(app, EMAIL);
    const res = await agent.get("/api/categories");
    expect(res.status).toBe(200);
    const seedNames = [
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ];
    expect(
      res.body.data.filter((r: { name: string }) => seedNames.includes(r.name))
    ).toEqual([
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ]);
  });
});