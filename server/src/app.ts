import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
  UPLOAD_DIR,
  sanitizeOriginalFilename,
  storeFileBuffer,
  deleteStoredFile,
} from "./attachmentFiles.js";

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];
const STATUSES: TicketStatus[] = ["NEW"];
const PAGE_SIZES = [10, 25, 50];

// Attachment upload helper (AC-06/FR-24/BR-13). Files are buffered in memory
// and written to server/uploads only after all validation has passed.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Only JPG, PNG, WEBP, and PDF files are allowed") as Error & {
        code: string;
      };
      err.code = "INVALID_FILE_TYPE";
      cb(err);
    } else {
      cb(null, true);
    }
  },
});

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ data: categories });
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch categories",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Active reference data for the Create Ticket form (BR-05, FR-01).
// GET /api/related-systems -> { data: [{ id, name }, ...] } ordered by id
// ascending. Only active related systems are returned.
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ data: relatedSystems });
  } catch (err) {
    console.error("Failed to fetch related systems:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch related systems",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Development Requester selector
// GET /api/requesters -> { data: [{ id, name, email }, ...] } ordered by id
// ascending. Only active requesters are returned (BR-05, FR-02).
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ data: requesters });
  } catch (err) {
    console.error("Failed to fetch requesters:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch requesters",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Create Ticket (AC-01 / AC-04 / BR-01,02,06)
// POST /api/tickets -> 201 { data: ticket }
// Validates trimmed string lengths, enum values, and that referenced
// resources exist and are active. Ticket number is generated from the
// recorded id as TKT-XXXXXX. ticketDate/currentStatus are set by the backend.
// ---------------------------------------------------------------------------
app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const details: Record<string, string> = {};

    // Trim all string inputs before validation (api-spec: Input Sanitization).
    const summary =
      typeof body.summary === "string" ? body.summary.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const priority: string =
      typeof body.requestedPriority === "string"
        ? body.requestedPriority.trim()
        : "";

    if (summary.length < 10 || summary.length > 200) {
      details.summary = "Summary must be between 10 and 200 characters";
    }
    if (description.length < 20 || description.length > 2000) {
      details.description = "Description must be between 20 and 2000 characters";
    }
    if (!PRIORITIES.includes(priority as RequestedPriority)) {
      details.requestedPriority = 'Must be "LOW", "MEDIUM", or "HIGH"';
    }

    const requesterId = Number(body.requesterId);
    const categoryId = Number(body.categoryId);
    const relatedSystemId = Number(body.relatedSystemId);

    if (!Number.isInteger(requesterId) || requesterId <= 0) {
      details.requesterId = "Must be a valid requester ID";
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      details.categoryId = "Must be a valid category ID";
    }
    if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
      details.relatedSystemId = "Must be a valid related system ID";
    }

    if (Object.keys(details).length > 0) {
      return res.status(400).json({
        error: { message: "Validation failed", code: "VALIDATION_ERROR", details },
      });
    }

    // Referenced resources must exist and be active.
    const requester = await getPrisma().requester.findUnique({
      where: { id: requesterId },
    });
    if (!requester) {
      return res.status(404).json({
        error: { message: "Requester not found", code: "REQUESTER_NOT_FOUND" },
      });
    }
    if (!requester.isActive) {
      return res.status(400).json({
        error: { message: "Requester is not active", code: "REQUESTER_INACTIVE" },
      });
    }

    const category = await getPrisma().category.findUnique({
      where: { id: categoryId },
    });
    if (!category || !category.isActive) {
      return res.status(404).json({
        error: { message: "Category not found", code: "CATEGORY_NOT_FOUND" },
      });
    }

    const relatedSystem = await getPrisma().relatedSystem.findUnique({
      where: { id: relatedSystemId },
    });
    if (!relatedSystem || !relatedSystem.isActive) {
      return res.status(404).json({
        error: {
          message: "Related system not found",
          code: "RELATED_SYSTEM_NOT_FOUND",
        },
      });
    }

    // Insert with a temporary unique placeholder, then derive the final
    // ticketNumber (TKT-XXXXXX) from the generated id inside a transaction.
    const ticket = await getPrisma().$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${Date.now()}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary,
          description,
          requestedPriority: priority as RequestedPriority,
          currentStatus: "NEW",
        },
      });
      return tx.ticket.update({
        where: { id: created.id },
        data: {
          ticketNumber: `TKT-${String(created.id).padStart(6, "0")}`,
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      });
    });

    res.status(201).json({ data: ticket });
  } catch (err) {
    console.error("Failed to create ticket:", err);
    res.status(500).json({
      error: {
        message: "Failed to create ticket",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// My Tickets (AC-05 / AC-08)
// GET /api/tickets?requesterId=:id -> { data, pagination }
// Supports case-insensitive search and combined filters. Invalid page /
// pageSize default to safe values (page 1, pageSize 10).
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const q = req.query;
    const requesterId = Number(q.requesterId);
    if (q.requesterId === undefined || !Number.isInteger(requesterId) || requesterId <= 0) {
      return res.status(400).json({
        error: {
          message: "Invalid query parameters",
          code: "INVALID_PARAMETERS",
          details: { requesterId: "Requester ID is required" },
        },
      });
    }

    const details: Record<string, string> = {};

    let categoryId: number | undefined;
    if (q.categoryId !== undefined) {
      categoryId = Number(q.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        details.categoryId = "Category ID must be a valid integer";
      }
    }

    let relatedSystemId: number | undefined;
    if (q.relatedSystemId !== undefined) {
      relatedSystemId = Number(q.relatedSystemId);
      if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
        details.relatedSystemId = "Related system ID must be a valid integer";
      }
    }

    let status: TicketStatus | undefined;
    if (q.status !== undefined && q.status !== "") {
      if (STATUSES.includes(q.status as TicketStatus)) {
        status = q.status as TicketStatus;
      } else {
        details.status = 'Status must be "NEW"';
      }
    }

    let priority: RequestedPriority | undefined;
    if (q.priority !== undefined && q.priority !== "") {
      if (PRIORITIES.includes(q.priority as RequestedPriority)) {
        priority = q.priority as RequestedPriority;
      } else {
        details.priority = 'Priority must be "LOW", "MEDIUM", or "HIGH"';
      }
    }

    if (Object.keys(details).length > 0) {
      return res.status(400).json({
        error: {
          message: "Invalid query parameters",
          code: "INVALID_PARAMETERS",
          details,
        },
      });
    }

    const where: Prisma.TicketWhereInput = { requesterId };
    if (categoryId !== undefined) where.categoryId = categoryId;
    if (relatedSystemId !== undefined) where.relatedSystemId = relatedSystemId;
    if (status !== undefined) where.currentStatus = status;
    if (priority !== undefined) where.requestedPriority = priority;

    if (typeof q.search === "string" && q.search.trim() !== "") {
      const term = q.search.trim();
      where.OR = [
        { ticketNumber: { contains: term, mode: "insensitive" } },
        { summary: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const sortBy: "ticketDate" | "ticketNumber" =
      q.sortBy === "ticketNumber" ? "ticketNumber" : "ticketDate";
    const sortOrder: "asc" | "desc" = q.sortOrder === "asc" ? "asc" : "desc";

    // Invalid page / pageSize default to safe values (T-013).
    const pageSize = PAGE_SIZES.includes(Number(q.pageSize))
      ? Number(q.pageSize)
      : 10;
    const page =
      Number.isInteger(Number(q.page)) && Number(q.page) >= 1
        ? Number(q.page)
        : 1;

    const [totalCount, rows] = await Promise.all([
      getPrisma().ticket.count({ where }),
      getPrisma().ticket.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          description: true,
          requestedPriority: true,
          currentStatus: true,
          ticketDate: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          _count: {
            select: { attachments: { where: { isRemoved: false } } },
          },
        },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      ticketNumber: r.ticketNumber,
      summary: r.summary,
      description: r.description,
      requestedPriority: r.requestedPriority,
      currentStatus: r.currentStatus,
      ticketDate: r.ticketDate,
      category: r.category,
      relatedSystem: r.relatedSystem,
      attachmentCount: r._count.attachments,
    }));

    const totalPages = Math.ceil(totalCount / pageSize);
    res.status(200).json({
      data,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Failed to fetch tickets:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch tickets",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Ticket Detail (AC-03 / BR-04)
// GET /api/tickets/:ticketId?requesterId=:id -> 200 { data: ticket }
// Enforces ownership: a requester may only view their own tickets.
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  try {
    const requesterId = Number(req.query.requesterId);
    if (req.query.requesterId === undefined || !Number.isInteger(requesterId) || requesterId <= 0) {
      return res.status(400).json({
        error: {
          message: "Requester ID is required",
          code: "MISSING_REQUESTER_ID",
        },
      });
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        error: { message: "Invalid ticket ID", code: "INVALID_TICKET_ID" },
      });
    }

    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            originalFilename: true,
            fileSizeBytes: true,
            contentType: true,
            uploadedAt: true,
            isRemoved: true,
            removedAt: true,
            removalReason: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({
        error: {
          message: "You do not have permission to view this ticket",
          code: "FORBIDDEN",
        },
      });
    }

    res.status(200).json({ data: ticket });
  } catch (err) {
    console.error("Failed to fetch ticket:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch ticket",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Upload Attachment (AC-06 / BR-12,13,14)
// POST /api/tickets/:ticketId/attachments (multipart/form-data)
//   fields: file (required), requesterId (required)
// Validates MIME type, size (<= 5 MB), ticket ownership, and the active
// five-attachment limit. The stored name is a UUID; the original filename is
// preserved for display. 201 with attachment metadata.
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:ticketId/attachments",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};

      if (!req.file) {
        res.status(400).json({
          error: { message: "No file provided", code: "MISSING_FILE" },
        });
        return;
      }

      const requesterId = Number(body.requesterId);
      if (body.requesterId === undefined || !Number.isInteger(requesterId) || requesterId <= 0) {
        res.status(400).json({
          error: { message: "Requester ID is required", code: "MISSING_REQUESTER_ID" },
        });
        return;
      }

      const detailRefs = await resolveTicketForRoute(
        req,
        res,
        requesterId,
        "You do not have permission to add attachments to this ticket"
      );
      if (!detailRefs) return;

      const activeCount = await getPrisma().attachment.count({
        where: { ticketId: detailRefs.ticketId, isRemoved: false },
      });
      if (activeCount >= MAX_ATTACHMENTS) {
        res.status(409).json({
          error: { message: "Maximum 5 attachments per ticket", code: "MAX_ATTACHMENTS_REACHED" },
        });
        return;
      }

      const originalFilename = sanitizeOriginalFilename(req.file.originalname);
      const storedFilename = await storeFileBuffer(req.file.buffer, req.file.mimetype);

      let attachment;
      try {
        attachment = await getPrisma().attachment.create({
          data: {
            ticketId: detailRefs.ticketId,
            originalFilename,
            storedFilename,
            fileSizeBytes: req.file.size,
            contentType: req.file.mimetype,
          },
        });
      } catch (err) {
        await deleteStoredFile(storedFilename);
        throw err;
      }

      res.status(201).json({
        data: {
          id: attachment.id,
          ticketId: attachment.ticketId,
          originalFilename: attachment.originalFilename,
          fileSizeBytes: attachment.fileSizeBytes,
          contentType: attachment.contentType,
          uploadedAt: attachment.uploadedAt,
          isRemoved: attachment.isRemoved,
        },
      });
    } catch (err) {
      console.error("Failed to upload attachment:", err);
      res.status(500).json({
        error: { message: "Failed to upload attachment", code: "INTERNAL_SERVER_ERROR" },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Get Attachment Metadata (AC-06 / AC-07)
// GET /api/tickets/:ticketId/attachments?requesterId=:id[&includeRemoved=true]
// Returns attachment metadata for the owner's ticket; soft-removed records are
// hidden by default and shown only when includeRemoved=true.
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
  try {
    const requesterId = Number(req.query.requesterId);
    if (req.query.requesterId === undefined || !Number.isInteger(requesterId) || requesterId <= 0) {
      res.status(400).json({
        error: { message: "Requester ID is required", code: "MISSING_REQUESTER_ID" },
      });
      return;
    }

    const detailRefs = await resolveTicketForRoute(
      req,
      res,
      requesterId,
      "You do not have permission to view these attachments"
    );
    if (!detailRefs) return;

    const includeRemoved = req.query.includeRemoved === "true";

    const attachments = await getPrisma().attachment.findMany({
      where: {
        ticketId: detailRefs.ticketId,
        ...(includeRemoved ? {} : { isRemoved: false }),
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        originalFilename: true,
        fileSizeBytes: true,
        contentType: true,
        uploadedAt: true,
        isRemoved: true,
        removedAt: true,
        removalReason: true,
      },
    });

    const data = attachments.map((a) => ({
      id: a.id,
      originalFilename: a.originalFilename,
      fileSizeBytes: a.fileSizeBytes,
      contentType: a.contentType,
      uploadedAt: a.uploadedAt,
      isRemoved: a.isRemoved,
      ...(a.isRemoved ? { removedAt: a.removedAt, removalReason: a.removalReason } : {}),
    }));

    res.status(200).json({ data });
  } catch (err) {
    console.error("Failed to fetch attachments:", err);
    res.status(500).json({
      error: { message: "Failed to fetch attachments", code: "INTERNAL_SERVER_ERROR" },
    });
  }
});

// ---------------------------------------------------------------------------
// Download Attachment (AC-06 / BR-23)
// GET /api/attachments/:attachmentId/download?requesterId=:id
// Streams the stored file when owned and active. Removed attachments are not
// downloadable (AC-07).
// ---------------------------------------------------------------------------
app.get("/api/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const requesterId = Number(req.query.requesterId);
    if (req.query.requesterId === undefined || !Number.isInteger(requesterId) || requesterId <= 0) {
      res.status(400).json({
        error: { message: "Requester ID is required", code: "MISSING_REQUESTER_ID" },
      });
      return;
    }

    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
      });
      return;
    }

    const attachment = await getPrisma().attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
      });
      return;
    }

    if (attachment.ticket.requesterId !== requesterId) {
      res.status(403).json({
        error: {
          message: "You do not have permission to download this attachment",
          code: "FORBIDDEN",
        },
      });
      return;
    }

    if (attachment.isRemoved) {
      res.status(403).json({
        error: {
          message: "This attachment has been removed and cannot be downloaded",
          code: "ATTACHMENT_REMOVED",
        },
      });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.storedFilename);
    if (!fs.existsSync(filePath)) {
      res.status(500).json({
        error: { message: "Attachment file is missing", code: "FILE_NOT_FOUND" },
      });
      return;
    }

    res.setHeader("Content-Type", attachment.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.originalFilename.replace(/"/g, "'")}"`
    );
    res.setHeader("Content-Length", attachment.fileSizeBytes);
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({
          error: { message: "Failed to read attachment", code: "INTERNAL_SERVER_ERROR" },
        });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error("Failed to download attachment:", err);
    res.status(500).json({
      error: { message: "Failed to download attachment", code: "INTERNAL_SERVER_ERROR" },
    });
  }
});

