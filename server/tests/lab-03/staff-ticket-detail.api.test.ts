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
import type { RequestedPriority, TicketStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// lab-03 / staff-ticket-detail.api.test.ts — API-22..API-30 (§2.4 tests.md)
//
//   API-22  detail returns owner/itPriority/permittedStatusTransitions/comments;
//           notes present only for IT_STAFF/ADMIN viewers (AC-15)
//   API-23  claim unassigned (200); already-assigned -> 409 (AC-09)
//   API-24  assign/reassign to active IT_STAFF or ADMIN; inactive/wrong-role
//           owners are indistinguishable from missing -> 404 (AC-10)
//   API-25  IT Priority lifecycle: init = requested, staff PATCH, requester 403
//   API-26  every positive transition in §5.3 persists (walk + single hops)
//   API-27  disallowed transitions -> 409 TICKET_STATUS_TRANSITION_NOT_ALLOWED;
//           CANCELLED terminal; rejected writes never overwrite (BR-43)
//   API-28  requester respond WFO->OPEN; other statuses 409; staff 403
//   API-29  "Problem Appears Resolved" indicator (201, status unchanged) etc.
//   API-30  staff can download/preview any Ticket's active attachments (200);
//           staff upload/remove -> 403; requester cross-owner -> 404
//
// Requires the DB to be migrated and seeded. All rows/stored files created
// here are removed in afterAll so the suite repeats.
// ---------------------------------------------------------------------------

const prisma = getPrisma();

const EMAIL = {
  staff1: "detail.staff1@mail.kmutt.ac.th",
  staff2: "detail.staff2@mail.kmutt.ac.th",
  admin: "detail.admin1@mail.kmutt.ac.th",
  inactiveStaff: "detail.staff.inactive@mail.kmutt.ac.th",
  requester: "detail.requester@mail.kmutt.ac.th",
  foreigner: "detail.foreigner@mail.kmutt.ac.th",
};

const refs: Partial<{
  staff1Id: number;
  staff2Id: number;
  adminId: number;
  inactiveStaffId: number;
  requesterId: number;
  foreignerId: number;
  categoryId: number;
  relatedSystemId: number;
}> = {};

const createdTicketIds: number[] = [];
const createdAttachmentIds: number[] = [];
let seq = 0;

function pngBytes(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

interface TicketSpec {
  requesterId: number;
  ownerId?: number | null;
  status: TicketStatus;
  requestedPriority?: RequestedPriority;
}

async function makeTicket(spec: TicketSpec): Promise<{ id: number; ticketNumber: string }> {
  seq += 1;
  const priority = spec.requestedPriority ?? "LOW";
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `TKD-${String(seq).padStart(6, "0")}`,
      submittedById: spec.requesterId,
      ownerId: spec.ownerId ?? null,
      categoryId: refs.categoryId!,
      relatedSystemId: refs.relatedSystemId!,
      summary: "Staff Detail API test ticket",
      description:
        "A description long enough to satisfy the Ticket model validation rules.",
      requestedPriority: priority,
      itPriority: priority,
      currentStatus: spec.status,
      ticketDate: new Date(),
    },
  });
  createdTicketIds.push(t.id);
  return { id: t.id, ticketNumber: t.ticketNumber };
}

// POST a Public Comment/Internal Note directly (through the API) is covered in
// comments-notes.api.test.ts; makeTicket + patchTo keep this suite focused.

async function patchStatus(agent: request.Agent, ticketId: number, currentStatus: string) {
  return agent
    .patch(`/api/tickets/${ticketId}`)
    .set("Origin", TRUSTED_ORIGIN)
    .send({ currentStatus });
}

