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

  it("returns the four seeded categories in id order for an authenticated Requester", async () => {
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
});