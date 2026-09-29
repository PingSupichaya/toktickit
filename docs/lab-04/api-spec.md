# Lab 4 API Specification

## Overview

This document defines the REST API additions for TokTickIT Sprint 4: Actions Taken, the final Ticket resolution gate, optimistic concurrency, and role-appropriate dashboards. It extends the Lab 3 contract (`docs/lab-03/api-spec.md`); every Lab 2/3 endpoint not listed here is unchanged and remains in force, including the authentication/session model, error shape, and status-code conventions.

**Base URL:** `http://localhost:3000/api` (unchanged)

---

## 1. Conventions Carried Over from Lab 3

- **Session auth:** `toktickit_session` HttpOnly cookie; `401 UNAUTHORIZED` for missing/invalid/expired session, `403 FORBIDDEN` for wrong role, `404 NOT_FOUND` for cross-owner access (no existence leak).
- **Response shape:** `{ "data": { ... } }` or `{ "data": [...], "pagination": {...} }`; errors as `{ "error": { "message", "code", "details" } }`.
- **CSRF / rate limiting:** unchanged.

## 2. New Status Codes Introduced in Lab 4

| Status | Meaning |
|--------|---------|
| 409 `RESOLUTION_NOT_ALLOWED` | Ticket does not satisfy the resolution gate (BR-10) |
| 409 `STALE_UPDATE` | The submitted `version` does not match the current stored version (BR-12) |

---

## 3. Data Types

### ActionTaken object (in responses)

```json
{
  "id": 501,
  "ticketId": 42,
  "description": "Reseated the RAM and reran the diagnostic tool.",
  "result": "Diagnostic passed; battery drain no longer reproducible.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See diagnostic_log_2.pdf on the shared drive.",
  "performedBy": { "id": 10, "name": "Sam Patel", "role": "IT_STAFF" },
  "updatedBy": null,
  "version": 1,
  "createdAt": "2026-09-20T09:15:00.000Z",
  "updatedAt": "2026-09-20T09:15:00.000Z"
}
```

### Ticket object — fields added in Lab 4

```json
{
  "version": 3,
  "canResolve": false,
  "actionCount": 2,
  "hasOutstandingFollowUp": true
}
```

