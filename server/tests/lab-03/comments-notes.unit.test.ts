import { describe, expect, it } from "vitest";
import {
  CONTENT_MAX_LENGTH,
  CONTENT_MIN_LENGTH,
  validateContent,
} from "../../src/contentValidation.js";

// ---------------------------------------------------------------------------
// lab-03 / comments-notes.unit.test.ts — UNIT-04 (§2.8 tests.md)
//
//   BR-23 / BR-24 — comment/note content validation: trim, then 1-2000
//   boundary; whitespace-only rejected.
// ---------------------------------------------------------------------------

describe("UNIT-04 comment/note content validation (BR-23, BR-24)", () => {
  it("accepts content from 1 to 2000 characters after trim", () => {
    expect(validateContent("a")).toEqual({ ok: true, value: "a" });
    expect(validateContent("  hello  ")).toEqual({ ok: true, value: "hello" });
    const max = "x".repeat(CONTENT_MAX_LENGTH);
    expect(validateContent(`  ${max}  `)).toEqual({ ok: true, value: max });
  });

  it("rejects empty and whitespace-only content", () => {
    expect(validateContent("")).toMatchObject({ ok: false });
    expect(validateContent("   ")).toMatchObject({ ok: false });
    expect(validateContent("\t\n  ")).toMatchObject({ ok: false });
  });

  it("rejects content shorter than 1 or longer than 2000 characters", () => {
    expect(validateContent("x".repeat(CONTENT_MIN_LENGTH - 1))).toMatchObject({
      ok: false,
    });
    expect(validateContent("x".repeat(CONTENT_MAX_LENGTH + 1))).toMatchObject({
      ok: false,
    });
  });

  it("rejects non-string payloads", () => {
    expect(validateContent(undefined)).toMatchObject({ ok: false });
    expect(validateContent(null)).toMatchObject({ ok: false });
    expect(validateContent(42)).toMatchObject({ ok: false });
    expect(validateContent({ content: "ignored" })).toMatchObject({ ok: false });
  });

  it("preserves the trimmed value exactly", () => {
    expect(validateContent("  A note with   inner spaces  ")).toEqual({
      ok: true,
      value: "A note with   inner spaces",
    });
  });
});