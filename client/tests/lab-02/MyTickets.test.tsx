import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { TicketPage, TicketQuery, TicketSummary } from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
];

const categories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
];

const relatedSystems = [
  { id: 1, name: "Email" },
  { id: 2, name: "Campus Wi-Fi" },
];

const ticketA: TicketSummary = {
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
};

const ticketB: TicketSummary = {
  id: 2,
  ticketNumber: "TKT-000002",
  summary: "Cannot access email inbox",
  description: "Login keeps failing.",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  ticketDate: "2026-09-03T08:00:00.000Z",
  category: { id: 1, name: "Account and Access" },
  relatedSystem: { id: 1, name: "Email" },
  attachmentCount: 0,
};

const defaultPage: TicketPage = {
  items: [ticketA, ticketB],
  pagination: {
    page: 1,
    pageSize: 10,
    totalCount: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const emptyPage: TicketPage = {
  items: [],
  pagination: {
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

function lastFetchTicketsCall(): TicketQuery | undefined {
  const calls = vi.mocked(api.fetchTickets).mock.calls;
  return calls[calls.length - 1]?.[0];
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
  vi.mocked(api.fetchCategories).mockResolvedValue(categories);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue(relatedSystems);
  vi.mocked(api.fetchTickets).mockResolvedValue(defaultPage);
});

const user = userEvent.setup();

async function openMyTickets() {
  localStorage.setItem(
    "toktickit.requester",
    JSON.stringify({ id: 1, name: "Alice Johnson", email: "alice@example.com" })
  );
  render(<App />);
  await waitFor(() => {
    expect(document.querySelector(".app-header__user-name")?.textContent).toBe(
      "Alice Johnson"
    );
  });
}

async function pickOption(testId: string, listboxName: string, label: string) {
  await user.click(screen.getByTestId(testId));
  await user.click(
    within(screen.getByRole("listbox", { name: listboxName })).getByText(label)
  );
}

describe("MyTickets (T-014)", () => {
  it("shows skeleton loading while tickets are being fetched", async () => {
    vi.mocked(api.fetchTickets).mockImplementation(() => new Promise(() => {}));

    await openMyTickets();

    expect(screen.getByTestId("ticket-list-loading")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Loading tickets").length).toBe(3);
  });

  it("shows the empty state when the requester has no tickets (AC-05)", async () => {
    vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);

    await openMyTickets();

    const empty = await screen.findByTestId("empty-state");
    expect(within(empty).getByText("No Tickets Yet")).toBeInTheDocument();
    expect(
      within(empty).getByText("You haven't created any tickets.")
    ).toBeInTheDocument();
    expect(within(empty).getByTestId("empty-create-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("pagination")).not.toBeInTheDocument();
  });

  it("fetches and renders only the current requester's tickets (AC-05 / FR-15)", async () => {
    await openMyTickets();

    const list = await screen.findByTestId("ticket-list");
    expect(within(list).getByText("TKT-000001")).toBeInTheDocument();
    expect(
      within(list).getByText("Laptop battery drains quickly")
    ).toBeInTheDocument();

    const statusBadges = within(list).getAllByTestId("status-badge");
    expect(statusBadges[0]).toHaveTextContent("NEW");
    expect(statusBadges[0]).toHaveAttribute("data-value", "NEW");
    expect(statusBadges).toHaveLength(2);

    const priorityBadges = within(list).getAllByTestId("priority-badge");
    expect(priorityBadges[0]).toHaveTextContent("HIGH");
    expect(priorityBadges[0]).toHaveAttribute("data-value", "HIGH");

    expect(within(list).getByText("📎 2")).toBeInTheDocument();
    expect(within(list).getByText("Campus Wi-Fi")).toBeInTheDocument();

    expect(lastFetchTicketsCall()?.requesterId).toBe(1);
    expect(
      screen.getByRole("button", { name: "Open ticket TKT-000001" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("ticket-count")).toHaveTextContent(
      "Showing 1–2 of 2 tickets"
    );
  });

  it("debounces the search input and refetches with a search term", async () => {
    await openMyTickets();
    await screen.findByTestId("ticket-list");

    const search = screen.getByTestId("search-input");
    expect(search).toHaveAttribute("placeholder", "Search tickets…");

    await user.type(search, "battery");

    await waitFor(
      () => {
        expect(lastFetchTicketsCall()?.search).toBe("battery");
      },
      { timeout: 1500 }
    );
  });

  it("applies the selected Status and Category filters to the refetch", async () => {
    await openMyTickets();
    await screen.findByTestId("ticket-list");

    await pickOption("filter-status", "Status", "NEW");
    await waitFor(() => {
      expect(lastFetchTicketsCall()?.status).toBe("NEW");
    });

    await pickOption("filter-category", "Category", "Hardware");
    await waitFor(() => {
      expect(lastFetchTicketsCall()?.categoryId).toBe(2);
    });

    await pickOption("filter-priority", "Priority", "HIGH");
    await waitFor(() => {
      expect(lastFetchTicketsCall()?.priority).toBe("HIGH");
    });
  });

  it("applies the selected Sort option to the refetch", async () => {
    await openMyTickets();
    await screen.findByTestId("ticket-list");

    await user.click(screen.getByTestId("sort-control"));
    await user.click(
      within(screen.getByRole("listbox", { name: "Sort" })).getByText(
        "Oldest first"
      )
    );

    await waitFor(() => {
      expect(lastFetchTicketsCall()?.sortBy).toBe("ticketDate");
      expect(lastFetchTicketsCall()?.sortOrder).toBe("asc");
    });
  });

  it("shows the Clear Filters button only when a filter is active and clears it", async () => {
    await openMyTickets();
    await screen.findByTestId("ticket-list");

    expect(screen.queryByTestId("clear-filters-btn")).not.toBeInTheDocument();

    await pickOption("filter-status", "Status", "NEW");
    expect(await screen.findByTestId("clear-filters-btn")).toBeInTheDocument();

    await user.click(screen.getByTestId("clear-filters-btn"));
    expect(screen.queryByTestId("clear-filters-btn")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(lastFetchTicketsCall()?.status).toBeUndefined();
    });
  });

  it("shows the No Results empty state when search/filters match nothing (AC-08)", async () => {
    vi.mocked(api.fetchTickets).mockImplementation(async (query) =>
      query.search === "zzz-not-found" ? emptyPage : defaultPage
    );

    await openMyTickets();
    await screen.findByTestId("ticket-list");

    await user.type(screen.getByTestId("search-input"), "zzz-not-found");

    const empty = await screen.findByTestId("empty-state");
    expect(within(empty).getByText("No Results")).toBeInTheDocument();
    expect(
      within(empty).getByText("No tickets match your search or filters.")
    ).toBeInTheDocument();
    expect(within(empty).getByTestId("empty-clear-btn")).toBeInTheDocument();

    await user.click(within(empty).getByTestId("empty-clear-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("ticket-list")).toBeInTheDocument();
    });
  });

  it("renders pagination with Prev/Next and page size selection", async () => {
    const multiPage: TicketPage = {
      items: [ticketA, ticketB],
      pagination: {
        page: 1,
        pageSize: 10,
        totalCount: 45,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    };
    vi.mocked(api.fetchTickets).mockResolvedValue(multiPage);

    await openMyTickets();

    const pagination = await screen.findByTestId("pagination");
    expect(pagination).toHaveTextContent("Showing 1–10 of 45");

    const nextBtn = within(pagination).getByRole("button", { name: "Next ›" });
    const prevBtn = within(pagination).getByRole("button", { name: "‹ Prev" });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);
    await waitFor(() => {
      expect(lastFetchTicketsCall()?.page).toBe(2);
    });

    await user.selectOptions(screen.getByTestId("page-size-select"), "25");
    await waitFor(() => {
      const call = lastFetchTicketsCall();
      expect(call?.pageSize).toBe(25);
      expect(call?.page).toBe(1);
    });
  });

  it("navigates to the Create Ticket form from the empty state", async () => {
    vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);

    await openMyTickets();
    await screen.findByTestId("empty-state");

    await user.click(screen.getByTestId("empty-create-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("submit-btn")).toBeInTheDocument();
    });
  });
});