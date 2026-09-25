import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "../axeAudit.js";
import * as api from "../../src/api.js";
import type {
  AdminUser,
  QueueTicket,
  TicketDetail,
} from "../../src/api.js";
import App from "../../src/App.js";
import { AuthProvider } from "../../src/context/AuthContext.js";
import { StaffTicketQueue } from "../../src/components/features/StaffTicketQueue.js";
import { StaffTicketDetail } from "../../src/components/features/StaffTicketDetail.js";
import { UserList } from "../../src/components/features/UserList.js";

// ---------------------------------------------------------------------------
// UI-12 — automated accessibility audit (ui-spec §8 / §9).
// axe-core (via jest-axe, see ../axeAudit.ts) over the Login, Change
// Password, Ticket Queue, Ticket Detail tabs, and User Management screens.
// `document.title` / `<html lang>` are set to mirror client/index.html
// (component tests do not render the document shell).
// ---------------------------------------------------------------------------

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

const queueTicket: QueueTicket = {
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
  owner: null,
  attachmentCount: 0,
};

const detail: TicketDetail = {
  id: 1,
  ticketNumber: "TKT-000001",
  submittedById: 1,
  submitter: { id: 1, name: "Alice Johnson", email: "alice@mail.kmutt.ac.th" },
  ownerId: null,
  owner: null,
  categoryId: 2,
  category: { id: 2, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  summary: "Laptop battery drains quickly",
  description: "Battery lasts only two hours on a full charge.",
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "NEW",
  ticketDate: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-10T14:00:00.000Z",
  attachments: [],
  comments: [
    {
      id: 7,
      ticketId: 1,
      author: { id: 10, name: "Bobby Staff" },
      content: "A fresh battery has been ordered.",
      createdAt: "2026-09-10T15:00:00.000Z",
    },
  ],
  notes: [
    {
      id: 8,
      ticketId: 1,
      author: { id: 10, name: "Bobby Staff" },
      content: "Waiting on vendor patch.",
      createdAt: "2026-09-10T15:01:00.000Z",
    },
  ],
  canIndicateResolved: false,
  permittedStatusTransitions: ["OPEN", "IN_PROGRESS", "CANCELLED"],
};

const adminUser: AdminUser = {
  id: 1,
  name: "Carol Admin",
  email: "carol@mail.kmutt.ac.th",
  role: "ADMIN",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

function apiError(status: number, code: string) {
  const err = new Error(code) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.title = "TokTickIT";
  document.documentElement.setAttribute("lang", "en");
});

describe("A11y audit (UI-12)", () => {
  it("Login screen has no axe violations", async () => {
    vi.mocked(api.fetchMe).mockRejectedValue(apiError(401, "UNAUTHENTICATED"));
    const { container } = render(<App />);
    await screen.findByTestId("login-email");

    await expectNoAxeViolations(container);
  });

  it("Change Password screen has no axe violations", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: {
        id: 2,
        name: "Bob Smith",
        email: "bob@mail.kmutt.ac.th",
        role: "REQUESTER",
        isActive: true,
      },
      mustChangePassword: true,
    });
    const { container } = render(<App />);
    await screen.findByTestId("current-password");

    await expectNoAxeViolations(container);
  });

  it("Ticket Queue has no axe violations", async () => {
    vi.mocked(api.fetchQueue).mockResolvedValue({
      ...emptyPage,
      items: [queueTicket],
      pagination: { ...emptyPage.pagination, totalCount: 1 },
    });
    vi.mocked(api.fetchCategories).mockResolvedValue([
      { id: 2, name: "Hardware" },
    ]);
    vi.mocked(api.fetchRelatedSystems).mockResolvedValue([
      { id: 2, name: "Corporate Laptop" },
    ]);
    const { container } = render(
      <main>
        <StaffTicketQueue />
      </main>
    );
    await screen.findByTestId("queue-table");

    await expectNoAxeViolations(container);
  });

  it("Ticket Detail tabs (comments + notes) have no axe violations", async () => {
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(detail);
    vi.mocked(api.fetchEligibleOwners).mockResolvedValue([
      { id: 10, name: "Bobby Staff", role: "IT_STAFF" },
    ]);
    vi.mocked(api.downloadAttachmentUrl).mockReturnValue(
      "/api/attachments/1/download"
    );
    const { container } = render(
      <main>
        <StaffTicketDetail ticketId={1} onBack={() => undefined} />
      </main>
    );
    await screen.findByTestId("operational-panel");

    await expectNoAxeViolations(container);

    // Notes tab view carries the internal-only hint and thread list.
    await userEvent
      .setup()
      .click(screen.getByRole("tab", { name: "Internal Notes" }));
    await screen.findByTestId("internal-notes");

    await expectNoAxeViolations(container);
  });

  it("User Management panel has no axe violations", async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({
      user: {
        id: 1,
        name: "Carol Admin",
        email: "carol@mail.kmutt.ac.th",
        role: "ADMIN",
        isActive: true,
      },
      mustChangePassword: false,
    });
    vi.mocked(api.fetchUsers).mockResolvedValue([adminUser]);
    const { container } = render(
      <main>
        <AuthProvider>
          <UserList />
        </AuthProvider>
      </main>
    );
    await screen.findByTestId("users-table");

    await expectNoAxeViolations(container);
  });
});