- `version` — optimistic-concurrency counter, starts at `1`, incremented on every successful operational update (D-01, BR-12).
- `canResolve` — helper flag consumed by the Status select (ui-spec §7). `true` only when the resolution gate (BR-10) is currently satisfied (≥1 Action Taken and latest has `followUpRequired = false`). Mirrors the Lab 3 `canIndicateResolved` pattern. UI convenience only — the backend independently rejects the write per BR-10.
- `actionCount` / `hasOutstandingFollowUp` — supporting fields so the client can render the resolution-gate hint without an extra request (`hasOutstandingFollowUp` reflects the latest Action Taken's `followUpRequired`).
- `permittedStatusTransitions` (Lab 3 §4.9, unchanged in shape) continues to list every transition that is legal per the matrix alone; `RESOLVED` is still listed when the matrix allows it even if `canResolve = false` — the UI then shows the option disabled with the hint instead of hiding it.

(All other Ticket fields are unchanged from `docs/lab-03/api-spec.md` §4.9.)

---

## 4. Endpoints

---

### 4.1 POST `/api/tickets/:ticketId/actions`

Create an Action Taken on a Ticket.

**Access:** `IT_STAFF` / `ADMIN` (BR-02). Not the submitting Requester, not restricted to the Ticket Owner — any Staff member may act on any accessible Ticket.

**Request body:**

```json
{
  "description": "Reseated the RAM and reran the diagnostic tool.",
  "result": "Diagnostic passed; battery drain no longer reproducible.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See diagnostic_log_2.pdf on the shared drive."
}
```

**Validation (BR-03, BR-04, BR-05):**

- `description`, `result`: required, 1–2000 chars after trim.
- `followUpRequired`: required boolean.
- `followUpNote`: required, 1–1000 chars after trim, **only when** `followUpRequired = true`; must be empty/omitted when `followUpRequired = false` (a non-empty value in that case is rejected).
- `attachmentNotes`: optional, 0–500 chars after trim.

**Success (201):** the created ActionTaken object (`performedBy` = session user, `version = 1`, `createdAt`/`updatedAt` = now).

**Errors:**

- `400 VALIDATION_ERROR` — field violations (`details` keyed by field, including `FOLLOW_UP_NOTE_REQUIRED` / `FOLLOW_UP_NOTE_NOT_ALLOWED`).
- `401 UNAUTHORIZED`.
- `403 FORBIDDEN` — Requester attempting to create (BR-02, AC-09).
- `404 NOT_FOUND` — Ticket does not exist.
- `500 INTERNAL_SERVER_ERROR`.

---

### 4.2 GET `/api/tickets/:ticketId/actions`

List Actions Taken for a Ticket, oldest first (BR-08).

**Access:** the submitting Requester of the Ticket (read-only), or `IT_STAFF`/`ADMIN` (any Ticket).

**Success (200):**

```json
{ "data": [ { "id": 501, "...": "as in §3" } ] }
```

Returns `{ "data": [] }` (never an error) when the Ticket has zero Actions Taken.

**Errors:** `401 UNAUTHORIZED`; `404 NOT_FOUND` (missing Ticket, or cross-owner Requester access — no existence leak, consistent with Lab 3 D-03); `500 INTERNAL_SERVER_ERROR`.

---

### 4.3 PATCH `/api/tickets/:ticketId/actions/:actionId`

Edit an existing Action Taken. Optimistic-concurrency protected.

**Access:** `IT_STAFF` / `ADMIN` (any Ticket, not only the original author — BR-02, BR-07).

**Request body (all fields optional except `version`; at least one editable field required):**

```json
{
  "version": 1,
  "description": "Reseated the RAM, reran diagnostics, and replaced the battery.",
  "result": "Battery replaced; confirmed stable over a 24-hour soak test.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See diagnostic_log_3.pdf."
}
```

**Validation:** same field rules as §4.1 for any field supplied; `version` is required and must equal the ActionTaken's current stored `version` (BR-12).

**Success (200):** the updated ActionTaken object; `version` incremented by 1; `updatedBy` set to the editing user; `updatedAt` refreshed. `performedBy` and `createdAt` are unchanged.

**Errors:**

- `400 VALIDATION_ERROR` — field violations, or missing `version`.
- `401 UNAUTHORIZED`.
- `403 FORBIDDEN` — Requester attempting to edit.
- `404 NOT_FOUND` — Ticket or Action Taken does not exist, or the Action Taken does not belong to the given Ticket.
- `409 STALE_UPDATE` — submitted `version` does not match the current stored `version`; response body includes the current ActionTaken so the client can refresh:
  ```json
  { "error": { "code": "STALE_UPDATE", "message": "This Action Taken was updated by someone else. Refresh and try again.", "details": { "current": { "...": "current ActionTaken object" } } } }
  ```
- `500 INTERNAL_SERVER_ERROR`.

---

### 4.4 PATCH `/api/tickets/:ticketId` (extended from Lab 3 §4.10)

Update Ticket operational fields. Behavior unchanged from Lab 3 except: (a) `version` is now required, (b) transitioning to `RESOLVED` is gated by BR-10.

**Access:** `IT_STAFF` / `ADMIN` only.

**Request body:**

```json
{ "version": 3, "itPriority": "HIGH", "currentStatus": "RESOLVED" }
```

**Validation:**

- `version` required; must match the Ticket's current stored `version` → otherwise `409 STALE_UPDATE` (same body shape as §4.3, with the current Ticket object).
- `itPriority ∈ {LOW, MEDIUM, HIGH}` (unchanged).
- `currentStatus` must be a permitted transition per §7 of `specification.md` → otherwise `409 TICKET_STATUS_TRANSITION_NOT_ALLOWED` (unchanged from Lab 3).
- **New:** if `currentStatus = RESOLVED`, the Ticket must have ≥ 1 Action Taken and the most recent Action Taken must have `followUpRequired = false` → otherwise `409 RESOLUTION_NOT_ALLOWED`:
  ```json
  { "error": { "code": "RESOLUTION_NOT_ALLOWED", "message": "This Ticket cannot be resolved yet — add an Action Taken with no outstanding follow-up first.", "details": {} } }
  ```
  This check is evaluated **after** the transition-matrix check and **before** the write is committed.

**Success (200):** returns the updated Ticket (same shape as Lab 3 §4.9 minus comments/notes, plus `version` incremented by 1 and refreshed `canResolve` / `actionCount` / `hasOutstandingFollowUp` per §3).

**Errors:** `400 VALIDATION_ERROR`; `401`; `403 FORBIDDEN`; `404 NOT_FOUND`; `409 STALE_UPDATE`; `409 TICKET_STATUS_TRANSITION_NOT_ALLOWED`; `409 RESOLUTION_NOT_ALLOWED`; `500`.

---

### 4.5 GET `/api/dashboard/requester`

Requester Dashboard metrics and recent Tickets (BR-14).

**Access:** `REQUESTER` only.

**Success (200):**

```json
{
  "data": {
    "metrics": {
      "myOpenTickets": 3,
      "waitingOnYou": 1,
      "resolved": 5,
      "closed": 12
    },
    "recentTickets": [
      {
        "id": 101,
        "ticketNumber": "TKT-000101",
        "summary": "Laptop battery drains quickly",
        "currentStatus": "IN_PROGRESS",
        "updatedAt": "2026-09-20T09:15:00.000Z"
      }
    ]
  }
}
```

`recentTickets` is capped at 5, ordered `updatedAt desc`; returns `[]` when the Requester has no Tickets (never an error — AC-11).

**Drill-down (client routing, no extra API):** each metric links to My Tickets (`GET /api/tickets`) pre-filtered:

| Metric | Drill-down query |
|---|---|
| `myOpenTickets` | `GET /api/tickets?status=NEW&status=OPEN&status=IN_PROGRESS&status=REOPENED` (own Tickets) |
| `waitingOnYou` | `GET /api/tickets?status=WAITING_FOR_REQUESTER` |
| `resolved` | `GET /api/tickets?status=RESOLVED` |
| `closed` | `GET /api/tickets?status=CLOSED` |

Timestamps are UTC ISO-8601 (BR-18); empty metrics return `0` and `recentTickets: []`, never an error.

**Errors:** `401 UNAUTHORIZED`; `403 FORBIDDEN` (non-Requester); `500 INTERNAL_SERVER_ERROR`.

---

### 4.6 GET `/api/dashboard/staff`

IT Staff Dashboard metrics and recent Tickets (BR-15).

**Access:** `IT_STAFF` / `ADMIN`.

**Success (200):**

```json
{
  "data": {
    "metrics": {
      "new": 14,
      "open": 23,
      "inProgress": 18,
      "waitingForRequester": 7,
      "unassigned": 9,
      "myAssigned": 16,
      "byPriority": { "low": 12, "medium": 27, "high": 6 }
    },
    "recentTickets": [
      {
        "id": 101,
        "ticketNumber": "TKT-000101",
        "summary": "Laptop battery drains quickly",
        "currentStatus": "IN_PROGRESS",
        "updatedAt": "2026-09-20T09:15:00.000Z"
      }
    ]
  }
}
```

`new`/`open`/`inProgress`/`waitingForRequester` are queue-wide counts. `unassigned` counts Tickets where `ownerId IS NULL` and `currentStatus ∉ {RESOLVED, CLOSED, CANCELLED}`. `myAssigned` counts Tickets owned by the session user with `currentStatus ∉ {RESOLVED, CLOSED, CANCELLED}`. `byPriority` counts active (non-terminal) Tickets grouped by `itPriority` (BR-15). `recentTickets` is the current user's 5 most recently updated owned Tickets, `[]` when none (AC-10).

**Drill-down (client routing to `GET /api/tickets/queue`, Lab 3 §4.8):**

| Metric | Drill-down query |
|---|---|
| `new` / `open` / `inProgress` / `waitingForRequester` | `GET /api/tickets/queue?status=NEW` (etc. for each status) |
| `unassigned` | `GET /api/tickets/queue?assignment=unassigned` |
| `myAssigned` | `GET /api/tickets/queue?assignment=assignedToMe` |
| `byPriority.low` / `.medium` / `.high` | `GET /api/tickets/queue?priority=LOW` (etc.) |
| `recentTickets` item | `GET /api/tickets/:ticketId` (Ticket Detail) |

Timestamps are UTC ISO-8601 (BR-18); zero metrics return `0`, never an error.

**Errors:** `401 UNAUTHORIZED`; `403 FORBIDDEN` (Requester); `500 INTERNAL_SERVER_ERROR`.

---

### 4.7 GET `/api/tickets/:ticketId` (extended from Lab 3 §4.9)

Ticket Detail response is unchanged from Lab 3 except the Lab 4 fields in §3 are added: `version`, `canResolve`, `actionCount`, `hasOutstandingFollowUp`. `permittedStatusTransitions` keeps its Lab 3 meaning (matrix legality only); `canResolve = false` does not remove `RESOLVED` from that array — the UI disables the option with the hint instead (ui-spec §7).

---

## 5. Validation and Concurrency Notes

### Optimistic concurrency (D-01, BR-12)

- Both `Ticket.version` and `ActionTaken.version` start at `1` and increment by exactly `1` on every successful write.
- A client must always send back the `version` it most recently read for the record it is writing to.
- The server performs the update as a single conditional statement (`UPDATE ... WHERE id = ? AND version = ?`); zero rows affected ⇒ `409 STALE_UPDATE`.
- The `409 STALE_UPDATE` body always includes the current server-side record so the client can refresh its view and let the user retry with current data, without a second round-trip.

### Resolution gate evaluation order (BR-10)

1. Authentication / authorization checks.
2. `version` match check (`409 STALE_UPDATE`).
3. Transition-matrix legality check (`409 TICKET_STATUS_TRANSITION_NOT_ALLOWED`).
4. Resolution-gate check, only when the target status is `RESOLVED` (`409 RESOLUTION_NOT_ALLOWED`).
5. Commit.

### Duplicate-submission handling (D-05, BR-21)

- Client disables the submit control and shows a busy state for the duration of the request (same pattern as Lab 2/3 forms).
- No server-side idempotency key is implemented in Lab 4 (see specification.md D-05); this is a documented, deliberate scope boundary.

---

## 6. Server Test Files (planned)

Tests live under `server/tests/lab-04/` and are planned in `docs/lab-04/tests.md`:

- `actions-taken.api.test.ts` — create/list/edit, validation, role restrictions, concurrency
- `ticket-workflow.api.test.ts` — resolution gate, full transition matrix, stale-write handling
- `requester-dashboard.api.test.ts` — metric calculations, empty states, ownership scoping
- `staff-dashboard.api.test.ts` — metric calculations, empty states, `myAssigned` scoping
