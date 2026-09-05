import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import type { Ticket } from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
];

const categories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
  { id: 4, name: "Network" },
];

const relatedSystems = [
  { id: 1, name: "Email" },
  { id: 2, name: "Campus Wi-Fi" },
  { id: 3, name: "VPN" },
  { id: 4, name: "LEB2 App" },
];

const createdTicket: Ticket = {
  id: 1,
  ticketNumber: "TKT-000001",
  requesterId: 1,
  requester: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  categoryId: 2,
  category: { id: 2, name: "Hardware" },
  relatedSystemId: 2,
  relatedSystem: { id: 2, name: "Campus Wi-Fi" },
  summary: "Laptop battery drains quickly",
  description:
    "My corporate laptop battery drains very quickly, lasting only 2 hours.",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  ticketDate: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-04T10:30:00.000Z",
  updatedAt: "2026-09-04T10:30:00.000Z",
};

const uploadedAttachment = {
  id: 103,
  ticketId: 1,
  originalFilename: "error-screenshot.png",
  fileSizeBytes: 64,
  contentType: "image/png",
  uploadedAt: "2026-09-05T11:00:00.000Z",
  isRemoved: false,
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
  vi.mocked(api.fetchCategories).mockResolvedValue(categories);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue(relatedSystems);
  vi.mocked(api.createTicket).mockResolvedValue(createdTicket);
  vi.mocked(api.uploadAttachment).mockResolvedValue(uploadedAttachment);
});

const user = userEvent.setup();

async function openCreateTicket() {
  localStorage.setItem(
    "toktickit.requester",
    JSON.stringify({ id: 1, name: "Alice Johnson", email: "alice@example.com" })
  );
  render(<App />);
  await waitFor(() => {
    expect(document.querySelector(".app-header__user-name")?.textContent).toBe(
      "Alice Johnson"
    );
  });
  await user.click(screen.getByRole("button", { name: "Create Ticket" }));
  await waitFor(() => {
    expect(screen.getByTestId("submit-btn")).toBeInTheDocument();
  });
}

async function fillValidForm() {
  await user.click(screen.getByTestId("category-select"));
  await user.click(screen.getByText("Hardware"));
  await user.click(screen.getByTestId("related-system-select"));
  await user.click(screen.getByText("Campus Wi-Fi"));
  await user.type(
    screen.getByTestId("summary-input"),
    "Laptop battery drains quickly"
  );
  await user.type(
    screen.getByTestId("description-input"),
    "My corporate laptop battery drains very quickly, lasting only 2 hours."
  );
  await user.click(screen.getByRole("radio", { name: "MEDIUM" }));
}

