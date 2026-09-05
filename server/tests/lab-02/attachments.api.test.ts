import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
  UPLOAD_DIR,
  buildStoredFilename,
  deleteStoredFile,
  sanitizeOriginalFilename,
} from "../../src/attachmentFiles.js";

// Attachment API endpoints (AC-06 - type/size/limits; AC-07 - soft removal):
//   T-017 – upload: valid file 201; invalid type 415; oversized 413;
//           5-attachment limit 409; wrong owner 403
//   T-019 – download: owned active 200; wrong owner 403; removed 403
//   T-020 – soft-remove: 200 isRemoved=true; metadata visible via
//           includeRemoved=true; re-remove 409; wrong owner 403
//   T-018 – unit tests for filename sanitisation (path traversal, UUID names)
// Requires the DB to be migrated and seeded (see README.md). Files written to
// server/uploads and all DB rows created here are cleaned up in afterAll.
// Each test that uploads attaches to a freshly created ticket so the ticket
// never hits the 5-active-attachment limit midway through the suite.

const prisma = getPrisma();

const createdTicketIds: number[] = [];
const createdAttachmentIds: number[] = [];

let requesterId = 0;
let otherRequesterId = 0;
let categoryId = 0;
let relatedSystemId = 0;

function pngBytes(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function validPayload(rId: number): Record<string, unknown> {
  return {
    requesterId: rId,
    categoryId,
    relatedSystemId,
    summary: "Attachment test ticket for evidence uploads",
    description:
      "This ticket is created to exercise the attachment upload, download, and soft removal endpoints against a real database.",
    requestedPriority: "MEDIUM",
  };
}

async function createTicket(rId: number): Promise<number> {
  const res = await request(app).post("/api/tickets").send(validPayload(rId));
  expect(res.status).toBe(201);
  createdTicketIds.push(res.body.data.id);
  return res.body.data.id;
}

async function uploadFile(
  ticketId: number,
  rId: number,
  buffer: Buffer,
  filename: string,
  contentType: string
) {
  const res = await request(app)
    .post(`/api/tickets/${ticketId}/attachments`)
    .field("requesterId", String(rId))
    .attach("file", buffer, { filename, contentType });
  if (res.body?.data?.id) createdAttachmentIds.push(res.body.data.id);
  return res;
}

let ownerTicketId = 0;

beforeAll(async () => {
  await prisma.$connect();

  const requesters = await prisma.requester.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });
  if (requesters.length < 2) {
    throw new Error("Seed must provide at least 2 active requesters");
  }
  requesterId = requesters[0].id;
  otherRequesterId = requesters[1].id;

  const category = await prisma.category.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
  categoryId = category.id;

  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
  relatedSystemId = relatedSystem.id;

  ownerTicketId = await createTicket(requesterId);
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
  await prisma.$disconnect();
});

