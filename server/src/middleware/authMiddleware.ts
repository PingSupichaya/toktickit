import type { Request, RequestHandler, Response } from "express";
import type { UserRole } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { SESSION_COOKIE_NAME, hashSessionToken } from "../session.js";
import { getTrustedOrigins, originIsAllowed } from "../csrf.js";
import { normalizeEmail } from "../email.js";

// The authenticated user attached to the request by requireSession. Never
// includes passwordHash, failedLoginAttempts, or lastFailedLoginAt.
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionUser;
    }
  }
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // BR-08: rolling 15-minute window
const RATE_LIMIT_MAX_ATTEMPTS = 5;

const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Reads a single cookie by name from the Cookie header without needing a
// cookie-parser dependency.
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return undefined;
}

function unauthorized(res: Response): Response {
  return res.status(401).json({
    error: { message: "Authentication required", code: "UNAUTHORIZED" },
  });
}

function forbidden(
  res: Response,
  message = "You do not have permission to perform this action"
): Response {
  return res.status(403).json({
    error: { message, code: "FORBIDDEN" },
  });
}

// Find the matching, unexpired Session for the cookie and attach its user.
// Missing/invalid/expired/deactivated sessions all yield 401 UNAUTHORIZED.
export const requireSession: RequestHandler = async (req, res, next) => {
  try {
    const token = readCookie(req, SESSION_COOKIE_NAME);
    if (!token) return unauthorized(res);

    const tokenHash = hashSessionToken(token);
    const session = await getPrisma().session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) return unauthorized(res);

    if (session.expiresAt.getTime() <= Date.now()) {
      // Expired sessions are deleted so they cannot be reused (BR-12).
      await getPrisma()
        .session.delete({ where: { id: session.id } })
        .catch(() => undefined);
      return unauthorized(res);
    }

    if (!session.user.isActive) {
      await getPrisma()
        .session.delete({ where: { id: session.id } })
        .catch(() => undefined);
      return unauthorized(res);
    }

    req.sessionUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      isActive: session.user.isActive,
      mustChangePassword: session.user.mustChangePassword,
    };
    return next();
  } catch (err) {
    console.error("Session lookup failed:", err);
    return unauthorized(res);
  }
};

// Rejects state-changing requests whose Origin/Referer does not match a
// trusted origin — but only when a session is present (it always is on /api
// behind requireSession). GET/HEAD/OPTIONS are never checked.
export const csrfProtect: RequestHandler = (req, res, next) => {
  if (!CSRF_METHODS.has(req.method)) return next();
  if (req.sessionUser) {
    if (
      !originIsAllowed(
        req.headers.origin,
        req.headers.referer,
        getTrustedOrigins()
      )
    ) {
      return res.status(403).json({
        error: {
          message: "Cross-site request blocked",
          code: "CSRF_ORIGIN_MISMATCH",
        },
      });
    }
  }
  return next();
};

// A user with mustChangePassword = true may only reach /api/auth/me,
// /api/auth/logout, and /api/auth/change-password until they change it (AC-02).
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/change-password",
]);

function requestPath(req: Request): string {
  return (req.originalUrl.split("?")[0] ?? req.originalUrl).replace(/\/+$/, "");
}

export const mustChangePasswordGuard: RequestHandler = (req, res, next) => {
  const user = req.sessionUser;
  if (
    user &&
    user.mustChangePassword &&
    !PASSWORD_CHANGE_ALLOWED_PATHS.has(requestPath(req))
  ) {
    return res.status(403).json({
      error: {
        message: "You must change your password before continuing",
        code: "PASSWORD_CHANGE_REQUIRED",
      },
    });
  }
  return next();
};

// Route-level role check; an authenticated-but-wrong role is 403 FORBIDDEN
// (role restrictions are never indistinguishable from 404 — that policy
// applies only to cross-owner object access, D-03).
export function requireRole(...roles: UserRole[]): RequestHandler {
  const allowed = new Set<UserRole>(roles);
  return (req, res, next) => {
    const user = req.sessionUser;
    if (!user) return unauthorized(res);
    if (!allowed.has(user.role)) return forbidden(res);
    return next();
  };
}

// In-memory sliding-window login rate limiter (BR-08). Failures are tracked per
// email; 5 failures within 15 minutes block further attempts until the window
// clears. A successful login resets the counter.
//
// The library is intentionally in-memory: the lab spec (D-07) accepts that the
// window does not survive a process restart.
export class LoginRateLimiter {
  private attempts = new Map<string, number[]>();

  private prune(email: string, now: number): number[] {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const recent = (this.attempts.get(email) ?? []).filter((t) => t > cutoff);
    this.attempts.set(email, recent);
    return recent;
  }

  recordFailure(email: string): void {
    const now = Date.now();
    const recent = this.prune(email, now);
    recent.push(now);
    this.attempts.set(email, recent);
  }

  reset(email: string): void {
    this.attempts.delete(email);
  }

  isBlocked(email: string): boolean {
    return this.prune(email, Date.now()).length >= RATE_LIMIT_MAX_ATTEMPTS;
  }

  middleware(): RequestHandler {
    return (req, res, next) => {
      const email = normalizeEmail(
        typeof req.body?.email === "string" ? req.body.email : ""
      );
      if (this.isBlocked(email)) {
        return res.status(429).json({
          error: {
            message: "Too many failed login attempts. Try again later.",
            code: "TOO_MANY_ATTEMPTS",
          },
        });
      }
      return next();
    };
  }
}