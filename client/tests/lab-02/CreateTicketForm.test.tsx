import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
  vi.mocked(api.fetchCategories).mockResolvedValue(categories);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue(relatedSystems);
  vi.mocked(api.createTicket).mockResolvedValue(createdTicket);
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
});