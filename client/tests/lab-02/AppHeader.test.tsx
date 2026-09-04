import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
});

async function renderWithRequester() {
  localStorage.setItem(
    "toktickit.requester",
    JSON.stringify({ id: 1, name: "Alice Johnson", email: "alice@example.com" })
  );
  render(<App />);
  await waitFor(() => {
    expect(
      document.querySelector(".app-header__user-name")?.textContent
    ).toBe("Alice Johnson");
  });
}

describe("AppHeader (Section 11)", () => {
  it("shows nav links (My Tickets, Create Ticket) with active state", async () => {
    await renderWithRequester();

    const myTickets = screen.getByRole("button", { name: "My Tickets" });
    const createTicket = screen.getByRole("button", { name: "Create Ticket" });

    // My Tickets is active by default.
    expect(myTickets.getAttribute("data-active")).toBe("true");
    expect(createTicket.getAttribute("data-active")).toBe("false");

    // Clicking Create Ticket moves the active indicator.
    await userEvent.click(createTicket);
    expect(createTicket.getAttribute("data-active")).toBe("true");
    expect(myTickets.getAttribute("data-active")).toBe("false");
  });

  it("hamburger opens a full-screen overlay with stacked nav and closes on ✕", async () => {
    await renderWithRequester();

    const hamburger = screen.getByRole("button", { name: "Open menu" });
    await userEvent.click(hamburger);

    // Overlay dialog opens with stacked links + requester info + switch button.
    const overlay = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(within(overlay).getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(within(overlay).getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();
    expect(within(overlay).getByText("Alice Johnson")).toBeInTheDocument();
    expect(
      within(overlay).getByRole("button", { name: "Switch Requester" })
    ).toBeInTheDocument();

    // Close hides the overlay.
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selecting a nav link in the overlay closes it", async () => {
    await renderWithRequester();
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Create Ticket" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
