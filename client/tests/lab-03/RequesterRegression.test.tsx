import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { TicketDetail as TicketDetailData } from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import { TicketDetail } from "../../src/components/features/TicketDetail.js";

vi.mock("../../src/api.js");

let currentUser: api.AuthUser | null = {
  id: 1,
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "REQUESTER",
  isActive: true,
};

// RequesterProvider derives the requester from the authenticated session, so
// the harness stubs AuthContext with the signed-in user.
vi.mock("../../src/context/AuthContext.js", () => ({
  useAuth: () => ({ user: currentUser }),
}));

const aliceComment = (id: number, content: string, createdAt: string) => ({
  id,
  ticketId: 1,
  author: { id: 1, name: "Alice Johnson" },
  content,
  createdAt,
});

const makeDetail = (overrides: Partial<TicketDetailData> = {}): TicketDetailData => ({
  id: 1,
  ticketNumber: "TKT-000001",
  submittedById: 1,
  submitter: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  categoryId: 2,
  category: { id: 2, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Campus Wi-Fi" },
  summary: "Laptop battery drains quickly",
  description: "Battery lasts only two hours.",
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  currentStatus: "NEW",
  ticketDate: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-04T10:30:00.000Z",
  canIndicateResolved: true,
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
  comments: [
    aliceComment(51, "I already restarted the laptop.", "2026-09-04T11:00:00.000Z"),
    aliceComment(52, "Battery still draining fast.", "2026-09-04T12:00:00.000Z"),
  ],
  notes: [
    {
      id: 99,
      ticketId: 1,
      author: { id: 7, name: "Grace IT" },
      content: "Internal note: clearly a hardware fault.",
      createdAt: "2026-09-04T13:00:00.000Z",
    },
  ],
  ...overrides,
});

const onBack = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(makeDetail());
  vi.mocked(api.formatTicketDate).mockImplementation(() => "4 Sep 2026");
  vi.mocked(api.downloadAttachmentUrl).mockImplementation(
    (id) => `http://localhost:3000/api/attachments/${id}/download`
  );
});

const user = userEvent.setup();

function renderDetail(ticket: TicketDetailData = makeDetail()) {
  vi.mocked(api.fetchTicketDetail).mockResolvedValue(ticket);
  render(
    <RequesterProvider>
      <TicketDetail ticketId={1} onBack={onBack} />
    </RequesterProvider>
  );
}

async function openDetail(ticket: TicketDetailData = makeDetail()) {
  renderDetail(ticket);
  await waitFor(() => {
    expect(screen.getByTestId("ticket-detail-number")).toBeInTheDocument();
  });
}

