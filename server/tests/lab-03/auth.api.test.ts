import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  SESSION_COOKIE_NAME,
  generateSessionToken,
  hashSessionToken,
} from "../../src/session.js";

// ---------------------------------------------------------------------------
// lab-03 / auth.api.test.ts — API-01 … API-07, API-09, API-10 (§2.1 tests.md)
// ---------------------------------------------------------------------------

const PASSWORD = "ChangeMe123!";
const NEW_PASSWORD = "NewSecurePass1!";
const TRUSTED_ORIGIN = "http://localhost:5173";

const EMAIL = {
  requester: "api.auth.requester@mail.kmutt.ac.th",
  pwchange: "api.auth.pwchange@mail.kmutt.ac.th",
  inactive: "api.auth.inactive@mail.kmutt.ac.th",
  reset: "api.auth.reset@mail.kmutt.ac.th",
};

let requesterId: number;

function sessionCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  const entries = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const session = entries.find((c) => c.startsWith("toktickit_session="));
  if (!session) throw new Error("Expected a toktickit_session cookie");
  return session.split(";")[0].trim();
}

function login(email: string, password: string = PASSWORD) {
  return request(app).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const prisma = getPrisma();

  requesterId = (
    await prisma.user.create({
      data: {
        name: "API Auth Requester",
        email: EMAIL.requester,
        role: "REQUESTER",
        isActive: true,
        passwordHash: hash,
        mustChangePassword: false,
      },
    })
  ).id;

  await prisma.user.create({
    data: {
      name: "API Auth Must Change",
      email: EMAIL.pwchange,
      role: "REQUESTER",
      isActive: true,
      passwordHash: hash,
      mustChangePassword: true,
    },
  });

  await prisma.user.create({
    data: {
      name: "API Auth Inactive",
      email: EMAIL.inactive,
      role: "REQUESTER",
      isActive: false,
      passwordHash: hash,
      mustChangePassword: false,
    },
  });

  await prisma.user.create({
    data: {
      name: "API Auth Reset",
      email: EMAIL.reset,
      role: "REQUESTER",
      isActive: true,
      passwordHash: hash,
      mustChangePassword: false,
    },
  });
});

afterAll(async () => {
  const prisma = getPrisma();
  const emails = Object.values(EMAIL);
  await prisma.session.deleteMany({ where: { user: { email: { in: emails } } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe("API-01 — valid login establishes a session (AC-01 / BR-01)", () => {
  it("returns the authenticated user, mustChangePassword flag, and session cookie", async () => {
    const res = await login(EMAIL.requester);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: requesterId,
      name: "API Auth Requester",
      email: EMAIL.requester,
      role: "REQUESTER",
      isActive: true,
    });
    expect(res.body.data.mustChangePassword).toBe(false);

    const setCookie = res.headers["set-cookie"] as unknown as string[];
    const session = setCookie.find((c) => c.startsWith("toktickit_session="));
    expect(session).toBeDefined();
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
    expect(session).toContain("Path=/");
    expect(session).toContain("Max-Age=28800");
  });
});

describe("API-02 — inactive account login (AC-06 / BR-07)", () => {
  it("returns 403 ACCOUNT_INACTIVE with a safe message and no account data", async () => {
    const res = await login(EMAIL.inactive);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: {
        message: "Your account is not active. Contact your administrator.",
        code: "ACCOUNT_INACTIVE",
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('"data"');
  });
});

describe("API-03 — unknown email and wrong password are indistinguishable (BR-06)", () => {
  it("both return identical 401 INVALID_CREDENTIALS responses", async () => {
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody.exists@mail.kmutt.ac.th", password: "WrongPass1!" });

    const wrongPassword = await login(EMAIL.requester, "WrongPass1!");

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknown.body);
    expect(unknown.body).toEqual({
      error: {
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      },
    });
    expect(unknown.body.data).toBeUndefined();
  });
});

describe("API-04 — login rate limiting (AC-07 / BR-08)", () => {
  it("resets the failure counter on success and blocks after 5 failures", async () => {
    // Three failures, then a successful login resets the counter.
    for (let i = 0; i < 3; i++) {
      const res = await login(EMAIL.reset, "WrongPass1!");
      expect(res.status).toBe(401);
    }
    const success = await login(EMAIL.reset);
    expect(success.status).toBe(200);

    // Five fresh failures on a distinct email, then the sixth attempt is 429.
    const ghost = "api.auth.ghost@mail.kmutt.ac.th";
    for (let i = 0; i < 5; i++) {
      const res = await login(ghost, "WrongPass1!");
      expect(res.status).toBe(401);
    }
    const blocked = await login(ghost, "WrongPass1!");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: {
        message: "Too many failed login attempts. Try again later.",
        code: "TOO_MANY_ATTEMPTS",
      },
    });
  });
});

describe("API-05 — logout invalidates the session (AC-05 / BR-11)", () => {
  it("returns 204, clears the cookie, and subsequent /me returns 401", async () => {
    const loginRes = await login(EMAIL.requester);
    const cookie = sessionCookie(loginRes);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(401);
    expect(me.body).toEqual({
      error: { message: "Authentication required", code: "UNAUTHORIZED" },
    });

    // Idempotent-safe: a second logout with the dead session is 401.
    const again = await request(app)
      .post("/api/auth/logout")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie);
    expect(again.status).toBe(401);
  });
});

