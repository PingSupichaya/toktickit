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
import {
  canTransition,
  getPermittedTransitions,
  isStaffRole,
} from "./statusTransitions.js";
import { validateContent } from "./contentValidation.js";
import { isValidEmail, normalizeEmail } from "./email.js";
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

// Raised inside the indicate-resolved transaction when a concurrent request
// already recorded the action; mapped to 409 ALREADY_INDICATED_RESOLVED.
class AlreadyIndicatedResolvedError extends Error {
  constructor() {
    super("indicate-resolved already recorded");
  }
}

// Raised inside the claim transaction when the Ticket already has an owner;
// mapped to 409 TICKET_ALREADY_ASSIGNED (BR-43 stale-write protection).
class TicketAlreadyAssignedError extends Error {
  constructor() {
    super("ticket is already assigned");
  }
}

// Raised inside the PATCH transaction when the requested status move is not
// permitted by the current-status matrix; mapped to 409
// TICKET_STATUS_TRANSITION_NOT_ALLOWED (BR-43).
class StatusTransitionNotAllowedError extends Error {
  constructor() {
    super("status transition is not allowed");
  }
}

// Raised inside the claim transaction when the Ticket does not exist; mapped
// to 404 TICKET_NOT_FOUND.
class TicketNotFoundInTransactionError extends Error {
  constructor() {
    super("ticket not found");
  }
}

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
// IT Staff Ticket Queue (FR-14, BR-36..BR-39). GET /api/tickets/queue returns
// the shared queue across all Requesters to IT_STAFF/ADMIN users.
//
// Query params:
//   search         case-insensitive substring over ticketNumber, summary,
//                  description, Requester name, Requester email (BR-37)
//   status | priority (itPriority) | categoryId | relatedSystemId | assignment
//                  filters combine with AND logic (BR-38). assignment is one of
//                  `unassigned` | `assignedToMe` | `all`; ownerId narrows the
//                  specific owner and is ignored unless assignment is `all` or
//                  absent (api-spec §4.8).
//   sortBy         itPriority | ticketDate | updatedAt | requestedPriority |
//                  ticketNumber | currentStatus (default ordering when absent:
//                  itPriority DESC, ticketDate ASC — D-10 / BR-39)
//   sortOrder      asc | desc (default asc when sortBy is provided)
//   page/pageSize  10/25/50 (default 10); invalid values fall back to defaults.
// Invalid enum/assignment/ownerId values -> 400 INVALID_PARAMETERS (API-20).
// ---------------------------------------------------------------------------
const QUEUE_SORT_FIELDS = [
  "ticketDate",
  "updatedAt",
  "itPriority",
  "requestedPriority",
  "ticketNumber",
  "currentStatus",
] as const;
type QueueSortField = (typeof QUEUE_SORT_FIELDS)[number];

const QUEUE_ASSIGNMENTS = ["unassigned", "assignedToMe", "all"] as const;
type QueueAssignment = (typeof QUEUE_ASSIGNMENTS)[number];

