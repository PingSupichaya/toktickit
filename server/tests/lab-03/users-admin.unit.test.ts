import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail } from "../../src/email.js";

// UNIT-06 — FR-21 / BR-13: emails are normalized to lowercase before any
// uniqueness or lookup.
describe("email normalization and validation", () => {
  it("lowercases and trims emails", () => {
    expect(normalizeEmail("  Alice.John@MAIL.Kmutt.AC.TH ")).toBe(
      "alice.john@mail.kmutt.ac.th"
    );
  });

  it("accepts well-formed emails", () => {
    expect(isValidEmail("alice.john@mail.kmutt.ac.th")).toBe(true);
  });

  it("rejects malformed emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.d")).toBe(false);
  });
});