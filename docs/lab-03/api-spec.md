# Lab 3 API Specification

## Overview

This document defines the REST API contract for TokTickIT Sprint 3: users, roles, IT Staff ticketing, Public Comments, Internal Notes, and Administrator user management. It supersedes the Lab 2 contract where behavior changed (authentication, ownership responses, status enum) and preserves Lab 2 endpoints that still apply.

**Base URL:** `http://localhost:3000/api`

---

## 1. Authentication and Session Model

### Mechanism

- **Password hashing:** bcrypt, cost factor 12. Plaintext passwords never persist and are never returned by any response.
- **Session:** On successful login the server creates a `Session` row whose `tokenHash` is the SHA-256 digest of a random 32-byte token. The raw token is sent to the client in an HttpOnly cookie named `toktickit_session`.
- **Cookie attributes:** `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` (8 hours); `Secure` is added in non-local environments.
- **Expiry:** 8-hour absolute expiry enforced server-side on every authenticated request (BR-12).
- **Logout:** `POST /api/auth/logout` deletes the `Session` row; the client also clears the cookie.
- **CSRF:** SameSite=Lax plus an `Origin` (fallback `Referer`) header check on all state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`). A mismatched or missing origin is rejected with `403 CSRF_ORIGIN_MISMATCH` when a session is present.
- **Rate limiting:** login is limited to 5 failed attempts per email within a rolling 15-minute window; further attempts return `429 TOO_MANY_ATTEMPTS` until the window clears. Successful login resets the counter.

### How a Request Is Authenticated

1. Client sends the `toktickit_session` cookie with every request.
2. Middleware hashes the cookie value (SHA-256), finds a matching, unexpired `Session` row, and attaches the user.
3. Missing/invalid/expired session → `401 UNAUTHORIZED`.
4. Route-specific role checks then apply; failure → `403 FORBIDDEN`.

### Error handling, object access vs role

- Unauthenticated access → `401 UNAUTHORIZED`
- Authenticated but wrong role (e.g., Requester → Notes, Queue, Users) → `403 FORBIDDEN`
- **Cross-owner access is indistinguishable from a missing resource → `404 NOT_FOUND`** (no existence leak, D-03).

---

## 2. Common Response Patterns

### Success

```json
{ "data": { } }
```

Lists/paginated endpoints:

```json
{
  "data": [ ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error

```json
{
  "error": {
    "message": "Human-readable safe message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | OK — retrieval or successful update |
| 201 | Created (Ticket, Comment, Note, User, Attachment) |
| 204 | No content (logout) |
| 400 | Validation failure / invalid input / invalid query parameters |
| 401 | Unauthenticated (missing/invalid/expired session; invalid credentials) |
| 403 | Forbidden role, or CSRF origin mismatch |
| 404 | Resource not found, or cross-owner access (no existence leak) |
| 409 | Conflict (duplicate email, claim conflict, invalid status transition, self-deactivation, last-admin safety, already-resolved indicator) |
| 413 | Payload too large |
| 415 | Unsupported file type |
| 429 | Too many login attempts |
| 500 | Unexpected server error (safe message only) |

---

## 3. User and Role Data Types

### UserRole

```
enum UserRole { REQUESTER  IT_STAFF  ADMIN }
```

### TicketStatus (Lab 3)

```
enum TicketStatus {
  NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER,
  RESOLVED, CLOSED, REOPENED, CANCELLED
}
```

### Priority (used for both Requested Priority and IT Priority)

```
enum Priority { LOW  MEDIUM  HIGH }
```

### User object (in responses)

Never includes `passwordHash`, `failedLoginAttempts`, or `lastFailedLoginAt`.

```json
{
  "id": 1,
  "name": "Alice Johnson",
  "email": "alice.john@mail.kmutt.co.th",
  "role": "REQUESTER",
  "isActive": true,
  "mustChangePassword": true,
  "createdAt": "2026-09-14T10:00:00.000Z"
}
```

---

## 4. Endpoints

---

### 4.1 POST `/api/auth/login`

Authenticate with email/password and establish a session.

**Access:** Public.

**Request body:**

```json
{ "email": "alice.john@mail.kmutt.co.th", "password": "ChangeMe123!" }
```

**Success (200):** sets `toktickit_session` cookie.

```json
{
  "data": {
    "user": {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice.john@mail.kmutt.co.th",
      "role": "REQUESTER",
      "isActive": true
    },
    "mustChangePassword": true
  }
}
```

**Errors:**

- `400 VALIDATION_ERROR` — missing/blank email or password (details).
- `401 INVALID_CREDENTIALS` — generic message `"Invalid email or password"` for unknown email or wrong password.
- `403 ACCOUNT_INACTIVE` — `"Your account is not active. Contact your administrator."`
- `429 TOO_MANY_ATTEMPTS` — `"Too many failed login attempts. Try again later."`
- `500 INTERNAL_SERVER_ERROR`

**Notes:** A user with `mustChangePassword = true` still authenticates successfully; the client must route them to the Change Password screen (AC-02).

---

### 4.2 POST `/api/auth/logout`

Invalidate the current session.

**Access:** Any authenticated user.

**Success (204):** Session row deleted; response instructs the browser to clear the cookie.

**Errors:** `401 UNAUTHORIZED` (no session). Logout is idempotent-safe: calling it again returns `401`.

---

### 4.3 GET `/api/auth/me`

Return the current authenticated user; used to restore session state on page reload.

**Access:** Any authenticated user.

**Success (200):**

```json
{
  "data": {
    "user": { "id": 1, "name": "Alice Johnson", "email": "alice.john@mail.kmutt.co.th", "role": "REQUESTER", "isActive": true },
    "mustChangePassword": true
  }
}
```

**Errors:** `401 UNAUTHORIZED`.

---

### 4.4 POST `/api/auth/change-password`

Change the current password. Available to authenticated users; the first-login flow uses it to clear `mustChangePassword`.

**Access:** Any authenticated user.

**Request body:**

```json
{
  "currentPassword": "ChangeMe123!",
  "newPassword": "NewSecurePass1!"
}
```

**Validation (BR-10, BR-02):**

- `currentPassword` must match the stored hash.
- `newPassword`: 8–64 characters; at least one uppercase, one lowercase, one digit, one special character; must differ from the current password.

**Success (200):** password re-hashed with bcrypt, `mustChangePassword = false`, session remains valid.

```json
{
  "data": {
    "user": { "id": 1, "name": "Alice Johnson", "email": "alice.john@mail.kmutt.co.th", "role": "REQUESTER", "isActive": true },
    "mustChangePassword": false
  }
}
```

**Errors:**

- `400 VALIDATION_ERROR` — rule violations with `details` keyed by field (`newPassword`, `currentPassword`).
- `401 UNAUTHORIZED` — no session or wrong `currentPassword` (`INVALID_CURRENT_PASSWORD`).
- `500 INTERNAL_SERVER_ERROR`

---

### 4.5 GET `/api/categories` and `GET /api/related-systems`

Reference data for ticket forms and the queue filters. Behavior unchanged from Lab 2 except that a valid session is now required.

**Access:** Any authenticated user.

**Success (200):** `{ "data": [ { "id": 1, "name": "Account and Access" }, ... ] }`

**Errors:** `401 UNAUTHORIZED`; `500 INTERNAL_SERVER_ERROR`.

**Removed:** `GET /api/requesters` no longer exists (development selector removed).

---

### 4.6 POST `/api/tickets`

Create a Ticket. The submitter is the authenticated user; `requesterId` in the body is ignored if present (BR-03).

**Access:** `REQUESTER` only.

**Request body:**

```json
{
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "My corporate laptop battery drains very quickly, lasting only 2 hours on a full charge.",
  "requestedPriority": "MEDIUM"
}
```

**Validation (unchanged from Lab 2):** `summary` 10–200 chars trimmed; `description` 20–2000 chars trimmed; `requestedPriority ∈ {LOW, MEDIUM, HIGH}`; `categoryId` and `relatedSystemId` must reference active records.

**Success (201):**

```json
{
  "data": {
    "id": 42,
    "ticketNumber": "TKT-000042",
    "submittedById": 1,
    "submitter": { "id": 1, "name": "Alice Johnson", "email": "alice.john@mail.kmutt.co.th" },
    "ownerId": null,
    "owner": null,
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "summary": "Laptop battery drains quickly",
    "description": "My corporate laptop battery drains very quickly, lasting only 2 hours on a full charge.",
    "requestedPriority": "MEDIUM",
    "itPriority": "MEDIUM",
    "currentStatus": "NEW",
    "ticketDate": "2026-09-14T10:30:00.000Z",
    "createdAt": "2026-09-14T10:30:00.000Z",
    "updatedAt": "2026-09-14T10:30:00.000Z"
  }
}
```

**Notes:** `itPriority` is initialized to `requestedPriority` (BR-19). `attachmentCount` and other read models unchanged.

**Errors:** `400 VALIDATION_ERROR`; `401 UNAUTHORIZED`; `403 FORBIDDEN` (non-Requester role); `404` referenced reference data missing; `500`.

---

### 4.7 GET `/api/tickets` (My Tickets)

Return only the authenticated Requester's own Tickets (BR-16, BR-03).

**Access:** `REQUESTER` only.

**Query parameters (unchanged from Lab 2):**

| Parameter | Type | Notes |
|-----------|------|-------|
| `search` | string | Case-insensitive substring in `ticketNumber`, `summary`, `description` |
| `categoryId` | int | Filter |
| `relatedSystemId` | int | Filter |
| `status` | enum | Filter; one of the 8 statuses |
| `priority` | enum | Filter on `requestedPriority` (`LOW/MEDIUM/HIGH`) |
| `sortBy` | string | `ticketDate` (default) or `ticketNumber` |
| `sortOrder` | string | `asc` or `desc` (default `desc`) |
| `page` | int | Default 1 |
| `pageSize` | int | 10, 25, or 50; default 10 |

**Success (200):** `{ data: [...], pagination: {...} }`. Each row includes `ticketNumber`, `summary`, `requestedPriority`, `currentStatus`, `itPriority`, `ticketDate`, `category`, `relatedSystem`, `owner` (id/name), `attachmentCount`.

**Errors:** `400 INVALID_PARAMETERS` (invalid enum filters); `401 UNAUTHORIZED`; `403 FORBIDDEN` (non-Requester); `500`.

---

### 4.8 GET `/api/tickets/queue` (IT Staff Ticket Queue)

Return the shared Ticket Queue across all Requesters.

**Access:** `IT_STAFF` or `ADMIN`.

**Query parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `search` | string | Case-insensitive substring in `ticketNumber`, `summary`, `description`, Requester `name`, Requester `email` (BR-37) |
| `status` | enum | One of the 8 statuses |
| `priority` | enum | Filter on `itPriority` (`LOW/MEDIUM/HIGH`) |
| `categoryId` | int | Filter |
| `relatedSystemId` | int | Filter |
| `assignment` | string | `unassigned` \| `assignedToMe` \| `all` |
| `ownerId` | int | Filter by specific owner (optional; ignored when `assignment` is set to a non-`all` value) |
| `sortBy` | string | `itPriority` \| `ticketDate` \| `updatedAt` \| `requestedPriority` \| `ticketNumber` \| `currentStatus` (see Default ordering below) |
| `sortOrder` | string | `asc` or `desc` (default `asc` when `sortBy` is provided) |
| `page` | int | Default 1 |
| `pageSize` | int | 10, 25, or 50; default 10 |

**Default ordering:** when no `sortBy` is supplied, the queue is ordered `itPriority DESC, ticketDate ASC` (highest priority first, oldest first within the same priority — D-10). When `sortBy` is supplied, ordering uses that column with `sortOrder` (default `asc`) and `ticketDate ASC` as a stable tiebreaker.

**Success (200):**

```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-000042",
      "summary": "Laptop battery drains quickly",
      "requestedPriority": "MEDIUM",
      "itPriority": "HIGH",
      "currentStatus": "IN_PROGRESS",
      "ticketDate": "2026-09-12T09:15:00.000Z",
      "updatedAt": "2026-09-14T11:00:00.000Z",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "requester": { "id": 1, "name": "Alice Johnson", "email": "alice.john@mail.kmutt.co.th" },
      "owner": { "id": 10, "name": "Sam Patel", "role": "IT_STAFF" },
      "attachmentCount": 2
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalCount": 21, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": false }
}
```

**Errors:** `400 INVALID_PARAMETERS` (invalid enum/assignment/ownerId values); `401 UNAUTHORIZED`; `403 FORBIDDEN` (Requester role — BR-36); `500`.

---

### 4.9 GET `/api/tickets/:ticketId`

Return one Ticket's full detail.

**Access:**

- `REQUESTER` — only Tickets they submitted: `ticket.submittedById === session.user.id`; otherwise `404 NOT_FOUND` (no existence leak, D-03).
- `IT_STAFF` / `ADMIN` — any Ticket.

**Response (200):** Ticket fields plus:

- `attachments` (all, including removed metadata — same shape as Lab 2)
- `comments` (Public Comments, joined with author and ordered `createdAt asc`)
- `notes` (Internal Notes) — **present only for `IT_STAFF`/`ADMIN` viewers**
- `canIndicateResolved` (boolean) — helper flag for the Requester's "Problem Appears Resolved" action availability
- `permittedStatusTransitions` (array of statuses) — helper consumed by the IT Staff status dropdown, derived from the transition matrix

```json
{
  "data": {
    "id": 42,
    "ticketNumber": "TKT-000042",
    "submittedById": 1,
    "submitter": { "id": 1, "name": "Alice Johnson", "email": "alice.john@mail.kmutt.co.th" },
    "ownerId": 10,
    "owner": { "id": 10, "name": "Sam Patel", "role": "IT_STAFF" },
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "summary": "Laptop battery drains quickly",
    "description": "My corporate laptop battery drains very quickly, lasting only 2 hours on a full charge.",
    "requestedPriority": "MEDIUM",
    "itPriority": "HIGH",
    "currentStatus": "IN_PROGRESS",
    "ticketDate": "2026-09-12T09:15:00.000Z",
    "createdAt": "2026-09-12T09:15:00.000Z",
    "updatedAt": "2026-09-14T11:00:00.000Z",
    "permittedStatusTransitions": ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    "canIndicateResolved": false,
    "attachments": [],
    "comments": [
      { "id": 1, "author": { "id": 1, "name": "Alice Johnson" }, "content": "It happens after the last update.", "createdAt": "2026-09-12T10:00:00.000Z" }
    ],
    "notes": [
      { "id": 2, "author": { "id": 10, "name": "Sam Patel" }, "content": "Waiting on vendor patch.", "createdAt": "2026-09-13T08:30:00.000Z" }
    ]
  }
}
```

**Errors:** `400 INVALID_TICKET_ID`; `401 UNAUTHORIZED`; `404 NOT_FOUND` (missing, or cross-owner requester access); `500`.

---

### 4.10 PATCH `/api/tickets/:ticketId`

Update Ticket operational fields. Only IT Staff/Administrator.

**Access:** `IT_STAFF` / `ADMIN` only.

**Request body (both fields optional, at least one required):**

```json
{ "itPriority": "HIGH", "currentStatus": "IN_PROGRESS" }
```

**Validation:**

- `itPriority ∈ {LOW, MEDIUM, HIGH}`.
- `currentStatus` must be a permitted transition from the current status per the matrix in `specification.md §5.3`; otherwise `409 TICKET_STATUS_TRANSITION_NOT_ALLOWED`.

**Success (200):** returns the updated Ticket (same shape as §4.9 minus comments/notes for compactness; includes owner submitter for the UI).

**Errors:** `400 VALIDATION_ERROR`; `401 UNAUTHORIZED`; `403 FORBIDDEN` (Requester); `404 NOT_FOUND` (missing Ticket); `409 STATUS_TRANSITION_NOT_ALLOWED`; `500`.

---

### 4.11 POST `/api/tickets/:ticketId/claim`

Claim an unassigned Ticket for the current IT Staff/Administrator user.

**Access:** `IT_STAFF` / `ADMIN`.

**Request body:** none.

**Success (200):** `owner` is set to the authenticated user.

```json
{
  "data": { "ticketId": 42, "owner": { "id": 10, "name": "Sam Patel", "role": "IT_STAFF" } }
}
```

**Errors:** `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 NOT_FOUND` (missing Ticket); `409 TICKET_ALREADY_ASSIGNED` (already has an owner — use the assign endpoint); `500`.

---

### 4.12 PUT `/api/tickets/:ticketId/owner`

Assign or reassign Ticket ownership to any eligible user.

**Access:** `IT_STAFF` / `ADMIN`.

**Request body:**

```json
{ "ownerId": 11 }
```

**Validation:** `ownerId` must be an existing, active user with role `IT_STAFF` or `ADMIN` (BR-17).

**Success (200):**

```json
{"data": { "ticketId": 42, "owner": { "id": 11, "name": "Priya Nair", "role": "IT_STAFF" } } }
```

**Errors:** `400 VALIDATION_ERROR` (invalid ownerId); `401`; `403`; `404 NOT_FOUND` (Ticket or owner not found — owner lookup does not reveal inactive users, returns `NOT_FOUND`); `500`.

---

### 4.13 Comments

#### POST `/api/tickets/:ticketId/comments`

Create a Public Comment.

**Access:** the submitting Requester of the Ticket, or `IT_STAFF`/`ADMIN`.

**Request body:**

```json
{ "content": "I tried a fresh battery and it works now." }
```

**Validation (BR-23):** `content` 1–2000 chars after trim; whitespace-only rejected (`400 VALIDATION_ERROR`).

**Success (201):** append-only; author and createdAt set by the backend.

```json
{
  "data": { "id": 9, "ticketId": 42, "author": { "id": 1, "name": "Alice Johnson" }, "content": "I tried a fresh battery and it works now.", "createdAt": "2026-09-14T12:00:00.000Z" }
}
```

**Errors:** `400 VALIDATION_ERROR`; `401`; `403 FORBIDDEN` (Requester posting on a Ticket they do not own); `404 NOT_FOUND` (missing Ticket or cross-owner access); `500`.

#### GET `/api/tickets/:ticketId/comments`

List Public Comments, oldest first.

**Access:** the submitting Requester of the Ticket, or `IT_STAFF`/`ADMIN`.

**Success (200):** `{ "data": [comment, ...] }` (shape above, ordered `createdAt asc`).

**Errors:** `401`, `404` (missing or cross-owner), `500`.

---

### 4.14 Notes (Internal Notes)

#### POST `/api/tickets/:ticketId/notes`

Create an Internal Note (visible only to IT Staff/Administrator).

**Access:** `IT_STAFF` / `ADMIN` only.

**Request body:**

```json
{ "content": "Waited 48h; vendor JD-992 confirmed root cause." }
```

**Validation (BR-24):** `content` 1–2000 chars after trim; whitespace-only rejected.

**Success (201):** same append-only shape as a Comment, with `author`.

**Errors:** `400 VALIDATION_ERROR`; `401`; `403 FORBIDDEN` (Requester — BR-28); `404 NOT_FOUND` (missing Ticket); `500`.

#### GET `/api/tickets/:ticketId/notes`

List Internal Notes, oldest first.

**Access:** `IT_STAFF` / `ADMIN` only.

**Success (200):** `{ "data": [note, ...] }`.

**Errors:** `401`; `403 FORBIDDEN` (Requester — BR-28, no note content exposed); `404` (missing Ticket); `500`.

---

### 4.15 POST `/api/tickets/:ticketId/indicate-resolved`

Requester "Problem Appears Resolved." Records an automatic Public Comment; does **not** change the Ticket status (BR-05, BR-21).

**Access:** the submitting Requester of the Ticket.

**Request body:** none.

**Validation:** Ticket status must be one of `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`. Otherwise `409 TICKET_NOT_INDICATABLE`.

**Success (201):** creates a Public Comment authored by the Requester with fixed, safe system text:

> "The Requester indicated the problem appears resolved."

```json
{ "data": { "id": 12, "ticketId": 42, "author": { "id": 1, "name": "Alice Johnson" }, "content": "The Requester indicated the problem appears resolved.", "createdAt": "2026-09-14T13:00:00.000Z" } }
```

**Errors:** `401`; `403 FORBIDDEN` (staff trying to use the Requester action, or Requester on a Ticket they did not submit); `404 NOT_FOUND` (missing/cross-owner); `409 TICKET_NOT_INDICATABLE`; `500`.

---

### 4.16 POST `/api/tickets/:ticketId/requester-respond`

Requester provides the requested information, moving the Ticket from `WAITING_FOR_REQUESTER` to `OPEN` (FR-13, BR-22). This is the only status write a Requester may perform.

**Access:** the submitting Requester of the Ticket.

**Request body:**

```json
{ "content": "I have attached the new screenshot. Please continue." }
```

`content` is optional; when provided it becomes a Public Comment authored by the Requester (must satisfy BR-23: 1–2000 chars trimmed).

**Success (200):** Ticket status is now `OPEN`; if `content` was provided, the returned object includes the created Public Comment.

```json
{
  "data": {
    "ticket": { "ticketId": 42, "ticketNumber": "TKT-000042", "currentStatus": "OPEN", "updatedAt": "2026-09-14T13:30:00.000Z" },
    "comment": { "id": 13, "ticketId": 42, "author": { "id": 1, "name": "Alice Johnson" }, "content": "I have attached the new screenshot. Please continue.", "createdAt": "2026-09-14T13:30:00.000Z" }
  }
}
```

**Errors:** `400 VALIDATION_ERROR` (invalid optional `content`); `401`; `403 FORBIDDEN` (staff invoking the Requester action, or Requester on a Ticket they did not submit); `404 NOT_FOUND` (missing/cross-owner); `409 TICKET_STATUS_TRANSITION_NOT_ALLOWED` (status is not `WAITING_FOR_REQUESTER`); `500`.

---

### 4.17 Attachment endpoints (Lab 2 continuation, authenticated)

Behavior is identical to Lab 2 with two changes: authorization comes from the session (never a `requesterId` in body/query), and cross-owner access returns `404` instead of `403`.

#### POST `/api/tickets/:ticketId/attachments` (multipart/form-data)

- **Access:** the submitting Requester only (`403 FORBIDDEN` for staff/admin; `404` for cross-owner).
- Field `file` required; `requesterId` field is ignored if present.
- Same validation as Lab 2: MIME ∈ {`image/jpeg`, `image/png`, `image/webp`, `application/pdf`}; size ≤ 5 MB (`413`/`415`); active attachment count < 5 (`409 MAX_ATTACHMENTS_REACHED`).
- **Success (201):** attachment metadata (id, ticketId, originalFilename, fileSizeBytes, contentType, uploadedAt, isRemoved).

#### GET `/api/tickets/:ticketId/attachments`

- **Access:** submitting Requester or `IT_STAFF`/`ADMIN`.
- Query param `includeRemoved=true` includes removed metadata (requester) as in Lab 2.
- **Success (200):** `{ "data": [attachment, ...] }`.

#### GET `/api/attachments/:attachmentId/download`

- **Access:** submitting Requester or `IT_STAFF`/`ADMIN`.
- **Success (200):** streams the file (Content-Type, Content-Disposition).
- **Errors:** `404` for missing attachment or cross-ticket/cross-owner access; `403 ATTACHMENT_REMOVED` when the attachment is soft-removed and the viewer may otherwise access the Ticket.

#### DELETE `/api/attachments/:attachmentId`

- **Access:** the submitting Requester only.
- Body: `{ "removalReason": "optional, ≤ 500 chars" }`.
- **Success (200):** metadata with `isRemoved: true`, `removedAt`, `removalReason`.
- **Errors:** `404` missing or cross-owner; `409 ALREADY_REMOVED`.

---

### 4.18 GET `/api/users` (User list)

**Access:** `ADMIN` only.

**Query parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `search` | string | Optional; case-insensitive substring on `name` or `email` |
| `role` | enum | Optional; `REQUESTER`, `IT_STAFF`, or `ADMIN` (single filter) |

No pagination is required (Excluded Scope).

**Success (200):**

```json
{
  "data": [
    { "id": 1, "name": "Alice Johnson", "email": "alice.john@mail.kmutt.co.th", "role": "REQUESTER", "isActive": true, "mustChangePassword": true, "createdAt": "2026-09-01T09:00:00.000Z" }
  ]
}
```

**Errors:** `400 INVALID_PARAMETERS` (invalid role); `401`; `403 FORBIDDEN` (non-Admin); `500`.

---

### 4.19 POST `/api/users` (Create user)

**Access:** `ADMIN` only.

**Request body:**

```json
{
  "name": "Mina Chen",
  "email": "mina.chen@mail.kmutt.co.th",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "TempPass1!"
}
```

**Validation (BR-29, BR-13, BR-10):**

- `name` required (1–200 chars trimmed).
- `email` required, valid format, unique.
- `role ∈ {REQUESTER, IT_STAFF, ADMIN}`.
- `initialPassword` follows BR-10 rules (8–64 chars; upper/lower/digit/special).

**Success (201):** password bcrypt-hashed; `mustChangePassword = true`.

```json
{ "data": { "id": 21, "name": "Mina Chen", "email": "mina.chen@mail.kmutt.co.th", "role": "IT_STAFF", "isActive": true, "mustChangePassword": true, "createdAt": "2026-09-14T14:00:00.000Z" } }
```

**Errors:** `400 VALIDATION_ERROR` (details include `email`/`role`/`initialPassword` issues); `401`; `403`; `409 EMAIL_ALREADY_EXISTS`; `500`.

---

### 4.20 PATCH `/api/users/:userId` (Update user)

**Access:** `ADMIN` only.

**Request body (all fields optional, at least one required):**

```json
{ "name": "Mina Chen-Woo", "email": "mina.chen@mail.kmutt.co.th", "role": "IT_STAFF", "isActive": false }
```

**Validation and safety rules:**

- `name`, `email` (unique), `role` (enum), `isActive` (boolean) — otherwise `400`.
- An Administrator may not deactivate their **own** account → `409 CANNOT_DEACTIVATE_SELF` (BR-31).
- No change may leave the system with zero active Administrators → `409 LAST_ACTIVE_ADMIN` (BR-32). This checks the resulting set of active `ADMIN` users after the change.
- Duplicate email on another user → `409 EMAIL_ALREADY_EXISTS`.

**Success (200):** updated User object (same shape as create; password data never included).

**Errors:** `400`, `401`, `403`, `404 NOT_FOUND` (unknown user), `409` as above, `500`.

---

### 4.21 POST `/api/users/:userId/reset-initial-password`

Set a new initial password for a user; the user must change it at the next login.

**Access:** `ADMIN` only.

**Request body:**

```json
{ "newPassword": "ResetMe123!" }
```

**Validation:** `newPassword` follows BR-10. (Allows resetting for any user including the current Administrator; the caller is then marked `mustChangePassword = true` and must change it next login.)

**Success (200):** password bcrypt-hashed; `mustChangePassword = true`.

```json
{ "data": { "id": 21, "name": "Mina Chen-Woo", "email": "mina.chen@mail.kmutt.co.th", "role": "IT_STAFF", "isActive": true, "mustChangePassword": true } }
```

**Errors:** `400 VALIDATION_ERROR`; `401`; `403`; `404 NOT_FOUND`; `500`.

---

## 5. Validation and Security Notes

### Ownership and existence-leak policy (D-03)

- Object-level "this is someone else's Ticket / Attachment / Note" is indistinguishable from "does not exist" → `404 NOT_FOUND`.
- Role-level restrictions (Requester calling a Staff endpoint) → `403 FORBIDDEN`.

### Input sanitization

- All strings trimmed before validation.
- Unicode-aware length checks on Summary, Description, Comment, Note, Name fields.
- Email normalized to lowercase before uniqueness checks.
- Comment/Note content is plain text; client renders escaped text with `white-space: pre-wrap` (BR-27). No HTML is executed.
- Attachment filenames sanitized exactly as in Lab 2 (UUID storage names; original names preserved for display).

### Transactional integrity

- Ticket creation generates `TKT-NNNNNN` from the row id inside a transaction (unchanged from Lab 2).
- "Problem Appears Resolved" inserts a single Public Comment row (no multi-entity transaction required).
- Assignments and status changes are single-row updates; status changes are validated against the current status read in the same request.

### Secrets

- Session tokens and password hashes are never returned to the client.
- `server/.env` and all secrets remain git-ignored; `.env.example` documents new variables (e.g., `COOKIE_SECURE`, `TRUSTED_ORIGINS`).

---

## 6. Server Test Files (planned)

Tests live under `server/tests/lab-03/` and are planned in `docs/lab-03/tests.md`:

- `auth.api.test.ts` — login/logout/me/change-password, rate limiting, inactive, safe errors
- `authorization.api.test.ts` — 401/403/404 matrix, existence-leak behavior, role navigation data
- `staff-queue.api.test.ts` — search/filter/sort/pagination + invalid params
- `staff-ticket-detail.api.test.ts` — claim/assign, IT Priority, status transitions
- `comments-notes.api.test.ts` — Public Comments, Internal Notes, role restrictions, append-only
- `users-admin.api.test.ts` — list/search/filter, create, edit, initial password, safety rules