// ---------------------------------------------------------------------------
// Soft-Remove Attachment (AC-07 / BR-15,16)
// DELETE /api/attachments/:attachmentId
//   body: { requesterId (required), removalReason (optional, <= 500 chars) }
// Marks isRemoved=true. The record (metadata) stays visible on the Ticket
// Detail screen; the stored file remains on disk but is no longer downloadable.
// ---------------------------------------------------------------------------
app.delete("/api/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const requesterId = Number(body.requesterId);
    if (body.requesterId === undefined || !Number.isInteger(requesterId) || requesterId <= 0) {
      res.status(400).json({
        error: { message: "Requester ID is required", code: "MISSING_REQUESTER_ID" },
      });
      return;
    }

    const removalReason =
      typeof body.removalReason === "string" ? body.removalReason.trim() : "";
    if (removalReason.length > 500) {
      res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { removalReason: "Removal reason must not exceed 500 characters" },
        },
      });
      return;
    }

    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
      });
      return;
    }

    const attachment = await getPrisma().attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { requesterId: true } } },
    });

    if (!attachment) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
      });
      return;
    }

    if (attachment.ticket.requesterId !== requesterId) {
      res.status(403).json({
        error: {
          message: "You do not have permission to remove this attachment",
          code: "FORBIDDEN",
        },
      });
      return;
    }

    if (attachment.isRemoved) {
      res.status(409).json({
        error: { message: "Attachment is already removed", code: "ALREADY_REMOVED" },
      });
      return;
    }

    const updated = await getPrisma().attachment.update({
      where: { id: attachmentId },
      data: {
        isRemoved: true,
        removedAt: new Date(),
        removalReason: removalReason === "" ? null : removalReason,
      },
    });

    res.status(200).json({
      data: {
        id: updated.id,
        isRemoved: updated.isRemoved,
        removedAt: updated.removedAt,
        removalReason: updated.removalReason,
      },
    });
  } catch (err) {
    console.error("Failed to remove attachment:", err);
    res.status(500).json({
      error: { message: "Failed to remove attachment", code: "INTERNAL_SERVER_ERROR" },
    });
  }
});

