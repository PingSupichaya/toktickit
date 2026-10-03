import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  TRUSTED_ORIGIN,
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";

// ---------------------------------------------------------------------------
// lab-04 / ticket-workflow.api.test.ts — API-14–API-22
// (docs/lab-04/tests.md §2.2, api-spec §4.4 + §5, BR-10–BR-13).
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  req1: "workflow.req1@mail.kmutt.ac.th",
  staff1: "workflow.staff1@mail.kmutt.ac.th",
  staff2: "workflow.staff2@mail.kmutt.ac.th",
};

const CAT = "Workflow Test Category";
const SYS = "Workflow Test System";

let seq = 0;
const refs: { categoryId: number; systemId: number; req1Id: number; staff1Id: number } = {
  categoryId: 0,
  systemId: 0,
  req1Id: 0,
  staff1Id: 0,
};

async function makeTicket(status: string): Promise<number> {
  seq += 1;
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `TKW-${String(200000 + seq)}`,
      submittedById: refs.req1Id,
      ownerId: refs.staff1Id,
      categoryId: refs.categoryId,
      relatedSystemId: refs.systemId,
      summary: `Workflow fixture TKW-${seq} summary text`,
      description: `Workflow fixture TKW-${seq} description with enough detail.`,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status as never,
    },
  });
  return t.id;
}

async function currentVersion(agent: request.Agent, ticketId: number): Promise<number> {
  const res = await agent.get(`/api/tickets/${ticketId}`);
  expect(res.status).toBe(200);
  return res.body.data.version;
}

function patchTicket(agent: request.Agent, ticketId: number, body: object) {
  return agent
    .patch(`/api/tickets/${ticketId}`)
    .set("Origin", TRUSTED_ORIGIN)
    .send(body);
}

async function addQualifyingAction(agent: request.Agent, ticketId: number) {
  const res = await agent
    .post(`/api/tickets/${ticketId}/actions`)
    .set("Origin", TRUSTED_ORIGIN)
    .send({
      actionAt: "2026-09-20T09:15:00.000Z",
      description: "Workflow qualifying work.",
      result: "Verified working.",
      followUpRequired: false,
    });
  expect(res.status).toBe(201);
}

async function addBlockedAction(agent: request.Agent, ticketId: number) {
  const res = await agent
    .post(`/api/tickets/${ticketId}/actions`)
    .set("Origin", TRUSTED_ORIGIN)
    .send({
      actionAt: "2026-09-20T09:15:00.000Z",
      description: "Workflow work needing follow-up.",
      result: "Partially done.",
      followUpRequired: true,
      followUpNote: "Revisit after parts arrive.",
    });
  expect(res.status).toBe(201);
}

beforeAll(async () => {
  await prisma.$connect();
  await createTestUser(prisma, EMAIL.req1, "REQUESTER", { name: "Workflow Req" });
  await createTestUser(prisma, EMAIL.staff1, "IT_STAFF", { name: "Workflow Staff One" });
  await createTestUser(prisma, EMAIL.staff2, "IT_STAFF", { name: "Workflow Staff Two" });
  const category = await prisma.category.create({ data: { name: CAT } });
  const system = await prisma.relatedSystem.create({ data: { name: SYS } });
  refs.categoryId = category.id;
  refs.systemId = system.id;
  refs.req1Id = (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.req1 } })).id;
  refs.staff1Id = (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL.staff1 } })).id;
});

afterAll(async () => {
  await prisma.actionTaken.deleteMany({
    where: { ticket: { ticketNumber: { startsWith: "TKW-" } } },
  });
  await prisma.publicComment.deleteMany({
    where: { ticket: { ticketNumber: { startsWith: "TKW-" } } },
  });
  await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: "TKW-" } },
  });
  await prisma.category.deleteMany({ where: { name: CAT } });
  await prisma.relatedSystem.deleteMany({ where: { name: SYS } });
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-14 — resolve with zero Actions Taken (AC-03 / BR-10)", () => {
  it("→ 422 RESOLUTION_NOT_ALLOWED; status unchanged", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("OPEN");
    const res = await patchTicket(staff, id, {
      version: await currentVersion(staff, id),
      currentStatus: "RESOLVED",
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RESOLUTION_NOT_ALLOWED");

    const detail = await staff.get(`/api/tickets/${id}`);
    expect(detail.body.data.currentStatus).toBe("OPEN");
  });
});

