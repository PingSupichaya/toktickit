import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  PASSWORD,
  TRUSTED_ORIGIN,
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";

// ---------------------------------------------------------------------------
// lab-04 / actions-taken.api.test.ts — API-01–API-13, API-37, API-39
// (docs/lab-04/tests.md §2.1, api-spec §4.1–§4.3, BR-01..BR-08).
// API-38 (gate keys off latest actionAt) belongs to the ticket-workflow
// issue — the resolution gate does not exist yet, so it stays a todo here.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  req1: "actions.req1@mail.kmutt.ac.th",
  req2: "actions.req2@mail.kmutt.ac.th",
  staff1: "actions.staff1@mail.kmutt.ac.th",
  staff2: "actions.staff2@mail.kmutt.ac.th",
  admin: "actions.admin@mail.kmutt.ac.th",
};

const CAT = "Actions Test Category";
const SYS = "Actions Test System";

const refs: {
  tAId: number;
  tEmptyId: number;
  tBId: number;
  tOrderId: number;
} = { tAId: 0, tEmptyId: 0, tBId: 0, tOrderId: 0 };

function postAction(agent: request.Agent, ticketId: number, body: object) {
  return agent
    .post(`/api/tickets/${ticketId}/actions`)
    .set("Origin", TRUSTED_ORIGIN)
    .send(body);
}

function patchAction(
  agent: request.Agent,
  ticketId: number,
  actionId: number,
  body: object
) {
  return agent
    .patch(`/api/tickets/${ticketId}/actions/${actionId}`)
    .set("Origin", TRUSTED_ORIGIN)
    .send(body);
}

const validBody = (overrides: object = {}) => ({
  actionAt: "2026-09-20T09:15:00.000Z",
  description: "Reseated the RAM and reran the diagnostic tool.",
  result: "Diagnostic passed; battery drain no longer reproducible.",
  followUpRequired: false,
  attachmentNotes: "See diagnostic_log_2.pdf on the shared drive.",
  ...overrides,
});

beforeAll(async () => {
  await prisma.$connect();

  await createTestUser(prisma, EMAIL.req1, "REQUESTER", { name: "Actions Req One" });
  await createTestUser(prisma, EMAIL.req2, "REQUESTER", { name: "Actions Req Two" });
  await createTestUser(prisma, EMAIL.staff1, "IT_STAFF", { name: "Actions Staff One" });
  await createTestUser(prisma, EMAIL.staff2, "IT_STAFF", { name: "Actions Staff Two" });
  await createTestUser(prisma, EMAIL.admin, "ADMIN", { name: "Actions Admin" });

  const category = await prisma.category.create({ data: { name: CAT } });
  const system = await prisma.relatedSystem.create({ data: { name: SYS } });
  const req1 = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.req1 } });
  const req2 = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.req2 } });
  const staff1 = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff1 } });

  const ticketData = (submittedById: number, n: string) => ({
    ticketNumber: n,
    submittedById,
    ownerId: staff1.id,
    categoryId: category.id,
    relatedSystemId: system.id,
    summary: `Actions fixture ${n} summary text`,
    description: `Actions fixture ${n} description with enough detail here.`,
    requestedPriority: "MEDIUM" as const,
    itPriority: "MEDIUM" as const,
    currentStatus: "OPEN" as const,
  });

  const tA = await prisma.ticket.create({ data: ticketData(req1.id, "TKACT-000001") });
  const tEmpty = await prisma.ticket.create({ data: ticketData(req1.id, "TKACT-000002") });
  const tB = await prisma.ticket.create({ data: ticketData(req2.id, "TKACT-000003") });
  const tOrder = await prisma.ticket.create({ data: ticketData(req1.id, "TKACT-000004") });
  refs.tAId = tA.id;
  refs.tEmptyId = tEmpty.id;
  refs.tBId = tB.id;
  refs.tOrderId = tOrder.id;
});

afterAll(async () => {
  await prisma.actionTaken.deleteMany({
    where: { ticket: { ticketNumber: { startsWith: "TKACT-" } } },
  });
  await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: "TKACT-" } },
  });
  await prisma.category.deleteMany({ where: { name: CAT } });
  await prisma.relatedSystem.deleteMany({ where: { name: SYS } });
  // Restore staff2 in case API-39 left it deactivated, then remove fixtures.
  await prisma.user.updateMany({
    where: { email: EMAIL.staff2 },
    data: { isActive: true },
  });
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-09 — empty Ticket returns an empty list (AC-01)", () => {
  it("GET on a Ticket with zero Actions Taken → { data: [] }", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const res = await staff.get(`/api/tickets/${refs.tEmptyId}/actions`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });
});

