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
  vi.mocked(api.fetchMe).mockResolvedValue({
    user: requesterUser,
    mustChangePassword: true,
  });
  vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);
  vi.mocked(api.fetchCategories).mockResolvedValue([]);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue([]);
});

async function renderChangePasswordScreen() {
  render(<App />);
  return await screen.findByTestId("current-password");
}

describe("ChangePasswordForm (UI-03)", () => {
  it("shows only the Change Password screen when mustChangePassword is true", async () => {
    await renderChangePasswordScreen();

    expect(screen.getByText("Change Your Password")).toBeInTheDocument();
    expect(
      screen.getByText("You must choose a new password before continuing.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("new-password")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-password")).toBeInTheDocument();
    expect(screen.getByTestId("change-password-btn")).toBeDisabled();
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Ticket")).not.toBeInTheDocument();
  });

  it("updates the live rule checklist as the new password is typed", async () => {
    const user = userEvent.setup();
    await renderChangePasswordScreen();
    const current = screen.getByTestId("current-password");
    const fresh = screen.getByTestId("new-password");

    await user.type(current, "OldPass123!");
    await user.type(fresh, "newpass1");

    expect(screen.getByTestId("password-rule-1")).toHaveClass("is-met");
    expect(screen.getByTestId("password-rule-2")).not.toHaveClass("is-met");
    expect(screen.getByTestId("password-rule-3")).toHaveClass("is-met");
    expect(screen.getByTestId("password-rule-4")).toHaveClass("is-met");
    expect(screen.getByTestId("password-rule-5")).not.toHaveClass("is-met");
    expect(screen.getByTestId("password-rule-6")).toHaveClass("is-met");
  });

  it("marks the differs-from-current rule unmet when new equals current", async () => {
    const user = userEvent.setup();
    await renderChangePasswordScreen();
    const current = screen.getByTestId("current-password");
    const fresh = screen.getByTestId("new-password");

    await user.type(current, "SamePass1!");
    await user.type(fresh, "SamePass1!");

    expect(screen.getByTestId("password-rule-6")).not.toHaveClass("is-met");
    expect(screen.getByTestId("change-password-btn")).toBeDisabled();
  });

  it("keeps submit disabled until all rules are met and confirmation matches", async () => {
    const user = userEvent.setup();
    await renderChangePasswordScreen();
    const current = screen.getByTestId("current-password");
    const fresh = screen.getByTestId("new-password");
    const confirm = screen.getByTestId("confirm-password");

    await user.type(current, "OldPass123!");
    await user.type(fresh, "New$Pass1!");
    for (let i = 1; i <= 6; i += 1) {
      expect(screen.getByTestId(`password-rule-${i}`)).toHaveClass("is-met");
    }

    await user.type(confirm, "Different123!");
    expect(screen.getByTestId("change-password-btn")).toBeDisabled();

    await user.clear(confirm);
    await user.type(confirm, "New$Pass1!");
    expect(screen.getByTestId("change-password-btn")).toBeEnabled();
  });

  it("on success clears the gate and opens the authenticated shell", async () => {
    vi.mocked(api.changePassword).mockResolvedValue({
      user: requesterUser,
      mustChangePassword: false,
    });

    const user = userEvent.setup();
    await renderChangePasswordScreen();
    const current = screen.getByTestId("current-password");
    const fresh = screen.getByTestId("new-password");

    await user.type(current, "OldPass123!");
    await user.type(fresh, "New$Pass1!");
    await user.type(screen.getByTestId("confirm-password"), "New$Pass1!");
    await user.click(screen.getByTestId("change-password-btn"));

    await waitFor(() => expect(screen.getByTestId("logout-btn")).toBeInTheDocument());
    expect(vi.mocked(api.changePassword)).toHaveBeenCalledWith("OldPass123!", "New$Pass1!");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("Create Ticket")).toBeInTheDocument();
  });

  it("shows an inline error under Current Password when it is wrong", async () => {
    vi.mocked(api.changePassword).mockRejectedValue(
      apiError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.") as never
    );

    const user = userEvent.setup();
    await renderChangePasswordScreen();
    const current = screen.getByTestId("current-password");
    const fresh = screen.getByTestId("new-password");

    await user.type(current, "WrongPass123!");
    await user.type(fresh, "New$Pass1!");
    await user.type(screen.getByTestId("confirm-password"), "New$Pass1!");
    await user.click(screen.getByTestId("change-password-btn"));

    await waitFor(() =>
      expect(screen.getByTestId("error-current-password")).toHaveTextContent(
        "Current password is incorrect."
      )
    );
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
  });
});