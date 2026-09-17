# Lab 3 Specification: Users, Roles, IT Staff Ticketing, and Admin User Management

---

## 1. Sprint Goal

Replace the Lab 2 development Requester selector with real email/password authentication, a mandatory first-login password change, and server-side role-based authorization for three roles: Requester, IT Staff, and Administrator. Deliver the first operational IT Staff workflow — a searchable Ticket Queue, an extended Ticket Detail with ownership, IT Priority, a permitted status workflow, Public Comments and Internal Notes — plus a minimalist Administrator User Management screen for viewing, creating, editing, activating/deactivating, and issuing initial passwords for accounts. Every Lab 2 Requester function continues to work, now bound to the authenticated identity instead of a client-chosen requester.

---

## 2. Stakeholder Request

The temporary Requester selector is no longer acceptable. The system needs real users who sign in with an email address and password. Users with an initial password must choose a new one before entering the application. Administrators need a simple User Management screen: view users, create an account, assign one role, update basic account information, activate or deactivate an account, and set a new initial password.

Requesters keep every ticket function built in Lab 2, but the current Requester identity must always come from the authenticated account. IT Staff need a professional Ticket Queue to find work, open Ticket Detail, claim or reassign ownership, set IT Priority, communicate through Public Comments, record private Internal Notes, and move a Ticket through a permitted status workflow. Requesters may indicate that a problem appears resolved, but only IT Staff may formally resolve or close a Ticket. Every screen and API must be protected according to role and ownership — hiding a button is not authorization.

---

## 3. Scope

### Included

- Email/password authentication, session management (HttpOnly cookie session), logout, current-user retrieval
- Mandatory first-login password change with password-rule validation
- Server-side role-based authorization for Requester, IT Staff, and Administrator on every protected endpoint
- Migration of the Lab 2 Development Requester records into the real User model; removal of the Requester selector and its client-side state
- Requester regression: create/list/detail Tickets and the full Attachment lifecycle using the authenticated identity; Public Comments on owned Tickets; "Problem Appears Resolved" indicator
- IT Staff Ticket Queue with search, filters, sorting, and pagination
- IT Staff Ticket Detail with ownership (claim/assign/reassign), IT Priority, permitted status transitions, Public Comments, and Internal Notes
- Public Comments visible to Requester, IT Staff, and Administrator; Internal Notes visible only to IT Staff and Administrator
- Minimalist Administrator User Management: user list with name/email search and optional role filter; create user with one role and initial password; edit name/email/role/activation state; set a new initial password
- Administrator safety rules: no self-deactivation, always at least one active Administrator, no user deletion (deactivation instead)
- Prisma data-model migration preserving all Lab 2 Tickets and Attachments; idempotent seed data
- Zen Green UI extensions following `ui-spec.md`

### Excluded

- Email invitations, password-reset email, multi-factor authentication, social login, and single sign-on
- Self-registration and Requester-created accounts
- Actions Taken by IT Staff (deferred to Lab 4)
- SLA calculation, escalation rules, and notification services
- Dashboards and KPI analytics beyond simple queue counts
- Multi-tenant organizations, departments, and customer administration
- Multiple roles per user, role history, and account audit history
- User deletion, bulk operations, import/export, and account-history screens
- Extended user-profile management (department, organization, profile photo)
- Email delivery of initial passwords or reset links
- Account unlocking, administrator approval workflows, and advanced identity-management functions
- Advanced user-list features: mandatory pagination, multi-column sorting, multiple simultaneous filters

---

## 4. Functional Requirements

### 4.1 Authentication and Sessions

**FR-01** A user must authenticate with an email address and password. On successful authentication the server establishes a session and returns the permitted user identity and role.

**FR-02** Users marked as requiring a password change (`mustChangePassword = true`) must be allowed to complete the change-password flow but must not reach any other application screen until a valid new password is saved.

**FR-03** The Logout action must invalidate the server-side session and clear client access.

**FR-04** The current authenticated user and role must be retrievable on page reload via `GET /api/auth/me`.

**FR-05** Every protected API and screen must enforce authorization on the server. Hiding or disabling a frontend control is feedback only, never a security control.

**FR-06** The authenticated user identity — never a `requesterId` supplied by the client — must determine ownership of all Requester operations.

**FR-07** Navigation must show only the destinations permitted for the authenticated role.

### 4.2 Requester Regression and Public Comments

**FR-08** An authenticated Requester must be able to create a Ticket using their authenticated identity; the client no longer sends a `requesterId`.

**FR-09** My Tickets must list only the authenticated Requester's own Tickets with the Lab 2 search, filter, sort, and pagination behavior.

**FR-10** Ticket Detail must be available to the owning Requester with the full Lab 2 read-only view and Attachment lifecycle (upload, preview, download, soft-remove with confirmation) and continued ownership protection.

**FR-11** A Requester must be able to post a Public Comment on a Ticket they own.

