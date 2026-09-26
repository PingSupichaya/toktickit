import { describe, it, expect } from "vitest";
import { originIsAllowed } from "../../src/csrf.js";

// UNIT-05 — §1 / BR-14: the CSRF origin-check helper.
const TRUSTED = ["http://localhost:5173", "http://127.0.0.1:5173"];

describe("originIsAllowed", () => {
  it("allows a matching Origin header", () => {
    expect(
      originIsAllowed("http://localhost:5173", undefined, TRUSTED)
    ).toBe(true);
  });

  it("rejects a mismatched Origin header", () => {
    expect(
      originIsAllowed("https://evil.example.com", undefined, TRUSTED)
    ).toBe(false);
  });

  it("rejects a missing Origin and missing Referer", () => {
    expect(originIsAllowed(undefined, undefined, TRUSTED)).toBe(false);
  });

  it("falls back to the Referer when Origin is absent", () => {
    expect(
      originIsAllowed(undefined, "http://localhost:5173/login", TRUSTED)
    ).toBe(true);
  });

  it("rejects a mismatched Referer when Origin is absent", () => {
    expect(
      originIsAllowed(undefined, "https://evil.example.com/hook", TRUSTED)
    ).toBe(false);
  });

  it("prefers Origin over Referer when both are present", () => {
    expect(
      originIsAllowed(
        "https://evil.example.com",
        "http://localhost:5173/login",
        TRUSTED
      )
    ).toBe(false);
  });

  it("rejects malformed headers", () => {
    expect(originIsAllowed("not-a-url", undefined, TRUSTED)).toBe(false);
  });
});