import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { deleteStoredFile } from "../../src/attachmentFiles.js";
import {
  TRUSTED_ORIGIN,
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";

// lab-03 / migration-regression.api.test.ts — API-43, MIG-02, MIG-04
//
//   API-43 (AC-20 / BR-03, BR-41) — the full Lab 2 Requester flow regresses
//     under the authenticated identity: Create → My Tickets (search/filter/
//     sort/pager) → Detail → upload → preview → soft-remove are all bound to
//     the session user; a client-supplied `requesterId` is never honoured.
//   MIG-02 (AC-20 / §7.4) — Tickets created on the Lab 3 model keep the Lab 2
//     invariants: NEW status, itPriority = requestedPriority, owner null, and
//     the submitter maps back to the authenticated user.
//   MIG-04 — the development requester selector is gone: GET /api/requesters
//     returns 404.
//
// Requires the DB to be migrated and seeded (see README.md). All rows and
// stored files created here are cleaned up in afterAll so the suite is
// repeatable.

const prisma = getPrisma();

const EMAIL = {
  requester: "lab03.migreq.requester@mail.kmutt.ac.th",
  foreigner: "lab03.migreq.foreigner@mail.kmutt.ac.th",
};

const createdTicketIds: number[] = [];
const createdAttachmentIds: number[] = [];

interface Refs {
  requesterId: number;
  foreignerId: number;
  categoryId: number;
  relatedSystemId: number;
}

const refs: Partial<Refs> = {};

function pngBytes(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    categoryId: refs.categoryId,
    relatedSystemId: refs.relatedSystemId,
    summary: "Camera stopped detecting motion in the lab",
    description:
      "The corridor camera stopped detecting motion after the firmware update and now records everything as blank.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

async function apiCreate(agent: request.Agent, payload: Record<string, unknown>) {
  const res = await agent
    .post("/api/tickets")
    .set("Origin", TRUSTED_ORIGIN)
    .send(payload);
  if (res.body?.data?.id) createdTicketIds.push(res.body.data.id);
  return res;
}

async function uploadFile(
  agent: request.Agent,
  ticketId: number,
  buffer: Buffer,
  filename: string,
  contentType: string
) {
  const res = await agent
    .post(`/api/tickets/${ticketId}/attachments`)
    .set("Origin", TRUSTED_ORIGIN)
    .attach("file", buffer, { filename, contentType });
  if (res.body?.data?.id) createdAttachmentIds.push(res.body.data.id);
  return res;
}

beforeAll(async () => {
  await prisma.$connect();

  const requester = await createTestUser(prisma, EMAIL.requester, "REQUESTER");
  const foreigner = await createTestUser(prisma, EMAIL.foreigner, "REQUESTER");
  refs.requesterId = requester.id;
  refs.foreignerId = foreigner.id;

  refs.categoryId = (
    await prisma.category.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { id: "asc" },
    })
  ).id;

  refs.relatedSystemId = (
    await prisma.relatedSystem.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { id: "asc" },
    })
  ).id;
});

afterAll(async () => {
  const rows = await prisma.attachment.findMany({
    where: { id: { in: createdAttachmentIds } },
    select: { storedFilename: true },
  });
  for (const row of rows) {
    await deleteStoredFile(row.storedFilename).catch(() => {});
  }
  if (createdAttachmentIds.length > 0) {
    await prisma.attachment.deleteMany({
      where: { id: { in: createdAttachmentIds } },
    });
  }
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({
      where: { id: { in: createdTicketIds } },
    });
  }
  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("MIG-02 — Lab 2 data preserved under the Lab 3 model (AC-20, §7.4)", () => {
  it("a created Ticket keeps NEW status, itPriority = requestedPriority, owner null", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const res = await apiCreate(agent, validPayload());
    expect(res.status).toBe(201);

    const db = await prisma.ticket.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(db.currentStatus).toBe("NEW");
    expect(db.itPriority).toBe(db.requestedPriority);
    expect(db.itPriority).toBe("MEDIUM");
    expect(db.ownerId).toBeNull();
    expect(db.submittedById).toBe(refs.requesterId);
  });

  it("the submitter mapping survives to the Detail endpoint, with attachments and comments arrays", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const created = await apiCreate(agent, validPayload());
    const detail = await agent.get(`/api/tickets/${created.body.data.id}`);
    expect(detail.status).toBe(200);

    const d = detail.body.data;
    expect(d.submittedById).toBe(refs.requesterId);
    expect(d.submitter).toMatchObject({ id: refs.requesterId, email: EMAIL.requester });
    expect(d.ownerId).toBeNull();
    expect(d.owner).toBeNull();
    expect(Array.isArray(d.attachments)).toBe(true);
    expect(Array.isArray(d.comments)).toBe(true);
  });
});

