// Lab 4 dashboard metric predicates (docs/lab-04/specification.md BR-14,
// BR-15). Pure functions over minimal row shapes, covered by UNIT-04. The
// routes evaluate the same predicates as Prisma counts/queries (efficient at
// scale); these helpers pin the exact counting semantics in unit tests.

export type DashboardStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export type DashboardRole = "REQUESTER" | "IT_STAFF" | "ADMIN";
export type DashboardPriority = "LOW" | "MEDIUM" | "HIGH";

export interface MetricTicket {
  currentStatus: DashboardStatus;
  submittedById: number;
  ownerId: number | null;
  itPriority: DashboardPriority;
}

// Terminal statuses excluded from every "active" metric (BR-15).
const TERMINAL_STATUSES: ReadonlySet<DashboardStatus> = new Set([
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
]);

export function isActiveStatus(status: DashboardStatus): boolean {
  return !TERMINAL_STATUSES.has(status);
}

export interface RequesterMetrics {
  myOpenTickets: number;
  waitingOnYou: number;
  resolved: number;
  closed: number;
}

const REQUESTER_OPEN: ReadonlySet<DashboardStatus> = new Set([
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "REOPENED",
]);

// BR-14: counts over Tickets where submittedById = the caller.
export function countRequesterMetrics(
  tickets: MetricTicket[],
  userId: number
): RequesterMetrics {
  const own = tickets.filter((t) => t.submittedById === userId);
  return {
    myOpenTickets: own.filter((t) => REQUESTER_OPEN.has(t.currentStatus)).length,
    waitingOnYou: own.filter((t) => t.currentStatus === "WAITING_FOR_REQUESTER").length,
    resolved: own.filter((t) => t.currentStatus === "RESOLVED").length,
    closed: own.filter((t) => t.currentStatus === "CLOSED").length,
  };
}

export interface StaffMetrics {
  new: number;
  open: number;
  inProgress: number;
  waitingForRequester: number;
  unassigned: number;
  myAssigned: number;
  byPriority: { low: number; medium: number; high: number };
}

// BR-15: queue-wide counts; ownership/priority slices as documented.
export function countStaffMetrics(
  tickets: MetricTicket[],
  userId: number
): StaffMetrics {
  const active = tickets.filter((t) => isActiveStatus(t.currentStatus));
  const byPriority = {
    low: active.filter((t) => t.itPriority === "LOW").length,
    medium: active.filter((t) => t.itPriority === "MEDIUM").length,
    high: active.filter((t) => t.itPriority === "HIGH").length,
  };
  return {
    new: tickets.filter((t) => t.currentStatus === "NEW").length,
    open: tickets.filter((t) => t.currentStatus === "OPEN").length,
    inProgress: tickets.filter((t) => t.currentStatus === "IN_PROGRESS").length,
    waitingForRequester: tickets.filter(
      (t) => t.currentStatus === "WAITING_FOR_REQUESTER"
    ).length,
    unassigned: active.filter((t) => t.ownerId === null).length,
    myAssigned: active.filter((t) => t.ownerId === userId).length,
    byPriority,
  };
}

export interface ActiveUserCounts {
  requesters: number;
  itStaff: number;
  admins: number;
}

// BR-15 userCounts: active users only, grouped by role.
export function countActiveUsersByRole(
  users: Array<{ role: DashboardRole; isActive: boolean }>
): ActiveUserCounts {
  const active = users.filter((u) => u.isActive);
  return {
    requesters: active.filter((u) => u.role === "REQUESTER").length,
    itStaff: active.filter((u) => u.role === "IT_STAFF").length,
    admins: active.filter((u) => u.role === "ADMIN").length,
  };
}
