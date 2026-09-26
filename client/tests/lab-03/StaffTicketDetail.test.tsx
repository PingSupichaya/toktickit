import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { TicketDetail } from "../../src/api.js";
import { StaffTicketDetail } from "../../src/components/features/StaffTicketDetail.js";

vi.mock("../../src/api.js");

const eligibleOwners: api.EligibleOwner[] = [
  { id: 10, name: "Bobby Staff", role: "IT_STAFF" },
  { id: 11, name: "Priya Nair", role: "IT_STAFF" },
  { id: 12, name: "Avery Admin", role: "ADMIN" },
];

const ticket: TicketDetail = {
  id: 42,
  ticketNumber: "TKT-000042",
  submittedById: 1,
  submitter: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  ownerId: null,
  owner: null,
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
  canIndicateResolved: false,
  permittedStatusTransitions: [
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CANCELLED",
  ],
};

const onBack = vi.fn();
const user = userEvent.setup();

function detailData(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return { ...ticket, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(detailData());
  vi.mocked(api.fetchEligibleOwners).mockResolvedValue(eligibleOwners);
  vi.mocked(api.downloadAttachmentUrl).mockReturnValue(
    "/api/attachments/1/download"
  );
  vi.mocked(api.claimTicket).mockResolvedValue({
    ticketId: 42,
    owner: { id: 10, name: "Bobby Staff", role: "IT_STAFF" },
  });
  vi.mocked(api.assignOwner).mockResolvedValue({
    ticketId: 42,
    owner: { id: 11, name: "Priya Nair", role: "IT_STAFF" },
  });
  vi.mocked(api.updateTicketOperational).mockImplementation(async (id, input) =>
    detailData({
      itPriority: input.itPriority ?? ticket.itPriority,
      currentStatus: input.currentStatus ?? ticket.currentStatus,
    })
  );
  vi.mocked(api.postComment).mockResolvedValue({
    id: 99,
    ticketId: 42,
    author: { id: 10, name: "Bobby Staff" },
    content: "A fresh battery has been ordered.",
    createdAt: "2026-09-10T15:00:00.000Z",
  });
  vi.mocked(api.postNote).mockResolvedValue({
    id: 100,
    ticketId: 42,
    author: { id: 10, name: "Bobby Staff" },
    content: "Waiting on vendor patch JD-992.",
    createdAt: "2026-09-10T15:01:00.000Z",
  });
});

