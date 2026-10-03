import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import { AuthContext } from "../../src/context/AuthContext.js";
import { ActionsTakenPanel, ActionsTakenReadonlyCard } from "../../src/components/features/ActionsTakenPanel.js";

vi.mock("../../src/api.js");

const staffUser: api.AuthUser = {
  id: 10,
  name: "Sam Patel",
  email: "sam@mail.kmutt.ac.th",
  role: "IT_STAFF",
  isActive: true,
};

const requesterUser: api.AuthUser = {
  id: 1,
  name: "Jennifer Lee",
  email: "jen@mail.kmutt.ac.th",
  role: "REQUESTER",
  isActive: true,
};

function authValue(user: api.AuthUser) {
  return {
    status: "authenticated" as const,
    user,
    mustChangePassword: false,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  };
}

const actionOne: api.ActionTaken = {
  id: 501,
  ticketId: 42,
  actionAt: "2026-09-20T09:15:00.000Z",
  description: "Reseated the RAM and reran the diagnostic tool.",
  result: "Diagnostic passed.",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: "See diagnostic_log_2.pdf on the shared drive.",
  performedBy: { id: 10, name: "Sam Patel", role: "IT_STAFF" },
  updatedBy: null,
  version: 1,
  createdAt: "2026-09-20T09:20:00.000Z",
  updatedAt: "2026-09-20T09:20:00.000Z",
};

const actionTwo: api.ActionTaken = {
  ...actionOne,
  id: 502,
  actionAt: "2026-09-21T10:00:00.000Z",
  description: "Replaced the battery.",
  result: "Stable over a 24-hour soak test.",
  followUpRequired: true,
  followUpNote: "Recheck in a week.",
  version: 2,
};

function mockList(actions: api.ActionTaken[]) {
  vi.mocked(api.fetchActionsTaken).mockResolvedValue(actions);
}

async function openCreateForm() {
  await userEvent.setup().click(screen.getByTestId("add-action-btn"));
  await screen.findByTestId("save-action-btn");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList([actionOne]);
});

describe("UI-01 — follow-up conditional field (AC-01 / FR-02)", () => {
  it("note hidden/cleared when toggle off; required when toggle on", async () => {
    const user = userEvent.setup();
    render(<ActionsTakenPanel ticketId={42} />);
    await screen.findByTestId("actions-taken-list");
    await openCreateForm();

    // Hidden while the toggle is off.
    expect(screen.queryByTestId("action-followup-note-input")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("action-followup-toggle"));
    await screen.findByTestId("action-followup-note-input");

    // Toggle back off clears and hides the note.
    await user.click(screen.getByTestId("action-followup-toggle"));
    expect(screen.queryByTestId("action-followup-note-input")).not.toBeInTheDocument();

    // Toggle on, submit without a note → inline error, no API call.
    await user.click(screen.getByTestId("action-followup-toggle"));
    const note = await screen.findByTestId("action-followup-note-input");
    await user.type(screen.getByTestId("action-description-input"), "Did some work");
    await user.type(screen.getByTestId("action-result-input"), "It worked");
    await user.click(screen.getByTestId("save-action-btn"));
    await screen.findByText("Required when follow-up is needed");
    expect(api.createActionTaken).not.toHaveBeenCalled();
    expect(note).toBeInTheDocument();

    // With a note the create goes through with the flag set.
    vi.mocked(api.createActionTaken).mockResolvedValue({ ...actionOne, id: 600 });
    await user.type(note, "Check back tomorrow");
    await user.click(screen.getByTestId("save-action-btn"));
    await waitFor(() =>
      expect(api.createActionTaken).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ followUpRequired: true, followUpNote: "Check back tomorrow" })
      )
    );
  });
});

