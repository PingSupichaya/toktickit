import { describe, expect, it } from "vitest";
import {
  ACTION_AT_FUTURE_TOLERANCE_MS,
  isActionAtTooFarInFuture,
  isResolutionGateSatisfied,
  isStaleVersion,
  normalizeFollowUpNote,
  parseActionAt,
} from "../../src/actionTakenRules.js";
import {
  countActiveUsersByRole,
  countRequesterMetrics,
  countStaffMetrics,
  type MetricTicket,
} from "../../src/dashboardMetrics.js";

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

describe("UNIT-01 — resolution-gate evaluator (BR-10)", () => {
  it("denies with zero actions regardless of the latest flag", () => {
    expect(isResolutionGateSatisfied(0, null)).toBe(false);
    expect(isResolutionGateSatisfied(0, false)).toBe(false);
  });

  it("denies when the latest action needs follow-up", () => {
    expect(isResolutionGateSatisfied(1, true)).toBe(false);
    expect(isResolutionGateSatisfied(3, true)).toBe(false);
  });

  it("allows with ≥1 action and a clean latest entry", () => {
    expect(isResolutionGateSatisfied(1, false)).toBe(true);
    expect(isResolutionGateSatisfied(4, false)).toBe(true);
  });
});

describe("UNIT-04 — dashboard metric builders (BR-14, BR-15)", () => {
  const tickets: MetricTicket[] = [
    { currentStatus: "NEW", submittedById: 1, ownerId: null, itPriority: "LOW" },
    { currentStatus: "OPEN", submittedById: 1, ownerId: 10, itPriority: "MEDIUM" },
    { currentStatus: "IN_PROGRESS", submittedById: 1, ownerId: 10, itPriority: "HIGH" },
    { currentStatus: "WAITING_FOR_REQUESTER", submittedById: 1, ownerId: null, itPriority: "LOW" },
    { currentStatus: "RESOLVED", submittedById: 1, ownerId: 10, itPriority: "MEDIUM" },
    { currentStatus: "CLOSED", submittedById: 1, ownerId: null, itPriority: "HIGH" },
    { currentStatus: "REOPENED", submittedById: 2, ownerId: 10, itPriority: "LOW" },
    { currentStatus: "CANCELLED", submittedById: 2, ownerId: null, itPriority: "MEDIUM" },
  ];

  it("requester metrics count only the caller's Tickets", () => {
    expect(countRequesterMetrics(tickets, 1)).toEqual({
      myOpenTickets: 3, // NEW + OPEN + IN_PROGRESS
      waitingOnYou: 1,
      resolved: 1,
      closed: 1,
    });
    expect(countRequesterMetrics(tickets, 2)).toEqual({
      myOpenTickets: 1, // REOPENED
      waitingOnYou: 0,
      resolved: 0,
      closed: 0,
    });
    expect(countRequesterMetrics(tickets, 99)).toEqual({
      myOpenTickets: 0,
      waitingOnYou: 0,
      resolved: 0,
      closed: 0,
    });
  });

  it("staff metrics separate queue-wide, unassigned, mine, and priority slices", () => {
    expect(countStaffMetrics(tickets, 10)).toEqual({
      new: 1,
      open: 1,
      inProgress: 1,
      waitingForRequester: 1,
      unassigned: 2, // NEW/null + WAITING/null (active only)
      myAssigned: 3, // OPEN/10 + IN_PROGRESS/10 + REOPENED/10 (RESOLVED/10 excluded)
      byPriority: { low: 3, medium: 1, high: 1 }, // active only
    });
    expect(countStaffMetrics(tickets, 99).myAssigned).toBe(0);
  });

  it("userCounts counts active users only, per role", () => {
    expect(
      countActiveUsersByRole([
        { role: "REQUESTER", isActive: true },
        { role: "REQUESTER", isActive: true },
        { role: "REQUESTER", isActive: false },
        { role: "IT_STAFF", isActive: true },
        { role: "IT_STAFF", isActive: false },
        { role: "ADMIN", isActive: true },
        { role: "ADMIN", isActive: false },
      ])
    ).toEqual({ requesters: 2, itStaff: 1, admins: 1 });
  });
});

describe("UNIT-05 — actionAt validator (BR-06)", () => {
  const now = new Date("2026-09-20T12:00:00.000Z").getTime();

  it("parses valid ISO-8601, rejects missing and invalid input", () => {
    expect(parseActionAt("2026-09-20T09:15:00.000Z")).toEqual({
      ok: true,
      date: new Date("2026-09-20T09:15:00.000Z"),
    });
    expect(parseActionAt("").ok).toBe(false);
    expect(parseActionAt(undefined).ok).toBe(false);
    expect(parseActionAt(null).ok).toBe(false);
    expect(parseActionAt("not-a-date").ok).toBe(false);
    expect(parseActionAt(12345).ok).toBe(false);
  });

  it("rejects future dates beyond the +5 min tolerance, accepts the rest", () => {
    const tolerance = ACTION_AT_FUTURE_TOLERANCE_MS;
    expect(tolerance).toBe(5 * 60 * 1000);
    // Beyond tolerance → too far.
    expect(
      isActionAtTooFarInFuture(new Date(now + tolerance + 1000), now)
    ).toBe(true);
    // Within tolerance (client clock skew) → accepted.
    expect(isActionAtTooFarInFuture(new Date(now + tolerance - 1000), now)).toBe(
      false
    );
    expect(isActionAtTooFarInFuture(new Date(now), now)).toBe(false);
    // Past values (backdated logging) always pass.
    expect(
      isActionAtTooFarInFuture(new Date("2020-01-15T08:30:00.000Z"), now)
    ).toBe(false);
  });
});