**FR-12** A Requester must be able to use the "Problem Appears Resolved" action on an owned Ticket, which records an automatic Public Comment; the Requester must not be able to formally set the Ticket to Resolved or Closed.

**FR-13** Public Comments on an owned Ticket must be visible to the Requester; a Requester must be able to provide requested information and move their own Ticket from `WAITING_FOR_REQUESTER` back to `OPEN`; Internal Notes must never be visible to a Requester.

### 4.3 IT Staff Ticket Queue and Operations

**FR-14** IT Staff must be able to retrieve a shared Ticket Queue with keyword search, suitable filters, sorting, and pagination.

**FR-15** IT Staff must be able to open the Ticket Detail of any Ticket and view its grouped information and attachments.

**FR-16** IT Staff must be able to claim an unassigned Ticket, assign it to themselves, or reassign ownership to another eligible user.

**FR-17** IT Staff must be able to set and update IT Priority, which initially copies the Requested Priority.

**FR-18** IT Staff must be able to update the Ticket status only along the permitted transition matrix.

**FR-19** IT Staff must be able to post Public Comments and create Internal Notes on any Ticket.

**FR-20** IT Staff must be able to view both Public Comments and Internal Notes on any Ticket.

### 4.4 Administrator User Management

**FR-21** An Administrator must be able to list users and search by name or email with an optional single role filter.

**FR-22** An Administrator must be able to create a user with a name, email address, one permitted role, activation state, and an initial password.

**FR-23** An Administrator must be able to update a user's name, email address, role, and activation state.

**FR-24** An Administrator must be able to set a new initial password that the user must change at the next login.

**FR-25** An Administrator must not be able to deactivate their own account, and no operation may leave the system without at least one active Administrator.

**FR-26** User lifecycle must use deactivation; user deletion is out of scope.

### 4.5 Authorization Matrix

Every API operation is protected server-side. Roles: `REQUESTER`, `IT_STAFF`, `ADMIN`. "Staff" below means the union of `IT_STAFF` and `ADMIN`, which is granted explicitly by this matrix.

| Operation | Requester | IT_STAFF | ADMIN |
|---|---|---|---|
| Login, Logout, Me, Change Password | ✔ | ✔ | ✔ |
| Categories, Related Systems (reference) | ✔ | ✔ | ✔ |
| Create Ticket | ✔ | — | — |
| My Tickets list (owned only) | ✔ | — | — |
| Ticket Detail | Owned only | Any | Any |
| Attachment upload / soft-remove | Owned only | — | — |
| Attachment metadata / download / preview | Owned only | Any | Any |
| Post Public Comment | Owned only | Any | Any |
| View Public Comments | Owned only | Any | Any |
| "Problem Appears Resolved" | Owned only | — | — |
| Ticket Queue | — | ✔ | ✔ |
| Claim / assign / reassign ownership | — | ✔ | ✔ |
| Set IT Priority | — | ✔ | ✔ |
| Update status (per matrix) | WAITING_FOR_REQUESTER → OPEN only | ✔ | ✔ |
| Create / view Internal Notes | — | ✔ | ✔ |
| User list / search / role filter | — | — | ✔ |
| Create / edit user | — | — | ✔ |
| Set / reset initial password | — | — | ✔ |

**Existence-leak protection (BR-15):** cross-owner access to another user's Ticket, Attachment, or Internal Note returns the same `404 NOT_FOUND` as a missing resource. Role-based restrictions return `403 FORBIDDEN`.

---

## 5. Business Rules

### 5.1 Authentication and Accounts

**BR-01** Only an active user with valid credentials may authenticate. `GET /api/auth/me`, queue, ticket, comment, note, attachment, and user-management endpoints all require a valid session.

**BR-02** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved. `GET /api/auth/me` reports `mustChangePassword` and the client gates the rest of the app behind the Change Password screen.

**BR-03** The authenticated user identity — not a `requesterId` supplied by the client — determines ownership of Requester operations. Client-supplied `requesterId` values are ignored.

**BR-04** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator.

**BR-05** A Requester may indicate that a problem appears resolved, but cannot formally set a Ticket to Resolved or Closed.

**BR-06** Login failure (unknown email or wrong password) returns the same safe message "Invalid email or password" with `401 INVALID_CREDENTIALS`; it must not reveal whether an account exists.

**BR-07** An inactive account receives a clear, safe response (`403 ACCOUNT_INACTIVE` → "Your account is not active. Contact your administrator.") without exposing additional account information.

**BR-08** After 5 consecutive failed login attempts for the same email within a rolling 15-minute window, authentication is refused with `429 TOO_MANY_ATTEMPTS` for the remainder of the window. A successful login resets the counter.

**BR-09** Passwords are hashed with bcrypt (cost factor 12). Passwords are never stored in plaintext and are never returned by any API response.

**BR-10** New passwords must be 8–64 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character. The new password must differ from the current password.

**BR-11** Logout invalidates the server-side session record; the browser session cookie is cleared.