// Resolves requester + ticket ownership for ticket-scoped attachment routes.
// Responds with the correct error and returns null when the request is
// rejected (404 TICKET_NOT_FOUND / 403 FORBIDDEN).
async function resolveTicketForRoute(
  req: Request,
  res: Response,
  requesterId: number,
  forbiddenMessage: string
): Promise<{ ticketId: number; requesterId: number } | null> {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  const ticket = await getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });

  if (!ticket) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  if (ticket.requesterId !== requesterId) {
    res.status(403).json({
      error: { message: forbiddenMessage, code: "FORBIDDEN" },
    });
    return null;
  }

  return { ticketId: ticket.id, requesterId };
}

// Central error handler: maps multer / file-type upload errors to the
// documented API responses (413 FILE_TOO_LARGE, 415 INVALID_FILE_TYPE).
app.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: { message: "File size must not exceed 5 MB", code: "FILE_TOO_LARGE" },
      });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error: {
          message: "Invalid file upload",
          code: "INVALID_UPLOAD",
          details: { file: err.code },
        },
      });
      return;
    }
    if ((err as { code?: string } | null)?.code === "INVALID_FILE_TYPE") {
      res.status(415).json({
        error: {
          message: "Only JPG, PNG, WEBP, and PDF files are allowed",
          code: "INVALID_FILE_TYPE",
        },
      });
      return;
    }
    next(err);
  }
);

export default app;
