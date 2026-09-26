import crypto from "node:crypto";

// Session token helpers (§1 Authentication and Session Model).
// The server stores only the SHA-256 digest of a random 32-byte token; the raw
// token travels only inside the HttpOnly `toktickit_session` cookie (BR-11).

export const SESSION_COOKIE_NAME = "toktickit_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8-hour absolute expiry (BR-12)
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 28800 — cookie Max-Age

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}