import { describe, it, expect } from "vitest";
import {
  hashSessionToken,
  generateSessionToken,
  SESSION_TTL_MS,
  SESSION_MAX_AGE_SECONDS,
} from "../../src/session.js";

// UNIT-02 — §1 / BR-11: tokens are 32 random bytes; only the SHA-256 digest is
// stored/compared; two logins produce distinct tokens.
describe("session token generation and hashing", () => {
  it("generates a token that decodes to 32 random bytes", () => {
    const token = generateSessionToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("produces distinct tokens for two separate sessions", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
  });

  it("hashes deterministically to a 64-char SHA-256 digest", () => {
    const token = generateSessionToken();
    const digest = hashSessionToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(digest);
  });

  it("never stores or reveals the raw token (digest differs from token)", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("exposes the 8-hour TTL as milliseconds and cookie Max-Age", () => {
    expect(SESSION_TTL_MS).toBe(8 * 60 * 60 * 1000);
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
  });
});