beforeAll(async () => {
  await prisma.$connect();

  const staff1 = await createTestUser(prisma, EMAIL.staff1, "IT_STAFF", { name: "Detail Staff One" });
  const staff2 = await createTestUser(prisma, EMAIL.staff2, "IT_STAFF", { name: "Detail Staff Two" });
  const admin = await createTestUser(prisma, EMAIL.admin, "ADMIN", { name: "Detail Admin" });
  const inactiveStaff = await createTestUser(prisma, EMAIL.inactiveStaff, "IT_STAFF", {
    name: "Detail Inactive Staff",
    isActive: false,
  });
  const requester = await createTestUser(prisma, EMAIL.requester, "REQUESTER", { name: "Detail Requester" });
  const foreigner = await createTestUser(prisma, EMAIL.foreigner, "REQUESTER", { name: "Detail Foreigner" });

  refs.staff1Id = staff1.id;
  refs.staff2Id = staff2.id;
  refs.adminId = admin.id;
  refs.inactiveStaffId = inactiveStaff.id;
  refs.requesterId = requester.id;
  refs.foreignerId = foreigner.id;

  const category = await prisma.category.create({ data: { name: `Detail Test Category ${Date.now()}` } });
  const system = await prisma.relatedSystem.create({ data: { name: `Detail Test System ${Date.now()}` } });
  refs.categoryId = category.id;
  refs.relatedSystemId = system.id;
});

afterAll(async () => {
  const rows = await prisma.attachment.findMany({
    where: { id: { in: createdAttachmentIds } },
    select: { storedFilename: true },
  });
  for (const row of rows) {
    await deleteStoredFile(row.storedFilename).catch(() => {});
  }

  await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  if (createdAttachmentIds.length > 0) {
    await prisma.attachment.deleteMany({ where: { id: { in: createdAttachmentIds } } });
  }
  await prisma.attachment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });

  if (refs.categoryId) await prisma.category.delete({ where: { id: refs.categoryId } }).catch(() => {});
  if (refs.relatedSystemId) await prisma.relatedSystem.delete({ where: { id: refs.relatedSystemId } }).catch(() => {});

  await deleteTestUsers(prisma, Object.values(EMAIL));
  await prisma.$disconnect();
});

describe("API-22 — Ticket Detail returns operational fields (FR-15 / AC-08)", () => {
  it("staff sees owner, itPriority, permittedStatusTransitions, comments and notes", async () => {
    const staffAgent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });

    await prisma.internalNote.create({
      data: { ticketId: t.id, authorId: refs.staff1Id!, content: "secret staff note" },
    });

    const res = await staffAgent.get(`/api/tickets/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: t.id,
      ticketNumber: t.ticketNumber,
      currentStatus: "NEW",
      itPriority: "LOW",
      owner: null,
      submitter: { id: refs.requesterId! },
    });
    expect(res.body.data.permittedStatusTransitions).toEqual([
      "OPEN",
      "IN_PROGRESS",
      "CANCELLED",
    ]);
    expect(Array.isArray(res.body.data.comments)).toBe(true);
    expect(Array.isArray(res.body.data.notes)).toBe(true);
    expect(res.body.data.notes).toHaveLength(1);
    expect(res.body.data.notes[0].content).toBe("secret staff note");
  });

  it("requester detail omits notes; cross-owner access is 404 (D-03)", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "OPEN" });

    const res = await requesterAgent.get(`/api/tickets/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBeUndefined();
    expect(res.body.data.comments).toBeDefined();
    // A Requester has no status writes from OPEN (matrix: only WFO -> OPEN).
    expect(res.body.data.permittedStatusTransitions).toEqual([]);

    const cross = await foreignAgent.get(`/api/tickets/${t.id}`);
    expect(cross.status).toBe(404);
  });
});

describe("API-23 — Claim an unassigned Ticket; conflict on assigned (AC-09)", () => {
  it("claim succeeds for staff, second claim is 409, requester claim is 403", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const staff2Agent = await loginAgent(app, EMAIL.staff2);
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });

    const claim = await staff1Agent
      .post(`/api/tickets/${t.id}/claim`)
      .set("Origin", TRUSTED_ORIGIN);
    expect(claim.status).toBe(200);
    expect(claim.body.data).toEqual({
      ticketId: t.id,
      owner: { id: refs.staff1Id!, name: expect.any(String), role: "IT_STAFF" },
    });

    const again = await staff2Agent
      .post(`/api/tickets/${t.id}/claim`)
      .set("Origin", TRUSTED_ORIGIN);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("TICKET_ALREADY_ASSIGNED");

    const requesterClaim = await requesterAgent
      .post(`/api/tickets/${t.id}/claim`)
      .set("Origin", TRUSTED_ORIGIN);
    expect(requesterClaim.status).toBe(403);
  });

  it("claiming a missing ticket is 404", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const res = await staff1Agent
      .post("/api/tickets/99999999/claim")
      .set("Origin", TRUSTED_ORIGIN);
    expect(res.status).toBe(404);
  });
});

