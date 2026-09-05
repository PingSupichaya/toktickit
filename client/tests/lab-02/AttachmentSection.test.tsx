import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { Attachment } from "../../src/api.js";
import { AttachmentSection } from "../../src/components/features/AttachmentSection.js";

vi.mock("../../src/api.js");

const active1: Attachment = {
  id: 51,
  originalFilename: "battery-report.png",
  fileSizeBytes: 2048,
  contentType: "image/png",
  uploadedAt: "2026-09-04T11:00:00.000Z",
  isRemoved: false,
};

const removed1: Attachment = {
  id: 52,
  originalFilename: "old-screenshot.png",
  fileSizeBytes: 1024,
  contentType: "image/png",
  uploadedAt: "2026-09-03T09:00:00.000Z",
  isRemoved: true,
  removedAt: "2026-09-04T11:30:00.000Z",
  removalReason: "Duplicated file",
};

const active2: Attachment = {
  id: 53,
  originalFilename: "service-log.pdf",
  fileSizeBytes: 4194304,
  contentType: "application/pdf",
  uploadedAt: "2026-09-04T12:00:00.000Z",
  isRemoved: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.downloadAttachmentUrl).mockImplementation(
    (id, requesterId) =>
      `http://localhost:3000/api/attachments/${id}/download?requesterId=${requesterId}`
  );
  vi.mocked(api.formatTicketDate).mockImplementation(() => "4 Sep 2026");
  vi.mocked(api.removeAttachment).mockResolvedValue({
    ...active1,
    isRemoved: true,
    removedAt: "2026-09-05T09:00:00.000Z",
    removalReason: "Wrong file",
  });
  vi.mocked(api.uploadAttachment).mockResolvedValue({
    id: 60,
    originalFilename: "photo.png",
    fileSizeBytes: 100,
    contentType: "image/png",
    uploadedAt: "2026-09-05T09:05:00.000Z",
    isRemoved: false,
  });
});

const user = userEvent.setup();

function renderSection(attachments: Attachment[]) {
  return render(
    <AttachmentSection ticketId={1} requesterId={1} attachments={attachments} />
  );
}

describe("AttachmentSection (T-021) - AC-06 / AC-07", () => {
  it("renders the active attachment count heading with active and removed rows", () => {
    renderSection([active1, removed1]);

    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (1 active)"
    );

    const activeRow = screen.getByTestId("attachment-51");
    const downloadLink = within(activeRow).getByRole("link", {
      name: "battery-report.png",
    });
    expect(downloadLink).toHaveAttribute(
      "href",
      "http://localhost:3000/api/attachments/51/download?requesterId=1"
    );
    expect(
      within(activeRow).getByTestId("remove-attachment-btn")
    ).toBeInTheDocument();

    const removedRow = screen.getByTestId("attachment-removed-52");
    expect(removedRow).toHaveAttribute(
      "aria-label",
      "Removed attachment: old-screenshot.png"
    );
    expect(within(removedRow).getByText("Removed")).toBeInTheDocument();
    expect(within(removedRow).getByText("Reason: Duplicated file")).toBeInTheDocument();
    expect(within(removedRow).queryByRole("link")).not.toBeInTheDocument();
    expect(
      within(removedRow).queryByTestId("remove-attachment-btn")
    ).not.toBeInTheDocument();
  });

  it("shows the 'No attachments yet' empty state when there are no attachments", () => {
    renderSection([]);

    const empty = screen.getByTestId("empty-state");
    expect(within(empty).getByText("No attachments yet")).toBeInTheDocument();
    expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (0 active)"
    );
  });

  it("shows the upload zone when active count < 5 and 'Maximum attachments reached' at 5", () => {
    const first = renderSection([active1, active2]);
    expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    expect(screen.queryByTestId("attachment-max")).not.toBeInTheDocument();
    first.unmount();

    const fiveActive: Attachment[] = Array.from({ length: 5 }, (_, i) => ({
      ...active1,
      id: 100 + i,
      originalFilename: `file-${i}.png`,
    }));
    renderSection(fiveActive);

    expect(screen.getByTestId("attachment-max")).toBeInTheDocument();
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
  });

  it("opens the confirmation modal, removes on confirm, decreases the count (AC-07)", async () => {
    renderSection([active1, removed1]);

    await user.click(screen.getByTestId("remove-attachment-btn"));
    const modal = screen.getByRole("dialog", { name: "Remove Attachment" });
    expect(modal).toHaveAttribute("aria-modal", "true");
    expect(within(modal).getByText(/battery-report\.png/)).toBeInTheDocument();

    await user.type(screen.getByTestId("removal-reason"), "Wrong file");
    await user.click(screen.getByTestId("confirm-remove-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("attachment-removed-51")).toBeInTheDocument();
    });
    expect(vi.mocked(api.removeAttachment)).toHaveBeenCalledWith(
      51,
      1,
      "Wrong file"
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (0 active)"
    );
  });

  it("keeps the attachment when the modal is cancelled", async () => {
    renderSection([active1]);

    await user.click(screen.getByTestId("remove-attachment-btn"));
    expect(screen.getByRole("dialog", { name: "Remove Attachment" })).toBeInTheDocument();

    await user.click(screen.getByTestId("cancel-remove-btn"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(vi.mocked(api.removeAttachment)).not.toHaveBeenCalled();
    expect(screen.getByTestId("attachment-51")).toBeInTheDocument();
    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (1 active)"
    );
  });

  it("shows an error and keeps the row if removal fails", async () => {
    vi.mocked(api.removeAttachment).mockRejectedValue(
      new Error("You do not have permission to remove this attachment")
    );
    renderSection([active1]);

    await user.click(screen.getByTestId("remove-attachment-btn"));
    await user.type(screen.getByTestId("removal-reason"), "Wrong file");
    await user.click(screen.getByTestId("confirm-remove-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("removal-error")).toHaveTextContent(
        "You do not have permission to remove this attachment"
      );
    });
    expect(screen.getByRole("dialog", { name: "Remove Attachment" })).toBeInTheDocument();
    expect(screen.getByTestId("attachment-51")).toBeInTheDocument();
    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (1 active)"
    );
  });

  it("requires a reason before removing an attachment", async () => {
    renderSection([active1]);

    await user.click(screen.getByTestId("remove-attachment-btn"));
    await user.click(screen.getByTestId("confirm-remove-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("removal-error")).toHaveTextContent(
        "Reason is required before removing"
      );
    });
    expect(vi.mocked(api.removeAttachment)).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Remove Attachment" })).toBeInTheDocument();
    expect(screen.getByTestId("attachment-51")).toBeInTheDocument();
  });

  it("uploads a selected file and increments the active count (AC-06)", async () => {
    renderSection([active1]);

    const file = new File(["data"], "photo.png", { type: "image/png" });
    await user.upload(screen.getByTestId("attachment-input"), file);

    await waitFor(() => {
      expect(screen.getByTestId("attachment-60")).toBeInTheDocument();
    });
    expect(vi.mocked(api.uploadAttachment)).toHaveBeenCalledWith(1, 1, file);
    expect(screen.getByTestId("attachment-count")).toHaveTextContent(
      "Attachments (2 active)"
    );
  });
});