**BR-12** Sessions expire after 8 hours. Expiration is checked server-side on every authenticated request; an expired or missing session returns `401`.

**BR-13** Email addresses are unique across all users, enforced by a database unique index. Duplicate creation or update is rejected with `409`.

**BR-14** An authenticated user without the required role receives `403 FORBIDDEN`. A user without a valid session receives `401 UNAUTHORIZED`.

**BR-15** Cross-owner access to another user's protected Ticket, Attachment, or Internal Note returns `404 NOT_FOUND` (identical to a missing resource) so access attempts do not leak whether the resource exists.

**BR-16** A Ticket belongs to exactly one submitter. The submitter is the authenticated Requester at creation time and cannot be changed.

### 5.2 Ticket Ownership, Priority, and Status

**BR-17** Each Ticket may have one primary Ticket Owner, who must be an active `IT_STAFF` or `ADMIN` user. A Ticket may initially be unassigned (`null` owner).

**BR-18** Only IT Staff or Administrator may claim, assign, or reassign Ticket ownership. A claim on an already-assigned Ticket is rejected `409`; reassignment uses the assign endpoint.

**BR-19** IT Priority initially copies Requested Priority. Only IT Staff or Administrator may change IT Priority. Values are `LOW`, `MEDIUM`, `HIGH`.

**BR-20** The required Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`. Status changes must follow the transition matrix in section 5.3; a disallowed transition is rejected with `409`.

**BR-21** Only a Requester may use "Problem Appears Resolved"; it is available only while the Ticket is in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`, and records an automatic Public Comment. It does not change the Ticket status.

**BR-22** A Requester may move their own Ticket from `WAITING_FOR_REQUESTER` to `OPEN` to indicate they have provided the requested information.

### 5.3 Ticket Status Transition Matrix

