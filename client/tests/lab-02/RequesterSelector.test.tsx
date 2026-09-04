import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import App from "../../src/App.js";

vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
  { id: 5, name: "Eve Turner", email: "eve@example.com" },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
});

describe("RequesterSelector (T-002 / T-003)", () => {
  it("only shows active requesters in the dropdown", async () => {
    render(<App />);
    const select = await screen.findByTestId("requester-select");
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    // Placeholder + the 3 active requesters.
    expect(options).toContain("Alice Johnson (alice@example.com)");
    expect(options).toContain("Bob Smith (bob@example.com)");
    expect(options).toContain("Eve Turner (eve@example.com)");
  });

  it("selecting a requester shows their name in the header and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<App />);

    const select = await screen.findByTestId("requester-select");
    await user.selectOptions(select, "1");
    await user.click(screen.getByTestId("continue-btn"));

    // Header shows the selected requester's name.
    await waitFor(() => {
      const header = document.querySelector(".app-header__user-name");
      expect(header?.textContent).toBe("Alice Johnson");
    });

    // Persisted in localStorage.
    const stored = JSON.parse(localStorage.getItem("toktickit.requester")!);
    expect(stored).toEqual({ id: 1, name: "Alice Johnson", email: "alice@example.com" });
  });

  it("restores a persisted requester on reload", async () => {
    localStorage.setItem(
      "toktickit.requester",
      JSON.stringify({ id: 2, name: "Bob Smith", email: "bob@example.com" })
    );
    render(<App />);

    // Selector is gated off; header shows the persisted requester.
    await waitFor(() => {
      const header = document.querySelector(".app-header__user-name");
      expect(header?.textContent).toBe("Bob Smith");
    });
    expect(screen.queryByTestId("requester-select")).not.toBeInTheDocument();
  });
});