describe("POST /api/tickets/:ticketId/attachments (T-017)", () => {
  it("accepts a valid JPEG and returns 201 with metadata", async () => {
    const ticketId = await createTicket(requesterId);
    const res = await uploadFile(ticketId, requesterId, pngBytes(), "screenshot.jpg", "image/jpeg");
    expect(res.status).toBe(201);

    const d = res.body.data;
    expect(d.ticketId).toBe(ticketId);
    expect(d.originalFilename).toBe("screenshot.jpg");
    expect(d.fileSizeBytes).toBe(pngBytes().length);
    expect(d.contentType).toBe("image/jpeg");
    expect(d.isRemoved).toBe(false);
    expect(d.uploadedAt).toBeDefined();
    expect(d).not.toHaveProperty("storedFilename");
  });

  it("rejects an unsupported file type with 415", async () => {
    const res = await uploadFile(ownerTicketId, requesterId, Buffer.from("plain text"), "notes.txt", "text/plain");
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("rejects an oversized file (>5 MB) with 413", async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 1);
    const res = await uploadFile(ownerTicketId, requesterId, big, "big.pdf", "application/pdf");
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 when no file is provided", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ownerTicketId}/attachments`)
      .field("requesterId", String(requesterId));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_FILE");
  });

  it("returns 400 when requesterId is missing but a file is provided", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ownerTicketId}/attachments`)
      .attach("file", pngBytes(), { filename: "orphan.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_REQUESTER_ID");
  });

  it("blocks a 6th active attachment with 409", async () => {
    const ticketId = await createTicket(requesterId);
    for (let i = 1; i <= 5; i++) {
      const r = await uploadFile(ticketId, requesterId, pngBytes(), `batch-${i}.png`, "image/png");
      expect(r.status).toBe(201);
    }
    const sixth = await uploadFile(ticketId, requesterId, pngBytes(), "extra.png", "image/png");
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.code).toBe("MAX_ATTACHMENTS_REACHED");
  });

  it("returns 403 for a requester who does not own the ticket", async () => {
    const res = await uploadFile(ownerTicketId, otherRequesterId, pngBytes(), "crack.png", "image/png");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a non-existent ticket", async () => {
    const res = await uploadFile(2147483647, requesterId, pngBytes(), "ghost.png", "image/png");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});

describe("GET /api/tickets/:ticketId/attachments (metadata)", () => {
  it("lists only active attachments by default, ordered by id", async () => {
    const ticketId = await createTicket(requesterId);
    const a = await uploadFile(ticketId, requesterId, pngBytes(), "meta-a.png", "image/png");
    const b = await uploadFile(ticketId, requesterId, pngBytes(), "meta-b.png", "image/png");

    const res = await request(app).get(`/api/tickets/${ticketId}/attachments?requesterId=${requesterId}`);
    expect(res.status).toBe(200);
    const order = res.body.data.map((x: { id: number }) => x.id);
    expect(order).toEqual([a.body.data.id, b.body.data.id]);
    expect(res.body.data.every((x: { isRemoved: boolean }) => x.isRemoved === false)).toBe(true);
  });

  it("returns 403 for a requester who does not own the ticket", async () => {
    const res = await request(app).get(`/api/tickets/${ownerTicketId}/attachments?requesterId=${otherRequesterId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a non-existent ticket", async () => {
    const res = await request(app).get(`/api/tickets/2147483647/attachments?requesterId=${requesterId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});

describe("GET /api/attachments/:attachmentId/download (T-019)", () => {
  it("downloads an owned active attachment as binary", async () => {
    const ticketId = await createTicket(requesterId);
    const up = await uploadFile(ticketId, requesterId, pngBytes(), "evidence.png", "image/png");
    const res = await request(app).get(`/api/attachments/${up.body.data.id}/download?requesterId=${requesterId}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/png/);
    expect(res.headers["content-disposition"] as string).toContain('attachment; filename="evidence.png"');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBe(pngBytes().length);
  });

  it("returns 403 for a non-owner requester", async () => {
    const ticketId = await createTicket(requesterId);
    const up = await uploadFile(ticketId, requesterId, pngBytes(), "secret.png", "image/png");
    const res = await request(app).get(`/api/attachments/${up.body.data.id}/download?requesterId=${otherRequesterId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for a removed attachment", async () => {
    const ticketId = await createTicket(requesterId);
    const up = await uploadFile(ticketId, requesterId, pngBytes(), "gone.png", "image/png");
    const id = up.body.data.id;
    await request(app).delete(`/api/attachments/${id}`).send({ requesterId });
    const res = await request(app).get(`/api/attachments/${id}/download?requesterId=${requesterId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ATTACHMENT_REMOVED");
  });

  it("returns 404 for a non-existent attachment", async () => {
    const res = await request(app).get(`/api/attachments/2147483647/download?requesterId=${requesterId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });
});

describe("DELETE /api/attachments/:attachmentId (T-020)", () => {
  it("soft-removes an owned attachment and keeps metadata visible", async () => {
    const ticketId = await createTicket(requesterId);
    const up = await uploadFile(ticketId, requesterId, pngBytes(), "old-screenshot.png", "image/png");
    const id = up.body.data.id;

    const del = await request(app)
      .delete(`/api/attachments/${id}`)
      .send({ requesterId, removalReason: "Uploaded wrong file" });
    expect(del.status).toBe(200);
    expect(del.body.data.id).toBe(id);
    expect(del.body.data.isRemoved).toBe(true);
    expect(del.body.data.removedAt).toBeDefined();
    expect(del.body.data.removalReason).toBe("Uploaded wrong file");

    const withoutRemoved = await request(app).get(
      `/api/tickets/${ticketId}/attachments?requesterId=${requesterId}`
    );
    expect(withoutRemoved.status).toBe(200);
    expect(withoutRemoved.body.data.map((a: { id: number }) => a.id)).not.toContain(id);

    const withRemoved = await request(app).get(
      `/api/tickets/${ticketId}/attachments?requesterId=${requesterId}&includeRemoved=true`
    );
    const rec = withRemoved.body.data.find((a: { id: number }) => a.id === id);
    expect(rec).toBeDefined();
    expect(rec.isRemoved).toBe(true);
    expect(rec.removedAt).toBeDefined();
    expect(rec.removalReason).toBe("Uploaded wrong file");
    expect(rec).not.toHaveProperty("storedFilename");
  });

  it("returns 409 when the attachment is already removed", async () => {
    const ticketId = await createTicket(requesterId);
    const up = await uploadFile(ticketId, requesterId, pngBytes(), "twice.png", "image/png");
    const id = up.body.data.id;
    await request(app).delete(`/api/attachments/${id}`).send({ requesterId });
    const again = await request(app).delete(`/api/attachments/${id}`).send({ requesterId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_REMOVED");
  });

  it("returns 403 for a non-owner requester", async () => {
    const ticketId = await createTicket(requesterId);
    const up = await uploadFile(ticketId, requesterId, pngBytes(), "foreign.png", "image/png");
    const res = await request(app)
      .delete(`/api/attachments/${up.body.data.id}`)
      .send({ requesterId: otherRequesterId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 for a non-existent attachment", async () => {
    const res = await request(app)
      .delete("/api/attachments/2147483647")
      .send({ requesterId });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
  });
});

describe("Attachment filename sanitisation (T-018)", () => {
  it("rejects path-traversal filenames", () => {
    expect(sanitizeOriginalFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalFilename("..\\..\\windows\\evil.exe")).toBe("evil.exe");
    expect(sanitizeOriginalFilename("/etc/shadow")).toBe("shadow");
    expect(sanitizeOriginalFilename("a/b/../report.pdf")).toBe("report.pdf");
  });

  it("strips control characters and surrounding whitespace", () => {
    expect(sanitizeOriginalFilename("photo\u0000.png")).toBe("photo.png");
    expect(sanitizeOriginalFilename("\n\tlaptop.png ")).toBe("laptop.png");
  });

  it("falls back to a safe name when nothing survives sanitisation", () => {
    expect(sanitizeOriginalFilename("\u0000\u0001")).toBe("attachment");
  });

  it("builds UUID-based stored filenames with the content-type extension", () => {
    expect(buildStoredFilename("image/png")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
    );
    expect(buildStoredFilename("image/jpeg")).toMatch(/\.jpg$/);
    expect(buildStoredFilename("image/webp")).toMatch(/\.webp$/);
    expect(buildStoredFilename("application/pdf")).toMatch(/\.pdf$/);
  });

  it("refuses unknown content types", () => {
    expect(() => buildStoredFilename("text/plain")).toThrow();
  });

  it("exposes documented limits and storage location", () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    expect(MAX_ATTACHMENTS).toBe(5);
    expect(UPLOAD_DIR.endsWith("uploads")).toBe(true);
  });
});