describe("API-15 — resolve with outstanding follow-up (AC-04 / BR-10)", () => {
  it("latest action followUpRequired=true → 422", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("OPEN");
    await addBlockedAction(staff, id);
    const res = await patchTicket(staff, id, {
      version: await currentVersion(staff, id),
      currentStatus: "RESOLVED",
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RESOLUTION_NOT_ALLOWED");
  });
});

describe("API-16 — resolve when gate satisfied (AC-05 / BR-10)", () => {
  it("≥1 action, latest followUpRequired=false → 200 with version+1", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("OPEN");
    await addQualifyingAction(staff, id);
    const version = await currentVersion(staff, id);
    const res = await patchTicket(staff, id, { version, currentStatus: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("RESOLVED");
    expect(res.body.data.version).toBe(version + 1);
    expect(res.body.data.actionCount).toBe(1);
    expect(res.body.data.hasOutstandingFollowUp).toBe(false);
  });
});

describe("API-17 — gate looks only at the most recent action (BR-10)", () => {
  it("earlier true + later false → resolution succeeds", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("IN_PROGRESS");
    await addBlockedAction(staff, id);
    await addQualifyingAction(staff, id);
    const res = await patchTicket(staff, id, {
      version: await currentVersion(staff, id),
      currentStatus: "RESOLVED",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("RESOLVED");
  });
});

describe("API-18/19 — full transition matrix persists (FR-06 / §7)", () => {
  it("every permitted move succeeds, incl. gated RESOLVED hops", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const walks: Array<{ from: string; hops: string[] }> = [
      { from: "NEW", hops: ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "OPEN"] },
      { from: "NEW", hops: ["IN_PROGRESS", "OPEN", "WAITING_FOR_REQUESTER", "IN_PROGRESS", "RESOLVED", "REOPENED", "RESOLVED"] },
      { from: "NEW", hops: ["CANCELLED"] },
      { from: "OPEN", hops: ["CANCELLED"] },
      { from: "IN_PROGRESS", hops: ["CANCELLED"] },
      { from: "WAITING_FOR_REQUESTER", hops: ["CANCELLED"] },
      { from: "REOPENED", hops: ["CANCELLED"] },
    ];
    for (const { from, hops } of walks) {
      const id = await makeTicket(from);
      for (const to of hops) {
        if (to === "RESOLVED") await addQualifyingAction(staff, id);
        const res = await patchTicket(staff, id, {
          version: await currentVersion(staff, id),
          currentStatus: to,
        });
        expect(res.status).toBe(200);
        expect(res.body.data.currentStatus).toBe(to);
      }
    }
    // CLOSED → REOPENED.
    const closedId = await makeTicket("CLOSED");
    const reopen = await patchTicket(staff, closedId, {
      version: await currentVersion(staff, closedId),
      currentStatus: "REOPENED",
    });
    expect(reopen.status).toBe(200);
  });

  it("every disallowed pair → 409 TICKET_STATUS_TRANSITION_NOT_ALLOWED", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const denied: Array<[string, string]> = [
      ["NEW", "CLOSED"],
      ["NEW", "RESOLVED"],
      ["NEW", "REOPENED"],
      ["CANCELLED", "OPEN"],
      ["RESOLVED", "OPEN"],
      ["IN_PROGRESS", "CLOSED"],
      ["CLOSED", "OPEN"],
      ["REOPENED", "CLOSED"],
    ];
    for (const [from, to] of denied) {
      const id = await makeTicket(from);
      const res = await patchTicket(staff, id, {
        version: await currentVersion(staff, id),
        currentStatus: to,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TICKET_STATUS_TRANSITION_NOT_ALLOWED");
    }
  });
});

describe("API-20 — stale write on Ticket update (AC-07 / BR-12)", () => {
  it("outdated version → 409 with current ticket; retry → 200 version+1", async () => {
    const staff1 = await loginAgent(app, EMAIL.staff1);
    const staff2 = await loginAgent(app, EMAIL.staff2);
    const id = await makeTicket("NEW");
    const v1 = await currentVersion(staff1, id);

    const first = await patchTicket(staff1, id, { version: v1, itPriority: "HIGH" });
    expect(first.status).toBe(200);
    expect(first.body.data.version).toBe(v1 + 1);

    const stale = await patchTicket(staff2, id, { version: v1, itPriority: "LOW" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");
    expect(stale.body.error.details.current.version).toBe(v1 + 1);
    expect(stale.body.error.details.current.itPriority).toBe("HIGH");

    const retry = await patchTicket(staff2, id, { version: v1 + 1, itPriority: "LOW" });
    expect(retry.status).toBe(200);
    expect(retry.body.data.version).toBe(v1 + 2);
  });

  it("missing version → 400 VALIDATION_ERROR", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("NEW");
    const res = await patchTicket(staff, id, { itPriority: "HIGH" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("API-21 — indicate-resolved unaffected by the gate (BR-10, BR-13)", () => {
  it("succeeds with zero actions and never changes status", async () => {
    const req = await loginAgent(app, EMAIL.req1);
    const id = await makeTicket("OPEN");
    const res = await req
      .post(`/api/tickets/${id}/indicate-resolved`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({});
    expect(res.status).toBe(201);

    const staff = await loginAgent(app, EMAIL.staff1);
    const detail = await staff.get(`/api/tickets/${id}`);
    expect(detail.body.data.currentStatus).toBe("OPEN");
  });
});

describe("API-22 — evaluation order: version → matrix → gate (BR-11)", () => {
  it("stale version + illegal target → STALE_UPDATE (not matrix error)", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("NEW");
    const v1 = await currentVersion(staff, id);
    await patchTicket(staff, id, { version: v1, itPriority: "HIGH" });

    const res = await patchTicket(staff, id, { version: v1, currentStatus: "CLOSED" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_UPDATE");
  });

  it("illegal matrix move + failing gate → matrix error (gate is last)", async () => {
    const staff = await loginAgent(app, EMAIL.staff1);
    const id = await makeTicket("NEW");
    const res = await patchTicket(staff, id, {
      version: await currentVersion(staff, id),
      currentStatus: "RESOLVED",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_STATUS_TRANSITION_NOT_ALLOWED");
  });
});
