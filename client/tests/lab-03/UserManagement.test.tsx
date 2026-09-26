import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminUser } from "../../src/api.js";
import * as api from "../../src/api.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import { UserList } from "../../src/components/features/UserList.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const me: api.AuthUser = {
  id: 1,
  name: "Carol Admin",
  email: "carol@mail.kmutt.ac.th",
  role: "ADMIN",
  isActive: true,
};

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 1,
    name: "Carol Admin",
    email: "carol@mail.kmutt.ac.th",
    role: "ADMIN",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const DEFAULT_USERS: AdminUser[] = [
  user(),
  user({
    id: 2,
    name: "Staff Person",
    email: "staff@mail.kmutt.ac.th",
    role: "IT_STAFF",
  }),
  user({
    id: 3,
    name: "Requester Person",
    email: "req@mail.kmutt.ac.th",
    role: "REQUESTER",
    isActive: false,
  }),
];

function apiError(status: number, code: string, message: string) {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

function lastFetchUsersCall(): api.UserQuery | undefined {
  const calls = vi.mocked(api.fetchUsers).mock.calls;
  return calls[calls.length - 1]?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchMe).mockResolvedValue({ user: me, mustChangePassword: false });
  vi.mocked(api.fetchUsers).mockImplementation(async (query) =>
    query?.search ? [] : DEFAULT_USERS
  );
  vi.mocked(api.createUser).mockResolvedValue(user({ id: 99, name: "New Person" }));
  vi.mocked(api.updateUser).mockResolvedValue(user());
  vi.mocked(api.resetUserInitialPassword).mockResolvedValue(user());
});

const userEvt = userEvent.setup();

function renderPanel() {
  return render(
    <AuthProvider>
      <UserList />
    </AuthProvider>
  );
}

async function renderReady() {
  renderPanel();
  await screen.findByTestId("users-table");
}

async function openEditUser(name: string) {
  const table = await screen.findByTestId("users-table");
  const row = within(table).getByText(name).closest("tr");
  expect(row).not.toBeNull();
  await userEvt.click(within(row as HTMLElement).getByTestId("edit-user-btn"));
  return screen.getByTestId("side-panel");
}

async function pickFromSelect(testId: string, listboxName: string, label: string) {
  await userEvt.click(screen.getByTestId(testId));
  await userEvt.click(
    within(screen.getByRole("listbox", { name: listboxName })).getByText(label)
  );
}

