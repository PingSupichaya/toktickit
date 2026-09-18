import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const requesterUser: api.AuthUser = {
  id: 1,
  name: "Alice Johnson",
  email: "alice.johnson@mail.kmutt.ac.th",
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

function apiError(status: number, code?: string, message = "Request failed") {
  return Object.assign(new Error(message), { status, code });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);
  vi.mocked(api.fetchCategories).mockResolvedValue([]);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue([]);
  vi.mocked(api.logout).mockResolvedValue(undefined);
});

describe("Auth gates (UI-04)", () => {
  it("shows the Login screen when the session check returns 401", async () => {
    vi.mocked(api.fetchMe).mockRejectedValue(apiError(401) as never);
    render(<App />);

    expect(await screen.findByTestId("login-email")).toBeInTheDocument();
    expect(screen.queryByTestId("current-password")).not.toBeInTheDocument();
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
  });

  it("blocks the shell and shows only the Change Password screen when mustChangePassword is true", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: requesterUser,
      mustChangePassword: true,
    });
    render(<App />);

    expect(await screen.findByTestId("current-password")).toBeInTheDocument();
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Ticket")).not.toBeInTheDocument();
    expect(screen.getByTestId("change-password-logout")).toBeInTheDocument();
  });

  it("logout from the Change Password screen returns to the Login screen", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: requesterUser,
      mustChangePassword: true,
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId("current-password");
    await user.click(screen.getByTestId("change-password-logout"));

    await waitFor(() => expect(screen.getByTestId("login-email")).toBeInTheDocument());
    expect(vi.mocked(api.logout)).toHaveBeenCalledTimes(1);
  });

  it("opens the shell after session validation and logout returns to Login", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: requesterUser,
      mustChangePassword: false,
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId("logout-btn");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("My Tickets")).toBeInTheDocument();

    await user.click(screen.getByTestId("logout-btn"));
    await waitFor(() => expect(screen.getByTestId("login-email")).toBeInTheDocument());
    expect(vi.mocked(api.logout)).toHaveBeenCalledTimes(1);
  });
});