describe("API-43 — Requester full regression under authenticated identity (AC-20 / BR-03, BR-41)", () => {
  it("create: the session user is the submitter; a body requesterId is not honoured", async () => {
    const agent = await loginAgent(app, EMAIL.requester);

    // The body is validated by the auth migration: requesterId is derived from
    // the session and must not be supplied (rejected with 400).
    const tampered = await agent
      .post("/api/tickets")
      .set("Origin", TRUSTED_ORIGIN)
      .send(validPayload({ requesterId: refs.foreignerId }));
    expect(tampered.status).toBe(400);
    expect(tampered.body.error.code).toBe("VALIDATION_ERROR");

    const res = await apiCreate(agent, validPayload());
    expect(res.status).toBe(201);
    expect(res.body.data.submittedById).toBe(refs.requesterId);
    expect(res.body.data.submittedById).not.toBe(refs.foreignerId);
  });

  it("my-tickets: search/filter/sort/pager return only the session user's rows; requesterId query is ignored", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);

    const marker = `MGREG${Date.now()}`;
    for (let n = 1; n <= 3; n++) {
      await apiCreate(
        agent,
        validPayload({ summary: `${marker} regression ticket ${n}` })
      );
    }
    const foreign = await apiCreate(
      foreignAgent,
      validPayload({ summary: `${marker} foreign ticket` })
    );
    createdTicketIds.push(foreign.body.data.id);

    // Even with `requesterId` pointing at the foreign user, the session user's
    // own tickets are listed (query param ignored).
    const res = await agent.get(
      `/api/tickets` +
        `?requesterId=${refs.foreignerId}` +
        `&search=${encodeURIComponent(marker)}` +
        `&categoryId=${refs.categoryId}` +
        `&priority=MEDIUM` +
        `&sortBy=ticketDate&sortOrder=asc` +
        `&page=1&pageSize=10`
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      totalCount: 3,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(res.body.data.map((r: { id: number }) => r.id)).not.toContain(
      foreign.body.data.id
    );
    for (const row of res.body.data) {
      expect(row.summary).toContain(marker);
    }
  });

  it("detail: an owned ticket loads fully; a cross-owner requester sees 404 (D-03)", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);
    const created = await apiCreate(agent, validPayload());

    const owned = await agent.get(`/api/tickets/${created.body.data.id}`);
    expect(owned.status).toBe(200);
    expect(owned.body.data.ticketNumber).toBe(created.body.data.ticketNumber);
    expect(owned.body.data.category).toHaveProperty("name");
    expect(owned.body.data.relatedSystem).toHaveProperty("name");
    expect(owned.body.data).toHaveProperty("canIndicateResolved");
    expect(owned.body.data).not.toHaveProperty("notes");

    const hidden = await foreignAgent.get(`/api/tickets/${created.body.data.id}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("attachment lifecycle under auth: upload → preview → soft-remove → removed download 403", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const created = await apiCreate(agent, validPayload());
    const ticketId = created.body.data.id;

    const up = await uploadFile(agent, ticketId, pngBytes(), "evidence.png", "image/png");
    expect(up.status).toBe(201);
    expect(up.body.data.ticketId).toBe(ticketId);
    const attachmentId = up.body.data.id;

    const download = await agent.get(`/api/attachments/${attachmentId}/download`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toMatch(/^image\/png/);
    expect(Buffer.isBuffer(download.body)).toBe(true);

    const remove = await agent
      .delete(`/api/attachments/${attachmentId}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ removalReason: "Wrong evidence file" });
    expect(remove.status).toBe(200);
    expect(remove.body.data.isRemoved).toBe(true);

    const removedDownload = await agent.get(`/api/attachments/${attachmentId}/download`);
    expect(removedDownload.status).toBe(403);
    expect(removedDownload.body.error.code).toBe("ATTACHMENT_REMOVED");

    const meta = await agent.get(`/api/tickets/${ticketId}/attachments?includeRemoved=true`);
    const rec = meta.body.data.find((a: { id: number }) => a.id === attachmentId);
    expect(rec).toBeDefined();
    expect(rec.isRemoved).toBe(true);
  });
});

describe("MIG-04 — development requester selector removed", () => {
  it("GET /api/requesters returns 404 (no requester-selector state endpoint exists)", async () => {
    const agent = await loginAgent(app, EMAIL.requester);
    const res = await agent.get("/api/requesters");
    expect(res.status).toBe(404);
  });
});