// Vitest's auto-mock replaces the ApiError class, so build fixtures with a
// plain Error carrying the parts the component reads (status / message).
function failingFetch(status: number, message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

async function renderDetail() {
  render(<StaffTicketDetail ticketId={42} onBack={onBack} />);
  await screen.findByTestId("operational-panel");
}

async function pickOption(testId: string, listboxName: string, label: string) {
  await user.click(screen.getByTestId(testId));
  await user.click(
    within(screen.getByRole("listbox", { name: listboxName })).getByText(label)
  );
}

describe("StaffTicketDetail (UI-07)", () => {
  it("shows a Claim button only when unassigned; claiming assigns the caller", async () => {
    await renderDetail();

    expect(screen.getByTestId("claim-btn")).toBeInTheDocument();
    expect(screen.getByTestId("owner-unassigned")).toHaveTextContent("Unassigned");
    expect(screen.queryByTestId("owner-select")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("claim-btn"));

    await waitFor(() =>
      expect(api.claimTicket).toHaveBeenCalledWith(42)
    );
    await waitFor(() =>
      expect(screen.queryByTestId("claim-btn")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("owner-select")).toBeInTheDocument();
  });

  it("renders an Owner select listing active staff/admin when assigned", async () => {
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(
      detailData({
        ownerId: 12,
        owner: { id: 12, name: "Avery Admin", role: "ADMIN" },
      })
    );
    await renderDetail();

    const ownerSelect = screen.getByTestId("owner-select");
    await user.click(ownerSelect);
    const options = within(
      screen.getByRole("listbox", { name: "Owner" })
    ).getAllByRole("option");
    const labels = options.map((o) => o.textContent);
    expect(labels).toEqual(
      expect.arrayContaining(["Bobby Staff", "Priya Nair", "Avery Admin"])
    );
  });

  it("offers only permitted status transitions in the Status select", async () => {
    await renderDetail();

    expect(screen.getByTestId("status-badge")).toHaveAttribute(
      "data-value",
      "OPEN"
    );
    await user.click(screen.getByTestId("status-select"));
    const options = within(
      screen.getByRole("listbox", { name: "Status" })
    ).getAllByRole("option");
    const labels = options.map((o) => o.textContent).sort();
    expect(labels).toEqual(
      ["CANCELLED", "IN_PROGRESS", "RESOLVED", "WAITING_FOR_REQUESTER"].sort()
    );
    expect(labels).not.toContain("NEW");
    expect(labels).not.toContain("OPEN");
    expect(labels).not.toContain("CLOSED");
    expect(labels).not.toContain("REOPENED");
  });

  it("saves the IT Priority via PATCH and shows the success banner", async () => {
    await renderDetail();

    await pickOption("it-priority-select", "IT Priority", "HIGH");
    await user.click(screen.getByTestId("save-ticket-btn"));

    await waitFor(() =>
      expect(api.updateTicketOperational).toHaveBeenCalledWith(42, {
        itPriority: "HIGH",
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("save-success")).toHaveTextContent(
        "Ticket updated."
      )
    );
  });

  it("sends a chosen status transition and keeps the save button busy while saving", async () => {
    vi.mocked(api.updateTicketOperational).mockImplementation(
      () => new Promise(() => {})
    );
    await renderDetail();

    await pickOption("status-select", "Status", "RESOLVED");
    await user.click(screen.getByTestId("save-ticket-btn"));

    await waitFor(() =>
      expect(api.updateTicketOperational).toHaveBeenCalledWith(42, {
        currentStatus: "RESOLVED",
      })
    );
    expect(screen.getByTestId("save-ticket-btn")).toBeDisabled();
    expect(screen.getByTestId("save-ticket-btn")).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("rejects an invalid status transition with a 409-surfaced failure banner", async () => {
    vi.mocked(api.updateTicketOperational).mockRejectedValue(
      new Error("This status transition is not allowed")
    );
    await renderDetail();

    await pickOption("status-select", "Status", "RESOLVED");
    await user.click(screen.getByTestId("save-ticket-btn"));

    await waitFor(() =>
      expect(screen.getByTestId("save-error")).toHaveTextContent(
        "This status transition is not allowed"
      )
    );
  });

  it("shows the 403 error state for unauthorized viewers", async () => {
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(
      failingFetch(403, "Forbidden")
    );
    render(<StaffTicketDetail ticketId={42} onBack={onBack} />);

    await screen.findByText("You are not authorized to view this ticket.");
  });

  it("shows the 404 error state for a missing ticket", async () => {
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(
      failingFetch(404, "Not found")
    );
    render(<StaffTicketDetail ticketId={999} onBack={onBack} />);

    await screen.findByText("Ticket not found.");
  });
});

describe("StaffTicketDetail (UI-08)", () => {
  it("renders ARIA tabs with Public Comments as the default tab", async () => {
    await renderDetail();

    expect(screen.getByTestId("detail-tabs")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Public Comments" })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Internal Notes" })
    ).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("tab", { name: "Attachments" })
    ).toHaveAttribute("aria-selected", "false");

    expect(
      screen.queryByTestId("comments-visibility-hint")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("public-comments")).toBeInTheDocument();
  });

  it("keeps Internal Notes visually distinct with the internal-only hint", async () => {
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(
      detailData({
        notes: [
          {
            id: 7,
            ticketId: 42,
            author: { id: 10, name: "Bobby Staff" },
            content: "Root cause identified.",
            createdAt: "2026-09-09T09:00:00.000Z",
          },
        ],
      })
    );
    await renderDetail();

    await user.click(screen.getByRole("tab", { name: "Internal Notes" }));

    expect(screen.getByTestId("notes-internal-hint")).toHaveTextContent(
      "Internal only — not visible to Requesters"
    );
    expect(screen.getByText("Internal")).toBeInTheDocument();
    expect(screen.getByText("Root cause identified.")).toBeInTheDocument();
  });

  it("validates the comment composer before any request", async () => {
    await renderDetail();

    await user.click(screen.getByTestId("post-comment-btn"));

    expect(screen.getByTestId("comment-error")).toHaveTextContent(
      "Comment must not be empty"
    );
    expect(api.postComment).not.toHaveBeenCalled();
  });

  it("posts a Public Comment and appends it to the thread", async () => {
    await renderDetail();

    await user.type(
      screen.getByTestId("comment-textarea"),
      "A fresh battery has been ordered."
    );
    await user.click(screen.getByTestId("post-comment-btn"));

    await waitFor(() =>
      expect(api.postComment).toHaveBeenCalledWith(
        42,
        "A fresh battery has been ordered."
      )
    );
    await waitFor(() =>
      expect(
        screen.getByText("A fresh battery has been ordered.")
      ).toBeInTheDocument()
    );
  });

  it("posts an Internal Note and appends it with an Internal marker", async () => {
    await renderDetail();

    await user.click(screen.getByRole("tab", { name: "Internal Notes" }));
    await user.type(
      screen.getByTestId("note-textarea"),
      "Waiting on vendor patch JD-992."
    );
    await user.click(screen.getByTestId("post-note-btn"));

    await waitFor(() =>
      expect(api.postNote).toHaveBeenCalledWith(
        42,
        "Waiting on vendor patch JD-992."
      )
    );
    await waitFor(() =>
      expect(screen.getByText("Waiting on vendor patch JD-992.")).toBeInTheDocument()
    );
  });

  it("renders attachments read-only: download for active, muted for removed", async () => {
    vi.mocked(api.fetchTicketDetail).mockResolvedValue(
      detailData({
        attachments: [
          {
            id: 1,
            originalFilename: "battery.jpg",
            fileSizeBytes: 102400,
            contentType: "image/jpeg",
            uploadedAt: "2026-09-08T08:00:00.000Z",
            isRemoved: false,
          },
          {
            id: 2,
            originalFilename: "old.pdf",
            fileSizeBytes: 204800,
            contentType: "application/pdf",
            uploadedAt: "2026-09-06T09:00:00.000Z",
            isRemoved: true,
            removedAt: "2026-09-07T10:00:00.000Z",
            removalReason: "Wrong file uploaded",
          },
        ],
      })
    );
    await renderDetail();

    await user.click(screen.getByRole("tab", { name: "Attachments" }));

    expect(screen.getByTestId("attachment-download-1")).toHaveAttribute("href");
    expect(screen.getByTestId("attachment-removed-2")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    // Staff view is read-only: no upload zone and no remove actions.
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-attachment-btn")).not.toBeInTheDocument();
  });
});