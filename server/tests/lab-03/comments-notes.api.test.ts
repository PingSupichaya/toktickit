import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  TRUSTED_ORIGIN,
  createTestUser,
  deleteTestUsers,
  loginAgent,
} from "../helpers/testAuth.js";
import type { TicketStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// lab-03 / comments-notes.api.test.ts — API-08, API-31..API-34 (§2.5 tests.md)
//
//   API-08  Requester requesting Internal Notes (list/create) -> 403, no
//           note content exposed (AC-04 / BR-28)
//   API-31  Create Public Comment (Requester + IT Staff): 201 append-only,
//           backend-recorded author/createdAt, content verbatim (AC-14)
//   API-32  Comment/Note content boundaries (BR-23, BR-24)
//   API-33  Comment vs Note visibility by role; lists ordered by createdAt
//   API-34  Cross-owner comment write -> 404 (no existence leak) (AC-23)
//
// Requires the DB to be migrated and seeded. All rows created here are
// removed in afterAll so the suite repeats.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  staff1: "notes.staff1@mail.kmutt.ac.th",
  admin: "notes.admin1@mail.kmutt.ac.th",
  requester: "notes.requester@mail.kmutt.ac.th",
  foreigner: "notes.foreigner@mail.kmutt.ac.th",
};

const refs: Partial<{
  staff1Id: number;
  adminId: number;
  requesterId: number;
  foreignerId: number;
  categoryId: number;
  relatedSystemId: number;
}> = {};

const createdTicketIds: number[] = [];
let seq = 0;

async function makeTicket(
  requesterId: number,
  status: TicketStatus = "NEW"
): Promise<{ id: number; ticketNumber: string }> {
  seq += 1;
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `TKC-${String(seq).padStart(6, "0")}`,
      submittedById: requesterId,
      ownerId: null,
      categoryId: refs.categoryId!,
      relatedSystemId: refs.relatedSystemId!,
      summary: "Comments & Notes API test ticket",
      description:
        "A description long enough to satisfy the Ticket model validation rules.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: status,
      ticketDate: new Date(),
    },
  });
  createdTicketIds.push(t.id);
  return { id: t.id, ticketNumber: t.ticketNumber };
}

function postComment(agent: request.Agent, ticketId: number, content: string) {
  return agent
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Origin", TRUSTED_ORIGIN)
    .send({ content });
}

function postNote(agent: request.Agent, ticketId: number, content: string) {
  return agent
    .post(`/api/tickets/${ticketId}/notes`)
    .set("Origin", TRUSTED_ORIGIN)
    .send({ content });
}

beforeAll(async () => {
  await prisma.$connect();

  const staff1 = await createTestUser(prisma, EMAIL.staff1, "IT_STAFF", { name: "Notes Staff One" });
  const admin = await createTestUser(prisma, EMAIL.admin, "ADMIN", { name: "Notes Admin" });
  const requester = await createTestUser(prisma, EMAIL.requester, "REQUESTER", { name: "Notes Requester" });
  const foreigner = await createTestUser(prisma, EMAIL.foreigner, "REQUESTER", { name: "Notes Foreigner" });

  refs.staff1Id = staff1.id;
  refs.adminId = admin.id;
  refs.requesterId = requester.id;
  refs.foreignerId = foreigner.id;

  const category = await prisma.category.create({ data: { name: `Notes Test Category ${Date.now()}` } });
  const system = await prisma.relatedSystem.create({ data: { name: `Notes Test System ${Date.now()}` } });
  refs.categoryId = category.id;
  refs.relatedSystemId = system.id;
});

afterAll(async () => {
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });

  if (refs.categoryId) await prisma.category.delete({ where: { id: refs.categoryId } }).catch(() => {});
  if (refs.relatedSystemId) await prisma.relatedSystem.delete({ where: { id: refs.relatedSystemId } }).catch(() => {});

  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-08 — Requester denied all Internal Notes access (AC-04 / BR-28)", () => {
  it("403 for list and create, without ever confirming note content", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket(refs.requesterId!);

    await prisma.internalNote.create({
      data: {
        ticketId: t.id,
        authorId: refs.staff1Id!,
        content: "TOP-SECRET-NOTE-CONTENT",
      },
    });

    const list = await requesterAgent.get(`/api/tickets/${t.id}/notes`);
    expect(list.status).toBe(403);
    expect(JSON.stringify(list.body)).not.toContain("TOP-SECRET-NOTE-CONTENT");
    expect(JSON.stringify(list.body)).not.toContain("notes");

    const create = await postNote(requesterAgent, t.id, "requester should never save");
    expect(create.status).toBe(403);

    const record = await prisma.internalNote.findFirst({
      where: { ticketId: t.id },
      select: { content: true },
    });
    expect(record?.content).toBe("TOP-SECRET-NOTE-CONTENT");

    const staffList = await staff1Agent.get(`/api/tickets/${t.id}/notes`);
    expect(staffList.status).toBe(200);
    expect(staffList.body.data.some((n: { content: string }) => n.content === "TOP-SECRET-NOTE-CONTENT")).toBe(true);
  });
});

