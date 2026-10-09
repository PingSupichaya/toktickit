import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import { RequesterDashboard } from "../../src/components/features/RequesterDashboard.js";

vi.mock("../../src/api.js");

const requesterUser: api.AuthUser = {
  id: 1,
  name: "Jennifer Lee",
  email: "jen@mail.kmutt.ac.th",
  role: "REQUESTER",
  isActive: true,
};

const dashboardData: api.RequesterDashboardData = {
  metrics: { myOpenTickets: 3, waitingOnYou: 1, resolved: 5, closed: 12 },
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

const emptyData: api.RequesterDashboardData = {
  metrics: { myOpenTickets: 0, waitingOnYou: 0, resolved: 0, closed: 0 },
  recentTickets: [],
};

function renderDashboard(props: Partial<React.ComponentProps<typeof RequesterDashboard>> = {}) {
  const onDrillDown = vi.fn();
  const onCreateTicket = vi.fn();
  const onOpenTicket = vi.fn();
  render(
    <AuthProvider>
      <RequesterDashboard
        onDrillDown={onDrillDown}
        onCreateTicket={onCreateTicket}
        onOpenTicket={onOpenTicket}
        {...props}
      />
    </AuthProvider>
  );
  return { onDrillDown, onCreateTicket, onOpenTicket };
}

beforeEach(() => {
  vi.clearAllMocks();
  // vi.mock() replaces every export including const arrays — restore it.
  (api as { REQUESTER_OPEN_STATUSES?: readonly string[] }).REQUESTER_OPEN_STATUSES = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "REOPENED",
  ];
  vi.mocked(api.fetchMe).mockResolvedValue({
    user: requesterUser,
    mustChangePassword: false,
  });
  vi.mocked(api.fetchRequesterDashboard).mockResolvedValue(dashboardData);
});

describe("UI-07 — Requester Dashboard rendering (AC-02, AC-11 / FR-10)", () => {
  it("renders the welcome header, four metric cards, and recent tickets", async () => {
    renderDashboard();
    await screen.findByTestId("requester-metric-cards");

    expect(screen.getByText("Welcome, Jennifer!")).toBeInTheDocument();
    const cards = within(screen.getByTestId("requester-metric-cards"));
    expect(cards.getByLabelText("My Open Tickets: 3 tickets")).toBeInTheDocument();
    expect(cards.getByLabelText("Waiting on You: 1 tickets")).toBeInTheDocument();
    expect(cards.getByLabelText("Resolved: 5 tickets")).toBeInTheDocument();
    expect(cards.getByLabelText("Closed: 12 tickets")).toBeInTheDocument();

    const recent = screen.getByTestId("requester-recent-tickets");
    expect(within(recent).getByText("TKT-000101")).toBeInTheDocument();
    expect(within(recent).getByText("Laptop battery drains quickly")).toBeInTheDocument();
  });

  it("zero metrics render as 0 with the empty state, not blank", async () => {
    vi.mocked(api.fetchRequesterDashboard).mockResolvedValue(emptyData);
    renderDashboard();
    await screen.findByTestId("requester-metric-cards");

    const cards = within(screen.getByTestId("requester-metric-cards"));
    expect(cards.getByLabelText("My Open Tickets: 0 tickets")).toBeInTheDocument();
    expect(screen.getByText("No tickets submitted yet.")).toBeInTheDocument();
  });

  it("metric drill-down links carry the documented status groups", async () => {
    const user = userEvent.setup();
    const { onDrillDown } = renderDashboard();
    await screen.findByTestId("requester-metric-cards");

    const cards = screen
      .getByTestId("requester-metric-cards")
      .querySelectorAll('[data-testid="metric-card-link"]');
    expect(cards).toHaveLength(4);
    await user.click(cards[0]);
    expect(onDrillDown).toHaveBeenLastCalledWith(["NEW", "OPEN", "IN_PROGRESS", "REOPENED"]);
    await user.click(cards[1]);
    expect(onDrillDown).toHaveBeenLastCalledWith(["WAITING_FOR_REQUESTER"]);
    await user.click(cards[2]);
    expect(onDrillDown).toHaveBeenLastCalledWith(["RESOLVED"]);
    await user.click(cards[3]);
    expect(onDrillDown).toHaveBeenLastCalledWith(["CLOSED"]);
  });

  it("recent View-all opens the unfiltered list; ticket number opens detail", async () => {
    const user = userEvent.setup();
    const { onDrillDown, onOpenTicket } = renderDashboard();
    await screen.findByTestId("requester-recent-tickets");

    await user.click(screen.getByTestId("recent-view-all-link"));
    expect(onDrillDown).toHaveBeenCalledWith(null);
    await user.click(screen.getByText("TKT-000101"));
    expect(onOpenTicket).toHaveBeenCalledWith(101);
  });

  it("refresh re-fetches without a reload; failure shows retry", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByTestId("requester-metric-cards");
    expect(api.fetchRequesterDashboard).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("dashboard-refresh-btn"));
    await waitFor(() =>
      expect(api.fetchRequesterDashboard).toHaveBeenCalledTimes(2)
    );

    vi.mocked(api.fetchRequesterDashboard).mockRejectedValueOnce(
      new Error("boom")
    );
    await user.click(screen.getByTestId("dashboard-refresh-btn"));
    await screen.findByTestId("dashboard-retry");
  });
});
