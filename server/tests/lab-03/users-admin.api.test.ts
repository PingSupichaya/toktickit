import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  PASSWORD,
  TRUSTED_ORIGIN,
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";
import { normalizeEmail } from "../../src/email.js";

// ---------------------------------------------------------------------------
// lab-03 / users-admin.api.test.ts — API-35..API-42 (§2.6 tests.md)
//
//   API-35  User list, search, role filter (FR-21 / FR-24)
//   API-36  Create user with one role + initial password (AC-16 / BR-29, BR-09)
//   API-37  Edit name/email/role/activation state (AC-17 / BR-13, BR-30, BR-35)
//   API-38  Activation and deactivation; users are never deleted (FR-23 / BR-33)
//   API-39  Admin cannot deactivate own account -> 409 CANNOT_DEACTIVATE_SELF
//   API-40  Last active Administrator protection -> 409 LAST_ACTIVE_ADMIN
//   API-41  Set/reset initial password forces change at next login (AC-19)
//   API-42  Non-Administrator denied all user endpoints -> 403 (AC-22)
//
// BR-32 is only reachable through self-demotion: self-deactivation is preempted
// by BR-31, and deactivating/demoting a peer always leaves the caller active.
// The "last active" state is probed rather than forced — the whole server suite
// runs in parallel against the same DB, where other suites keep their own active
// ADMIN users alive, so the assertion branches on the live count at request time
// (deterministic either way, and never disturbs sibling suites).
// ---------------------------------------------------------------------------

const prisma = getPrisma();
const SEEDED_ADMINS = [
  "omar.far@mail.kmutt.ac.th",
  "priya.nai@mail.kmutt.ac.th",
];

const FIRST = "InitialPass1!";

const EMAIL = {
  adminA: "ua.admin.a@mail.kmutt.ac.th",
  adminB: "ua.admin.b@mail.kmutt.ac.th",
  staff: "ua.staff@mail.kmutt.ac.th",
  requester: "ua.requester@mail.kmutt.ac.th",
  inactiveTarget: "ua.inactive@mail.kmutt.ac.th",
  resetTarget: "ua.reset@mail.kmutt.ac.th",
  created: "ua.created@mail.kmutt.ac.th",
};

// Track the pre-existing active state of the seeded admins so beforeAll can be
// repeated and afterAll can restore the original state exactly.
let seededAdminsWereActive: Record<string, boolean> = {};

beforeAll(async () => {
  for (const email of SEEDED_ADMINS) {
    const u = await prisma.user.findUnique({ where: { email } });
    seededAdminsWereActive[email] = u?.isActive ?? true;
  }
  await prisma.user.updateMany({
    where: { email: { in: SEEDED_ADMINS } },
    data: { isActive: false },
  });

  await deleteTestUsers(prisma, Object.values(EMAIL));

  await createTestUser(prisma, EMAIL.adminA, "ADMIN", { name: "Website Admin A" });
  await createTestUser(prisma, EMAIL.adminB, "ADMIN", { name: "Website Admin B" });
  await createTestUser(prisma, EMAIL.staff, "IT_STAFF", { name: "Support Staff" });
  await createTestUser(prisma, EMAIL.requester, "REQUESTER", { name: "Campus User" });
});