describe("API-24 — Assign/reassign ownership to eligible user (AC-10 / BR-17)", () => {
  it("accepts active staff/admin, rejects inactive or wrong-role owners with 404", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "OPEN" });

    const toStaff2 = await staff1Agent
      .put(`/api/tickets/${t.id}/owner`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: refs.staff2Id! });
    expect(toStaff2.status).toBe(200);
    expect(toStaff2.body.data.owner).toEqual({
      id: refs.staff2Id!,
      name: expect.any(String),
      role: "IT_STAFF",
    });

    const toAdmin = await staff1Agent
      .put(`/api/tickets/${t.id}/owner`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: refs.adminId! });
    expect(toAdmin.status).toBe(200);
    expect(toAdmin.body.data.owner.role).toBe("ADMIN");

    const detail = await staff1Agent.get(`/api/tickets/${t.id}`);
    expect(detail.body.data.owner).toEqual({
      id: refs.adminId!,
      name: expect.any(String),
      role: "ADMIN",
    });

    const toInactive = await staff1Agent
      .put(`/api/tickets/${t.id}/owner`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: refs.inactiveStaffId! });
    expect(toInactive.status).toBe(404);

    const toRequester = await staff1Agent
      .put(`/api/tickets/${t.id}/owner`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: refs.requesterId! });
    expect(toRequester.status).toBe(404);
  });

  it("invalid ownerId is 400; non-staff caller is 403; missing ticket is 404", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "OPEN" });

    const invalid = await staff1Agent
      .put(`/api/tickets/${t.id}/owner`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: 0 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const missing = await staff1Agent
      .put("/api/tickets/99999999/owner")
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: refs.staff2Id! });
    expect(missing.status).toBe(404);

    const requesterAssign = await requesterAgent
      .put(`/api/tickets/${t.id}/owner`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ ownerId: refs.staff2Id! });
    expect(requesterAssign.status).toBe(403);
  });

  it("eligible-owners helper lists only active IT_STAFF/ADMIN (supplemental)", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const requesterAgent = await loginAgent(app, EMAIL.requester);

    const res = await staff1Agent.get("/api/tickets/eligible-owners");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { id: number }) => u.id);
    expect(ids).toContain(refs.staff1Id);
    expect(ids).toContain(refs.staff2Id);
    expect(ids).toContain(refs.adminId);
    expect(ids).not.toContain(refs.inactiveStaffId);
    expect(ids).not.toContain(refs.requesterId);

    const denied = await requesterAgent.get("/api/tickets/eligible-owners");
    expect(denied.status).toBe(403);
  });
});

