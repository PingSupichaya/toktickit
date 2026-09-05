import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import * as api from "../../src/api.js";
import {
  RequesterProvider,
  useRequester,
} from "../../src/context/RequesterContext.js";

vi.mock("../../src/api.js");

const activeRequesters = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
];

const requesterById = (id: number) => activeRequesters.find((r) => r.id === id)!;

// A harness that models the app shell. It keeps a local "ticket context"
// (the ticket currently open) which FR-05 says MUST be cleared whenever the
// selected requester changes.
function Harness() {
  const { requester, selectRequester, clearRequester } = useRequester();
  const [ticketId, setTicketId] = React.useState<number | null>(null);

  // Whenever the requester changes (including switching), clear ticket context.
  React.useEffect(() => {
    setTicketId(null);
  }, [requester?.id]);

  function changeRequester(nextId: number) {
    // Simulate opening a ticket for the OLD requester first.
    setTicketId(999);
    // Then switch requester — the effect above wipes the stale ticket context.
    selectRequester(requesterById(nextId));
  }

  return (
    <div>
      <span data-testid="selected">
        {requester ? requester.name : "No requester selected"}
      </span>
      <span data-testid="ticket-context">
        {ticketId === null ? "none" : `ticket-${ticketId}`}
      </span>
      <button onClick={() => changeRequester(1)}>Switch to Alice</button>
      <button onClick={() => changeRequester(2)}>Switch to Bob</button>
      <button onClick={clearRequester}>Clear</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.fetchRequesters).mockResolvedValue(activeRequesters);
});

describe("RequesterContext (T-003 persistence + switch)", () => {
  it("persists the selected requester in localStorage", async () => {
    let apiCtx!: ReturnType<typeof useRequester>;
    function Capture() {
      apiCtx = useRequester();
      return null;
    }
    render(
      <RequesterProvider>
        <Capture />
      </RequesterProvider>
    );

    await act(async () => {
      apiCtx.selectRequester(requesterById(1));
    });

    const stored = JSON.parse(localStorage.getItem("toktickit.requester")!);
    expect(stored).toEqual({
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
    });
  });

  it("restores the persisted requester from localStorage across a page reload (remount)", async () => {
    const { unmount } = render(
      <RequesterProvider>
        <Harness />
      </RequesterProvider>
    );
    expect(screen.getByTestId("selected").textContent).toBe(
      "No requester selected"
    );

    // Simulate a previously persisted selection.
    await act(async () => {
      localStorage.setItem(
        "toktickit.requester",
        JSON.stringify(requesterById(2))
      );
    });

    // "Reload" — unmount and remount the whole tree.
    unmount();
    render(
      <RequesterProvider>
        <Harness />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe("Bob Smith");
    });
  });

  it("switching requester updates localStorage and clears the previous ticket context", async () => {
    render(
      <RequesterProvider>
        <Harness />
      </RequesterProvider>
    );

    // Select Alice first (persists to localStorage and updates state).
    await act(async () => {
      screen.getByText("Switch to Alice").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe("Alice Johnson");
    });
    expect(
      JSON.parse(localStorage.getItem("toktickit.requester")!)
    ).toMatchObject({ id: 1 });

    // User switches to Bob.
    await act(async () => {
      screen.getByText("Switch to Bob").click();
    });

    await waitFor(() => {
      // New requester is reflected in the store.
      expect(screen.getByTestId("selected").textContent).toBe("Bob Smith");
      // Previous ticket context is cleared (FR-05).
      expect(screen.getByTestId("ticket-context").textContent).toBe("none");
    });

    // localStorage reflects the newly selected requester.
    const stored = JSON.parse(localStorage.getItem("toktickit.requester")!);
    expect(stored).toEqual({
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
    });
  });

  it("clearRequester removes the requester from localStorage", async () => {
    let apiCtx!: ReturnType<typeof useRequester>;
    function Capture() {
      apiCtx = useRequester();
      return null;
    }
    render(
      <RequesterProvider>
        <Capture />
      </RequesterProvider>
    );

    await act(async () => {
      apiCtx.selectRequester(requesterById(1));
    });
    expect(localStorage.getItem("toktickit.requester")).not.toBeNull();

    await act(async () => {
      apiCtx.clearRequester();
    });
    await waitFor(() => {
      expect(localStorage.getItem("toktickit.requester")).toBeNull();
    });
  });
});