describe("UI-02 — edit mode (FR-03)", () => {
  it("Performed By is static text, action date stays editable, Save busies", async () => {
    const user = userEvent.setup();
    let resolveSave!: (a: api.ActionTaken) => void;
    vi.mocked(api.updateActionTaken).mockImplementation(
      () => new Promise<api.ActionTaken>((resolve) => (resolveSave = resolve))
    );
    render(<ActionsTakenPanel ticketId={42} />);
    await screen.findByTestId("actions-taken-list");

    await user.click(screen.getAllByTestId("edit-action-btn")[0]);
    await screen.findByTestId("save-action-btn");

    // Performed By is static text, never an input.
    const performer = screen.getByTestId("action-performer-static");
    expect(performer).toHaveTextContent("Sam Patel");
    expect(within(performer).queryByRole("textbox")).not.toBeInTheDocument();

    const datetime = screen.getByTestId("action-datetime-input");
    expect(datetime).not.toBeDisabled();
    expect(datetime).toHaveAttribute("type", "datetime-local");

    const save = screen.getByTestId("save-action-btn");
    await user.click(save);
    // Busy/disabled for the duration of the request (Lab 2/3 button rules).
    expect(save).toBeDisabled();
    resolveSave({ ...actionOne, description: "Edited" });
    // Completion closes the form and updates the list in place.
    await waitFor(() =>
      expect(screen.queryByTestId("save-action-btn")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });
});

describe("UI-03 — Requester read-only rendering (AC-08, AC-09 / FR-04)", () => {
  it("renders zero write controls for a Requester viewer", async () => {
    render(
      <AuthContext.Provider value={authValue(requesterUser)}>
        <ActionsTakenPanel ticketId={42} />
      </AuthContext.Provider>
    );
    await screen.findByTestId("actions-taken-list");

    expect(screen.queryByTestId("add-action-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-action-btn")).not.toBeInTheDocument();
    // The list itself is still visible read-only.
    expect(screen.getByText(actionOne.description)).toBeInTheDocument();
  });

  it("readonly card never contains write controls regardless of data", async () => {
    mockList([actionOne, actionTwo]);
    render(<ActionsTakenReadonlyCard ticketId={42} />);
    await screen.findByTestId("actions-taken-readonly");

    expect(screen.getByText("Actions Taken (2)")).toBeInTheDocument();
    expect(screen.queryByTestId("add-action-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-action-btn")).not.toBeInTheDocument();
    expect(screen.getByText(actionTwo.description)).toBeInTheDocument();
  });
});

describe("UI-04 — conflict banner on stale write (AC-07 / BR-12)", () => {
  it("409 repopulates the form and shows the banner with refreshed version", async () => {
    const user = userEvent.setup();
    const current: api.ActionTaken = {
      ...actionOne,
      description: "Newer description from a colleague",
      version: 2,
    };
    const stale = Object.assign(new Error("Stale"), {
      status: 409,
      code: "STALE_UPDATE",
      details: { current },
    });
    vi.mocked(api.updateActionTaken).mockRejectedValueOnce(stale);
    render(<ActionsTakenPanel ticketId={42} />);
    await screen.findByTestId("actions-taken-list");

    await user.click(screen.getAllByTestId("edit-action-btn")[0]);
    const save = await screen.findByTestId("save-action-btn");
    await user.click(save);

    const banner = await screen.findByTestId("action-conflict-banner");
    expect(banner).toHaveTextContent("updated by someone else");
    // Form repopulated with the server's current values.
    expect(screen.getByTestId("action-description-input")).toHaveValue(
      "Newer description from a colleague"
    );
    // The conflict remounts the form with the server's current values, so
    // re-query the live Save button before retrying.
    const retry = await screen.findByTestId("save-action-btn");
    vi.mocked(api.updateActionTaken).mockResolvedValueOnce(current);
    await user.click(retry);
    await waitFor(() =>
      expect(api.updateActionTaken).toHaveBeenLastCalledWith(
        42,
        501,
        expect.objectContaining({ version: 2 })
      )
    );
  });
});