describe("API-25 — IT Priority lifecycle (AC-11 / BR-19)", () => {
  it("initializes from requested priority, staff PATCH persists, requester denied", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const t = await makeTicket({
      requesterId: refs.requesterId!,
      status: "NEW",
      requestedPriority: "LOW",
    });

    const initial = await staff1Agent.get(`/api/tickets/${t.id}`);
    expect(initial.body.data.itPriority).toBe("LOW");

    const patch = await staff1Agent
      .patch(`/api/tickets/${t.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ itPriority: "HIGH" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.itPriority).toBe("HIGH");

    const after = await staff1Agent.get(`/api/tickets/${t.id}`);
    expect(after.body.data.itPriority).toBe("HIGH");

    const requesterPatch = await requesterAgent
      .patch(`/api/tickets/${t.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ itPriority: "MEDIUM" });
    expect(requesterPatch.status).toBe(403);

    const invalid = await staff1Agent
      .patch(`/api/tickets/${t.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ itPriority: "URGENT" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("empty PATCH body and unknown status value are rejected 400", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });

    const empty = await staff1Agent
      .patch(`/api/tickets/${t.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({});
    expect(empty.status).toBe(400);

    const badStatus = await staff1Agent
      .patch(`/api/tickets/${t.id}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ currentStatus: "ARCHIVED" });
    expect(badStatus.status).toBe(400);
  });
});

describe("API-26 — Status transition matrix, permitted moves (AC-12 / BR-20)", () => {
  it("full walk across two tickets persists every hop", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);

    const walk1: TicketStatus[] = [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
    ];
    const t1 = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });
    let current = "NEW";
    for (const to of walk1) {
      const r = await patchStatus(staff1Agent, t1.id, to);
      expect(r.status).toBe(200);
      expect(r.body.data.currentStatus).toBe(to);
      current = to;
    }
    expect(current).toBe("REOPENED");

    const walk2: TicketStatus[] = [
      "IN_PROGRESS",
      "OPEN",
      "RESOLVED",
      "REOPENED",
      "WAITING_FOR_REQUESTER",
      "IN_PROGRESS",
    ];
    const t2 = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });
    for (const to of walk2) {
      const r = await patchStatus(staff1Agent, t2.id, to);
      expect(r.status).toBe(200);
      expect(r.body.data.currentStatus).toBe(to);
    }
  });

  it("remaining single-hop matrix edges persist (NEW->CANCELLED, REOPENED set, ...)", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const cases: [TicketStatus, TicketStatus][] = [
      ["NEW", "CANCELLED"],
      ["OPEN", "WAITING_FOR_REQUESTER"],
      ["OPEN", "CANCELLED"],
      ["IN_PROGRESS", "RESOLVED"],
      ["IN_PROGRESS", "CANCELLED"],
      ["WAITING_FOR_REQUESTER", "CANCELLED"],
      ["REOPENED", "OPEN"],
      ["REOPENED", "IN_PROGRESS"],
      ["REOPENED", "RESOLVED"],
      ["REOPENED", "CANCELLED"],
    ];

    for (const [from, to] of cases) {
      const t = await makeTicket({ requesterId: refs.requesterId!, status: from });
      const r = await patchStatus(staff1Agent, t.id, to);
      expect(r.status).toBe(200);
      expect(r.body.data.currentStatus).toBe(to);
    }
  });
});

describe("API-27 — Status transition matrix, rejected moves (AC-12 / BR-43)", () => {
  it("disallowed pairs are 409 and never overwrite the current status", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);

    const denied: [TicketStatus, TicketStatus][] = [
      ["NEW", "CLOSED"],
      ["NEW", "RESOLVED"],
      ["NEW", "REOPENED"],
      ["NEW", "WAITING_FOR_REQUESTER"],
      ["RESOLVED", "OPEN"],
      ["IN_PROGRESS", "CLOSED"],
      ["REOPENED", "CLOSED"],
    ];

    for (const [from, to] of denied) {
      const t = await makeTicket({ requesterId: refs.requesterId!, status: from });
      const r = await patchStatus(staff1Agent, t.id, to);
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe("TICKET_STATUS_TRANSITION_NOT_ALLOWED");

      const detail = await staff1Agent.get(`/api/tickets/${t.id}`);
      expect(detail.body.data.currentStatus).toBe(from);
    }
  });

  it("CANCELLED is terminal for staff", async () => {
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "CANCELLED" });

    for (const to of ["OPEN", "NEW", "REOPENED", "CLOSED"] as TicketStatus[]) {
      const r = await patchStatus(staff1Agent, t.id, to);
      expect(r.status).toBe(409);
    }
  });
});

describe("API-28 — Requester respond WFO->OPEN (FR-13 / BR-22)", () => {
  it("responds 200 and moves to OPEN with an optional comment", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "WAITING_FOR_REQUESTER" });

    const res = await requesterAgent
      .post(`/api/tickets/${t.id}/requester-respond`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({ content: "I have provided the requested details." });
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.currentStatus).toBe("OPEN");
    expect(res.body.data.comment.content).toBe("I have provided the requested details.");
  });

  it("is rejected 409 from any other status; staff invocation is 403", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);

    const t = await makeTicket({ requesterId: refs.requesterId!, status: "OPEN" });
    const res = await requesterAgent
      .post(`/api/tickets/${t.id}/requester-respond`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_STATUS_TRANSITION_NOT_ALLOWED");

    const t2 = await makeTicket({ requesterId: refs.requesterId!, status: "WAITING_FOR_REQUESTER" });
    const staffRes = await staff1Agent
      .post(`/api/tickets/${t2.id}/requester-respond`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({});
    expect(staffRes.status).toBe(403);
  });
});

describe("API-29 — Problem Appears Resolved indicator (AC-13 / BR-21)", () => {
  it("records an automatic comment but never changes status", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });

    const res = await requesterAgent
      .post(`/api/tickets/${t.id}/indicate-resolved`)
      .set("Origin", TRUSTED_ORIGIN);
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe(
      "The Requester indicated the problem appears resolved."
    );
    expect(res.body.data.author).toEqual({
      id: refs.requesterId!,
      name: expect.any(String),
    });

    const detail = await requesterAgent.get(`/api/tickets/${t.id}`);
    expect(detail.body.data.currentStatus).toBe("NEW");

    const repeat = await requesterAgent
      .post(`/api/tickets/${t.id}/indicate-resolved`)
      .set("Origin", TRUSTED_ORIGIN);
    expect(repeat.status).toBe(409);
    expect(repeat.body.error.code).toBe("ALREADY_INDICATED_RESOLVED");
  });

  it("is denied from RESOLVED/CLOSED/CANCELLED and by staff", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);

    for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as TicketStatus[]) {
      const t = await makeTicket({ requesterId: refs.requesterId!, status });
      const res = await requesterAgent
        .post(`/api/tickets/${t.id}/indicate-resolved`)
        .set("Origin", TRUSTED_ORIGIN);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TICKET_NOT_INDICATABLE");
    }

    const t = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });
    const staffRes = await staff1Agent
      .post(`/api/tickets/${t.id}/indicate-resolved`)
      .set("Origin", TRUSTED_ORIGIN);
    expect(staffRes.status).toBe(403);
  });
});

describe("API-30 — Attachment access by role (AC-20 / FR-20)", () => {
  it("staff download/preview any ticket's active attachments; upload/remove denied", async () => {
    const requesterAgent = await loginAgent(app, EMAIL.requester);
    const staff1Agent = await loginAgent(app, EMAIL.staff1);
    const foreignAgent = await loginAgent(app, EMAIL.foreigner);
    const t = await makeTicket({ requesterId: refs.requesterId!, status: "NEW" });

    const up = await requesterAgent
      .post(`/api/tickets/${t.id}/attachments`)
      .set("Origin", TRUSTED_ORIGIN)
      .attach("file", pngBytes(), { filename: "spec-photo.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    const attachmentId = up.body.data.id;
    createdAttachmentIds.push(attachmentId);

    const meta = await staff1Agent.get(`/api/tickets/${t.id}/attachments`);
    expect(meta.status).toBe(200);
    expect(meta.body.data).toHaveLength(1);
    expect(meta.body.data[0].originalFilename).toBe("spec-photo.png");

    const dl = await staff1Agent.get(`/api/attachments/${attachmentId}/download`);
    expect(dl.status).toBe(200);

    const staffUpload = await staff1Agent
      .post(`/api/tickets/${t.id}/attachments`)
      .set("Origin", TRUSTED_ORIGIN)
      .attach("file", pngBytes(), { filename: "staff.png", contentType: "image/png" });
    expect(staffUpload.status).toBe(403);

    const staffRemove = await staff1Agent
      .delete(`/api/attachments/${attachmentId}`)
      .set("Origin", TRUSTED_ORIGIN)
      .send({});
    expect(staffRemove.status).toBe(403);

    const foreignDownload = await foreignAgent.get(`/api/attachments/${attachmentId}/download`);
    expect(foreignDownload.status).toBe(404);
  });
});