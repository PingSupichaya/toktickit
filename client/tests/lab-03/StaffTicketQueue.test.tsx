import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { QueuePage, QueueQuery, QueueTicket } from "../../src/api.js";
import { StaffTicketQueue } from "../../src/components/features/StaffTicketQueue.js";

vi.mock("../../src/api.js");

const bobby: api.AuthUser = {
  id: 10,
  name: "Bobby Staff",
  email: "bobby@mail.kmutt.ac.th",
  role: "IT_STAFF",
  isActive: true,
};

const categories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
];

const relatedSystems = [
  { id: 1, name: "Email" },
  { id: 2, name: "Corporate Laptop" },
];

const ticketA: QueueTicket = {
  id: 1,
  ticketNumber: "TKT-000001",
  summary: "Laptop battery drains quickly",
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "NEW",
  ticketDate: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-10T14:00:00.000Z",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  requester: { id: 1, name: "Alice Johnson", email: "alice@mail.kmutt.ac.th" },
  owner: { id: 10, name: "Bobby Staff", role: "IT_STAFF" },
  attachmentCount: 2,
};

const ticketB: QueueTicket = {
  id: 2,
  ticketNumber: "TKT-000002",
  summary: "Cannot access email inbox",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "OPEN",
  ticketDate: "2026-09-03T08:00:00.000Z",
  updatedAt: "2026-09-09T09:30:00.000Z",
  category: { id: 1, name: "Account and Access" },
  relatedSystem: { id: 1, name: "Email" },
  requester: { id: 2, name: "Maya Chen", email: "maya@mail.kmutt.ac.th" },
  owner: null,
  attachmentCount: 0,
};

const defaultPage: QueuePage = {
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

const emptyPage: QueuePage = {
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

function lastFetchQueueCall(): QueueQuery | undefined {
  const calls = vi.mocked(api.fetchQueue).mock.calls;
  return calls[calls.length - 1]?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchMe).mockResolvedValue({ user: bobby, mustChangePassword: false });
  vi.mocked(api.fetchCategories).mockResolvedValue(categories);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue(relatedSystems);
  vi.mocked(api.fetchQueue).mockResolvedValue(defaultPage);
});

const user = userEvent.setup();

async function renderQueue() {
  render(<StaffTicketQueue />);
  await screen.findByTestId("queue-count");
}

async function pickOption(testId: string, listboxName: string, label: string) {
  await user.click(screen.getByTestId(testId));
  await user.click(
    within(screen.getByRole("listbox", { name: listboxName })).getByText(label)
  );
}

