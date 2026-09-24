import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
// UI-13 — responsive switching prerequisites (ui-spec §8).
// jsdom has no layout engine, so real breakpoint behavior (table → cards at
// 1024px, tab stacking below 768px, zero horizontal overflow at 375px) is
// asserted in a real browser by E2E-06/E2E-10. What this file proves at unit
// level is that every responsive prerequisite exists in the DOM:
//   - queue and user list render BOTH the desktop table and the mobile card
//     list, so the CSS media queries have something to switch between;
//   - the header exposes the hamburger trigger that opens the mobile nav;
//   - the detail tabs use the ARIA tab pattern the stacked mobile CSS relies
//     on, and the side panel is a labelled modal dialog (full-screen on
//     mobile via CSS).
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
  comments: [],
  notes: [],
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

beforeEach(() => {
  vi.clearAllMocks();
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
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(detail);
  vi.mocked(api.fetchEligibleOwners).mockResolvedValue([]);
  vi.mocked(api.downloadAttachmentUrl).mockReturnValue(
    "/api/attachments/1/download"
  );
});

describe("Responsive prerequisites (UI-13)", () => {
  it("queue renders both the desktop table and the mobile card list", async () => {
    render(<StaffTicketQueue />);
    await screen.findByTestId("queue-table");

    expect(screen.getByTestId("queue-table").tagName).toBe("TABLE");
    const cards = screen.getByTestId("queue-card");
    expect(cards.tagName).toBe("UL");
    expect(
      cards.querySelector('button[aria-label="Open ticket TKT-000001"]')
    ).not.toBeNull();
  });

  it("user list renders both the desktop table and the mobile card list", async () => {
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
    render(
      <AuthProvider>
        <UserList />
      </AuthProvider>
    );
    await screen.findByTestId("users-table");

    expect(screen.getByTestId("users-table").tagName).toBe("TABLE");
    const cards = screen.getByTestId("user-card");
    expect(cards.tagName).toBe("UL");
    expect(cards.querySelector(".user-card__name")).not.toBeNull();
  });

  it("header exposes the hamburger trigger for the mobile nav overlay", async () => {
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
    vi.mocked(api.fetchTickets).mockResolvedValue(emptyPage);
    render(<App />);
    await screen.findByTestId("logout-btn");

    const menu = screen.getByTestId("menu-btn");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(menu);
    expect(
      await screen.findByRole("dialog", { name: "Navigation menu" })
    ).toBeInTheDocument();
  });

  it("detail tabs use the tab pattern the stacked mobile CSS relies on", async () => {
    render(<StaffTicketDetail ticketId={1} onBack={() => undefined} />);
    await screen.findByTestId("operational-panel");

    const tablist = screen.getByRole("tablist", { name: "Ticket sections" });
    expect(tablist).toBeInTheDocument();
    for (const name of ["Public Comments", "Internal Notes", "Attachments"]) {
      const tab = screen.getByRole("tab", { name });
      expect(tab).toHaveAttribute("aria-selected");
      expect(tab).toHaveAttribute("aria-controls");
    }
    expect(screen.getByRole("tabpanel", { hidden: false })).toBeInTheDocument();
  });

  it("user panel is a labelled modal dialog (full-screen on mobile via CSS)", async () => {
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
    render(
      <AuthProvider>
        <UserList />
      </AuthProvider>
    );
    await screen.findByTestId("users-table");

    await userEvent.setup().click(screen.getByTestId("create-user-btn"));
    const dialog = await screen.findByRole("dialog", { name: "Create User" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});