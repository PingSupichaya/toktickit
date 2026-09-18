import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as api from "../../src/api.js";
import {
  RequesterProvider,
  useRequester,
} from "../../src/context/RequesterContext.js";

let currentUser: api.AuthUser | null = null;

// RequesterProvider derives the requester from the authenticated user; the
// harness stubs AuthContext so requirePasswordChange/auth-flows are irrelevant.
vi.mock("../../src/context/AuthContext.js", () => ({
  useAuth: () => ({ user: currentUser }),
}));

const alice: api.AuthUser = {
  id: 1,
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "REQUESTER",
  isActive: true,
};

function Probe() {
  const { requester } = useRequester();
  return (
    <span data-testid="requester">
      {requester ? `${requester.name} (${requester.email})` : "No requester"}
    </span>
  );
}

beforeEach(() => {
  currentUser = null;
});

describe("RequesterContext (T-003) — requester derived from the authenticated user", () => {
  it("exposes the authenticated user as the requester", () => {
    currentUser = alice;

    render(
      <RequesterProvider>
        <Probe />
      </RequesterProvider>
    );

    expect(screen.getByTestId("requester")).toHaveTextContent(
      "Alice Johnson (alice@example.com)"
    );
  });

  it("returns no requester when there is no authenticated user", () => {
    render(
      <RequesterProvider>
        <Probe />
      </RequesterProvider>
    );

    expect(screen.getByTestId("requester")).toHaveTextContent("No requester");
  });
});