describe("CreateTicketForm (T-009 / T-010)", () => {
  it("shows skeleton loading for reference data and disables the submit button while fetching", async () => {
    vi.mocked(api.fetchCategories).mockImplementation(() => new Promise(() => {}));
    vi.mocked(api.fetchRelatedSystems).mockImplementation(
      () => new Promise(() => {})
    );

    await openCreateTicket();

    expect(await screen.findByTestId("loading-categories")).toBeInTheDocument();
    expect(screen.getByTestId("loading-related-systems")).toBeInTheDocument();
    expect(screen.getByTestId("submit-btn")).toBeDisabled();
  });

  it("populates Category and Related System dropdowns from the API (FR-08)", async () => {
    await openCreateTicket();
    expect(await screen.findByTestId("category-select")).toBeInTheDocument();

    await user.click(screen.getByTestId("category-select"));
    categories.forEach((c) => {
      expect(screen.getByText(c.name)).toBeInTheDocument();
    });
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId("related-system-select"));
    relatedSystems.forEach((s) => {
      expect(screen.getByText(s.name)).toBeInTheDocument();
    });
  });

  it("keeps the submit button disabled until all required fields are valid (initial state)", async () => {
    await openCreateTicket();
    await waitFor(() => {
      expect(screen.getByTestId("category-select")).toBeInTheDocument();
    });

    expect(screen.getByTestId("submit-btn")).toBeDisabled();
    expect(screen.queryByTestId("error-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("error-description")).not.toBeInTheDocument();
  });

  it("shows an inline error below a field on blur and clears it on correction", async () => {
    await openCreateTicket();
    await waitFor(() => {
      expect(screen.getByTestId("category-select")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("summary-input"));
    await user.type(screen.getByTestId("summary-input"), "Hi");
    await user.tab();

    expect(await screen.findByTestId("error-summary")).toHaveTextContent(
      "Summary must be between 10 and 200 characters"
    );
    expect(screen.getByTestId("counter-summary")).toHaveTextContent(
      "2 / 200 characters"
    );
    expect(screen.getByTestId("submit-btn")).toBeDisabled();

    // Description shorter than 20 characters is also rejected inline.
    await user.type(screen.getByTestId("description-input"), "Too short");
    await user.tab();
    expect(await screen.findByTestId("error-description")).toHaveTextContent(
      "Description must be between 20 and 2000 characters"
    );

    // Correcting the summary removes the error immediately.
    await user.clear(screen.getByTestId("summary-input"));
    await user.type(screen.getByTestId("summary-input"), "Laptop battery is dead");
    await waitFor(() => {
      expect(screen.queryByTestId("error-summary")).not.toBeInTheDocument();
    });
  });

  it("enters the busy state while submitting and shows a success banner when the ticket is created (T-010)", async () => {
    let resolveCreate!: (t: Ticket) => void;
    vi.mocked(api.createTicket).mockImplementation(
      () =>
        new Promise<Ticket>((resolve) => {
          resolveCreate = resolve;
        })
    );

    await openCreateTicket();
    await waitFor(() => {
      expect(screen.getByTestId("category-select")).toBeInTheDocument();
    });
    await fillValidForm();

    expect(screen.getByTestId("submit-btn")).toBeEnabled();

    await user.click(screen.getByTestId("submit-btn"));

    // Busy state: spinner + "Submitting…", whole button disabled, aria-busy set.
    const busyBtn = screen.getByTestId("submit-btn-busy");
    expect(busyBtn).toHaveAttribute("aria-busy", "true");
    expect(busyBtn).toBeDisabled();
    expect(busyBtn).toHaveTextContent("Submitting…");

    await act(async () => {
      resolveCreate(createdTicket);
    });

    expect(await screen.findByTestId("success-banner")).toHaveTextContent(
      "Ticket TKT-000001 created successfully."
    );

    // The form resets to the initial state after success.
    expect(screen.getByTestId("submit-btn")).toBeDisabled();
  });

  it("shows an error banner, re-enables the form, and preserves entered data when submission fails (T-009)", async () => {
    vi.mocked(api.createTicket).mockRejectedValue(
      new Error("Failed to create ticket")
    );

    await openCreateTicket();
    await waitFor(() => {
      expect(screen.getByTestId("category-select")).toBeInTheDocument();
    });
    await fillValidForm();
    await user.click(screen.getByTestId("submit-btn"));

    expect(await screen.findByTestId("error-banner")).toHaveTextContent(
      "Failed to create ticket"
    );

    // All user-entered data is preserved so the user can retry.
    expect(screen.getByTestId("summary-input")).toHaveValue(
      "Laptop battery drains quickly"
    );
    expect(screen.getByTestId("description-input")).toHaveValue(
      "My corporate laptop battery drains very quickly, lasting only 2 hours."
    );
    expect(screen.getByTestId("submit-btn")).toBeEnabled();
  });

  it("renders the attachment upload zone and lists selected files (ui-spec 12.2 #7)", async () => {
    await openCreateTicket();
    expect(await screen.findByTestId("attachment-input")).toBeInTheDocument();
    expect(screen.getByText("JPG, PNG, WEBP, PDF (max 5 MB)")).toBeInTheDocument();

    await user.upload(screen.getByTestId("attachment-input"), [
      new File(["x"], "error-screenshot.png", { type: "image/png" }),
      new File(["y"], "guide.pdf", { type: "application/pdf" }),
    ]);

    expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^attachment-row-/)).toHaveLength(2);

    // Attachments are optional: the submit button only needs the other fields.
    expect(screen.getByTestId("submit-btn")).toBeDisabled();
    await fillValidForm();
    expect(screen.getByTestId("submit-btn")).toBeEnabled();
  });

  it("rejects disallowed file types and oversized files before upload (BR-12 / BR-13)", async () => {
    await openCreateTicket();
    const input = await screen.findByTestId("attachment-input");

    // fireEvent bypasses the accept-attribute filter (as OS file dialogs do);
    // the validation logic must still reject the file.
    fireEvent.change(input, {
      target: {
        files: [new File(["hello"], "notes.txt", { type: "text/plain" })],
      },
    });
    expect(await screen.findByTestId("attachment-error")).toHaveTextContent(
      "notes.txt is not an allowed file type"
    );
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();

    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "huge.pdf",
      { type: "application/pdf" }
    );
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(await screen.findByTestId("attachment-error")).toHaveTextContent(
      "huge.pdf exceeds the 5 MB limit"
    );
    expect(screen.queryByText("huge.pdf")).not.toBeInTheDocument();
  });

  it("allows at most 5 attachments and replaces the zone with a maximum message (BR-14)", async () => {
    await openCreateTicket();
    const input = await screen.findByTestId("attachment-input");

    await user.upload(
      input,
      Array.from(
        { length: 5 },
        (_, i) =>
          new File(["a"], `evidence-${i + 1}.png`, { type: "image/png" })
      )
    );

    expect(screen.getAllByTestId(/^attachment-row-/)).toHaveLength(5);
    expect(await screen.findByTestId("attachment-max")).toBeInTheDocument();
    expect(screen.getByText("Maximum 5 attachments reached")).toBeInTheDocument();
    expect(screen.queryByTestId("attachment-input")).not.toBeInTheDocument();
  });

  it("uploads selected files to the created ticket and lets a failed upload be retried (FR-30)", async () => {
    const png = new File(["abc"], "error-screenshot.png", { type: "image/png" });
    vi.mocked(api.uploadAttachment)
      .mockRejectedValueOnce(new Error("Upload failed. Try again."))
      .mockResolvedValueOnce(uploadedAttachment);

    await openCreateTicket();
    await waitFor(() => {
      expect(screen.getByTestId("category-select")).toBeInTheDocument();
    });
    await fillValidForm();
    await user.upload(screen.getByTestId("attachment-input"), png);
    await user.click(screen.getByTestId("submit-btn"));

    // Ticket creation succeeds, then the attachment upload attempt fails.
    expect(await screen.findByTestId("success-banner")).toHaveTextContent(
      "Ticket TKT-000001 created successfully."
    );
    expect(await screen.findByText("Upload failed. Try again.")).toBeInTheDocument();

    // Retry re-uploads the same file to the same ticket.
    const retry = screen.getAllByRole("button", { name: /^Retry/ })[0];
    await user.click(retry);

    expect(await screen.findByText("Uploaded")).toBeInTheDocument();
    expect(api.uploadAttachment).toHaveBeenCalledWith(1, 1, png);
    expect(api.uploadAttachment).toHaveBeenCalledTimes(2);

    // While the success banner is up, picking files for a NEW ticket is blocked.
    expect(screen.getByTestId("attachment-input")).toBeDisabled();

    // Dismiss clears the previous ticket's rows and re-enables selection.
    await user.click(screen.getByTestId("success-dismiss"));
    await waitFor(() => {
      expect(screen.queryAllByTestId(/^attachment-row-/)).toHaveLength(0);
    });
    expect(screen.getByTestId("attachment-input")).toBeEnabled();
  });
});