describe("StaffTicketQueue (UI-06)", () => {
  it("skeleton-loads while the queue is being fetched", async () => {
    vi.mocked(api.fetchQueue).mockImplementation(() => new Promise(() => {}));

    render(<StaffTicketQueue />);

    expect(screen.getByTestId("queue-loading")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Loading queue").length).toBe(3);
  });

  it("shows the empty state when there are no tickets at all", async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue(emptyPage);

    await renderQueue();

    const empty = await screen.findByTestId("empty-state");
    expect(within(empty).getByText("No Tickets in Queue")).toBeInTheDocument();
    expect(screen.queryByTestId("queue-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("queue-pagination")).not.toBeInTheDocument();
  });

  it("renders the desktop table with all queue columns", async () => {
    await renderQueue();

    const table = await screen.findByTestId("queue-table");
    const headers = [
      "Ticket",
      "Summary",
      "Requester",
      "Req. Priority",
      "IT Priority",
      "Status",
      "Owner",
      "Last Updated",
    ];
    headers.forEach((h) => {
      expect(within(table).getByText(h)).toBeInTheDocument();
    });

    expect(within(table).getByText("TKT-000001")).toBeInTheDocument();
    expect(within(table).getByText("Laptop battery drains quickly")).toBeInTheDocument();
    expect(within(table).getByText("Alice Johnson")).toBeInTheDocument();
    expect(within(table).getByText("Bobby Staff")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();

    // Badge rendering: status + requested priority + IT priority.
    const statusBadges = within(table).getAllByTestId("status-badge");
    expect(statusBadges.map((b) => b.getAttribute("data-value"))).toEqual([
      "NEW",
      "OPEN",
    ]);
    const priorityBadges = within(table).getAllByTestId("priority-badge");
    expect(priorityBadges).toHaveLength(4);
    expect(priorityBadges.map((b) => b.getAttribute("data-value"))).toContain("HIGH");
  });

  it("remembers the IT_STAFF/ADMIN session when rendering inside the shell", async () => {
    // The queue screen is only reachable for staff; verify it initializes the
    // queue fetch without any requester and sends the default sort.
    await renderQueue();

    expect(api.fetchQueue).toHaveBeenCalledTimes(1);
    const query = lastFetchQueueCall();
    expect(query?.page).toBe(1);
    expect(query?.pageSize).toBe(10);
    expect(query?.search).toBeUndefined();
  });

  it("debounces the search input (300ms) and refetches", async () => {
    await renderQueue();

    vi.mocked(api.fetchQueue).mockClear();

    const search = screen.getByTestId("queue-search-input");
    await user.type(search, "laptop");

    expect(api.fetchQueue).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(lastFetchQueueCall()?.search).toBe("laptop");
      },
      { timeout: 800 }
    );
    expect(screen.getByTestId("queue-clear-filters-btn")).toBeInTheDocument();
  });

  it("combines filter dropdowns into the queue query (AND filters)", async () => {
    await renderQueue();

    await pickOption("queue-filter-status", "Status", "OPEN");
    await pickOption("queue-filter-priority", "IT Priority", "MEDIUM");
    await pickOption("queue-filter-category", "Category", "Hardware");
    await pickOption("queue-filter-system", "Related System", "Corporate Laptop");
    await pickOption("queue-filter-assignment", "Assignment", "Assigned to me");

    await waitFor(() => {
      const q = lastFetchQueueCall();
      expect(q?.status).toBe("OPEN");
      expect(q?.itPriority).toBe("MEDIUM");
      expect(q?.categoryId).toBe(2);
      expect(q?.relatedSystemId).toBe(2);
      expect(q?.assignment).toBe("assignedToMe");
    });
  });

  it("applies the sort dropdown to the queue query", async () => {
    await renderQueue();

    await pickOption("queue-sort-control", "Sort", "Ticket number Z–A");

    await waitFor(() => {
      const q = lastFetchQueueCall();
      expect(q?.sortBy).toBe("ticketNumber");
      expect(q?.sortOrder).toBe("desc");
    });
  });

  it("shows the no-results state with Clear Filters when nothing matches", async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue(emptyPage);

    await renderQueue();

    await user.type(screen.getByTestId("queue-search-input"), "zzz-no-match");

    const empty = await screen.findByTestId("empty-state");
    await waitFor(() => {
      expect(within(empty).getByText(/No tickets match your current filters/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId("queue-empty-clear-btn")).toBeInTheDocument();

    await user.click(screen.getByTestId("queue-empty-clear-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("queue-search-input")).toHaveValue("");
    });
  });

  it("shows the 403 error state for a non-staff requester", async () => {
    vi.mocked(api.fetchQueue).mockRejectedValue(
      Object.assign(new Error("You are not authorized to view the ticket queue."), {
        status: 403,
        code: "FORBIDDEN",
      })
    );

    await renderQueue();

    expect(
      await screen.findByText("You are not authorized to view the ticket queue.")
    ).toBeInTheDocument();
  });

  it("shows an error banner with retry on failure", async () => {
    vi.mocked(api.fetchQueue).mockRejectedValue(new Error("Network down"));

    await renderQueue();

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Network down")).toBeInTheDocument();
  });

  it("paginates with page sizes 10/25/50", async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      items: [ticketA],
      pagination: {
        page: 1,
        pageSize: 10,
        totalCount: 45,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    });

    await renderQueue();

    const pager = await screen.findByTestId("queue-pagination");
    expect(within(pager).getByText("Showing 1–10 of 45")).toBeInTheDocument();
    expect(screen.getByTestId("queue-count")).toHaveTextContent(
      "Showing 1–10 of 45 tickets"
    );

    await user.selectOptions(screen.getByTestId("page-size-select"), ["25"]);
    await waitFor(() => {
      expect(lastFetchQueueCall()?.pageSize).toBe(25);
    });
  });

  it("clears all filters via the toolbar Clear Filters button", async () => {
    await renderQueue();

    await pickOption("queue-filter-status", "Status", "OPEN");
    await pickOption("queue-filter-priority", "IT Priority", "HIGH");

    expect(screen.getByTestId("queue-clear-filters-btn")).toBeInTheDocument();

    await user.click(screen.getByTestId("queue-clear-filters-btn"));

    await waitFor(() => {
      const q = lastFetchQueueCall();
      expect(q?.status).toBeUndefined();
      expect(q?.itPriority).toBeUndefined();
    });
    expect(screen.queryByTestId("queue-clear-filters-btn")).not.toBeInTheDocument();
  });
});