afterAll(async () => {
  for (const email of SEEDED_ADMINS) {
    await prisma.user.update({
      where: { email },
      data: { isActive: seededAdminsWereActive[email] ?? true },
    });
  }
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

async function adminAgent(email = EMAIL.adminA) {
  return loginAgent(app, email);
}

describe("API-35 — user list, search, role filter (FR-21 / FR-24)", () => {
  it("returns the user list for an Administrator without pagination", async () => {
    const agent = await adminAgent();
    const res = await agent.get("/api/users");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeUndefined();
    const emails = res.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain(EMAIL.adminA);
    expect(emails).toContain(EMAIL.requester);
  });

  it("searches name and email case-insensitively", async () => {
    const agent = await adminAgent();

    // Lowercase name fragment matches "Website Admin A" (insensitive search).
    const byName = await agent.get("/api/users").query({ search: "website admin" });
    expect(byName.status).toBe(200);
    const nameMatches = byName.body.data.map((u: { email: string }) => u.email);
    expect(nameMatches).toContain(EMAIL.adminA);

    // Uppercase email fragment matches the stored lowercase staff address.
    const byEmail = await agent.get("/api/users").query({ search: "UA.STAFF@" });
    expect(byEmail.status).toBe(200);
    const emailMatches = byEmail.body.data.map((u: { email: string }) => u.email);
    expect(emailMatches).toContain(EMAIL.staff);
  });

  it("filters by a single role", async () => {
    const agent = await adminAgent();

    const staff = await agent.get("/api/users").query({ role: "IT_STAFF" });
    expect(staff.status).toBe(200);
    const staffEmails = staff.body.data.map((u: { email: string }) => u.email);
    expect(staffEmails).toContain(EMAIL.staff);
    expect(staffEmails).not.toContain(EMAIL.requester);
    expect(staffEmails).not.toContain(EMAIL.adminA);

    const admins = await agent.get("/api/users").query({ role: "ADMIN" });
    const adminEmails = admins.body.data.map((u: { email: string }) => u.email);
    expect(adminEmails).toContain(EMAIL.adminA);
    expect(adminEmails).not.toContain(EMAIL.requester);
  });

  it("combines search and role filter", async () => {
    const agent = await adminAgent();
    const res = await agent
      .get("/api/users")
      .query({ search: "ua.", role: "REQUESTER" });
    expect(res.status).toBe(200);
    const emails = res.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain(EMAIL.requester);
    expect(emails).not.toContain(EMAIL.staff);
    expect(emails).not.toContain(EMAIL.adminA);
  });

  it("rejects an invalid role filter with 400", async () => {
    const agent = await adminAgent();
    const res = await agent.get("/api/users").query({ role: "NOT_A_ROLE" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PARAMETERS");
  });
});

describe("API-36 — create user with one role and initial password (AC-16)", () => {
  it("creates an active user, hashes the password, forces a change, never returns it", async () => {
    const agent = await adminAgent();
    const res = await agent
      .post("/api/users")
      .set("Origin", TRUSTED_ORIGIN)
      .send({
        name: "Mina Chen",
        email: EMAIL.created,
        role: "REQUESTER",
        isActive: true,
        initialPassword: FIRST,
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.email).toBe(EMAIL.created);
    expect(data.role).toBe("REQUESTER");
    expect(data.isActive).toBe(true);
    expect(data.mustChangePassword).toBe(true);
    expect(data.createdAt).toBeDefined();

    // The raw password and hash must never be returned (BR-09).
    expect(data.passwordHash).toBeUndefined();
    expect(data.initialPassword).toBeUndefined();
    expect(data.password).toBeUndefined();

    // The stored hash must differ from the raw password.
    const stored = await prisma.user.findUnique({ where: { email: EMAIL.created } });
    expect(stored?.passwordHash).toBeDefined();
    expect(stored?.passwordHash).not.toContain(FIRST);
    expect(stored?.mustChangePassword).toBe(true);
  });

  it("rejects an invalid role with 400 (exactly one permitted role)", async () => {
    const agent = await adminAgent();
    const res = await agent
      .post("/api/users")
      .set("Origin", TRUSTED_ORIGIN)
      .send({
        name: "Bad Role",
        email: "ua.badrole@mail.kmutt.ac.th",
        role: "SUPER_ADMIN",
        isActive: true,
        initialPassword: FIRST,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.role).toBeDefined();
  });

  it("rejects a weak initial password with 400 details", async () => {
    const agent = await adminAgent();
    const res = await agent
      .post("/api/users")
      .set("Origin", TRUSTED_ORIGIN)
      .send({
        name: "Weak Pass",
        email: "ua.weakpass@mail.kmutt.ac.th",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "short",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.initialPassword).toBeDefined();
  });

  it("rejects a duplicate (case-insensitive) email with 409", async () => {
    const agent = await adminAgent();
    // EMAIL.requester already exists; send its uppercase form.
    const dup = normalizeEmail(EMAIL.requester).toUpperCase();
    const res = await agent
      .post("/api/users")
      .set("Origin", TRUSTED_ORIGIN)
      .send({
        name: "Duplicate",
        email: dup,
        role: "REQUESTER",
        isActive: true,
        initialPassword: FIRST,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});

describe("API-37 — edit name/email/role/activation state (AC-17)", () => {
  it("updates name, email, role, and activation state", async () => {
    const agent = await adminAgent();
    const requester = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL.requester },
    });

    const res = await agent
      .patch(`/api/users/${requester.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ name: "Edited Name", role: "IT_STAFF", isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Edited Name");
    expect(res.body.data.role).toBe("IT_STAFF");
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.email).toBe(EMAIL.requester);

    // Persisted in the DB.
    const stored = await prisma.user.findUnique({
      where: { id: requester.id },
    });
    expect(stored?.name).toBe("Edited Name");
    expect(stored?.role).toBe("IT_STAFF");
    expect(stored?.isActive).toBe(false);

    // Restore for later suites.
    await agent
      .patch(`/api/users/${requester.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ name: "Campus User", role: "REQUESTER", isActive: true });
  });

  it("rejects a duplicate email on another user with 409", async () => {
    const agent = await adminAgent();
    const created = await createTestUser(prisma, "ua.dup@mail.kmutt.ac.th", "REQUESTER");

    // EMAIL.staff already owns this address.
    const res = await agent
      .patch(`/api/users/${created.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ email: EMAIL.staff });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");

    await deleteTestUsers(prisma, ["ua.dup@mail.kmutt.ac.th"]);
  });

  it("rejects an invalid role with 400", async () => {
    const agent = await adminAgent();
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff } });

    const res = await agent
      .patch(`/api/users/${staff.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ role: "SUPER_ADMIN" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.role).toBeDefined();
  });

  it("returns 404 for an unknown user", async () => {
    const agent = await adminAgent();
    const res = await agent
      .patch("/api/users/999999999")
      .set("Origin", TRUSTED_ORIGIN)
      .send({ name: "Nowhere" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });
});

describe("API-38 — activation and deactivation; users are never deleted (FR-23 / BR-33)", () => {
  it("deactivated users cannot log in, reactivation restores access", async () => {
    await createTestUser(prisma, EMAIL.inactiveTarget, "REQUESTER");
    const agent = await adminAgent();

    const target = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL.inactiveTarget },
    });

    const deactivate = await agent
      .patch(`/api/users/${target.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);
    // Users are never deleted: the row still exists.
    const still = await prisma.user.findUnique({ where: { id: target.id } });
    expect(still).toBeDefined();

    const failed = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL.inactiveTarget, password: PASSWORD });
    expect(failed.status).toBe(403);
    expect(failed.body.error.code).toBe("ACCOUNT_INACTIVE");

    const reactivate = await agent
      .patch(`/api/users/${target.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.data.isActive).toBe(true);

    const ok = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL.inactiveTarget, password: PASSWORD });
    expect(ok.status).toBe(200);
  });
});

describe("API-39 — Admin cannot deactivate own account (AC-18 / BR-31)", () => {
  it("returns 409 CANNOT_DEACTIVATE_SELF", async () => {
    const agent = await adminAgent();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.adminA } });

    const res = await agent
      .patch(`/api/users/${admin.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CANNOT_DEACTIVATE_SELF");
  });
});

describe("API-40 — last active Administrator protection (AC-18 / BR-32)", () => {
  it("rejects a self-demotion that would leave zero active admins, otherwise applies it", async () => {
    // Probe the live count of other active admins (the whole server suite runs
    // in parallel against this DB). The assertion branches deterministically:
    // 409 LAST_ACTIVE_ADMIN exactly when no other active ADMIN remains, else a
    // successful demote to REQUESTER is applied.
    const agent = await adminAgent(EMAIL.adminB);
    const adminB = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.adminB } });

    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: adminB.id } },
    });

    const res = await agent
      .patch(`/api/users/${adminB.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ role: "REQUESTER" });

    if (otherActiveAdmins === 0) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("LAST_ACTIVE_ADMIN");
      expect(res.body.error.message).toMatch(/at least one active Administrator/i);
      return;
    }

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("REQUESTER");
  });

  it("rebuilds a two-admin baseline afterwards", async () => {
    const agent = await adminAgent(); // adminA is definitely still an ADMIN
    const adminB = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.adminB } });

    const promote = await agent
      .patch(`/api/users/${adminB.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ role: "ADMIN" });
    expect(promote.status).toBe(200);
    expect(promote.body.data.role).toBe("ADMIN");
  });
});

describe("API-41 — set/reset initial password forces change at next login (AC-19 / BR-34)", () => {
  it("marks the target user mustChangePassword = true", async () => {
    await createTestUser(prisma, EMAIL.resetTarget, "IT_STAFF");
    const agent = await adminAgent();
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL.resetTarget },
    });

    const res = await agent
      .post(`/api/users/${target.id}/reset-initial-password`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ newPassword: "ResetMe123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
    expect(res.body.data.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({
      where: { id: target.id },
    });
    expect(stored?.mustChangePassword).toBe(true);
    // Old PASSWORD no longer works; the new one does and forces the gate.
    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL.resetTarget, password: "ResetMe123!" });
    expect(loginNew.status).toBe(200);
    expect(loginNew.body.data.mustChangePassword).toBe(true);

    const cookie = loginNew.headers["set-cookie"]?.[0]?.split(";")[0];
    const blocked = await request(app)
      .get("/api/categories")
      .set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("rejects a weak new password with 400", async () => {
    const agent = await adminAgent();
    const target = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL.resetTarget },
    });

    const res = await agent
      .post(`/api/users/${target.id}/reset-initial-password`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ newPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.newPassword).toBeDefined();
  });

  it("returns 404 for an unknown user", async () => {
    const agent = await adminAgent();
    const res = await agent
      .post("/api/users/999999999/reset-initial-password")
      .set("Origin", TRUSTED_ORIGIN)
      .send({ newPassword: "ResetMe123!" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });
});

describe("API-42 — non-Administrator denied all user endpoints (AC-22 / FR-21)", () => {
  it("Requester and IT_STAFF get 403 for list/create/edit/reset", async () => {
    const requester = await loginAgent(app, EMAIL.requester);
    const staff = await loginAgent(app, EMAIL.staff);
    const target = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.requester } });
    const bcryptHash = await bcrypt.hash(PASSWORD, 12);
    // An admin-only-owned user id that cannot be confused with the caller.
    const authzTarget = await prisma.user.create({
      data: {
        name: "AuthZ Target",
        email: "ua.authz.target@mail.kmutt.ac.th",
        role: "IT_STAFF",
        isActive: true,
        passwordHash: bcryptHash,
        mustChangePassword: false,
      },
    });

    const checks: Array<() => Promise<request.Response>> = [
      () => requester.get("/api/users"),
      () => requester.post("/api/users").set("Origin", TRUSTED_ORIGIN).send({}),
      () => requester.patch(`/api/users/${target.id}`).set("Origin", TRUSTED_ORIGIN).send({}),
      () =>
        requester
          .post(`/api/users/${authzTarget.id}/reset-initial-password`)
          .set("Origin", TRUSTED_ORIGIN)
          .send({}),
      () => staff.get("/api/users"),
      () => staff.post("/api/users").set("Origin", TRUSTED_ORIGIN).send({}),
      () => staff.patch(`/api/users/${target.id}`).set("Origin", TRUSTED_ORIGIN).send({}),
      () =>
        staff
          .post(`/api/users/${authzTarget.id}/reset-initial-password`)
          .set("Origin", TRUSTED_ORIGIN)
          .send({}),
    ];

    for (const c of checks) {
      const res = await c();
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }

    await prisma.session.deleteMany({ where: { userId: authzTarget.id } });
    await prisma.user.delete({ where: { id: authzTarget.id } });
  });
});