describe("API-31 — Create Public Comment append-only (AC-14 / BR-25, BR-26)", () => {
  it("requester posts 201 with backend-recorded author/createdAt, verbatim content", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const t = await makeTicket(refs.requesterId!);

    const res = await postComment(requesterAgent, t.id, "  The GPU now reports healthy.  ");
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ticketId: t.id,
      author: { id: refs.requesterId!, name: expect.any(String) },
      content: "The GPU now reports healthy.",
    });
    expect(typeof res.body.data.createdAt).toBe("string");
    expect(res.body.data).not.toHaveProperty("authorId");
  });

  it("staff posts 201 on any ticket; history is append-only with author time", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket(refs.requesterId!);

    const res = await postComment(staff1Agent, t.id, "Investigating; will update soon.");
    expect(res.status).toBe(201);
    expect(res.body.data.author.id).toBe(refs.staff1Id!);

    const all = await staff1Agent.get(`/api/tickets/${t.id}/comments`);
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(1);
  });
});

describe("API-32 — Comment/Note content boundaries (BR-23, BR-24)", () => {
  it("accepts 1 and 2000 characters; rejects empty, whitespace-only, and 2001", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket(refs.requesterId!);

    const one = await postComment(requesterAgent, t.id, "x");
    expect(one.status).toBe(201);

    const max = "y".repeat(2000);
    const maxRes = await postComment(requesterAgent, t.id, max);
    expect(maxRes.status).toBe(201);
    expect(maxRes.body.data.content).toBe(max);

    const empty = await postComment(requesterAgent, t.id, "   ");
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");

    const tooLong = await postComment(requesterAgent, t.id, "z".repeat(2001));
    expect(tooLong.status).toBe(400);

    const noteMax = "n".repeat(2000);
    const noteMaxRes = await postNote(staff1Agent, t.id, noteMax);
    expect(noteMaxRes.status).toBe(201);
    expect(noteMaxRes.body.data.content).toBe(noteMax);

    const noteEmpty = await postNote(staff1Agent, t.id, " \n ");
    expect(noteEmpty.status).toBe(400);
  });
});

describe("API-33 — Comment vs Note visibility by role (AC-14, AC-15 / BR-04)", () => {
  it("comments visible to all; notes only to staff; lists ordered by createdAt", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const adminAgent = await loginAgent(app, EMAIL.admin);
    const t = await makeTicket(refs.requesterId!);

    const base = new Date("2026-03-01T08:00:00.000Z");
    await prisma.publicComment.create({
      data: {
        ticketId: t.id,
        authorId: refs.requesterId!,
        content: "first comment",
        createdAt: new Date(base.getTime() + 1000),
      },
    });
    await prisma.publicComment.create({
      data: {
        ticketId: t.id,
        authorId: refs.requesterId!,
        content: "second comment",
        createdAt: new Date(base.getTime() + 2000),
      },
    });
    await prisma.internalNote.create({
      data: {
        ticketId: t.id,
        authorId: refs.staff1Id!,
        content: "first note",
        createdAt: new Date(base.getTime() + 3000),
      },
    });
    await prisma.internalNote.create({
      data: {
        ticketId: t.id,
        authorId: refs.staff1Id!,
        content: "second note",
        createdAt: new Date(base.getTime() + 4000),
      },
    });

    const requesterComments = await requesterAgent.get(`/api/tickets/${t.id}/comments`);
    expect(requesterComments.status).toBe(200);
    expect(requesterComments.body.data.map((c: { content: string }) => c.content)).toEqual([
      "first comment",
      "second comment",
    ]);

    const requesterDetail = await requesterAgent.get(`/api/tickets/${t.id}`);
    expect(requesterDetail.body.data.comments).toHaveLength(2);
    expect(requesterDetail.body.data.notes).toBeUndefined();

    const staffNotes = await staff1Agent.get(`/api/tickets/${t.id}/notes`);
    expect(staffNotes.status).toBe(200);
    expect(staffNotes.body.data.map((n: { content: string }) => n.content)).toEqual([
      "first note",
      "second note",
    ]);

    const adminDetail = await adminAgent.get(`/api/tickets/${t.id}`);
    expect(adminDetail.body.data.notes.map((n: { content: string }) => n.content)).toEqual([
      "first note",
      "second note",
    ]);
    expect(adminDetail.body.data.comments).toHaveLength(2);
  });
});

describe("API-34 — Cross-owner comment write is 404 (AC-23 / BR-15)", () => {
  it("requester posting on another user's ticket is indistinguishable from missing", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const foreignerAgent = await loginAgent(app, EMAIL.foreigner);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const foreignerTicket = await makeTicket(refs.foreignerId!);

    const write = await postComment(requesterAgent, foreignerTicket.id, "sneaky");
    expect(write.status).toBe(404);

    const read = await requesterAgent.get(`/api/tickets/${foreignerTicket.id}/comments`);
    expect(read.status).toBe(404);

    const count = await prisma.publicComment.count({
      where: { ticketId: foreignerTicket.id },
    });
    expect(count).toBe(0);

    const staffWrite = await postComment(staff1Agent, foreignerTicket.id, "staff can comment");
    expect(staffWrite.status).toBe(201);
  });
});