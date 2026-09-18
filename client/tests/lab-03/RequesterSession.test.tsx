import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { TicketQuery, TicketPage } from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const alice: api.AuthUser = {
  id: 1,
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "REQUESTER",
  isActive: true,
};

const categories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
];

const relatedSystems = [
  { id: 1, name: "Email" },
  { id: 2, name: "Campus Wi-Fi" },
];

const defaultPage: TicketPage = {
  items: [
    {
      id: 1,
      ticketNumber: "TKT-000001",
      summary: "Laptop battery drains quickly",
      description: "Battery lasts only two hours.",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      ticketDate: "2026-09-04T10:30:00.000Z",
      category: { id: 2, name: "Hardware" },
      relatedSystem: { id: 2, name: "Campus Wi-Fi" },
      attachmentCount: 2,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 10,
    totalCount: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

function lastFetchTicketsCall(): TicketQuery | undefined {
  return vi.mocked(api.fetchTickets).mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchMe).mockResolvedValue({ user: alice, mustChangePassword: false });
  vi.mocked(api.fetchCategories).mockResolvedValue(categories);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue(relatedSystems);
  vi.mocked(api.fetchTickets).mockResolvedValue(defaultPage);
  vi.mocked(api.fetchTicketDetail).mockResolvedValue({
    id: 1,
    ticketNumber: "TKT-000001",
    submittedById: 1,
    submitter: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
    categoryId: 2,
    category: { id: 2, name: "Hardware" },
    relatedSystemId: 2,
    relatedSystem: { id: 2, name: "Campus Wi-Fi" },
    summary: "Laptop battery drains quickly",
    description: "Battery lasts only two hours.",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    ticketDate: "2026-09-04T10:30:00.000Z",
    createdAt: "2026-09-04T10:30:00.000Z",
    updatedAt: "2026-09-04T10:30:00.000Z",
    attachments: [],
    comments: [],
  });
  vi.mocked(api.formatTicketDate).mockImplementation(() => "4 Sep 2026");
});

const user = userEvent.setup();

describe("Requester regression under the authenticated session (UI-10 - AC-20)", () => {
  it("renders My Tickets with the session identity and exposes all 8 status filters", async () => {
    render(<App />);

    await waitFor(() => {
      expect(document.querySelector(".app-header__user-name")?.textContent).toBe(
        "Alice Johnson"
      );
    });
    expect(screen.getByTestId("role-badge")).toHaveAttribute(
      "data-value",
      "REQUESTER"
    );

    // The list is queried server-side under the session; no client requesterId.
    const q = lastFetchTicketsCall();
    expect(q).toBeDefined();
    expect(Object.keys(q ?? {})).not.toContain("requesterId");

    await user.click(screen.getByTestId("filter-status"));
    const listbox = screen.getByRole("listbox", { name: "Status" });
    const labels = within(listbox)
      .getAllByRole("option")
      .map((o) => o.textContent);
    for (const status of [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
      "CANCELLED",
    ]) {
      expect(labels).toContain(status);
    }
  });

  it("fetches the Ticket Detail with only the ticket id (owner scoped server-side)", async () => {
    render(<App />);

    await waitFor(() => {
      expect(document.querySelector(".app-header__user-name")?.textContent).toBe(
        "Alice Johnson"
      );
    });

    await user.click(screen.getByRole("button", { name: "Open ticket TKT-000001" }));

    await waitFor(() => {
      expect(screen.getByTestId("ticket-detail-number")).toBeInTheDocument();
    });
    expect(vi.mocked(api.fetchTicketDetail)).toHaveBeenCalledWith(1);
  });
});