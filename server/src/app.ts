import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import bcrypt from "bcryptjs";
import { Prisma, RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
import type { User } from "@prisma/client";
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
import {
  LoginRateLimiter,
  csrfProtect,
  mustChangePasswordGuard,
  readCookie,
  requireRole,
  requireSession,
} from "./middleware/authMiddleware.js";
import { BCRYPT_COST, passwordRuleViolations } from "./passwordRules.js";
import { getTrustedOrigins } from "./csrf.js";
import { normalizeEmail } from "./email.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
} from "./session.js";

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];
const STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const INDICATABLE_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];
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

// CORS allows only the trusted browser origins (the Vite dev server) to call
// the API with credentials so the session cookie is sent and accepted.
app.use(
  cors({
    origin: getTrustedOrigins(),
    credentials: true,
  })
);
app.use(express.json());

// Login failures are tracked per email in a rolling 15-minute window (BR-08).
const loginRateLimiter = new LoginRateLimiter();

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Authentication (Lab 3). POST /api/auth/login is public and is registered
// before the global session middleware below. Everything else under /api
// requires a valid session, is CSRF-protected on state-changing methods, and
// is gated by mustChangePassword (only the /api/auth/* routes pass).
// ---------------------------------------------------------------------------

type PublicUserFields = Pick<
  User,
  "id" | "name" | "email" | "role" | "isActive"
>;

// Shape of a user in auth responses (§3). Never includes passwordHash,
// failedLoginAttempts, or lastFailedLoginAt (API-10, BR-09).
function toPublicUser(user: PublicUserFields) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    secure: process.env.COOKIE_SECURE === "true",
  });
}

// POST /api/auth/login (AC-01 / AC-06 / AC-07 / BR-01,06,07,08)
app.post(
  "/api/auth/login",
  loginRateLimiter.middleware(),
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const emailRaw = typeof body.email === "string" ? body.email : "";
      const password = typeof body.password === "string" ? body.password : "";

      const details: Record<string, string> = {};
      if (emailRaw.trim() === "") details.email = "Email is required";
      if (password === "") details.password = "Password is required";
      if (Object.keys(details).length > 0) {
        return res.status(400).json({
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details,
          },
        });
      }

      const email = normalizeEmail(emailRaw);
      const user = await getPrisma().user.findUnique({ where: { email } });

      // Unknown email and wrong password produce identical responses so the
      // endpoint never leaks which accounts exist (BR-06, D-03).
      const passwordMatches = user
        ? await bcrypt.compare(password, user.passwordHash)
        : false;

      if (!user || !passwordMatches) {
        loginRateLimiter.recordFailure(email);
        return res.status(401).json({
          error: {
            message: "Invalid email or password",
            code: "INVALID_CREDENTIALS",
          },
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          error: {
            message: "Your account is not active. Contact your administrator.",
            code: "ACCOUNT_INACTIVE",
          },
        });
      }

      // A successful login resets the failure counter (BR-08).
      loginRateLimiter.reset(email);

      const token = generateSessionToken();
      await getPrisma().session.create({
        data: {
          tokenHash: hashSessionToken(token),
          userId: user.id,
          expiresAt: sessionExpiry(),
        },
      });

      setSessionCookie(res, token);

      return res.status(200).json({
        data: {
          user: toPublicUser(user),
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (err) {
      console.error("Failed to log in:", err);
      return res.status(500).json({
        error: {
          message: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

// Global session + CSRF + must-change-password gate on every /api route.
app.use("/api", requireSession);
app.use("/api", csrfProtect);
app.use("/api", mustChangePasswordGuard);

// GET /api/auth/me (AC-05) — restores session state on page reload.
app.get("/api/auth/me", (req: Request, res: Response) => {
  const user = req.sessionUser!;
  return res.status(200).json({
    data: {
      user: toPublicUser(user),
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// POST /api/auth/logout (AC-05 / BR-11) — invalidates the session (204).
app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const token = readCookie(req, SESSION_COOKIE_NAME);
    if (token) {
      await getPrisma().session.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return res.status(204).end();
  } catch (err) {
    console.error("Failed to log out:", err);
    return res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// POST /api/auth/change-password (AC-02 / BR-02, BR-10). Clears the
// mustChangePassword flag so the first-login flow can open the app (AC-02).
app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser!;
    const body = req.body ?? {};
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (currentPassword === "") {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { currentPassword: "Current password is required" },
        },
      });
    }

    const fullUser = await getPrisma().user.findUnique({
      where: { id: user.id },
    });
    const currentMatches = fullUser
      ? await bcrypt.compare(currentPassword, fullUser.passwordHash)
      : false;

    if (!currentMatches) {
      return res.status(401).json({
        error: {
          message: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        },
      });
    }

    const violations = passwordRuleViolations(newPassword, currentPassword);
    if (violations.length > 0) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { newPassword: violations.join("; ") },
        },
      });
    }

    const updated = await getPrisma().user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
        mustChangePassword: false,
      },
    });

    return res.status(200).json({
      data: {
        user: toPublicUser(updated),
        mustChangePassword: updated.mustChangePassword,
      },
    });
  } catch (err) {
    console.error("Failed to change password:", err);
    return res.status(500).json({
      error: {
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
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
// IT Staff Ticket Queue (Lab 3, deferred to the IT Staff issue). The role
// guard is wired now so the role matrix is enforced (Requester → 403, BR-36);
// authorized staff/admins currently receive 404 until the queue is shipped.
// ---------------------------------------------------------------------------
app.get(
  "/api/tickets/queue",
  requireRole(UserRole.IT_STAFF, UserRole.ADMIN),
  (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: "Ticket queue is not available yet",
        code: "NOT_FOUND",
      },
    });
  }
);

// ---------------------------------------------------------------------------
// User Management (Lab 3, deferred to the Admin issue). Non-Administrators are
// rejected with 403; the list/create/edit/reset endpoints ship later.
// ---------------------------------------------------------------------------
app.get(
  "/api/users",
  requireRole(UserRole.ADMIN),
  (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: "User management is not available yet",
        code: "NOT_FOUND",
      },
    });
  }
);

