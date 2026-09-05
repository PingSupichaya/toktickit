import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { TicketDetail as TicketDetailData } from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import { TicketDetail } from "../../src/components/features/TicketDetail.js";

vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
];

const detailTicket: TicketDetailData = {
  id: 1,
  ticketNumber: "TKT-000001",
  requesterId: 1,
  requester: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  categoryId: 2,
  category: { id: 2, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Campus Wi-Fi" },
  summary: "Laptop battery drains quickly",
  description: "Battery lasts only two hours.\nIt dies randomly even when idle.",
  requestedPriority: "HIGH",
  currentStatus: "NEW",
  ticketDate: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-04T10:30:00.000Z",
  attachments: [
    {
      id: 51,
      originalFilename: "battery-report.png",
      fileSizeBytes: 2048,
      contentType: "image/png",
      uploadedAt: "2026-09-04T11:00:00.000Z",
      isRemoved: false,
    },
    {
      id: 52,
      originalFilename: "old-screenshot.png",
      fileSizeBytes: 1024,
      contentType: "image/png",
      uploadedAt: "2026-09-03T09:00:00.000Z",
      isRemoved: true,
      removedAt: "2026-09-04T11:30:00.000Z",
      removalReason: "Duplicated file",
    },
  ],
};

const onBack = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(
    "toktickit.requester",
    JSON.stringify({ id: 1, name: "Alice Johnson", email: "alice@example.com" })
  );
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(detailTicket);
  vi.mocked(api.formatTicketDate).mockImplementation(() => "4 Sep 2026");
  vi.mocked(api.downloadAttachmentUrl).mockImplementation(
    (id, requesterId) =>
      `http://localhost:3000/api/attachments/${id}/download?requesterId=${requesterId}`
  );
});

const user = userEvent.setup();

function renderDetail() {
  return render(
    <RequesterProvider>
      <TicketDetail ticketId={1} onBack={onBack} />
    </RequesterProvider>
  );
}

async function openDetail() {
  renderDetail();
  await waitFor(() => {
    expect(screen.getByTestId("ticket-detail-number")).toBeInTheDocument();
  });
}

describe("RequesterTicketDetail (T-016) - AC-03", () => {
  it("shows the loading skeleton while the ticket is being fetched", async () => {
    vi.mocked(api.fetchTicketDetail).mockImplementation(() => new Promise(() => {}));

    renderDetail();

    expect(await screen.findByTestId("ticket-detail-loading")).toBeInTheDocument();
  });

  it("renders all fields read-only with badges, summary, description, and attachments", async () => {
    await openDetail();

    const detail = screen.getByText("Ticket Detail").closest(
      ".ticket-detail"
    ) as HTMLElement;

    expect(within(detail).getByTestId("ticket-number")).toHaveTextContent(
      "TKT-000001"
    );
    expect(within(detail).getByTestId("ticket-date")).toHaveTextContent(
      "4 Sep 2026"
    );
    expect(within(detail).getByText("Requester")).toBeInTheDocument();
    expect(within(detail).getByText("Alice Johnson")).toBeInTheDocument();
    expect(within(detail).getByText("Category")).toBeInTheDocument();
    expect(within(detail).getByText("Hardware")).toBeInTheDocument();
    expect(within(detail).getByText("Related System")).toBeInTheDocument();
    expect(within(detail).getByText("Campus Wi-Fi")).toBeInTheDocument();

    const statusBadge = within(detail).getByTestId("status-badge");
    expect(statusBadge).toHaveTextContent("NEW");
    expect(statusBadge).toHaveAttribute("data-value", "NEW");

    const priorityBadge = within(detail).getByTestId("priority-badge");
    expect(priorityBadge).toHaveTextContent("HIGH");
    expect(priorityBadge).toHaveAttribute("data-value", "HIGH");

    expect(
      within(detail).getByText("Laptop battery drains quickly")
    ).toBeInTheDocument();
    expect(
      within(detail).getByText(/Battery lasts only two hours\./)
    ).toBeInTheDocument();
    expect(within(detail).getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (1 active)"
    );

    expect(
      within(detail).getByRole("button", { name: "Back to My Tickets" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("shows the breadcrumb 'My Tickets / TKT-000001' and calls onBack via it", async () => {
    await openDetail();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(breadcrumb).getByRole("button", { name: "My Tickets" })
    ).toBeInTheDocument();
    expect(within(breadcrumb).getByText("TKT-000001")).toBeInTheDocument();

    await user.click(
      within(breadcrumb).getByRole("button", { name: "My Tickets" })
    );
    expect(onBack).toHaveBeenCalled();
  });

  it("returns to My Tickets via the Back button", async () => {
    await openDetail();

    await user.click(screen.getByTestId("cancel-btn"));
    expect(onBack).toHaveBeenCalled();
  });

  it("calls fetchTicketDetail with the ticket and requester ids", async () => {
    await openDetail();

    expect(vi.mocked(api.fetchTicketDetail)).toHaveBeenCalledWith(1, 1);
  });

  it("shows the ownership error state for a 403 and can navigate back", async () => {
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(
      Object.assign(
        new Error("You do not have permission to view this ticket"),
        { status: 403, code: "FORBIDDEN" }
      )
    );

    renderDetail();
    await screen.findByText("You do not have permission to view this ticket.");

    await user.click(
      screen.getByRole("button", { name: "Back to My Tickets" })
    );
    expect(onBack).toHaveBeenCalled();
  });

  it("shows the not-found error state for a 404", async () => {
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(
      Object.assign(new Error("Ticket not found"), {
        status: 404,
        code: "TICKET_NOT_FOUND",
      })
    );

    renderDetail();

    expect(await screen.findByText("Ticket not found.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to My Tickets" })
    ).toBeInTheDocument();
  });
});