describe("Requester Ticket Detail additions (UI-09 - AC-13)", () => {
  it("renders the Public Comments card newest-first with author, time, and composer counter", async () => {
    await openDetail();

    const comments = screen.getByTestId("public-comments");
    expect(within(comments).getByText("Public Comments (2)")).toBeInTheDocument();

    const items = within(comments).getAllByTestId(/^comment-\d+$/);
    expect(items).toHaveLength(2);
    expect(items.map((el) => el.getAttribute("data-testid"))).toEqual([
      "comment-52",
      "comment-51",
    ]);

    expect(
      within(comments).getAllByText((_, el) =>
        (el?.textContent ?? "").trim() === "Alice Johnson · 4 Sep 2026"
      )
    ).toHaveLength(2);
    expect(within(comments).getByText("Battery still draining fast.")).toBeInTheDocument();
    expect(within(comments).getByTestId("counter-comment")).toHaveTextContent(
      "0 / 2000 characters"
    );
    expect(
      within(comments).getByRole("button", { name: "Post Comment" })
    ).toBeInTheDocument();
  });

  it("shows the IT Priority badge with the 'IT:' prefix on detail", async () => {
    await openDetail();

    const itBadge = screen.getByTestId("it-priority-badge");
    expect(itBadge).toHaveTextContent("IT: HIGH");
    expect(itBadge).toHaveAttribute("data-value", "HIGH");

    const requestedBadge = screen.getByTestId("priority-badge");
    expect(requestedBadge).toHaveTextContent("HIGH");
    expect(requestedBadge).toHaveAttribute("data-value", "HIGH");
  });

  it("never renders Internal Notes to a Requester (BR-04 / BR-28)", async () => {
    await openDetail();

    expect(screen.queryByText("Internal note: clearly a hardware fault.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-99")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal only")).not.toBeInTheDocument();
  });

  it("posts a Public Comment, appends it immediately, and clears the composer", async () => {
    vi.mocked(api.postComment).mockResolvedValue(
      aliceComment(53, "Uploaded a new battery report.", "2026-09-04T13:00:00.000Z")
    );
    await openDetail();

    await user.type(
      screen.getByTestId("comment-textarea"),
      "Uploaded a new battery report."
    );
    expect(screen.getByTestId("counter-comment")).toHaveTextContent(
      "30 / 2000 characters"
    );

    await user.click(screen.getByTestId("post-comment-btn"));

    await waitFor(() => {
      expect(vi.mocked(api.postComment)).toHaveBeenCalledWith(
        1,
        "Uploaded a new battery report."
      );
    });
    expect(screen.getByTestId("comment-53")).toBeInTheDocument();
    expect(screen.getByTestId("public-comments")).toHaveTextContent(
      "Public Comments (3)"
    );
    expect(screen.getByTestId("comment-textarea")).toHaveValue("");
  });

  it("rejects an empty Public Comment with inline validation", async () => {
    await openDetail();

    await user.click(screen.getByTestId("post-comment-btn"));

    expect(screen.getByTestId("comment-error")).toHaveTextContent(
      "Comment must not be empty"
    );
    expect(vi.mocked(api.postComment)).not.toHaveBeenCalled();
  });

  it("shows 'Problem Appears Resolved', confirms via modal, and hides after posting", async () => {
    vi.mocked(api.indicateResolved).mockResolvedValue(
      aliceComment(
        90,
        "The Requester indicated the problem appears resolved.",
        "2026-09-04T13:00:00.000Z"
      )
    );
    await openDetail();

    const indicateBtn = screen.getByTestId("indicate-resolved-btn");
    await user.click(indicateBtn);

    expect(
      screen.getByText("Have you confirmed the problem is resolved?")
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-indicate-resolved-btn"));

    await waitFor(() => {
      expect(vi.mocked(api.indicateResolved)).toHaveBeenCalledWith(1);
    });
    expect(screen.getByTestId("comment-90")).toBeInTheDocument();
    expect(
      screen.getByText("The Requester indicated the problem appears resolved.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("public-comments")).toHaveTextContent(
      "Public Comments (3)"
    );
    expect(screen.queryByTestId("indicate-resolved-btn")).not.toBeInTheDocument();
  });

  it("never shows the indicator button for terminal statuses or when the API denies it", async () => {
    await openDetail(makeDetail({ currentStatus: "RESOLVED", canIndicateResolved: true }));
    expect(screen.queryByTestId("indicate-resolved-btn")).not.toBeInTheDocument();

    await openDetail(makeDetail({ currentStatus: "NEW", canIndicateResolved: false }));
    expect(screen.queryByTestId("indicate-resolved-btn")).not.toBeInTheDocument();
  });

  it("shows 'Provide Information' only when WAITING_FOR_REQUESTER and moves the Ticket to OPEN", async () => {
    vi.mocked(api.requesterRespond).mockResolvedValue({
      ticket: {
        ticketId: 1,
        ticketNumber: "TKT-000001",
        currentStatus: "OPEN",
        updatedAt: "2026-09-05T09:00:00.000Z",
      },
      comment: aliceComment(91, "Here is the invoice.", "2026-09-05T09:00:00.000Z"),
    });

    await openDetail(
      makeDetail({ currentStatus: "WAITING_FOR_REQUESTER", canIndicateResolved: false })
    );

    expect(screen.queryByTestId("indicate-resolved-btn")).not.toBeInTheDocument();
    const respondBtn = screen.getByTestId("requester-respond-btn");
    await user.click(respondBtn);

    await user.type(screen.getByTestId("respond-textarea"), "Here is the invoice.");
    await user.click(screen.getByTestId("confirm-respond-btn"));

    await waitFor(() => {
      expect(vi.mocked(api.requesterRespond)).toHaveBeenCalledWith(
        1,
        "Here is the invoice."
      );
    });
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-value", "OPEN");
    expect(screen.getByTestId("comment-91")).toBeInTheDocument();
    expect(screen.queryByTestId("respond-textarea")).not.toBeInTheDocument();
    expect(screen.queryByTestId("requester-respond-btn")).not.toBeInTheDocument();
  });

  it("allows a Provide Information reply with no comment (status still moves to OPEN)", async () => {
    vi.mocked(api.requesterRespond).mockResolvedValue({
      ticket: {
        ticketId: 1,
        ticketNumber: "TKT-000001",
        currentStatus: "OPEN",
        updatedAt: "2026-09-05T09:00:00.000Z",
      },
    });

    await openDetail(
      makeDetail({ currentStatus: "WAITING_FOR_REQUESTER", canIndicateResolved: false })
    );

    await user.click(screen.getByTestId("requester-respond-btn"));
    await user.click(screen.getByTestId("confirm-respond-btn"));

    await waitFor(() => {
      expect(vi.mocked(api.requesterRespond)).toHaveBeenCalledWith(1, undefined);
    });
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-value", "OPEN");
    expect(screen.getByTestId("public-comments")).toHaveTextContent(
      "Public Comments (2)"
    );
  });
});

describe("Requester regression under session identity (UI-10 - AC-20)", () => {
  it("removes an attachment on the detail and shows the muted removed row", async () => {
    vi.mocked(api.removeAttachment).mockResolvedValue({
      removedAt: "2026-09-05T09:00:00.000Z",
      removalReason: "Duplicated file",
    } as api.Attachment);
    await openDetail();

    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (1 active)"
    );
    expect(screen.getByTestId("attachment-removed-52")).toBeInTheDocument();

    await user.click(screen.getByTestId("remove-attachment-btn"));
    await user.type(screen.getByTestId("removal-reason"), "Duplicated file");
    await user.click(screen.getByTestId("confirm-remove-btn"));

    await waitFor(() => {
      expect(vi.mocked(api.removeAttachment)).toHaveBeenCalledWith(
        51,
        "Duplicated file"
      );
    });
    expect(screen.getByTestId("attachment-removed-51")).toBeInTheDocument();
    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (0 active)"
    );
  });
});