describe("API-01 — create a valid Action Taken (AC-01 / BR-03, BR-06)", () => {
  it("201 with ticketId, supplied actionAt, actor as performedBy, version 1", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const res = await postAction(staff, refs.tEmptyId, validBody());
    expect(res.status).toBe(201);
    expect(res.body.data.ticketId).toBe(refs.tEmptyId);
    expect(res.body.data.actionAt).toBe("2026-09-20T09:15:00.000Z");
    expect(res.body.data.performedBy.name).toBe("Actions Staff One");
    expect(res.body.data.performedBy.role).toBe("IT_STAFF");
    expect(res.body.data.performedBy.id).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff1 } })).id
    );
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.updatedBy).toBeNull();
    expect(res.body.data.followUpNote).toBeNull();
    // createdAt is the server log time, distinct from the supplied work date.
    expect(new Date(res.body.data.createdAt).getTime()).toBeGreaterThan(
      new Date(res.body.data.actionAt).getTime()
    );
  });
});

describe("API-02 — follow-up conditional (BR-04)", () => {
  it("true + empty note → 400 FOLLOW_UP_NOTE_REQUIRED", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const res = await postAction(
      staff,
      refs.tAId,
      validBody({ followUpRequired: true, followUpNote: "   " })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.followUpNote).toBeDefined();
  });

  it("false + stale note → 201 with followUpNote auto-cleared to null", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const res = await postAction(
      staff,
      refs.tAId,
      validBody({ followUpRequired: false, followUpNote: "leftover text" })
    );
    expect(res.status).toBe(201);
    expect(res.body.data.followUpRequired).toBe(false);
    expect(res.body.data.followUpNote).toBeNull();
  });
});

describe("API-03 — description/result boundaries (AC-01 / BR-03)", () => {
  it("rejects empty, whitespace-only, and >2000 chars", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    for (const body of [
      validBody({ description: "" }),
      validBody({ description: "   " }),
      validBody({ result: "  \t " }),
      validBody({ description: "x".repeat(2001) }),
      validBody({ result: "y".repeat(2001) }),
    ]) {
      const res = await postAction(staff, refs.tAId, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("accepts 1 and 2000 chars", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const res = await postAction(
      staff,
      refs.tAId,
      validBody({ description: "d", result: "r".repeat(2000) })
    );
    expect(res.status).toBe(201);
  });
});

describe("API-04 — attachment notes (BR-05)", () => {
  it("omitted → null and creates no Attachment record", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const before = await prisma.attachment.count({
      where: { ticketId: refs.tAId },
    });
    const { attachmentNotes: _omit, ...body } = validBody();
    const res = await postAction(staff, refs.tAId, body);
    expect(res.status).toBe(201);
    expect(res.body.data.attachmentNotes).toBeNull();
    await expect(
      prisma.attachment.count({ where: { ticketId: refs.tAId } })
    ).resolves.toBe(before);
  });

  it("rejects >500 chars", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const res = await postAction(
      staff,
      refs.tAId,
      validBody({ attachmentNotes: "z".repeat(501) })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("API-05 — Requester cannot create (AC-09 / BR-02)", () => {
  it("Requester POST → 403 and no record created", async () => {
    const req = await loginAgent(app, EMAIL.req1);
    const before = await prisma.actionTaken.count({
      where: { ticketId: refs.tAId },
    });
    const res = await postAction(req, refs.tAId, validBody());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    await expect(
      prisma.actionTaken.count({ where: { ticketId: refs.tAId } })
    ).resolves.toBe(before);
  });
});

describe("API-06 — non-owner Staff can create (BR-02)", () => {
  it("IT_STAFF other than the Ticket owner → 201", async () => {
    const staff2 = await loginAgent(app, EMAIL.staff2);
    const res = await postAction(staff2, refs.tAId, validBody());
    expect(res.status).toBe(201);
    const staff2Id = (
      await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff2 } })
    ).id;
    expect(res.body.data.performedBy.id).toBe(staff2Id);
  });
});

describe("API-07 — Requester list is read-only and scoped (AC-08 / FR-04)", () => {
  it("own Ticket → 200; another Requester's Ticket → 404", async () => {
    const req = await loginAgent(app, EMAIL.req1);
    const own = await req.get(`/api/tickets/${refs.tAId}/actions`);
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body.data)).toBe(true);

    const cross = await req.get(`/api/tickets/${refs.tBId}/actions`);
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});

describe("API-08 — list ordering (FR-05 / BR-08)", () => {
  it("returns oldest work first by (actionAt asc, id asc)", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const descs = ["order-mid", "order-early", "order-late", "order-tie-a", "order-tie-b"];
    const ats = [
      "2026-09-10T10:00:00.000Z",
      "2026-09-08T10:00:00.000Z",
      "2026-09-12T10:00:00.000Z",
      "2026-09-11T10:00:00.000Z",
      "2026-09-11T10:00:00.000Z",
    ];
    for (let i = 0; i < descs.length; i++) {
      const res = await postAction(
        staff,
        refs.tOrderId,
        validBody({ description: descs[i], result: `result ${descs[i]}`, actionAt: ats[i] })
      );
      expect(res.status).toBe(201);
    }
    const list = await staff.get(`/api/tickets/${refs.tOrderId}/actions`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((a: { description: string }) => a.description)).toEqual([
      "order-early",
      "order-mid",
      "order-tie-a",
      "order-tie-b",
      "order-late",
    ]);
  });
});

describe("API-10 — edit role restriction (AC-09 / BR-02)", () => {
  it("Requester PATCH → 403; non-author Staff PATCH → 200", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const created = await postAction(
      staff,
      refs.tAId,
      validBody({ description: "api10 original" })
    );
    expect(created.status).toBe(201);

    const req = await loginAgent(app, EMAIL.req1);
    const denied = await patchAction(req, refs.tAId, created.body.data.id, {
      version: 1,
      description: "requester edit attempt",
    });
    expect(denied.status).toBe(403);

    const staff2 = await loginAgent(app, EMAIL.staff2);
    const allowed = await patchAction(staff2, refs.tAId, created.body.data.id, {
      version: 1,
      description: "non-author staff edit",
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.description).toBe("non-author staff edit");
  });
});

describe("API-11 — edit preserves immutable fields (BR-06, BR-07)", () => {
  it("performedBy/createdAt unchanged; actionAt editable; updatedBy set", async () => {
    const staff1 = await loginAgent(app, EMAIL.staff1);
    const created = await postAction(
      staff1,
      refs.tAId,
      validBody({ description: "api11 original" })
    );
    const staff1Id = (
      await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff1 } })
    ).id;
    const staff2Id = (
      await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff2 } })
    ).id;

    const staff2 = await loginAgent(app, EMAIL.staff2);
    const edited = await patchAction(staff2, refs.tAId, created.body.data.id, {
      version: 1,
      actionAt: "2026-09-21T08:00:00.000Z",
      result: "api11 updated result",
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.performedBy.id).toBe(staff1Id);
    expect(edited.body.data.createdAt).toBe(created.body.data.createdAt);
    expect(edited.body.data.actionAt).toBe("2026-09-21T08:00:00.000Z");
    expect(edited.body.data.updatedBy.id).toBe(staff2Id);
    expect(edited.body.data.version).toBe(2);
  });
});

