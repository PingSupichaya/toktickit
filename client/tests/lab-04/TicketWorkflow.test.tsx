import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { TicketDetail } from "../../src/api.js";
import { StaffTicketDetail } from "../../src/components/features/StaffTicketDetail.js";

vi.mock("../../src/api.js");

const baseTicket: TicketDetail = {
  id: 42,
  ticketNumber: "TKT-000042",
  submittedById: 1,
  submitter: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  ownerId: 10,
  owner: { id: 10, name: "Bobby Staff", role: "IT_STAFF" },
  categoryId: 2,
  category: { id: 2, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Corporate Laptop" },
  summary: "Laptop battery drains quickly",
  description: "Battery lasts only two hours on a full charge.",
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "OPEN",
  ticketDate: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-10T14:00:00.000Z",
  attachments: [],
  comments: [],
  notes: [],
  version: 3,
  canResolve: false,
  actionCount: 0,
  hasOutstandingFollowUp: false,
  canIndicateResolved: false,
  permittedStatusTransitions: [
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CANCELLED",
  ],
};

function detailData(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return { ...baseTicket, ...overrides };
}

const onBack = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(detailData());
  vi.mocked(api.fetchEligibleOwners).mockResolvedValue([]);
  vi.mocked(api.downloadAttachmentUrl).mockReturnValue(
    "/api/attachments/1/download"
  );
});

async function renderDetail(overrides: Partial<TicketDetail> = {}) {
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(detailData(overrides));
  render(<StaffTicketDetail ticketId={42} onBack={onBack} />);
  await screen.findByTestId("operational-panel");
}

async function openStatusOptions() {
  await userEvent.setup().click(screen.getByTestId("status-select"));
  return within(screen.getByRole("listbox", { name: "Status" }));
}

describe("UI-05 — resolution-gate hint (FR-07)", () => {
  it("canResolve=false disables RESOLVED with the hint; true enables it", async () => {
    const user = userEvent.setup();
    await renderDetail({ canResolve: false });

    // Inline hint directly beneath the select, associated via aria-describedby.
    const hint = screen.getByTestId("resolution-gate-hint");
    expect(hint).toHaveTextContent(
      "Add an Action Taken with no outstanding follow-up before resolving."
    );
    expect(screen.getByTestId("status-select")).toHaveAttribute(
      "aria-describedby",
      "resolution-gate-hint"
    );

    const listbox = await openStatusOptions();
    const resolved = listbox.getByText("RESOLVED");
    expect(resolved.closest("li")).toHaveAttribute("aria-disabled", "true");
    // A disabled option cannot be chosen — the draft stays empty.
    await user.click(resolved);
    expect(screen.getByTestId("status-select")).toHaveTextContent(
      "Select a transition…"
    );
  });

  it("canResolve=true leaves RESOLVED enabled with no hint", async () => {
    await renderDetail({ canResolve: true, actionCount: 1 });
    expect(screen.queryByTestId("resolution-gate-hint")).not.toBeInTheDocument();

    const listbox = await openStatusOptions();
    const resolved = listbox.getByText("RESOLVED");
    expect(
      resolved.closest("li")?.getAttribute("aria-disabled")
    ).not.toBe("true");
  });
});

describe("UI-06 — in-place status refresh (FR-09)", () => {
  it("successful change updates the badge without a full remount", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTicketOperational).mockImplementation(
      async (_id, input) =>
        detailData({
          currentStatus: input.currentStatus ?? baseTicket.currentStatus,
          version: 4,
          canResolve: true,
          actionCount: 1,
        })
    );
    await renderDetail({ canResolve: true, actionCount: 1 });

    const listbox = await openStatusOptions();
    await user.click(listbox.getByText("IN_PROGRESS"));
    await user.click(screen.getByTestId("save-ticket-btn"));

    // Badge + version state refresh in place: no second detail fetch …
    await waitFor(() =>
      expect(screen.getByTestId("status-badge")).toHaveAttribute(
        "data-value",
        "IN_PROGRESS"
      )
    );
    expect(api.fetchTicketDetail).toHaveBeenCalledTimes(1);
    // … and the write carried the version last read.
    expect(api.updateTicketOperational).toHaveBeenCalledWith(42, {
      version: 3,
      currentStatus: "IN_PROGRESS",
    });
  });

  it("409 STALE_UPDATE shows the conflict banner and refreshes fields", async () => {
    const user = userEvent.setup();
    const current = detailData({
      currentStatus: "IN_PROGRESS",
      version: 4,
      itPriority: "HIGH",
    });
    const stale = Object.assign(new Error("Stale"), {
      status: 409,
      code: "STALE_UPDATE",
      details: { current },
    });
    vi.mocked(api.updateTicketOperational).mockRejectedValueOnce(stale);
    await renderDetail({ canResolve: true, actionCount: 1 });

    const listbox = await openStatusOptions();
    await user.click(listbox.getByText("IN_PROGRESS"));
    await user.click(screen.getByTestId("save-ticket-btn"));

    const banner = await screen.findByTestId("action-conflict-banner");
    expect(banner).toHaveTextContent("updated by someone else");
    // Operational fields refresh to the server's current values.
    await waitFor(() =>
      expect(screen.getByTestId("status-badge")).toHaveAttribute(
        "data-value",
        "IN_PROGRESS"
      )
    );
  });
});
