import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  canTransition,
  getPermittedTransitions,
  isStaffRole,
} from "../../src/statusTransitions.js";
import type { TicketStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// lab-03 / status-transitions.unit.test.ts — UNIT-03 (§2.8 tests.md)
//
//   BR-20 / §5.3 — every (from, role, to) combination returns allowed/denied
//   per the transition matrix; the functions are pure (no side effects).
// ---------------------------------------------------------------------------

const ALL_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

// Exact positive moves from specification.md §5.3.
const STAFF_ALLOWED: [TicketStatus, TicketStatus][] = [
  ["NEW", "OPEN"],
  ["NEW", "IN_PROGRESS"],
  ["NEW", "CANCELLED"],
  ["OPEN", "IN_PROGRESS"],
  ["OPEN", "WAITING_FOR_REQUESTER"],
  ["OPEN", "RESOLVED"],
  ["OPEN", "CANCELLED"],
  ["IN_PROGRESS", "OPEN"],
  ["IN_PROGRESS", "WAITING_FOR_REQUESTER"],
  ["IN_PROGRESS", "RESOLVED"],
  ["IN_PROGRESS", "CANCELLED"],
  ["WAITING_FOR_REQUESTER", "IN_PROGRESS"],
  ["WAITING_FOR_REQUESTER", "RESOLVED"],
  ["WAITING_FOR_REQUESTER", "CANCELLED"],
  ["RESOLVED", "CLOSED"],
  ["RESOLVED", "REOPENED"],
  ["CLOSED", "REOPENED"],
  ["REOPENED", "OPEN"],
  ["REOPENED", "IN_PROGRESS"],
  ["REOPENED", "WAITING_FOR_REQUESTER"],
  ["REOPENED", "RESOLVED"],
  ["REOPENED", "CANCELLED"],
];

const REQUESTER_ALLOWED: [TicketStatus, TicketStatus][] = [
  ["WAITING_FOR_REQUESTER", "OPEN"],
];

function allowedSet(
  pairs: [TicketStatus, TicketStatus][],
  from: TicketStatus
): TicketStatus[] {
  return pairs.filter(([f]) => f === from).map(([, t]) => t);
}

describe("UNIT-03 status transition matrix (§5.3)", () => {
  it("isStaffRole distinguishes the Staff role group from Requester", () => {
    expect(isStaffRole(UserRole.IT_STAFF)).toBe(true);
    expect(isStaffRole(UserRole.ADMIN)).toBe(true);
    expect(isStaffRole(UserRole.REQUESTER)).toBe(false);
  });

  it("getPermittedTransitions returns the staff moves for IT_STAFF and ADMIN", () => {
    for (const from of ALL_STATUSES) {
      const expected = allowedSet(STAFF_ALLOWED, from);
      expect(getPermittedTransitions(from, UserRole.IT_STAFF)).toEqual(expected);
      expect(getPermittedTransitions(from, UserRole.ADMIN)).toEqual(expected);
    }
  });

  it("getPermittedTransitions returns the requester moves (WFO -> OPEN only)", () => {
    for (const from of ALL_STATUSES) {
      const expected = allowedSet(REQUESTER_ALLOWED, from);
      expect(getPermittedTransitions(from, UserRole.REQUESTER)).toEqual(expected);
    }
  });

  it("canTransition allows exactly the positive matrix moves", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const staffExpected = STAFF_ALLOWED.some(
          ([f, t]) => f === from && t === to
        );
        expect(canTransition(from, to, UserRole.IT_STAFF)).toBe(staffExpected);
        expect(canTransition(from, to, UserRole.ADMIN)).toBe(staffExpected);

        const requesterExpected = REQUESTER_ALLOWED.some(
          ([f, t]) => f === from && t === to
        );
        expect(canTransition(from, to, UserRole.REQUESTER)).toBe(
          requesterExpected
        );
      }
    }
  });

  it("rejects AC-12-style disallowed moves (NEW->CLOSED, CANCELLED->OPEN)", () => {
    expect(canTransition("NEW", "CLOSED", UserRole.IT_STAFF)).toBe(false);
    expect(canTransition("CANCELLED", "OPEN", UserRole.IT_STAFF)).toBe(false);
    expect(canTransition("RESOLVED", "OPEN", UserRole.IT_STAFF)).toBe(false);
  });

  it("has no side effects (returned arrays are fresh copies)", () => {
    const a = getPermittedTransitions("OPEN", UserRole.IT_STAFF);
    a.push("CLOSED");
    const b = getPermittedTransitions("OPEN", UserRole.IT_STAFF);
    expect(b).not.toContain("CLOSED");
    expect(getPermittedTransitions("OPEN", UserRole.IT_STAFF)).toEqual([
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ]);
  });
});