app.get(
  "/api/tickets/queue",
  requireRole(UserRole.IT_STAFF, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const q = req.query;
      const sessionUserId = req.sessionUser?.id;
      if (sessionUserId === undefined) {
        return res.status(401).json({
          error: { message: "Authentication required", code: "UNAUTHORIZED" },
        });
      }

      const details: Record<string, string> = {};

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

      let assignment: QueueAssignment | undefined;
      if (q.assignment !== undefined && q.assignment !== "") {
        if (QUEUE_ASSIGNMENTS.includes(q.assignment as QueueAssignment)) {
          assignment = q.assignment as QueueAssignment;
        } else {
          details.assignment =
            'Assignment must be "unassigned", "assignedToMe", or "all"';
        }
      }

      let ownerId: number | undefined;
      if (q.ownerId !== undefined) {
        ownerId = Number(q.ownerId);
        if (!Number.isInteger(ownerId) || ownerId <= 0) {
          details.ownerId = "Owner ID must be a valid integer";
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

      const where: Prisma.TicketWhereInput = {};
      if (status !== undefined) where.currentStatus = status;
      if (priority !== undefined) where.itPriority = priority;
      if (categoryId !== undefined) where.categoryId = categoryId;
      if (relatedSystemId !== undefined) where.relatedSystemId = relatedSystemId;

      if (assignment === "unassigned") {
        where.ownerId = null;
      } else if (assignment === "assignedToMe") {
        where.ownerId = sessionUserId;
      } else if (ownerId !== undefined) {
        // `all` or assignment absent: narrow to the specific owner (BR-38).
        where.ownerId = ownerId;
      }

      if (typeof q.search === "string" && q.search.trim() !== "") {
        const term = q.search.trim();
        where.OR = [
          { ticketNumber: { contains: term, mode: "insensitive" } },
          { summary: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { submitter: { name: { contains: term, mode: "insensitive" } } },
          { submitter: { email: { contains: term, mode: "insensitive" } } },
        ];
      }

      const sortOrder: Prisma.SortOrder =
        q.sortOrder === "desc" ? "desc" : "asc";
      const requestedSort =
        typeof q.sortBy === "string" ? q.sortBy : "";
      const orderBy: Prisma.TicketOrderByWithRelationInput[] =
        (QUEUE_SORT_FIELDS as readonly string[]).includes(requestedSort)
          ? ([{ [requestedSort as QueueSortField]: sortOrder },
              { ticketDate: "asc" }] as Prisma.TicketOrderByWithRelationInput[])
          : [{ itPriority: "desc" }, { ticketDate: "asc" }];

      // Invalid page / pageSize fall back to defaults (BR-39 / API-20).
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
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            ticketNumber: true,
            summary: true,
            requestedPriority: true,
            itPriority: true,
            currentStatus: true,
            ticketDate: true,
            updatedAt: true,
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
            submitter: { select: { id: true, name: true, email: true } },
            owner: { select: { id: true, name: true, role: true } },
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
        requestedPriority: r.requestedPriority,
        itPriority: r.itPriority,
        currentStatus: r.currentStatus,
        ticketDate: r.ticketDate,
        updatedAt: r.updatedAt,
        category: r.category,
        relatedSystem: r.relatedSystem,
        requester: r.submitter,
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
      console.error("Failed to fetch ticket queue:", err);
      res.status(500).json({
        error: {
          message: "Failed to fetch ticket queue",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// User Management (Lab 3, §4.18..4.21). ADMIN-only. The list endpoint supports
// a case-insensitive name/email search and a single role filter with no
// pagination (Excluded Scope). Create validates BR-29/BR-13/BR-10 and marks
// the user mustChangePassword = true. PATCH enforces BR-31 (no self
// deactivation) and BR-32 (never leave zero active Administrators). The reset
// endpoint re-issues a bcrypt-hashed initial password that forces a change at
// the next login (BR-34). Responses never include passwordHash or the
// credential-tracking fields (§3).
// ---------------------------------------------------------------------------
const USER_ROLES: UserRole[] = [
  UserRole.REQUESTER,
  UserRole.IT_STAFF,
  UserRole.ADMIN,
];

// Shape of a user in the user-management responses (§3). Includes
// mustChangePassword and createdAt; never passwordHash/failedLoginAttempts.
function toAdminUser(
  user: Pick<
    User,
    | "id"
    | "name"
    | "email"
    | "role"
    | "isActive"
    | "mustChangePassword"
    | "createdAt"
  >
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

app.get(
  "/api/users",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const q = req.query;
      const where: Prisma.UserWhereInput = {};

      if (q.role !== undefined && q.role !== "") {
        if (!USER_ROLES.includes(q.role as UserRole)) {
          return res.status(400).json({
            error: {
              message: "Invalid role filter",
              code: "INVALID_PARAMETERS",
            },
          });
        }
        where.role = q.role as UserRole;
      }

      if (typeof q.search === "string" && q.search.trim() !== "") {
        const term = q.search.trim();
        where.OR = [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ];
      }

      const users = await getPrisma().user.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      res.status(200).json({ data: users.map(toAdminUser) });
    } catch (err) {
      console.error("Failed to fetch users:", err);
      res.status(500).json({
        error: {
          message: "Failed to fetch users",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

app.post(
  "/api/users",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const details: Record<string, string> = {};

      const name = typeof body.name === "string" ? body.name.trim() : "";
      const emailRaw =
        typeof body.email === "string" ? body.email.trim() : "";
      const role: string = typeof body.role === "string" ? body.role.trim() : "";
      const initialPassword =
        typeof body.initialPassword === "string" ? body.initialPassword : "";

      if (name.length < 1 || name.length > 200) {
        details.name = "Name must be between 1 and 200 characters";
      }
      if (!isValidEmail(emailRaw)) {
        details.email = "Enter a valid email address";
      }
      if (!USER_ROLES.includes(role as UserRole)) {
        details.role = "Must be REQUESTER, IT_STAFF, or ADMIN";
      }
      if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
        details.isActive = "Must be a boolean";
      }
      const violations = passwordRuleViolations(initialPassword);
      if (violations.length > 0) {
        details.initialPassword = violations.join("; ");
      }

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
      const existing = await getPrisma().user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({
          error: {
            message: "This email is already in use",
            code: "EMAIL_ALREADY_EXISTS",
          },
        });
      }

      const created = await getPrisma().user.create({
        data: {
          name,
          email,
          role: role as UserRole,
          isActive: body.isActive ?? true,
          passwordHash: await bcrypt.hash(initialPassword, BCRYPT_COST),
          mustChangePassword: true, // BR-29: initial passwords must be changed
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      res.status(201).json({ data: toAdminUser(created) });
    } catch (err) {
      console.error("Failed to create user:", err);
      res.status(500).json({
        error: {
          message: "Failed to create user",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

app.patch(
  "/api/users/:userId",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({
          error: { message: "Invalid user ID", code: "INVALID_USER_ID" },
        });
      }

      const target = await getPrisma().user.findUnique({
        where: { id: userId },
      });
      if (!target) {
        return res.status(404).json({
          error: { message: "User not found", code: "USER_NOT_FOUND" },
        });
      }

      const body = req.body ?? {};
      const details: Record<string, string> = {};

      const name = typeof body.name === "string" ? body.name.trim() : undefined;
      const emailRaw =
        typeof body.email === "string" ? body.email.trim() : undefined;
      const role: string | undefined =
        typeof body.role === "string" ? body.role.trim() : undefined;

      if (body.name !== undefined && name === undefined) {
        details.name = "Name must be a string";
      }
      if (name !== undefined && (name.length < 1 || name.length > 200)) {
        details.name = "Name must be between 1 and 200 characters";
      }
      if (emailRaw !== undefined && !isValidEmail(emailRaw)) {
        details.email = "Enter a valid email address";
      }
      if (role !== undefined && !USER_ROLES.includes(role as UserRole)) {
        details.role = "Must be REQUESTER, IT_STAFF, or ADMIN";
      }
      if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
        details.isActive = "Must be a boolean";
      }

      if (
        body.name === undefined &&
        body.email === undefined &&
        body.role === undefined &&
        body.isActive === undefined
      ) {
        details.general = "At least one field must be provided";
      }

      if (Object.keys(details).length > 0) {
        return res.status(400).json({
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details,
          },
        });
      }

      const newEmail = emailRaw !== undefined ? normalizeEmail(emailRaw) : undefined;
      if (newEmail !== undefined && newEmail !== target.email) {
        const duplicate = await getPrisma().user.findUnique({
          where: { email: newEmail },
        });
        if (duplicate) {
          return res.status(409).json({
            error: {
              message: "This email is already in use",
              code: "EMAIL_ALREADY_EXISTS",
            },
          });
        }
      }

      const newRole = role !== undefined ? (role as UserRole) : target.role;
      const newIsActive = body.isActive !== undefined ? body.isActive : target.isActive;

      // BR-31: an Administrator may not deactivate their own account.
      if (
        target.id === req.sessionUser?.id &&
        body.isActive === false
      ) {
        return res.status(409).json({
          error: {
            message: "You cannot deactivate your own account",
            code: "CANNOT_DEACTIVATE_SELF",
          },
        });
      }

      // BR-32: never leave the system with zero active Administrators. Count
      // other active admins excluding the target, then add the target's new
      // state; if the resulting set is empty the change is rejected.
      const otherActiveAdmins = await getPrisma().user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
          id: { not: target.id },
        },
      });
      const targetWillBeActiveAdmin = newRole === UserRole.ADMIN && newIsActive;
      if (!targetWillBeActiveAdmin && otherActiveAdmins === 0) {
        return res.status(409).json({
          error: {
            message:
              "The system must always have at least one active Administrator",
            code: "LAST_ACTIVE_ADMIN",
          },
        });
      }

      const updated = await getPrisma().user.update({
        where: { id: target.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(newEmail !== undefined ? { email: newEmail } : {}),
          ...(role !== undefined ? { role: newRole } : {}),
          ...(body.isActive !== undefined ? { isActive: newIsActive } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      res.status(200).json({ data: toAdminUser(updated) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint on email enforced at the DB level as a fallback.
        if (err.code === "P2002" && String(err.meta?.target).includes("email")) {
          return res.status(409).json({
            error: {
              message: "This email is already in use",
              code: "EMAIL_ALREADY_EXISTS",
            },
          });
        }
      }
      console.error("Failed to update user:", err);
      res.status(500).json({
        error: {
          message: "Failed to update user",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  }
);

app.post(
  "/api/users/:userId/reset-initial-password",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({
          error: { message: "Invalid user ID", code: "INVALID_USER_ID" },
        });
      }

      const target = await getPrisma().user.findUnique({
        where: { id: userId },
      });
      if (!target) {
        return res.status(404).json({
          error: { message: "User not found", code: "USER_NOT_FOUND" },
        });
      }

      const body = req.body ?? {};
      const newPassword =
        typeof body.newPassword === "string" ? body.newPassword : "";

      const violations = passwordRuleViolations(newPassword);
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
        where: { id: target.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
          mustChangePassword: true, // BR-34: force change at next login
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      res.status(200).json({ data: toAdminUser(updated) });
    } catch (err) {
      console.error("Failed to reset initial password:", err);
      res.status(500).json({
        error: {
          message: "Failed to reset initial password",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
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
// Eligible owners (supplementary helper for the IT Staff Owner select; the
// documented API defines only PUT /owner, so this endpoint supplies the
// candidate list for the ui-spec §6.3 `owner-select`). Active IT_STAFF/ADMIN
// users only; a Requester request is forbidden (403) and no user data leaks.
// Registered BEFORE /api/tickets/:ticketId so the literal segment wins.
// ---------------------------------------------------------------------------
app.get("/api/tickets/eligible-owners", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
    if (!isStaffRole(user.role)) {
      return res.status(403).json({
        error: {
          message: "You are not authorized to view eligible owners",
          code: "FORBIDDEN",
        },
      });
    }

    const owners = await getPrisma().user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.IT_STAFF, UserRole.ADMIN] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    });

    res.status(200).json({ data: owners });
  } catch (err) {
    console.error("Failed to fetch eligible owners:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch eligible owners",
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
      include: TICKET_DETAIL_INCLUDE,
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

    res.status(200).json({ data: toTicketDetail(ticket, user) });
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
// Ticket operational update (FR-17 / FR-18 / AC-11, AC-12, BR-19, BR-20)
// PATCH /api/tickets/:ticketId -> 200 { data: updated ticket }
//   body: { itPriority?: LOW|MEDIUM|HIGH, currentStatus?: transition target }
//   Only IT_STAFF/ADMIN. Status changes are validated against the CURRENT
//   status read in the same transaction (BR-43); a disallowed move is 409
//   TICKET_STATUS_TRANSITION_NOT_ALLOWED. Response mirrors §4.9 minus
//   comments/notes for compactness.
// ---------------------------------------------------------------------------
app.patch("/api/tickets/:ticketId", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
    if (!isStaffRole(user.role)) {
      return res.status(403).json({
        error: {
          message: "Only IT Staff or Administrator may update a Ticket",
          code: "FORBIDDEN",
        },
      });
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const body = req.body ?? {};
    const details: Record<string, string> = {};
    let itPriority: RequestedPriority | undefined;
    if (body.itPriority !== undefined && body.itPriority !== null) {
      if (PRIORITIES.includes(body.itPriority as RequestedPriority)) {
        itPriority = body.itPriority as RequestedPriority;
      } else {
        details.itPriority = 'IT Priority must be "LOW", "MEDIUM", or "HIGH"';
      }
    }
    let nextStatus: TicketStatus | undefined;
    if (body.currentStatus !== undefined && body.currentStatus !== null) {
      if (STATUSES.includes(body.currentStatus as TicketStatus)) {
        nextStatus = body.currentStatus as TicketStatus;
      } else {
        details.currentStatus = "Status has an invalid value";
      }
    }

    if (itPriority === undefined && nextStatus === undefined) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: {
            body: "At least one of itPriority or currentStatus must be provided",
          },
        },
      });
    }
    if (Object.keys(details).length > 0) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details,
        },
      });
    }

    const db = getPrisma();
    try {
      await db.$transaction(async (tx) => {
        const current = await tx.ticket.findUniqueOrThrow({
          where: { id: ticketId },
          select: { currentStatus: true },
        });
        if (
          nextStatus !== undefined &&
          !canTransition(current.currentStatus, nextStatus, user.role)
        ) {
          throw new StatusTransitionNotAllowedError();
        }
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            ...(itPriority !== undefined ? { itPriority } : {}),
            ...(nextStatus !== undefined ? { currentStatus: nextStatus } : {}),
          },
        });
      });
    } catch (err) {
      if (err instanceof StatusTransitionNotAllowedError) {
        return res.status(409).json({
          error: {
            message: "This status transition is not allowed",
            code: "TICKET_STATUS_TRANSITION_NOT_ALLOWED",
          },
        });
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return res.status(404).json({
          error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
        });
      }
      throw err;
    }

    const updated = await db.ticket.findUnique({
      where: { id: ticketId },
      include: TICKET_DETAIL_INCLUDE,
    });
    if (!updated) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }
    const data = toTicketDetail(updated, user);
    delete data.comments;
    delete data.notes;
    res.status(200).json({ data });
  } catch (err) {
    console.error("Failed to update ticket:", err);
    res.status(500).json({
      error: {
        message: "Failed to update ticket",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Claim an unassigned Ticket (FR-16 / AC-09 / BR-18)
// POST /api/tickets/:ticketId/claim -> 200 { data: { ticketId, owner } }
//   Only IT_STAFF/ADMIN. Already-assigned Tickets are rejected 409
//   TICKET_ALREADY_ASSIGNED (use the assign endpoint instead); the owner
//   snapshot is re-read in the same transaction (BR-43).
// ---------------------------------------------------------------------------
app.post("/api/tickets/:ticketId/claim", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
    if (!isStaffRole(user.role)) {
      return res.status(403).json({
        error: {
          message: "Only IT Staff or Administrator may claim a Ticket",
          code: "FORBIDDEN",
        },
      });
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const db = getPrisma();
    try {
      const updated = await db.$transaction(async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, ownerId: true },
        });
        if (!current) {
          throw new TicketNotFoundInTransactionError();
        }
        if (current.ownerId !== null) {
          throw new TicketAlreadyAssignedError();
        }
        return tx.ticket.update({
          where: { id: ticketId },
          data: { ownerId: user.id },
          select: {
            id: true,
            owner: { select: { id: true, name: true, role: true } },
          },
        });
      });

      res.status(200).json({
        data: { ticketId: updated.id, owner: updated.owner },
      });
    } catch (err) {
      if (err instanceof TicketAlreadyAssignedError) {
        return res.status(409).json({
          error: {
            message: "This Ticket is already assigned to an owner",
            code: "TICKET_ALREADY_ASSIGNED",
          },
        });
      }
      if (err instanceof TicketNotFoundInTransactionError) {
        return res.status(404).json({
          error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("Failed to claim ticket:", err);
    res.status(500).json({
      error: {
        message: "Failed to claim ticket",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Assign / reassign ownership (FR-16 / AC-10 / BR-17, BR-18)
// PUT /api/tickets/:ticketId/owner -> 200 { data: { ticketId, owner } }
//   body: { ownerId } must reference an existing, ACTIVE IT_STAFF/ADMIN user;
//   an inactive or wrong-role owner is indistinguishable from a missing user
//   (404, no user enumeration).
// ---------------------------------------------------------------------------
app.put("/api/tickets/:ticketId/owner", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
    if (!isStaffRole(user.role)) {
      return res.status(403).json({
        error: {
          message: "Only IT Staff or Administrator may assign a Ticket owner",
          code: "FORBIDDEN",
        },
      });
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const ownerId = (req.body ?? {}).ownerId;
    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { ownerId: "ownerId must be a valid user ID" },
        },
      });
    }

    const db = getPrisma();
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const owner = await db.user.findFirst({
      where: {
        id: ownerId,
        isActive: true,
        role: { in: [UserRole.IT_STAFF, UserRole.ADMIN] },
      },
      select: { id: true, name: true, role: true },
    });
    if (!owner) {
      return res.status(404).json({
        error: {
          message: "The selected owner is not an active IT Staff or Administrator",
          code: "OWNER_NOT_FOUND",
        },
      });
    }

    const updated = await db.ticket.update({
      where: { id: ticketId },
      data: { ownerId: owner.id },
      select: {
        id: true,
        owner: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(200).json({
      data: { ticketId: updated.id, owner: updated.owner },
    });
  } catch (err) {
    console.error("Failed to assign owner:", err);
    res.status(500).json({
      error: {
        message: "Failed to assign owner",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Internal Notes (FR-19 / FR-20 / AC-15, BR-24, BR-28)
// GET  /api/tickets/:ticketId/notes -> 200 { data: [note, ...] } oldest first
// POST /api/tickets/:ticketId/notes -> 201 { data: note }
//   body: { content: 1-2000 chars after trim, whitespace-only rejected }
//   IT_STAFF/ADMIN only; a Requester request is 403 with no note content
//   exposed (BR-28).
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId/notes", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
    if (!isStaffRole(user.role)) {
      return res.status(403).json({
        error: {
          message: "Only IT Staff or Administrator may view Internal Notes",
          code: "FORBIDDEN",
        },
      });
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });

    res.status(200).json({ data: notes.map(toCommentShape) });
  } catch (err) {
    console.error("Failed to fetch notes:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch notes",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

app.post("/api/tickets/:ticketId/notes", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (!user) {
      return res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
    }
    if (!isStaffRole(user.role)) {
      return res.status(403).json({
        error: {
          message: "Only IT Staff or Administrator may create Internal Notes",
          code: "FORBIDDEN",
        },
      });
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      return res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
    }

    const result = validateContent((req.body ?? {}).content);
    if (!result.ok) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { content: result.message },
        },
      });
    }

    const note = await getPrisma().internalNote.create({
      data: { ticketId: ticket.id, authorId: user.id, content: result.value },
      include: { author: { select: { id: true, name: true } } },
    });

    res.status(201).json({ data: toCommentShape(note) });
  } catch (err) {
    console.error("Failed to create note:", err);
    res.status(500).json({
      error: {
        message: "Failed to create note",
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
    const result = validateContent(body.content);
    if (!result.ok) {
      return res.status(400).json({
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { content: result.message },
        },
      });
    }

    const comment = await getPrisma().publicComment.create({
      data: { ticketId: access.ticketId, authorId: user.id, content: result.value },
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
// Ticket status. Only the submitting Requester may use it, only while the
// Ticket is in a non-terminal state (409 TICKET_NOT_INDICATABLE otherwise),
// and only once: Ticket.indicatedResolvedAt is set in the same transaction
// (409 ALREADY_INDICATED_RESOLVED on a repeat attempt).
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

      if (access.indicatedResolvedAt) {
        return res.status(409).json({
          error: {
            message: "You have already indicated this Ticket appears resolved",
            code: "ALREADY_INDICATED_RESOLVED",
          },
        });
      }

      const db = getPrisma();
      const comment = await db.$transaction(async (tx) => {
        const existing = await tx.ticket.findUniqueOrThrow({
          where: { id: access.ticketId },
          select: { indicatedResolvedAt: true },
        });
        if (existing.indicatedResolvedAt) {
          throw new AlreadyIndicatedResolvedError();
        }
        await tx.ticket.update({
          where: { id: access.ticketId },
          data: { indicatedResolvedAt: new Date() },
        });
        return tx.publicComment.create({
          data: {
            ticketId: access.ticketId,
            authorId: user.id,
            content: "The Requester indicated the problem appears resolved.",
          },
          include: { author: { select: { id: true, name: true } } },
        });
      });

      res.status(201).json({ data: toCommentShape(comment) });
    } catch (err) {
      if (err instanceof AlreadyIndicatedResolvedError) {
        return res.status(409).json({
          error: {
            message: "You have already indicated this Ticket appears resolved",
            code: "ALREADY_INDICATED_RESOLVED",
          },
        });
      }
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
// hidden by default and shown only when includeRemoved=true. IT_STAFF/ADMIN
// may read any Ticket's attachments (api-spec §4.17); a Requester may only
// read their own (404 for cross-owner).
// ---------------------------------------------------------------------------
app.get("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (user === undefined) {
      res.status(401).json({
        error: { message: "Authentication required", code: "UNAUTHORIZED" },
      });
      return;
    }

    const ticketId = Number(req.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
      return;
    }

    const isStaff = isStaffRole(user.role);
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, submittedById: true },
    });

    if (!ticket || (!isStaff && ticket.submittedById !== user.id)) {
      res.status(404).json({
        error: { message: "Ticket not found", code: "TICKET_NOT_FOUND" },
      });
      return;
    }

    const includeRemoved = req.query.includeRemoved === "true";

    const attachments = await getPrisma().attachment.findMany({
      where: {
        ticketId: ticket.id,
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
// downloadable (AC-07). IT_STAFF/ADMIN may download any Ticket's active
// attachments; a Requester may only download their own (404 cross-owner).
// ---------------------------------------------------------------------------
app.get("/api/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const user = req.sessionUser;
    if (user === undefined) {
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

    const isStaff = isStaffRole(user.role);
    if (!isStaff && attachment.ticket.submittedById !== user.id) {
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
  indicatedResolvedAt: Date | null;
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
      indicatedResolvedAt: true,
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
    indicatedResolvedAt: ticket.indicatedResolvedAt,
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

// Ticket detail row shape shared by GET and PATCH (api-spec §4.9/§4.10).
const TICKET_DETAIL_INCLUDE = {
  submitter: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, role: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    orderBy: { id: "asc" as const },
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
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
  internalNotes: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
} satisfies Prisma.TicketInclude;

type TicketDetailRow = Prisma.TicketGetPayload<{
  include: typeof TICKET_DETAIL_INCLUDE;
}>;

// Viewer-aware detail serializer: Internal Notes are present only for
// IT_STAFF/ADMIN; canIndicateResolved only for the submitting Requester;
// permittedStatusTransitions derives from the transition matrix (§5.3).
function toTicketDetail(
  ticket: TicketDetailRow,
  viewer: { id: number; role: UserRole }
): Record<string, unknown> {
  const isStaff = isStaffRole(viewer.role);
  const data: Record<string, unknown> = {
    ...ticket,
    canIndicateResolved:
      viewer.role === UserRole.REQUESTER &&
      ticket.submittedById === viewer.id &&
      ticket.indicatedResolvedAt === null &&
      INDICATABLE_STATUSES.includes(ticket.currentStatus),
    permittedStatusTransitions: getPermittedTransitions(
      ticket.currentStatus,
      viewer.role
    ),
    comments: ticket.publicComments.map(toCommentShape),
  };
  delete data.publicComments;
  delete data.indicatedResolvedAt;
  if (isStaff) {
    data.notes = ticket.internalNotes.map(toCommentShape);
  }
  delete data.internalNotes;
  return data;
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