// ---------------------------------------------------------------------------
// Create Ticket (AC-01 / AC-04 / BR-01,02,06)
// POST /api/tickets -> 201 { data: ticket }
// Validates trimmed string lengths, enum values, and that referenced
// resources exist and are active. Ticket number is generated from the
// recorded id as TKT-XXXXXX. ticketDate/currentStatus are set by the backend.
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets",
  requireRole(UserRole.REQUESTER),
  async (req: Request, res: Response) => {
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

    if (body.requesterId !== undefined) {
      details.requesterId = "Requester is derived from the session and must not be provided";
    }
    const categoryId = Number(body.categoryId);
    const relatedSystemId = Number(body.relatedSystemId);

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

    // The authenticated Requester is the submitter; requireRole(REQUESTER)
    // guarantees the session user is present, active, and a Requester.
    const requester = req.sessionUser;
    if (!requester) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
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
          submittedById: requester.id,
          categoryId,
          relatedSystemId,
          summary,
          description,
          requestedPriority: priority as RequestedPriority,
          itPriority: priority as RequestedPriority,
          currentStatus: "NEW",
        },
      });
      return tx.ticket.update({
        where: { id: created.id },
        data: {
          ticketNumber: `TKT-${String(created.id).padStart(6, "0")}`,
        },
        include: {
          submitter: { select: { id: true, name: true, email: true } },
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
// GET /api/tickets -> { data, pagination }
// Supports case-insensitive search and combined filters. Invalid page /
// pageSize default to safe values (page 1, pageSize 10).
// ---------------------------------------------------------------------------
app.get(
  "/api/tickets",
  requireRole(UserRole.REQUESTER),
  async (req: Request, res: Response) => {
  try {
    const q = req.query;
    const requesterId = req.sessionUser?.id;
    if (requesterId === undefined) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
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
        details.status =
          'Status must be "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", or "CANCELLED"';
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

    const where: Prisma.TicketWhereInput = { submittedById: requesterId };
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
          itPriority: true,
          currentStatus: true,
          ticketDate: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
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
      itPriority: r.itPriority,
      currentStatus: r.currentStatus,
      ticketDate: r.ticketDate,
      category: r.category,
      relatedSystem: r.relatedSystem,
      owner: r.owner,
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
// GET /api/tickets/:ticketId -> 200 { data: ticket }
// Enforces ownership: a Requester may only view their own tickets; cross-owner
// access is indistinguishable from a missing resource (404, D-03).
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
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
        submitter: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, role: true } },
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
        publicComments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
        internalNotes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    if (user.role === UserRole.REQUESTER && ticket.submittedById !== user.id) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const isStaff =
      user.role === UserRole.IT_STAFF || user.role === UserRole.ADMIN;

    const data: Record<string, unknown> = {
      ...ticket,
      canIndicateResolved:
        user.role === UserRole.REQUESTER &&
        ticket.submittedById === user.id &&
        INDICATABLE_STATUSES.includes(ticket.currentStatus),
      comments: ticket.publicComments.map(toCommentShape),
    };
    delete data.publicComments;
    if (isStaff) {
      data.notes = ticket.internalNotes.map(toCommentShape);
    }
    delete data.internalNotes;

    res.status(200).json({ data });
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
// Public Comments (FR-12 / FR-13 / BR-04, BR-23)
// POST /api/tickets/:ticketId/comments -> 201 { data: comment }
//   body: { content: 1-2000 chars after trim, whitespace-only rejected }
//   access: the submitting Requester or IT_STAFF/ADMIN; a Requester on
//   someone else's Ticket is indistinguishable from a missing resource (404).
// GET  /api/tickets/:ticketId/comments -> 200 { data: [comment, ...] } oldest
//   first. Same access rule as POST.
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId/comments", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }

    const access = await resolveTicketAccess(req, res, user, { allowStaff: true });
    if (!access) return;

    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId: access.ticketId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });

    res.status(200).json({ data: comments.map(toCommentShape) });
  } catch (err) {
    console.error("Failed to fetch comments:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch comments",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

app.post("/api/tickets/:ticketId/comments", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }

    const access = await resolveTicketAccess(req, res, user, { allowStaff: true });
    if (!access) return;

    const body = req.body ?? {};
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (content.length < 1 || content.length > 2000) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { content: "Content must be between 1 and 2000 characters" },
        },
      });
    }

    const comment = await getPrisma().publicComment.create({
      data: { ticketId: access.ticketId, authorId: user.id, content },
      include: { author: { select: { id: true, name: true } } },
    });

    res.status(201).json({ data: toCommentShape(comment) });
  } catch (err) {
    console.error("Failed to create comment:", err);
    res.status(500).json({
      error: {
        message: "Failed to create comment",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Requester "Problem Appears Resolved" (FR-12 / BR-21)
// POST /api/tickets/:ticketId/indicate-resolved -> 201 { data: comment }
// Records an automatic Public Comment (fixed system text); never changes the
// Ticket status. Only the submitting Requester may use it, and only while the
// Ticket is in a non-terminal state (409 TICKET_NOT_INDICATABLE otherwise).
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:ticketId/indicate-resolved",
  requireRole(UserRole.REQUESTER),
  async (req: Request, res: Response) => {
    try {
      const user = req.sessionUser;
      if (!user) {
        return res.status(401).json({
          error: { message: "Authentication required", code: "UNAUTHORIZED" },
        });
      }

      const access = await resolveTicketAccess(req, res, user, { allowStaff: false });
      if (!access) return;

      if (!INDICATABLE_STATUSES.includes(access.currentStatus)) {
        return res.status(409).json({
          error: {
            message: "This Ticket cannot be marked as appearing resolved in its current status",
            code: "TICKET_NOT_INDICATABLE",
          },
        });
      }

      const comment = await getPrisma().publicComment.create({
        data: {
          ticketId: access.ticketId,
          authorId: user.id,
          content: "The Requester indicated the problem appears resolved.",
        },
        include: { author: { select: { id: true, name: true } } },
      });

      res.status(201).json({ data: toCommentShape(comment) });
    } catch (err) {
      console.error("Failed to record indicate-resolved:", err);
      res.status(500).json({
        error: {
          message: "Failed to record indicate-resolved",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Requester responds to a request for information (FR-13 / BR-22)
// POST /api/tickets/:ticketId/requester-respond -> 200 { data: { ticket,
// comment? } }
// Moves the own Ticket from WAITING_FOR_REQUESTER to OPEN (the only status
// write a Requester may perform). Optional content becomes a Public Comment.
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:ticketId/requester-respond",
  requireRole(UserRole.REQUESTER),
  async (req: Request, res: Response) => {
    try {
      const user = req.sessionUser;
      if (!user) {
        return res.status(401).json({
          error: { message: "Authentication required", code: "UNAUTHORIZED" },
        });
      }

      const access = await resolveTicketAccess(req, res, user, { allowStaff: false });
      if (!access) return;

      if (access.currentStatus !== "WAITING_FOR_REQUESTER") {
        return res.status(409).json({
          error: {
            message: "This Ticket is not waiting for the Requester",
            code: "TICKET_STATUS_TRANSITION_NOT_ALLOWED",
          },
        });
      }

      const body = req.body ?? {};
      const content =
        body.content !== undefined
          ? typeof body.content === "string"
            ? body.content.trim()
            : ""
          : undefined;
      if (content !== undefined && (content.length < 1 || content.length > 2000)) {
        return res.status(400).json({
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details: { content: "Content must be between 1 and 2000 characters" },
          },
        });
      }

      const { updated, comment } = await getPrisma().$transaction(async (tx) => {
        const u = await tx.ticket.update({
          where: { id: access.ticketId },
          data: { currentStatus: "OPEN" },
        });
        const c =
          content !== undefined
            ? await tx.publicComment.create({
                data: { ticketId: access.ticketId, authorId: user.id, content },
                include: { author: { select: { id: true, name: true } } },
              })
            : null;
        return { updated: u, comment: c };
      });

      const data: Record<string, unknown> = {
        ticket: {
          ticketId: updated.id,
          ticketNumber: updated.ticketNumber,
          currentStatus: updated.currentStatus,
          updatedAt: updated.updatedAt,
        },
      };
      if (comment) data.comment = toCommentShape(comment);

      res.status(200).json({ data });
    } catch (err) {
      console.error("Failed to record requester respond:", err);
      res.status(500).json({
        error: {
          message: "Failed to record requester respond",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Upload Attachment (AC-06 / BR-12,13,14)
// POST /api/tickets/:ticketId/attachments (multipart/form-data)
//   fields: file (required)
// Validates MIME type, size (<= 5 MB), ticket ownership, and the active
// five-attachment limit. The stored name is a UUID; the original filename is
// preserved for display. 201 with attachment metadata.
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:ticketId/attachments",
  requireRole(UserRole.REQUESTER),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: { message: "No file provided", code: "MISSING_FILE" },
        });
        return;
      }

      const requesterId = req.sessionUser?.id;
      if (requesterId === undefined) {
        res.status(401).json({
          error: { message: "Authentication required", code: "UNAUTHORIZED" },
        });
        return;
      }

      const detailRefs = await resolveTicketForRoute(req, res, requesterId);
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
// GET /api/tickets/:ticketId/attachments[&includeRemoved=true]
// Returns attachment metadata for the owner's ticket; soft-removed records are
// hidden by default and shown only when includeRemoved=true.
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
  try {
    const requesterId = req.sessionUser?.id;
    if (requesterId === undefined) {
      res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
      return;
    }

    const detailRefs = await resolveTicketForRoute(req, res, requesterId);
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
// GET /api/attachments/:attachmentId/download
// Streams the stored file when owned and active. Removed attachments are not
// downloadable (AC-07).
// ---------------------------------------------------------------------------
app.get("/api/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const requesterId = req.sessionUser?.id;
    if (requesterId === undefined) {
      res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
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
      include: { ticket: { select: { submittedById: true } } },
    });

    if (!attachment) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
      });
      return;
    }

    if (attachment.ticket.submittedById !== requesterId) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
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
//   body: { removalReason (optional, <= 500 chars) }
// Marks isRemoved=true. The record (metadata) stays visible on the Ticket
// Detail screen; the stored file remains on disk but is no longer downloadable.
// ---------------------------------------------------------------------------
app.delete(
  "/api/attachments/:attachmentId",
  requireRole(UserRole.REQUESTER),
  async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const requesterId = req.sessionUser?.id;
    if (requesterId === undefined) {
      res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
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
      include: { ticket: { select: { submittedById: true } } },
    });

    if (!attachment) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
      });
      return;
    }

    if (attachment.ticket.submittedById !== requesterId) {
      res.status(404).json({
        error: { message: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" },
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

// Resolves ticket ownership for ticket-scoped attachment routes using the
// session user. Cross-owner access is indistinguishable from a missing
// resource (404, D-03); responds and returns null when rejected.
async function resolveTicketForRoute(
  req: Request,
  res: Response,
  userId: number
): Promise<{ ticketId: number } | null> {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  const ticket = await getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, submittedById: true },
  });

  if (!ticket || ticket.submittedById !== userId) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  return { ticketId: ticket.id };
}

// Resolves ticket access for comment/requester-action routes using the
// session user. When `allowStaff` is true, IT_STAFF/ADMIN may reach any
// Ticket (comments); otherwise only the submitting Requester may access
// (Requester-only actions). Cross-owner or missing Tickets are
// indistinguishable: 404 TICKET_NOT_FOUND (D-03).
async function resolveTicketAccess(
  req: Request,
  res: Response,
  user: { id: number; role: UserRole },
  options: { allowStaff: boolean }
): Promise<{
  ticketId: number;
  currentStatus: TicketStatus;
  ticketNumber: string;
} | null> {
  const ticketId = Number(req.params.ticketId);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  const isStaff =
    user.role === UserRole.IT_STAFF || user.role === UserRole.ADMIN;
  const ticket = await getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      ticketNumber: true,
      submittedById: true,
      currentStatus: true,
    },
  });

  if (!ticket) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  const allowByStaff = options.allowStaff && isStaff;
  if (!allowByStaff && ticket.submittedById !== user.id) {
    res.status(404).json({
      error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
    });
    return null;
  }

  return {
    ticketId: ticket.id,
    currentStatus: ticket.currentStatus,
    ticketNumber: ticket.ticketNumber,
  };
}

// Serializes a PublicComment / InternalNote row for API responses (never
// exposes author emails or internal identifiers).
function toCommentShape(comment: {
  id: number;
  ticketId: number;
  content: string;
  createdAt: Date;
  author: { id: number; name: string };
}) {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    author: { id: comment.author.id, name: comment.author.name },
    content: comment.content,
    createdAt: comment.createdAt,
  };
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
