import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import App from "../../src/App.js";

// Mock the API module so no real fetch / network is attempted in tests.
vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
});

describe("App", () => {
  it("renders the TokTickIT selector heading before a requester is chosen", async () => {
    render(<App />);
    expect(await screen.findByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows the requester selector with active requesters on load", async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = await screen.findByTestId("requester-select");
    expect(trigger).toBeInTheDocument();
    // Open the dropdown to reveal the active requester options.
    await user.click(trigger);
    expect(screen.getByText("Alice Johnson (alice@example.com)")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith (bob@example.com)")).toBeInTheDocument();
  });

  it("shows an error and retry option when fetching requesters fails", async () => {
    vi.mocked(api.fetchRequesters).mockRejectedValueOnce(new Error("network down"));
    render(<App />);
    expect(await screen.findByText(/Failed to load requesters/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry/i)).toBeInTheDocument();
  });
});
