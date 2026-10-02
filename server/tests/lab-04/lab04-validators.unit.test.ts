import { describe, expect, it } from "vitest";
import {
  isStaleVersion,
  normalizeFollowUpNote,
} from "../../src/actionTakenRules.js";

// lab-04 unit tests — UNIT-02 (BR-12) and UNIT-03 (BR-04).
// UNIT-01 (gate evaluator), UNIT-04 (metric builders), and UNIT-05 (actionAt
// validator) belong to the ticket-workflow / dashboard issues and stay todo.

describe("UNIT-02 — optimistic-concurrency comparator (BR-12)", () => {
  it("matching version proceeds (not stale)", () => {
    expect(isStaleVersion(1, 1)).toBe(false);
    expect(isStaleVersion(7, 7)).toBe(false);
  });

  it("mismatched version rejects with no side effects", () => {
    expect(isStaleVersion(1, 2)).toBe(true);
    expect(isStaleVersion(2, 1)).toBe(true);
  });

  it("non-integer or missing submission is stale (route reports 400 first)", () => {
    expect(isStaleVersion(undefined, 1)).toBe(true);
    expect(isStaleVersion(null, 1)).toBe(true);
    expect(isStaleVersion("1", 1)).toBe(true);
  });
});

describe("UNIT-03 — follow-up conditional validator (BR-04)", () => {
  it("required + valid note passes with the trimmed note", () => {
    expect(normalizeFollowUpNote(true, "  Check back tomorrow.  ")).toEqual({
      note: "Check back tomorrow.",
    });
  });

  it("required + empty/whitespace/missing/oversize note fails", () => {
    expect(normalizeFollowUpNote(true, "")).toEqual({
      error: "FOLLOW_UP_NOTE_REQUIRED",
    });
    expect(normalizeFollowUpNote(true, "   ")).toEqual({
      error: "FOLLOW_UP_NOTE_REQUIRED",
    });
    expect(normalizeFollowUpNote(true, null)).toEqual({
      error: "FOLLOW_UP_NOTE_REQUIRED",
    });
    expect(normalizeFollowUpNote(true, undefined)).toEqual({
      error: "FOLLOW_UP_NOTE_REQUIRED",
    });
    expect(normalizeFollowUpNote(true, "x".repeat(1001))).toEqual({
      error: "FOLLOW_UP_NOTE_REQUIRED",
    });
  });

  it("not required auto-clears any supplied note to null (never fails)", () => {
    expect(normalizeFollowUpNote(false, "leftover text")).toEqual({ note: null });
    expect(normalizeFollowUpNote(false, "")).toEqual({ note: null });
    expect(normalizeFollowUpNote(false, null)).toEqual({ note: null });
    expect(normalizeFollowUpNote(false, undefined)).toEqual({ note: null });
  });
});

describe.skip("Lab 4 validators unit contract (other issues)", () => {
  it.todo("UNIT-01 resolution-gate evaluator: 4 input combinations");
  it.todo("UNIT-04 metric builders incl. userCounts per role");
  it.todo("UNIT-05 actionAt validator: future beyond +5 min rejects, else accepts");
});
