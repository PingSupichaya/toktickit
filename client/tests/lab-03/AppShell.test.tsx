import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import * as api from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

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
  vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);
  vi.mocked(api.fetchCategories).mockResolvedValue([]);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue([]);
});

function trainedUser(role: api.UserRole, overrides: Partial<api.AuthUser> = {}): api.AuthUser {
  return {
    id: 1,
    name: "A Person",
    email: "person@mail.kmutt.ac.th",
    role,
    isActive: true,
    ...overrides,
  };
}

async function renderShellFor(user: api.AuthUser) {
  vi.mocked(api.fetchMe).mockResolvedValue({ user, mustChangePassword: false });
  render(<App />);
  await screen.findByTestId("logout-btn");
  return screen.getByRole("navigation", { name: "Main navigation" });
}

describe("AppShell role-based navigation (UI-05)", () => {
  it("shows only My Tickets and Create Ticket for a Requester", async () => {
    const nav = await renderShellFor(trainedUser("REQUESTER", { name: "Alice Johnson" }));

    expect(within(nav).getByText("My Tickets")).toBeInTheDocument();
    expect(within(nav).getByText("Create Ticket")).toBeInTheDocument();
    expect(within(nav).queryByText("Ticket Queue")).not.toBeInTheDocument();
    expect(within(nav).queryByText("User Management")).not.toBeInTheDocument();
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByTestId("role-badge")).toHaveAttribute("data-value", "REQUESTER");
  });

  it("shows only Ticket Queue for an IT Staff member", async () => {
    const nav = await renderShellFor(trainedUser("IT_STAFF", { name: "Bob Smith" }));

    expect(within(nav).getByText("Ticket Queue")).toBeInTheDocument();
    expect(within(nav).queryByText("My Tickets")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Create Ticket")).not.toBeInTheDocument();
    expect(within(nav).queryByText("User Management")).not.toBeInTheDocument();
    expect(screen.getByTestId("role-badge")).toHaveAttribute("data-value", "IT_STAFF");
  });

  it("shows Ticket Queue and User Management for an Administrator", async () => {
    const nav = await renderShellFor(trainedUser("ADMIN", { name: "Carol Admin" }));

    expect(within(nav).getByText("Ticket Queue")).toBeInTheDocument();
    expect(within(nav).getByText("User Management")).toBeInTheDocument();
    expect(within(nav).queryByText("My Tickets")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Create Ticket")).not.toBeInTheDocument();
    expect(screen.getByTestId("role-badge")).toHaveAttribute("data-value", "ADMIN");
  });
});