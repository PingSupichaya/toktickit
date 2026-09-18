import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import * as api from "../../src/api.js";
import App from "../../src/App.js";

// Mock the API module so no real fetch / network is attempted in tests.
vi.mock("../../src/api.js");

const alice: api.AuthUser = {
  id: 1,
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "REQUESTER",
  isActive: true,
};

const emptyPage: api.TicketPage = {
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchMe).mockRejectedValue(
    Object.assign(new Error("Unauthorized"), { status: 401 }) as never
  );
  vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);
  vi.mocked(api.fetchCategories).mockResolvedValue([]);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue([]);
});

describe("App", () => {
  it("renders the Login screen when there is no valid session", async () => {
    render(<App />);
    expect(await screen.findByTestId("login-email")).toBeInTheDocument();
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
  });

  it("restores an authenticated Requester session and renders the My Tickets shell", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: alice,
      mustChangePassword: false,
    });
    render(<App />);

    await screen.findByTestId("logout-btn");
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("My Tickets")).toBeInTheDocument();
    expect(within(nav).getByText("Create Ticket")).toBeInTheDocument();
  });

  it("shows only the Change Password screen when the session requires a password change", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: alice,
      mustChangePassword: true,
    });
    render(<App />);

    expect(await screen.findByTestId("current-password")).toBeInTheDocument();
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Ticket")).not.toBeInTheDocument();
  });
});