describe("API-06 — expired sessions are rejected (AC-05 / BR-12)", () => {
  it("returns 401 and deletes the expired session row", async () => {
    const token = generateSessionToken();
    await getPrisma().session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: requesterId,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.data).toBeUndefined();

    const remaining = await getPrisma().session.count({
      where: { tokenHash: hashSessionToken(token) },
    });
    expect(remaining).toBe(0);
  });
});

describe("API-09 — password rule boundaries (BR-10)", () => {
  function boundaryCase(label: string, newPassword: string) {
    it(`rejects "${label}"`, async () => {
      const cookie = sessionCookie(await login(EMAIL.pwchange));

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Origin", TRUSTED_ORIGIN)
        .set("Cookie", cookie)
        .send({ currentPassword: PASSWORD, newPassword });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.newPassword).toBeTruthy();
    });
  }

  boundaryCase("shorter than 8 characters", "Short1!");
  boundaryCase("no uppercase letter", "alllowercase1!");
  boundaryCase("no lowercase letter", "UPPERCASE1!");
  boundaryCase("no digit", "NoDigitsHere!");
  boundaryCase("no special character", "NoSpecial1");
  boundaryCase("equal to the current password", PASSWORD);
});

describe("API-07 — first-login change-password flow (AC-02 / BR-02, BR-10)", () => {
  it("rejects a wrong current password with 401 INVALID_CURRENT_PASSWORD", async () => {
    const cookie = sessionCookie(await login(EMAIL.pwchange));

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie)
      .send({ currentPassword: "TotallyWrong1!", newPassword: NEW_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CURRENT_PASSWORD");
  });

  it("changes the password, clears mustChangePassword, and keeps the session", async () => {
    const cookie = sessionCookie(await login(EMAIL.pwchange));

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(false);
    expect(res.body.data.user).toMatchObject({
      email: EMAIL.pwchange,
      role: "REQUESTER",
      isActive: true,
    });

    // The same session remains valid and /me reports the cleared flag.
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.mustChangePassword).toBe(false);

    // The old password no longer works; the new one does.
    expect((await login(EMAIL.pwchange, PASSWORD)).status).toBe(401);
    expect((await login(EMAIL.pwchange, NEW_PASSWORD)).status).toBe(200);
  });
});

describe("API-10 — no password material in any response (BR-09)", () => {
  it("never exposes passwordHash, failedLoginAttempts, or the session token", async () => {
    const loginRes = await login(EMAIL.requester);
    const cookie = sessionCookie(loginRes);
    const tokenValue = cookie.split("=")[1];

    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookie);
    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: "AnotherPass1!" });

    expect(changeRes.status).toBe(200);
    for (const body of [loginRes.body, meRes.body, changeRes.body]) {
      const json = JSON.stringify(body);
      expect(json).not.toContain("passwordHash");
      expect(json).not.toContain("failedLoginAttempts");
      expect(json).not.toContain(tokenValue);
    }
  });
});