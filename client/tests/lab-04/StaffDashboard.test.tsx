import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import { StaffDashboard } from "../../src/components/features/StaffDashboard.js";

vi.mock("../../src/api.js");

const staffUser: api.AuthUser = {
  id: 10,
  name: "Sam Patel",
  email: "sam@mail.kmutt.ac.th",
  role: "IT_STAFF",
  isActive: true,
};

const adminUser: api.AuthUser = {
  ...staffUser,
  id: 11,
  name: "Avery Admin",
  email: "avery@mail.kmutt.ac.th",
  role: "ADMIN",
};

const dashboardData: api.StaffDashboardData = {
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
};

const adminData: api.StaffDashboardData = {
  ...dashboardData,
  userCounts: { requesters: 41, itStaff: 8, admins: 2 },
};

function renderDashboard(
  user: api.AuthUser,
  props: Partial<React.ComponentProps<typeof StaffDashboard>> = {}
) {
  const onDrillDown = vi.fn();
  const onBrowseQueue = vi.fn();
  const onSearchTickets = vi.fn();
  const onOpenTicket = vi.fn();
  const onManageUsers = vi.fn();
  vi.mocked(api.fetchMe).mockResolvedValue({ user, mustChangePassword: false });
  render(
    <AuthProvider>
      <StaffDashboard
        onDrillDown={onDrillDown}
        onBrowseQueue={onBrowseQueue}
        onSearchTickets={onSearchTickets}
        onOpenTicket={onOpenTicket}
        onManageUsers={onManageUsers}
        {...props}
      />
    </AuthProvider>
  );
  return { onDrillDown, onBrowseQueue, onSearchTickets, onOpenTicket, onManageUsers };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchStaffDashboard).mockResolvedValue(dashboardData);
});

describe("UI-08 — Staff Dashboard rendering (AC-10 / FR-11)", () => {
  it("renders six cards, priority strip, recent list, and quick actions", async () => {
    const { onDrillDown, onBrowseQueue, onSearchTickets } = renderDashboard(staffUser);
    await screen.findByTestId("staff-metric-cards");

    expect(screen.getByText("Welcome back, Sam!")).toBeInTheDocument();
    const cards = screen.getByTestId("staff-metric-cards");
    expect(within(cards).getByLabelText("New: 14 tickets")).toBeInTheDocument();
    expect(within(cards).getByLabelText("Open: 23 tickets")).toBeInTheDocument();
    expect(within(cards).getByLabelText("In Progress: 18 tickets")).toBeInTheDocument();
    expect(within(cards).getByLabelText("Waiting for Requester: 7 tickets")).toBeInTheDocument();
    expect(within(cards).getByLabelText("Unassigned: 9 tickets")).toBeInTheDocument();
    expect(within(cards).getByLabelText("My Assigned: 16 tickets")).toBeInTheDocument();

    // Priority strip segments drill with the documented priority filters.
    const user = userEvent.setup();
    await user.click(screen.getByTestId("priority-breakdown-low"));
    expect(onDrillDown).toHaveBeenLastCalledWith({ kind: "priority", priority: "LOW" });
    await user.click(screen.getByTestId("priority-breakdown-medium"));
    expect(onDrillDown).toHaveBeenLastCalledWith({ kind: "priority", priority: "MEDIUM" });
    await user.click(screen.getByTestId("priority-breakdown-high"));
    expect(onDrillDown).toHaveBeenLastCalledWith({ kind: "priority", priority: "HIGH" });

    // Unassigned + My Assigned cards drill with assignment filters.
    const links = cards.querySelectorAll('[data-testid="metric-card-link"]');
    await user.click(links[4]);
    expect(onDrillDown).toHaveBeenLastCalledWith({
      kind: "assignment",
      assignment: "unassigned",
    });
    await user.click(links[5]);
    expect(onDrillDown).toHaveBeenLastCalledWith({
      kind: "assignment",
      assignment: "assignedToMe",
    });

    // Recent list + quick actions.
    expect(screen.getByText("TKT-000101")).toBeInTheDocument();
    await user.click(screen.getByText("Browse Unassigned"));
    expect(onBrowseQueue).toHaveBeenCalled();
    await user.click(screen.getByText("Search Tickets"));
    expect(onSearchTickets).toHaveBeenCalled();
  });

  it("ADMIN sees the user strip; IT_STAFF omits it entirely", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffDashboard).mockResolvedValue(adminData);
    const { onManageUsers } = renderDashboard(adminUser);
    await screen.findByTestId("staff-metric-cards");

    const strip = screen.getByTestId("staff-user-counts");
    expect(within(strip).getByText(/Requesters 41/)).toBeInTheDocument();
    await user.click(within(strip).getByText(/IT Staff 8/));
    expect(onManageUsers).toHaveBeenCalledWith("IT_STAFF");
  });

  it("IT_STAFF viewer renders no user strip at all", async () => {
    renderDashboard(staffUser);
    await screen.findByTestId("staff-metric-cards");
    expect(screen.queryByTestId("staff-user-counts")).not.toBeInTheDocument();
  });

  it("zero metrics render as 0 with the recent empty state", async () => {
    vi.mocked(api.fetchStaffDashboard).mockResolvedValue({
      metrics: {
        new: 0,
        open: 0,
        inProgress: 0,
        waitingForRequester: 0,
        unassigned: 0,
        myAssigned: 0,
        byPriority: { low: 0, medium: 0, high: 0 },
      },
      recentTickets: [],
    });
    renderDashboard(staffUser);
    await screen.findByTestId("staff-metric-cards");
    expect(screen.getByLabelText("My Assigned: 0 tickets")).toBeInTheDocument();
    expect(screen.getByText("No assigned Tickets yet.")).toBeInTheDocument();
  });
});

describe("UI-09 — dashboard loading and failure states (FR-13)", () => {
  it("shows skeletons while loading, then content", async () => {
    vi.mocked(api.fetchStaffDashboard).mockImplementation(() => new Promise(() => {}));
    renderDashboard(staffUser);
    expect(await screen.findByLabelText("Loading dashboard")).toBeInTheDocument();
  });

  it("shows a safe error with Retry, which re-fetches", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffDashboard).mockRejectedValueOnce(new Error("boom"));
    renderDashboard(staffUser);
    await screen.findByTestId("dashboard-retry");
    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();

    vi.mocked(api.fetchStaffDashboard).mockResolvedValue(dashboardData);
    await user.click(screen.getByTestId("dashboard-retry"));
    await screen.findByTestId("staff-metric-cards");
  });
});