describe("API-12 — stale write rejected on edit (AC-07 / BR-12)", () => {
  it("outdated version → 409 STALE_UPDATE with current record; retry → 200", async () => {
    const staff1 = await loginAgent(app, EMAIL.staff1);
    const created = await postAction(
      staff1,
      refs.tAId,
      validBody({ description: "api12 original" })
    );
    const id = created.body.data.id;

    const first = await patchAction(staff1, refs.tAId, id, {
      version: 1,
      description: "api12 first write",
    });
    expect(first.status).toBe(200);
    expect(first.body.data.version).toBe(2);

    const staff2 = await loginAgent(app, EMAIL.staff2);
    const stale = await patchAction(staff2, refs.tAId, id, {
      version: 1,
      description: "api12 stale write",
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");
    expect(stale.body.error.details.current.version).toBe(2);
    expect(stale.body.error.details.current.description).toBe("api12 first write");

    const retry = await patchAction(staff2, refs.tAId, id, {
      version: 2,
      description: "api12 retry write",
    });
    expect(retry.status).toBe(200);
    expect(retry.body.data.version).toBe(3);
  });
});

describe("API-13 — edit re-validates the follow-up conditional (BR-04)", () => {
  it("flipping to true without a note → 400; with a note → 200", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const created = await postAction(
      staff,
      refs.tAId,
      validBody({ description: "api13 original" })
    );
    const id = created.body.data.id;

    const missing = await patchAction(staff, refs.tAId, id, {
      version: 1,
      followUpRequired: true,
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");

    const supplied = await patchAction(staff, refs.tAId, id, {
      version: 1,
      followUpRequired: true,
      followUpNote: "Check back after the patch window.",
    });
    expect(supplied.status).toBe(200);
    expect(supplied.body.data.followUpRequired).toBe(true);
  });
});

describe("API-37 — actionAt future rejected, past accepted (AC-13 / BR-06)", () => {
  it("actionAt 10 min in the future → 400 ACTION_AT_IN_FUTURE", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const res = await postAction(staff, refs.tAId, validBody({ actionAt: future }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ACTION_AT_IN_FUTURE");
  });

  it("past actionAt → 201 stored verbatim", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const past = "2020-01-15T08:30:00.000Z";
    const res = await postAction(staff, refs.tAId, validBody({ actionAt: past }));
    expect(res.status).toBe(201);
    expect(res.body.data.actionAt).toBe(past);
  });
});

describe("API-39 — inactive Staff denied (BR-02 auth matrix)", () => {
  it("deactivated session → 401; fresh login → 403 ACCOUNT_INACTIVE", async () => {
    const staff2 = await loginAgent(app, EMAIL.staff2);
    await prisma.user.update({
      where: { email: EMAIL.staff2 },
      data: { isActive: false },
    });
    try {
      const denied = await staff2.get(`/api/tickets/${refs.tAId}/actions`);
      expect(denied.status).toBe(401);
      expect(denied.body.error.code).toBe("UNAUTHORIZED");

      const relogin = await request(app)
        .post("/api/auth/login")
        .send({ email: EMAIL.staff2, password: PASSWORD });
      expect(relogin.status).toBe(403);
      expect(relogin.body.error.code).toBe("ACCOUNT_INACTIVE");
    } finally {
      await prisma.user.update({
        where: { email: EMAIL.staff2 },
        data: { isActive: true },
      });
    }
  });
});
