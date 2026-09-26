import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// ---------------------------------------------------------------------------
// lab-03 / authorization.api.test.ts — API-11, API-12 (in-scope subset),
// API-14 (§2.2 tests.md). API-13 (cross-owner 404) requires the ticket-detail
// handler migration and ships with the Requester-regression issue.
// ---------------------------------------------------------------------------

const PASSWORD = "ChangeMe123!";
const TRUSTED_ORIGIN = "http://localhost:5173";

const EMAIL = {
  requester: "api.authz.requester@mail.kmutt.ac.th",
  staff: "api.authz.staff@mail.kmutt.ac.th",
  admin: "api.authz.admin@mail.kmutt.ac.th",
  mustChange: "api.authz.mustchange@mail.kmutt.ac.th",
};

function sessionCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  const entries = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const session = entries.find((c) => c.startsWith("toktickit_session="));
  if (!session) throw new Error("Expected a toktickit_session cookie");
  return session.split(";")[0].trim();
}

function login(email: string) {
  return request(app).post("/api/auth/login").send({ email, password: PASSWORD });
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const prisma = getPrisma();

  const create = (email: string, role: string, extra: object = {}) =>
    prisma.user.create({
      data: {
        name: `AuthZ ${role}`,
        email,
        role: role as "REQUESTER" | "IT_STAFF" | "ADMIN",
        isActive: true,
        passwordHash: hash,
        mustChangePassword: false,
        ...extra,
      },
    });

  await create(EMAIL.requester, "REQUESTER");
  await create(EMAIL.staff, "IT_STAFF");
  await create(EMAIL.admin, "ADMIN");
  await create(EMAIL.mustChange, "REQUESTER", { mustChangePassword: true });
});

afterAll(async () => {
  const prisma = getPrisma();
  const emails = Object.values(EMAIL);
  await prisma.session.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe("API-11 — no session on every protected endpoint → 401 (AC-21 / BR-14)", () => {
  // Endpoints include ones whose handlers ship in later issues (queue, users,
  // comments, notes); the global session guard rejects them before any route.
  const protectedEndpoints: Array<[string, string]> = [
    ["get", "/api/categories"],
    ["get", "/api/related-systems"],
    ["get", "/api/tickets"],
    ["post", "/api/tickets"],
    ["get", "/api/tickets/1"],
    ["get", "/api/tickets/queue"],
    ["get", "/api/tickets/1/comments"],
    ["post", "/api/tickets/1/comments"],
    ["get", "/api/tickets/1/notes"],
    ["post", "/api/tickets/1/notes"],
    ["get", "/api/tickets/1/attachments"],
    ["post", "/api/tickets/1/attachments"],
    ["get", "/api/attachments/1/download"],
    ["delete", "/api/attachments/1"],
    ["get", "/api/users"],
  ];

  it.each(protectedEndpoints)(
    "%s %s without a session → 401",
    async (method, path) => {
      const req = (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);
      if (method !== "get") req.send({});
      const res = await req;

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
  );
});

describe("API-12 — role matrix enforced server-side, in-scope subset (AC-22 / BR-36)", () => {
  it("Requester → ticket queue and user management are 403", async () => {
    const cookie = sessionCookie(await login(EMAIL.requester));

    const queue = await request(app).get("/api/tickets/queue").set("Cookie", cookie);
    expect(queue.status).toBe(403);
    expect(queue.body.error.code).toBe("FORBIDDEN");

    const users = await request(app).get("/api/users").set("Cookie", cookie);
    expect(users.status).toBe(403);
    expect(users.body.error.code).toBe("FORBIDDEN");
  });

  it("IT_STAFF → user management and create-ticket are 403", async () => {
    const cookie = sessionCookie(await login(EMAIL.staff));

    const users = await request(app).get("/api/users").set("Cookie", cookie);
    expect(users.status).toBe(403);

    const create = await request(app)
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie)
      .send({});
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("FORBIDDEN");
  });

  it("ADMIN → create-ticket is 403 but user management and queue pass the role guard", async () => {
    const cookie = sessionCookie(await login(EMAIL.admin));

    const create = await request(app)
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie)
      .send({});
    expect(create.status).toBe(403);

    // Endpoints themselves are deferred stubs (404); the role guard must not
    // deny an ADMIN.
    const users = await request(app).get("/api/users").set("Cookie", cookie);
    expect(users.status).not.toBe(403);

    const queue = await request(app)
      .get("/api/tickets/queue")
      .set("Cookie", cookie);
    expect(queue.status).not.toBe(403);
  });

  it("a must-change-password user may only reach /api/auth routes (AC-02)", async () => {
    const cookie = sessionCookie(await login(EMAIL.mustChange));

    const categories = await request(app)
      .get("/api/categories")
      .set("Cookie", cookie);
    expect(categories.status).toBe(403);
    expect(categories.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
  });
});

describe("API-14 — CSRF origin check (§1)", () => {
  it("rejects a mismatched Origin with 403 CSRF_ORIGIN_MISMATCH and keeps the session", async () => {
    const cookie = sessionCookie(await login(EMAIL.requester));

    const blocked = await request(app)
      .post("/api/auth/logout")
      .set("Origin", "https://evil.example.com")
      .set("Cookie", cookie);

    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("CSRF_ORIGIN_MISMATCH");

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
  });

  it("allows a matching Origin to proceed", async () => {
    const cookie = sessionCookie(await login(EMAIL.requester));

    const ok = await request(app)
      .post("/api/auth/logout")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie);
    expect(ok.status).toBe(204);
  });

  it("accepts a matching Referer when Origin is absent", async () => {
    const cookie = sessionCookie(await login(EMAIL.requester));

    const ok = await request(app)
      .post("/api/auth/logout")
      .set("Referer", `${TRUSTED_ORIGIN}/login`)
      .set("Cookie", cookie);
    expect(ok.status).toBe(204);
  });
});