describe("UserList (UI-11)", () => {
  it("renders the user table with names, emails, role and status badges", async () => {
    await renderReady();

    const table = screen.getByTestId("users-table");
    expect(within(table).getByText("Carol Admin")).toBeInTheDocument();
    expect(within(table).getByText("staff@mail.kmutt.ac.th")).toBeInTheDocument();

    const roles = within(table).getAllByTestId("role-badge");
    expect(roles).toHaveLength(3);
    expect(roles[0]).toHaveAttribute("data-value", "ADMIN");
    expect(roles[1]).toHaveAttribute("data-value", "IT_STAFF");
    expect(roles[2]).toHaveAttribute("data-value", "REQUESTER");

    const statuses = within(table).getAllByTestId("user-status-badge");
    expect(statuses[0]).toHaveAttribute("data-value", "Active");
    expect(statuses[2]).toHaveAttribute("data-value", "Inactive");

    expect(within(table).getAllByTestId("edit-user-btn").length).toBe(3);
  });

  it("shows the empty state when there are no users at all", async () => {
    vi.mocked(api.fetchUsers).mockResolvedValue([]);
    renderPanel();

    const empty = await screen.findByTestId("empty-state");
    expect(within(empty).getByText("No users found")).toBeInTheDocument();
    expect(screen.queryByTestId("users-table")).not.toBeInTheDocument();
  });

  it("debounces search, combines with the role filter, and clears filters", async () => {
    await renderReady();

    await userEvt.type(screen.getByTestId("user-search-input"), "carol");
    await waitFor(
      () => expect(lastFetchUsersCall()?.search).toBe("carol"),
      { timeout: 1500 }
    );

    await pickFromSelect("user-filter-role", "Filter by role", "Administrator");
    await waitFor(() => expect(lastFetchUsersCall()?.role).toBe("ADMIN"));

    expect(screen.getByTestId("user-clear-filters-btn")).toBeInTheDocument();
    await userEvt.click(screen.getByTestId("user-clear-filters-btn"));
    await waitFor(
      () => expect(lastFetchUsersCall()).toEqual({}),
      { timeout: 1500 }
    );
    expect(screen.queryByTestId("user-clear-filters-btn")).not.toBeInTheDocument();
  });

  it("shows the no-results state with Clear Filters action", async () => {
    await renderReady();

    await userEvt.type(screen.getByTestId("user-search-input"), "zzz");
    const empty = await screen.findByTestId("empty-state");
    await waitFor(() => {
      expect(
        within(empty).getByText("No results match your search or filter.")
      ).toBeInTheDocument();
    });

    await userEvt.click(screen.getByTestId("user-empty-clear-btn"));
    await screen.findByTestId("users-table");
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("validates the create panel: live initial-password checklist and required fields", async () => {
    await renderReady();
    await userEvt.click(screen.getByTestId("create-user-btn"));

    const panel = screen.getByTestId("side-panel");
    expect(screen.getByRole("dialog", { name: "Create User" })).toBeInTheDocument();

    // Password checklist exists and starts unmet.
    const passwordInput = within(panel).getByTestId("user-initial-password");
    expect(passwordInput).toBeInTheDocument();
    expect(within(panel).getByTestId("password-rule-1")).not.toHaveClass("is-met");

    // Weak password: checklist stays unmet and Save is blocked with inline error.
    await userEvt.type(passwordInput, "abc");
    expect(within(panel).getByTestId("password-rule-1")).not.toHaveClass("is-met");
    await userEvt.type(within(panel).getByTestId("user-name-input"), "New Person");
    await userEvt.type(
      within(panel).getByTestId("user-email-input"),
      "new@mail.kmutt.ac.th"
    );
    await userEvt.click(within(panel).getByTestId("save-user-btn"));
    expect(
      await within(panel).findByTestId("error-initial-password")
    ).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();

    // Strong password flips every rule and creates the user.
    await userEvt.clear(passwordInput);
    await userEvt.type(passwordInput, "ChangeMe123!");
    for (let i = 1; i <= 5; i += 1) {
      expect(within(panel).getByTestId(`password-rule-${i}`)).toHaveClass("is-met");
    }
    await userEvt.click(within(panel).getByTestId("save-user-btn"));

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({
        name: "New Person",
        email: "new@mail.kmutt.ac.th",
        role: "REQUESTER",
        isActive: true,
        initialPassword: "ChangeMe123!",
      })
    );
    expect(
      await screen.findByTestId("users-success-banner")
    ).toHaveTextContent("New Person was created.");
    expect(screen.queryByTestId("side-panel")).not.toBeInTheDocument();
  });

  it("surfaces a duplicate-email conflict inline on the Email field", async () => {
    vi.mocked(api.createUser).mockRejectedValue(
      apiError(409, "EMAIL_ALREADY_EXISTS", "This email is already in use")
    );
    await renderReady();
    await userEvt.click(screen.getByTestId("create-user-btn"));

    const panel = screen.getByTestId("side-panel");
    await userEvt.type(within(panel).getByTestId("user-name-input"), "New Person");
    await userEvt.type(
      within(panel).getByTestId("user-email-input"),
      "taken@mail.kmutt.ac.th"
    );
    await userEvt.type(within(panel).getByTestId("user-initial-password"), "ChangeMe123!");
    await userEvt.click(within(panel).getByTestId("save-user-btn"));

    expect(
      await within(panel).findByTestId("error-user-email")
    ).toHaveTextContent("This email is already in use");
    expect(screen.queryByTestId("side-panel")).toBeInTheDocument();
  });

  it("edits a user and saves the update", async () => {
    await renderReady();
    const panel = await openEditUser("Staff Person");

    expect(within(panel).getByTestId("user-name-input")).toHaveValue("Staff Person");
    expect(within(panel).getByTestId("user-email-input")).toHaveValue(
      "staff@mail.kmutt.ac.th"
    );

    const nameInput = within(panel).getByTestId("user-name-input");
    await userEvt.clear(nameInput);
    await userEvt.type(nameInput, "Bobby Staff");
    await userEvt.click(within(panel).getByTestId("save-user-btn"));

    await waitFor(() =>
      expect(api.updateUser).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ name: "Bobby Staff", isActive: true })
      )
    );
    expect(
      await screen.findByTestId("users-success-banner")
    ).toHaveTextContent("User was updated.");
    expect(screen.queryByTestId("side-panel")).not.toBeInTheDocument();
  });

  it("disables the Active toggle for the current administrator's own account", async () => {
    await renderReady();
    const panel = await openEditUser("Carol Admin");

    const toggle = within(panel).getByTestId("user-active-toggle");
    expect(toggle).toBeDisabled();
    expect(
      within(panel).getByText("You cannot deactivate your own account.")
    ).toBeInTheDocument();
  });

  it("hints when a change would remove the last active Administrator", async () => {
    vi.mocked(api.fetchUsers).mockResolvedValue([user()]);
    await renderReady();
    const panel = await openEditUser("Carol Admin");

    // Demoting the only active Administrator triggers the server-side conflict
    // safety hint (server remains authoritative, tested in API-40 / BR-32).
    await pickFromSelect("user-role-select", "Role", "Requester");
    expect(within(panel).getByTestId("last-admin-hint")).toBeInTheDocument();
  });

  it("sets a new initial password for an existing user", async () => {
    await renderReady();
    const panel = await openEditUser("Staff Person");

    await userEvt.click(within(panel).getByTestId("reset-password-btn"));
    const resetInput = within(panel).getByTestId("user-reset-password");
    await userEvt.type(resetInput, "ChangeMe123!");
    await userEvt.click(within(panel).getByTestId("save-reset-password-btn"));

    await waitFor(() =>
      expect(api.resetUserInitialPassword).toHaveBeenCalledWith(2, "ChangeMe123!")
    );
    expect(
      await within(panel).findByTestId("reset-password-success")
    ).toBeInTheDocument();
  });

  it("is reachable from the Admin shell via the User Management nav item", async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    vi.mocked(api.fetchCategories).mockResolvedValue([]);
    vi.mocked(api.fetchRelatedSystems).mockResolvedValue([]);

    render(<App />);
    await screen.findByTestId("logout-btn");
    await userEvt.click(screen.getByText("User Management"));

    expect(await screen.findByTestId("user-search-input")).toBeInTheDocument();
  });
});