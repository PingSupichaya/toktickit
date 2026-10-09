import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "../axeAudit.js";
import * as api from "../../src/api.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import { StaffDashboard } from "../../src/components/features/StaffDashboard.js";
import { RequesterDashboard } from "../../src/components/features/RequesterDashboard.js";
import { ActionsTakenPanel } from "../../src/components/features/ActionsTakenPanel.js";
import { StaffTicketDetail } from "../../src/components/features/StaffTicketDetail.js";

// ---------------------------------------------------------------------------
// UI-11 — automated accessibility audit for Lab 4 screens (ui-spec §10).
// axe-core (via jest-axe, see ../axeAudit.ts) over both dashboards, the
// Actions Taken list + create form, and the resolution-gate hint + conflict
// banner. `document.title` / `<html lang>` mirror client/index.html because
// component tests do not render the document shell. Color-contrast stays a
// manual spot-check (E2E-06 computes it in-browser): jsdom has no layout
// engine, so axe cannot evaluate real contrast ratios.
// ---------------------------------------------------------------------------

vi.mock("../../src/api.js");

const staffUser: api.AuthUser = {
  id: 10,
  name: "Sam Patel",
  email: "sam@mail.kmutt.ac.th",
  role: "IT_STAFF",
  isActive: true,
};

const requesterUser: api.AuthUser = {
  id: 1,
  name: "Jennifer Lee",
  email: "jen@mail.kmutt.ac.th",
  role: "REQUESTER",
  isActive: true,
};

const staffData: api.StaffDashboardData = {
  metrics: {
    new: 14,
    open: 23,
    inProgress: 18,
    waitingForRequester: 7,
    unassigned: 9,
    myAssigned: 16,
    byPriority: { low: 12, medium: 27, high: 6 },
  },
  recentTickets: [
    {
      id: 101,
      ticketNumber: "TKT-000101",
      summary: "Laptop battery drains quickly",
      currentStatus: "IN_PROGRESS",
      updatedAt: "2026-09-20T09:15:00.000Z",
    },
  ],
  userCounts: { requesters: 41, itStaff: 8, admins: 2 },
};

const requesterData: api.RequesterDashboardData = {
  metrics: { myOpenTickets: 0, waitingOnYou: 0, resolved: 0, closed: 0 },
  recentTickets: [],
};

const action: api.ActionTaken = {
  id: 501,
  ticketId: 42,
  actionAt: "2026-09-20T09:15:00.000Z",
  description: "Reseated the RAM and reran the diagnostic tool.",
  result: "Diagnostic passed.",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  performedBy: { id: 10, name: "Sam Patel", role: "IT_STAFF" },
  updatedBy: null,
  version: 1,
  createdAt: "2026-09-20T09:20:00.000Z",
  updatedAt: "2026-09-20T09:20:00.000Z",
};

const ticket: api.TicketDetail = {
  id: 42,
  ticketNumber: "TKT-000042",
  submittedById: 1,
  submitter: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  ownerId: 10,
  owner: { id: 10, name: "Sam Patel", role: "IT_STAFF" },
  categoryId: 2,
  category: { id: 2, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  summary: "Laptop battery drains quickly",
  description: "Battery lasts only two hours on a full charge.",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "OPEN",
  ticketDate: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-10T14:00:00.000Z",
  attachments: [],
  comments: [],
  notes: [],
  version: 3,
  canResolve: false,
  actionCount: 0,
  hasOutstandingFollowUp: false,
  canIndicateResolved: false,
  permittedStatusTransitions: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED"],
};

const noop = () => undefined;

function authValue(user: api.AuthUser) {
  return {
    status: "authenticated" as const,
    user,
    mustChangePassword: false,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.title = "TokTickIT";
  document.documentElement.setAttribute("lang", "en");
  vi.mocked(api.fetchMe).mockResolvedValue({ user: staffUser, mustChangePassword: false });
});

describe("UI-11 — Lab 4 axe audit", () => {
  it("Staff Dashboard (populated) has no axe violations", async () => {
    vi.mocked(api.fetchStaffDashboard).mockResolvedValue(staffData);
    const { container } = render(
      <AuthProvider>
        <main>
          <StaffDashboard
            onDrillDown={noop}
            onBrowseQueue={noop}
            onSearchTickets={noop}
            onOpenTicket={noop}
            onManageUsers={noop}
          />
        </main>
      </AuthProvider>
    );
    await screen.findByTestId("staff-metric-cards");

    await expectNoAxeViolations(container);
  });

  it("Requester Dashboard (empty) has no axe violations", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: requesterUser,
      mustChangePassword: false,
    });
    vi.mocked(api.fetchRequesterDashboard).mockResolvedValue(requesterData);
    const { container } = render(
      <AuthProvider>
        <main>
          <RequesterDashboard
            onDrillDown={noop}
            onCreateTicket={noop}
            onOpenTicket={noop}
          />
        </main>
      </AuthProvider>
    );
    await screen.findByTestId("requester-metric-cards");

    await expectNoAxeViolations(container);
  });

  it("Actions Taken list + create form have no axe violations", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchActionsTaken).mockResolvedValue([action]);
    const { container } = render(
      <AuthProvider>
        <main>
          <ActionsTakenPanel ticketId={42} />
        </main>
      </AuthProvider>
    );
    await screen.findByTestId("actions-taken-list");
    await expectNoAxeViolations(container);

    await user.click(screen.getByTestId("add-action-btn"));
    await screen.findByTestId("save-action-btn");
    await expectNoAxeViolations(container);
  });

  it("resolution-gate hint + stale-write conflict banner have no axe violations", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(ticket);
    vi.mocked(api.fetchEligibleOwners).mockResolvedValue([]);
    vi.mocked(api.downloadAttachmentUrl).mockReturnValue("/api/attachments/1/download");
    const current = { ...ticket, version: 4, itPriority: "HIGH" as const };
    vi.mocked(api.updateTicketOperational).mockRejectedValueOnce(
      Object.assign(new Error("Stale"), {
        status: 409,
        code: "STALE_UPDATE",
        details: { current },
      })
    );
    const { container } = render(
      <main>
        <StaffTicketDetail ticketId={42} onBack={noop} />
      </main>
    );
    await screen.findByTestId("operational-panel");

    // Gate hint renders while RESOLVED is listed but unsatisfiable.
    await screen.findByTestId("resolution-gate-hint");
    await expectNoAxeViolations(container);

    // Stale write surfaces the conflict banner and refreshed fields.
    await user.click(screen.getByTestId("status-select"));
    const listbox = within(screen.getByRole("listbox", { name: "Status" }));
    await user.click(listbox.getByText("IN_PROGRESS"));
    await user.click(screen.getByTestId("save-ticket-btn"));
    await screen.findByTestId("action-conflict-banner");
    await expectNoAxeViolations(container);
  });
});
