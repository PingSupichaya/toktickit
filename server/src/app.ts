import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];
const STATUSES: TicketStatus[] = ["NEW"];
const PAGE_SIZES = [10, 25, 50];

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
        attachments: { orderBy: { id: "asc" } },
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

export default app;