| From | To — IT Staff / Administrator | To — Requester |
|---|---|---|
| `NEW` | `OPEN`, `IN_PROGRESS`, `CANCELLED` | — |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | — |
| `IN_PROGRESS` | `OPEN`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | — |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | `OPEN` |
| `RESOLVED` | `CLOSED`, `REOPENED` | — |
| `CLOSED` | `REOPENED` | — |
| `REOPENED` | `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | — |
| `CANCELLED` | — (terminal) | — |

The Requester "Problem Appears Resolved" action is allowed from `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`; it is an indicator only, not a status change.

### 5.4 Public Comments and Internal Notes

**BR-23** Public Comment content must be 1–2000 characters after trimming; empty or whitespace-only content is rejected.

**BR-24** Internal Note content must be 1–2000 characters after trimming; empty or whitespace-only content is rejected.

**BR-25** Public Comments and Internal Notes are append-only in Lab 3. Editing and deletion are excluded.

**BR-26** Each Comment and Note records its author and creation time from the backend; clients cannot set them.

**BR-27** Comment and Note content is stored as text and rendered safely (plain-text rendering with line breaks preserved, no HTML execution). No client-provided HTML is executed.

**BR-28** A Requester requesting the Internal Notes list or creation endpoint receives `403 FORBIDDEN`; no note content is returned.

### 5.5 Administrator User Management

**BR-29** An Administrator must create a user with exactly one permitted role (`REQUESTER`, `IT_STAFF`, or `ADMIN`).

**BR-30** An Administrator may update a user's name, email address, role, and activation state.

**BR-31** An Administrator must not be able to deactivate their own account (rejected with `409`).

**BR-32** No update may leave the system with zero active Administrators (rejected with `409`).

**BR-33** Users are deactivated, never deleted.

**BR-34** Setting or resetting an initial password sets `mustChangePassword = true` for the target user; the user must change it at the next login.

**BR-35** Role values must be one of `REQUESTER`, `IT_STAFF`, `ADMIN`; any other value is rejected `400`.

### 5.6 Queue, Validation, and Regression

**BR-36** The Ticket Queue is restricted to IT Staff and Administrator; a Requester request receives `403 FORBIDDEN`.

**BR-37** Queue search is case-insensitive and matches partial strings in Ticket Number, Summary, Description, Requester name, and Requester email.

**BR-38** Queue filters are `status`, `itPriority`, `categoryId`, `relatedSystemId`, and `assignment` (`unassigned` | `assignedToMe` | `all`, or a specific `ownerId`). Filters combine with AND logic.

**BR-39** Queue default ordering is `itPriority DESC, ticketDate ASC` (highest priority first, oldest within the same priority). Sortable fields are `ticketDate`, `updatedAt`, `itPriority`, `requestedPriority`, `ticketNumber`, `currentStatus`. Default page size is 10; valid page sizes are 10, 25, or 50; invalid values fall back to defaults.

**BR-40** All string inputs are trimmed before validation. Revalidation of Ticket, Attachment, Comment, Note, and User fields happens server-side even when the client validates.

**BR-41** All Lab 2 Requester Ticket and Attachment functions continue to behave identically under authenticated identity; regression behavior is part of scope and tested explicitly.

**BR-42** The Development Requester selector and all client-side Requester-selection state are removed; `GET /api/requesters` is removed.

**BR-43** All writes are validated against the current database state within the same request; a stale or already-applied write (e.g., claiming an already-assigned Ticket, a disallowed status change, a duplicate email on update) is rejected with a safe `409` conflict and is never silently overwritten.

---

## 6. UI Specification Summary

Full visual, interaction, token, and state details are defined in [`ui-spec.md`](./ui-spec.md). Summary:

### Screens

| Screen | Purpose | Roles |
|--------|---------|-------|
| Login | Email/password sign-in with validation, busy state, and safe failure feedback | All |
| Change Password (mandatory) | First-login password change with rules and confirmation | All (first login) |
| Application Shell | Header with authenticated name + role badge, role-based navigation, Logout; no development banner | All |
| My Tickets | Requester's authenticated ticket list (search/filter/sort/pagination) | Requester |
| Create Ticket | Existing Lab 2 form; identity comes from the session | Requester |
| Ticket Detail (Requester) | Read-only detail + attachments + Public Comments + "Problem Appears Resolved" | Requester |
| IT Staff Ticket Queue | Search, filters, sorting, pagination; desktop table / mobile cards | IT Staff, Admin |
| Ticket Detail (IT Staff) | Grouped fields + ownership, IT Priority, status controls + Public Comments / Internal Notes / Attachments tabs | IT Staff, Admin |
| User Management | User list (search + role filter), Create, Edit, Set initial password side panel | Admin |

### Key Controls

- **Login form** — email input, password input (show/hide), primary "Sign In" (`data-testid="login-submit-btn"`), inline validation below each field, generic safe error banner on failure
- **Change Password form** — current password, new password with live rule checklist, confirm password, primary "Change Password and Continue"
- **Header** — "Logged in as [Name]" + role badge (`data-testid="role-badge"`), nav links filtered by role, Logout button (`data-testid="logout-btn"`)
- **Queue toolbar** — search input, filter dropdowns (Status, IT Priority, Category, Related System, Assignment), sort control, page-size selector, pagination
- **Ticket Detail staff controls** — Owner select/claim button, IT Priority select, Status select with permitted options only, Public Comments tab, Internal Notes tab, Attachments tab
- **User Management** — search input, role filter dropdown, "Create User" button, list rows with Edit action, and a side panel for Create/Edit with Full Name, Email, Role, Active toggle, and initial-password controls

### Required Feedback States

Every screen implements **loading** (skeletons/spinners), **empty**, **no-results**, **forbidden**, **not-found**, **conflict**, **validation**, **success**, and **safe API-failure** feedback where meaningful. First-login users see only the Change Password screen until password change succeeds.

### Responsive and Accessibility

Same as Lab 2: desktop (≥ 1024 px), tablet (768–1023 px), mobile (< 768 px); hamburger navigation on mobile; 2→1 column grid collapse; touch targets ≥ 44 px; visible 2 px focus outlines; `role="alert"` validation messages; WCAG AA contrast. No unauthorized destinations are rendered in navigation.

---

## 7. Data Changes

The Lab 2 schema evolves without discarding existing Ticket or Attachment data. Full field tables are below; the migration is described in section 7.4.

### 7.1 New and Changed Models

#### User (replaces the Lab 2 `Requester` model; table `user`)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| name | String | No | Full name |
| email | String | No | Unique |
| role | UserRole | No | `REQUESTER \| IT_STAFF \| ADMIN` |
| isActive | Boolean | No | Default `true` |
| passwordHash | String | No | bcrypt hash (never plaintext) |
| mustChangePassword | Boolean | No | Default `true` |
| failedLoginAttempts | Int | No | Default `0` |
| lastFailedLoginAt | DateTime | Yes | Rolling 15-minute window marker |
| createdAt | DateTime | No | Auto |
| updatedAt | DateTime | No | Auto |

Indexes: unique on `email`; index on `isActive`; index on `role`.

#### Session (new)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| tokenHash | String | No | SHA-256 of the opaque session token; unique |
| userId | Int | No | FK → User |
| expiresAt | DateTime | No | 8-hour absolute expiry |
| createdAt | DateTime | No | Auto |

Indexes: unique on `tokenHash`; index on `userId`; index on `expiresAt`.

#### Ticket (changed)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment (unchanged) |
| ticketNumber | String | No | Unique; `TKT-NNNNNN` (unchanged) |
| requesterId → `submittedById` | Int | No | FK → User (renamed; existing values preserved) |
| ownerId (`ticketOwnerId`) | Int? | Yes | FK → User; the primary Ticket Owner (new) |
| categoryId | Int | No | FK → Category (unchanged) |
| relatedSystemId | Int | No | FK → RelatedSystem (unchanged) |
| summary | String | No | 10–200 chars trimmed (unchanged) |
| description | String | No | 20–2000 chars trimmed (unchanged) |
| requestedPriority | RequestedPriority | No | `LOW \| MEDIUM \| HIGH` (unchanged) |
| itPriority | RequestedPriority | No | Reuses `RequestedPriority`; copied from `requestedPriority` at creation (new) |
| currentStatus | TicketStatus | No | Expanded enum; default `NEW` |
| ticketDate | DateTime | No | Backend-set (unchanged) |
| createdAt / updatedAt | DateTime | No | Auto (unchanged) |

Indexes: unique on `ticketNumber`; indexes on `submittedById`, `ticketOwnerId`, `itPriority`, `ticketDate`, `currentStatus`, `categoryId`, `relatedSystemId`; composite `(submittedById, ticketDate)` for My Tickets; composite `(itPriority, ticketDate)` for the queue default ordering; composite `(currentStatus, ticketDate)` for queue status filters.

#### PublicComment (new)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| ticketId | Int | No | FK → Ticket |
| authorId | Int | No | FK → User |
| content | String | No | 1–2000 chars after trim |
| createdAt | DateTime | No | Backend-set |

Indexes: index on `ticketId`; composite `(ticketId, createdAt)`.

#### InternalNote (new)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| ticketId | Int | No | FK → Ticket |
| authorId | Int | No | FK → User |
| content | String | No | 1–2000 chars after trim |
| createdAt | DateTime | No | Backend-set |

Indexes: index on `ticketId`; composite `(ticketId, createdAt)`.

#### Unchanged (preserved): Category, RelatedSystem, Attachment

`Attachment` keeps its soft-removal design. `ticketId` continues to reference `Ticket`. No Lab 2 Ticket or Attachment rows are deleted.

### 7.2 Enums

```
enum UserRole     { REQUESTER  IT_STAFF  ADMIN }
enum RequestedPriority { LOW  MEDIUM  HIGH }       // reused for itPriority
enum TicketStatus { NEW  OPEN  IN_PROGRESS  WAITING_FOR_REQUESTER  RESOLVED  CLOSED  REOPENED  CANCELLED }
```

### 7.3 Relationships

- One User → many submitted Tickets (`submitter`)
- One User → many owned Tickets (`owner`; nullable)
- One User → many Sessions
- One Ticket → many PublicComments / InternalNotes
- One User → many PublicComments / InternalNotes (as author)
- Ticket, PublicComment, InternalNote, Session each reference `User.id`

### 7.4 Migration Strategy (Lab 2 → Lab 3)

1. **Rename** the `requester` table to `user` and the Prisma `Requester` model to `User`.
2. **Add** `role`, `passwordHash`, `mustChangePassword`, `failedLoginAttempts`, `lastFailedLoginAt` to `user` with safe defaults.
3. **Map** every existing Requester row to a User with `role = REQUESTER`, `isActive` preserved, `mustChangePassword = true`, and a bcrypt hash of the documented local-lab initial password (see seed data; never a real personal password).
4. **Update** `Ticket.requesterId` to reference `user.id` (data already 1:1, so no Ticket rows change) and rename the field to `submittedById`. Add `ownerId` (nullable) and `itPriority` (`= requestedPriority` for every existing Ticket). Replace the `TicketStatus` enum values with the expanded eight-status set while keeping `NEW` for existing Tickets.
5. **Create** `session`, `public_comment`, and `internal_note` tables.
6. **Remove** the `GET /api/requesters` endpoint and all client-side Requester-selector state/logic.
7. **Verify** ticket → submitter mapping counts match before and after migration (migration/regression test).

### 7.5 Seed Data

The seed script must be idempotent (safe to run repeatedly). It creates:

- 4 Categories and 7 Related Systems (unchanged from Lab 2)
- At least 4 active and 1 inactive Requester users (existing Lab 2 records, migrated)
- At least 3 active and 1 inactive IT Staff users
- 2 active Administrator users (one extra so the "last active Administrator" safety rule is testable)
- Tickets distributed across Requesters, statuses, priorities, and assigned/unassigned ownership
- Example Public Comments and Internal Notes that contain no sensitive information

All seeded user accounts are created with `mustChangePassword = true` and a documented, shared development initial password (e.g., `ChangeMe123!`, perhaps per-user variants for uniqueness testing). Seeded credentials are for local development only and are documented in the seed file and README; real personal passwords are never committed.

---

## 8. API Contract

Full endpoint details, request/response shapes, query parameters, headers, cookies, and example JSON are defined in [`api-spec.md`](./api-spec.md). The table below is the authoritative endpoint inventory.

| # | Method | Path | Purpose | Roles | Success |
|---|--------|------|---------|-------|---------|
| 1 | POST | `/api/auth/login` | Authenticate and establish a session | — | 200 |
| 2 | POST | `/api/auth/logout` | Invalidate the session | All | 204 |
| 3 | GET | `/api/auth/me` | Current user and role (+ `mustChangePassword`) | All | 200 |
| 4 | POST | `/api/auth/change-password` | Change password; clears `mustChangePassword` | All | 200 |
| 5 | GET | `/api/categories` | Active categories (authenticated) | All | 200 |
| 6 | GET | `/api/related-systems` | Active related systems (authenticated) | All | 200 |
| 7 | POST | `/api/tickets` | Create a ticket (submitter = session user) | Requester | 201 |
| 8 | GET | `/api/tickets` | My Tickets (search/filter/sort/paginate) | Requester | 200 |
| 9 | GET | `/api/tickets/queue` | IT Staff Ticket Queue (search/filter/sort/paginate) | Staff | 200 |
| 10 | GET | `/api/tickets/:ticketId` | Ticket Detail (+ comments; + notes for Staff) | Owner or Staff | 200 |
| 11 | PATCH | `/api/tickets/:ticketId` | Update IT Priority and/or status per matrix | Staff | 200 |
| 12 | POST | `/api/tickets/:ticketId/claim` | Claim an unassigned ticket for self | Staff | 200 |
| 13 | PUT | `/api/tickets/:ticketId/owner` | Assign or reassign ownership to eligible user | Staff | 200 |
| 14 | POST | `/api/tickets/:ticketId/comments` | Create a Public Comment | Owner-Req or Staff | 201 |
| 15 | GET | `/api/tickets/:ticketId/comments` | List Public Comments | Owner-Req or Staff | 200 |
| 16 | POST | `/api/tickets/:ticketId/notes` | Create an Internal Note | Staff | 201 |
| 17 | GET | `/api/tickets/:ticketId/notes` | List Internal Notes | Staff | 200 |
| 18 | POST | `/api/tickets/:ticketId/requester-respond` | Requester provides info: `WAITING_FOR_REQUESTER` → `OPEN`, optional Public Comment | Requester | 200 |
| 19 | POST | `/api/tickets/:ticketId/indicate-resolved` | Requester "Problem Appears Resolved" (auto Public Comment) | Requester | 201 |
| 20 | POST | `/api/tickets/:ticketId/attachments` | Upload attachment | Requester | 201 |
| 21 | GET | `/api/tickets/:ticketId/attachments` | Attachment metadata | Owner or Staff | 200 |
| 22 | GET | `/api/attachments/:attachmentId/download` | Download active attachment | Owner or Staff | 200 |
| 23 | DELETE | `/api/attachments/:attachmentId` | Soft-remove attachment | Requester | 200 |
| 24 | GET | `/api/users` | User list (search + role filter) | Admin | 200 |
| 25 | POST | `/api/users` | Create user with one role + initial password | Admin | 201 |
| 26 | PATCH | `/api/users/:userId` | Update name/email/role/activation state | Admin | 200 |
| 27 | POST | `/api/users/:userId/reset-initial-password` | Set a new initial password (`mustChangePassword = true`) | Admin | 200 |

### Authentication Mechanism (Summary)

- **Password hashing:** bcrypt, cost factor 12.
- **Session:** opaque 32-byte random token; only its SHA-256 hash is stored in the `Session` table. The raw token is delivered in an HttpOnly cookie, `SameSite=Lax`, `Path=/`, `Max-Age` 8 hours, `Secure` in production. The cookie is never readable by client JavaScript.
- **CSRF:** `SameSite=Lax` plus an `Origin` (or `Referer`) check on all state-changing methods; mismatched origins are rejected `403`. Cookies are not sent cross-site, which covers login CSRF.
- **Rate limiting / lockout:** 5 failed logins per email in a rolling 15-minute window → `429` for the remainder of the window (BR-08).

### Safe Errors (Summary)

- `401 UNAUTHORIZED` — missing/invalid/expired session
- `403 FORBIDDEN` — authenticated but role not permitted (including Requester → Internal Notes)
- `404 NOT_FOUND` — missing resource, or cross-owner / cross-ticket access (no existence leak)
- `400 VALIDATION_ERROR` — invalid field values (structured `details`)
- `409 Conflict` — duplicates, already assigned, invalid status transition, self-deactivation, last-admin safety
- `429 TOO_MANY_ATTEMPTS` — login rate limit
- `500 INTERNAL_SERVER_ERROR` — unexpected failure (safe message, no internals leaked)

Error body shape (unchanged from Lab 2):

```json
{
  "error": {
    "message": "Human-readable safe message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

---

## 9. Acceptance Criteria

Every AC maps to at least one planned test in `docs/lab-03/tests.md`.

**AC-01** Given an active user with valid credentials, when the user logs in, then the backend establishes authenticated access, returns the permitted user identity and role, and issues a session cookie.

**AC-02** Given a user who must change the initial password, when login succeeds, then normal application screens remain unavailable until a valid new password is saved.

**AC-03** Given an authenticated Requester, when the client supplies another `requesterId`, then the backend still applies the authenticated identity and does not return another Requester's data.

**AC-04** Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected (`403`) without exposing note content.

**AC-05** Given a logged-in user, when Logout is invoked, then the server-side session is invalidated and subsequent authenticated requests return `401`.

**AC-06** Given an inactive account, when login is attempted, then a clear safe `403 ACCOUNT_INACTIVE` response is returned without extra account information.

**AC-07** Given 5 failed login attempts within 15 minutes, when a further login is attempted, then `429 TOO_MANY_ATTEMPTS` is returned for the remainder of the window.

**AC-08** Given an IT Staff user, when the Ticket Queue is requested with search, filters, sorting, and pagination, then the correct paginated ticket set is returned and none belong outside the filter criteria.

**AC-09** Given an unassigned Ticket, when an IT Staff user claims it, then the owner becomes that user; when another IT Staff user attempts to claim the same Ticket, then `409` is returned.

**AC-10** Given a Ticket, when an IT Staff user assigns/reassigns ownership, then the owner is updated and the new owner is an active IT Staff or Administrator user.

**AC-11** Given a Ticket, when an IT Staff user sets IT Priority, then the value is updated and the change is persisted; the initial IT Priority equals the Requested Priority.

**AC-12** Given a Ticket in `NEW`, when an IT Staff user attempts to set it to `CLOSED`, then the transition is rejected `409`; setting it to `OPEN` succeeds.

**AC-13** Given a Requester-created Ticket, when the Requester uses "Problem Appears Resolved", then an automatic Public Comment is recorded and the Ticket status is not changed to `RESOLVED` or `CLOSED`.

**AC-14** Given a Ticket, when an IT Staff user posts a Public Comment, then the comment is append-only with backend-recorded author and creation time and is visible to the Requester, IT Staff, and Administrator.

**AC-15** Given a Ticket, when an IT Staff user creates an Internal Note, then the note is stored append-only with author and creation time and is visible only to IT Staff and Administrator.

**AC-16** Given an Administrator, when a user is created with a name, email, one role, activation state, and initial password, then the user exists, the initial password hashes correctly, `mustChangePassword` is true, and the raw password is never returned.

**AC-17** Given an existing user, when an Administrator edits name, email, role, or activation state, then the update persists; a duplicate email is rejected `409`.

**AC-18** Given an Administrator editing their own account, when self-deactivation is attempted, then the change is rejected `409`; when any change would remove the last active Administrator, then the change is rejected `409`.

**AC-19** Given a user with an initial password, when an Administrator sets a new initial password, then the user's `mustChangePassword` becomes true and the user must change it at the next login.

**AC-20** Given an authenticated Requester, then all Lab 2 Ticket and Attachment functions (create, list, detail, upload/download/preview, soft-remove) continue to work with the authenticated identity and ownership protection.

**AC-21** Given no session, when any protected endpoint is requested, then `401 UNAUTHORIZED` is returned with a safe message.

**AC-22** Given a Requester, when the Ticket Queue or User Management endpoint is requested, then `403 FORBIDDEN` is returned and no queue or user data is exposed.

**AC-23** Given a Requester, when they attempt to view, download, or preview a Ticket/Attachment that another user owns, then `404 NOT_FOUND` is returned (no existence leak) and the frontend shows a not-found state.

---

## 10. Definition of Done

### Development
- [ ] All features in the Included Scope are implemented
- [ ] No feature from the Excluded Scope is present
- [ ] All business rules (BR-01 – BR-43) are enforced server-side
- [ ] Prisma schema matches section 7; migration applies cleanly and preserves all Lab 2 Tickets/Attachments
- [ ] Development Requester selector and `GET /api/requesters` are removed
- [ ] Seed script runs without errors and is idempotent; seeded credentials are documented and contain no real secrets

### Authentication, Authorization, and Security
- [ ] Login, logout, current-user, and mandatory first-login password change work end-to-end
- [ ] Passwords are bcrypt-hashed; no plaintext or hash is ever returned by the API
- [ ] Sessions are server-side, expiring, invalidated on logout, and transmitted via HttpOnly cookie
- [ ] Every protected endpoint enforces the authorization matrix; UI hiding is never the security control
- [ ] Role-based navigation renders only permitted destinations

### Testing
- [ ] All acceptance criteria (AC-01 – AC-23) pass with automated tests
- [ ] Backend tests cover success, validation, authorization, ownership (no-existence-leak), 404/409/413/415/429, and 500 cases
- [ ] IT Staff queue tests cover search, each filter, sorting, and pagination
- [ ] Status-transition matrix tests cover every permitted and rejected transition
- [ ] Admin tests cover listing, search, role filter, creation, duplicate-email rejection, editing, one-role assignment, activation/deactivation, initial password, self-deactivation prevention, and last-active-Administrator prevention
- [ ] Migration/regression test verifies Lab 2 data survives and Requester functions still work
- [ ] Frontend tests cover Login, Change Password, StaffTicketQueue, StaffTicketDetail, and UserManagement
- [ ] Playwright screenshots capture E2E workflows as visual evidence
- [ ] No test is skipped, disabled, or commented out on the final main branch

### UI Screens
- [ ] Login and mandatory Change Password screens implemented and match `ui-spec.md`
- [ ] Application shell shows authenticated name + role and role-based nav
- [ ] Requester screens (My Tickets, Create Ticket, Ticket Detail + Public Comments + "Problem Appears Resolved") regress cleanly
- [ ] IT Staff Ticket Queue implemented with search, filters, sorting, pagination, and responsive table/cards
- [ ] IT Staff Ticket Detail implemented with ownership, IT Priority, status controls, and distinct Public Comments / Internal Notes tabs
- [ ] Administrator User Management implemented with list, search, role filter, create/edit panel, activate/deactivate, and initial-password controls
- [ ] Zen Green theme applied consistently; loading/empty/no-results/forbidden/not-found/conflict/success/failure feedback present
- [ ] Responsive layout verified on mobile, tablet, and desktop

### Review
- [ ] Every change merged via Pull Request with peer review and approval
- [ ] All review comments resolved before merging
- [ ] No sensitive data (real passwords, tokens, secrets) committed to the repository

### Documentation and Evidence
- [ ] `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are complete, current, and internally consistent
- [ ] README documents setup, migration, seed credentials, and test instructions
- [ ] Environment-variable requirements updated in `.env.example` (session/CSRF origin, cookie settings)
- [ ] Traced evidence on the final main branch demonstrates completion per the approved contract

---

## 11. Assumptions and Decisions

**D-01: DB-backed opaque cookie sessions instead of JWT.** The current stack (Express + PostgreSQL/Prisma, React SPA) supports a `Session` table that enables immediate logout invalidation and server-side expiry. Alternative stateless JWT was rejected because invalidating a token on logout is not possible without extra machinery. The cookie is HttpOnly so the raw token never reaches client code.

**D-02: `403 ACCOUNT_INACTIVE` on login for inactive accounts.** The stakeholder explicitly wants a "clear response for inactive accounts"; this intentionally reveals that the email exists. All other authentication failures use the generic `401 INVALID_CREDENTIALS` to avoid existence leaks.

**D-03: Cross-owner access returns `404`, not `403`.** Lab 2 used `403 FORBIDDEN` for ownership failures; Lab 3 section 6.2 requires not leaking whether another user's protected Ticket, Attachment, or Internal Note exists, so cross-owner access now returns the same `404 NOT_FOUND` as a missing resource. Role-based restrictions (a Requester hitting staff-only endpoints) still return `403`. Tests for Lab 2 ownership are updated to the new contract.

**D-04: "Problem Appears Resolved" is an automatic Public Comment, not a new status.** Storing it as an append-only Public Comment authored by the Requester (system text) keeps the data model simple, satisfies BR-05, and avoids adding a separate resolution flag field. IT Staff still formally move the Ticket to `RESOLVED`/`CLOSED`.

**D-05: `itPriority` reuses the `RequestedPriority` enum.** Both use the same three values (`LOW`, `MEDIUM`, `HIGH`), so a single enum is reused rather than introducing a duplicate `Priority` type. The field is separate from `requestedPriority` because the two may diverge after IT Staff changes it.

**D-06: Single-role authorization model.** Lab 3 assigns exactly one role per user. The Ticket Owner is an active `IT_STAFF` or `ADMIN` user; both roles share the "Staff" permission group in the authorization matrix (they may own/operate Tickets) while only `ADMIN` may access user management. This keeps Administrator and IT Staff responsibilities conceptually distinct where it matters (user management vs. ticket operations) while honoring section 4.5 ownership eligibility.

**D-07: In-memory login rate limiting.** The 5-attempts / 15-minute rule (BR-08) is enforced with an in-memory sliding window keyed by email (and IP) on the login endpoint. This is sufficient for a lab environment and is cleared on process restart; it is replaced by a persistent store only if required by a later stage.

**D-08: Password rule set.** New passwords are 8–64 characters with at least one uppercase, one lowercase, one digit, and one special character, and must differ from the current password. 64 chars stays under bcrypt's 72-byte input limit while remaining testable and user-friendly.

**D-09: Comment/Note length limit of 2000 characters.** Matches the existing Description limit, is long enough for realistic entries, and keeps the API and UI rules consistent with Lab 2 conventions.

**D-10: Ticket Queue default ordering `itPriority DESC, ticketDate ASC`.** A support queue should surface the highest-priority work first and, within a priority, the oldest Ticket first (FIFO) so no Ticket starves. The composite index `(itPriority, ticketDate)` serves this ordering directly.

**D-11: Admin seating for safety-rule testing.** Seed data creates two active Administrators so the "last active Administrator" rule (BR-32) can be tested without deactivating the only Administrator by accident.

**D-12: Initial passwords are a shared documented development value.** All migrated/created users start with `mustChangePassword = true` and a documented development initial password (e.g., `ChangeMe123!`, varied per user for uniqueness). This satisfies section 5.2 without committing real personal passwords.