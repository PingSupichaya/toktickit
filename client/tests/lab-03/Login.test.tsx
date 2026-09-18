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
  vi.mocked(api.fetchMe).mockRejectedValue(apiError(401, "UNAUTHENTICATED") as never);
  vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);
  vi.mocked(api.fetchCategories).mockResolvedValue([]);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue([]);
});

describe("LoginForm (UI-01 / UI-02)", () => {
  it("renders the login card with email/password fields and a disabled submit", async () => {
    render(<App />);

    expect(await screen.findByTestId("login-email")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "TokTickIT" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit-btn")).toBeDisabled();
  });

  it("shows inline validation errors on blur for empty fields and a malformed email", async () => {
    const user = userEvent.setup();
    render(<App />);

    const email = await screen.findByTestId("login-email");
    const password = screen.getByTestId("login-password");

    await user.click(email);
    await user.tab();
    expect(screen.getByTestId("error-email")).toHaveTextContent("Email is required");

    await user.click(password);
    await user.tab();
    expect(screen.getByTestId("error-password")).toHaveTextContent("Password is required");

    await user.type(email, "not-an-email");
    await user.tab();
    expect(screen.getByTestId("error-email")).toHaveTextContent("Enter a valid email address");
  });

  it("shows a busy state with the inline spinner and 'Signing In…' while the request is in flight", async () => {
    let resolveLogin!: (value: api.AuthResult) => void;
    vi.mocked(api.login).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    const user = userEvent.setup();
    render(<App />);
    const email = await screen.findByTestId("login-email");

    await user.type(email, "alice@test.com");
    await user.type(screen.getByTestId("login-password"), "Secret123!");
    await user.click(screen.getByTestId("login-submit-btn"));

    const button = screen.getByTestId("login-submit-btn");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Signing In…")).toBeInTheDocument();
    expect(document.querySelector(".spinner")).toBeInTheDocument();

    resolveLogin({ user: requesterUser, mustChangePassword: false });
    await waitFor(() => expect(screen.getByTestId("logout-btn")).toBeInTheDocument());
  });

  it("routes a successful login to the authenticated shell when mustChangePassword is false", async () => {
    vi.mocked(api.login).mockResolvedValue({ user: requesterUser, mustChangePassword: false });

    const user = userEvent.setup();
    render(<App />);
    const email = await screen.findByTestId("login-email");

    await user.type(email, "alice.johnson@mail.kmutt.ac.th ");
    await user.type(screen.getByTestId("login-password"), "Secret123!");
    await user.click(screen.getByTestId("login-submit-btn"));

    await waitFor(() => expect(screen.getByTestId("logout-btn")).toBeInTheDocument());
    expect(vi.mocked(api.login)).toHaveBeenCalledWith(
      "alice.johnson@mail.kmutt.ac.th",
      "Secret123!"
    );
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByText("My Tickets")).toBeInTheDocument();
    expect(within(nav).getByText("Create Ticket")).toBeInTheDocument();
    const badge = screen.getByTestId("role-badge");
    expect(badge).toHaveAttribute("data-value", "REQUESTER");
  });

  it("routes a successful login to the Change Password screen when mustChangePassword is true", async () => {
    vi.mocked(api.login).mockResolvedValue({ user: requesterUser, mustChangePassword: true });

    const user = userEvent.setup();
    render(<App />);
    const email = await screen.findByTestId("login-email");

    await user.type(email, "alice@test.com");
    await user.type(screen.getByTestId("login-password"), "Secret123!");
    await user.click(screen.getByTestId("login-submit-btn"));

    await waitFor(() => expect(screen.getByTestId("current-password")).toBeInTheDocument());
    expect(screen.queryByTestId("logout-btn")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Ticket")).not.toBeInTheDocument();
  });

  it.each([
    [401, undefined, "Invalid email or password"],
    [403, "ACCOUNT_INACTIVE", "Your account is not active. Contact your administrator."],
    [429, undefined, "Too many failed login attempts. Try again later."],
    [500, undefined, "Unable to sign in. Please try again."],
  ])("shows the safe %s banner without leaking details", async (status, code, message) => {
    vi.mocked(api.login).mockRejectedValue(apiError(status as number, code as string | undefined) as never);

    const user = userEvent.setup();
    render(<App />);
    const email = await screen.findByTestId("login-email");

    await user.type(email, "alice@test.com");
    await user.type(screen.getByTestId("login-password"), "wrong-password");
    await user.click(screen.getByTestId("login-submit-btn"));

    await waitFor(() => expect(screen.getByTestId("login-error")).toHaveTextContent(message));
    expect(screen.getByTestId("login-error")).toHaveClass("alert--error");
  });

  it("clears the error banner as soon as the user types again", async () => {
    vi.mocked(api.login).mockRejectedValue(apiError(401) as never);

    const user = userEvent.setup();
    render(<App />);
    const email = await screen.findByTestId("login-email");

    await user.type(email, "alice@test.com");
    await user.type(screen.getByTestId("login-password"), "wrong-password");
    await user.click(screen.getByTestId("login-submit-btn"));
    await waitFor(() => expect(screen.getByTestId("login-error")).toBeInTheDocument());

    await user.type(email, "b");
    expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
  });
});