// Ticket status transition matrix (specification.md §5.3, BR-20). Pure
// functions shared by the PATCH /api/tickets/:ticketId route, the Ticket
// Detail `permittedStatusTransitions` helper, and the UNIT-03 unit tests.
// REQUESTS_TO_STAFF are the moves IT Staff / Administrator may make from a
// source status; REQUESTS_TO_REQUESTER are the moves a Requester may make
// (only WFO -> OPEN, BR-22).

import type { TicketStatus, UserRole } from "@prisma/client";
import { UserRole as Role } from "@prisma/client";

export const STATUS_TRANSITIONS_TO_STAFF: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export const STATUS_TRANSITIONS_TO_REQUESTER: Record<TicketStatus, TicketStatus[]> = {
  WAITING_FOR_REQUESTER: ["OPEN"],
  NEW: [],
  OPEN: [],
  IN_PROGRESS: [],
  RESOLVED: [],
  CLOSED: [],
  REOPENED: [],
  CANCELLED: [],
};

export function isStaffRole(role: UserRole): boolean {
  return role === Role.IT_STAFF || role === Role.ADMIN;
}

// Permitted "to" statuses for a source status and role (the matrix in §5.3).
// Always returns a fresh array so callers cannot mutate the matrix tables.
export function getPermittedTransitions(
  status: TicketStatus,
  role: UserRole
): TicketStatus[] {
  return isStaffRole(role)
    ? [...STATUS_TRANSITIONS_TO_STAFF[status]]
    : [...STATUS_TRANSITIONS_TO_REQUESTER[status]];
}

// Whether moving `from` -> `to` is allowed for `role` per the matrix.
export function canTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: UserRole
): boolean {
  return getPermittedTransitions(from, role).includes(to);
}