# Lab 3 Test Plan

---

## 1. Test Strategy

### Approach

This document applies Test-Driven Development (TDD) and the Specification-Driven Development contract produced alongside it. The scenarios below are planned from `specification.md` (FR, BR, AC) and `api-spec.md` **before implementation begins**; they are not reconstructed afterward from generated tests. Every Acceptance Criterion must be covered by at least one automated test, and every automated test must map back to a requirement.

### Test Levels

**Unit Tests**
- Pure logic: password-rule validator, session-token generation + SHA-256 hashing, the status-transition matrix, comment/note trim+length validation, CSRF origin check, email normalization
- Rendered in isolation with mocked data: Login, ChangePassword, Ticket Queue, Ticket Detail tabs, User Management, role-gated navigation

**API / Integration Tests**
- Every REST endpoint in `api-spec.md` against a real (test) PostgreSQL database via Supertest
- Happy-path, validation failure, role-authorization failure, ownership (existence-leak) failure, missing-resource, conflict, rate-limit, and 500 scenarios
- Authentication, sessions, and CSRF handling
- Migration, seed idempotency, and Lab 2 regression

**UI Component Tests**
- Form validation, busy/empty/no-results/forbidden/not-found/conflict/success/failure states
- Role-gated navigation rendering, must-change-password gating, Public vs Internal comment/note rendering

**End-to-End Tests (Playwright)**
- Full workflows in a real (headless) Chromium browser: authentication, IT Staff ticket operations, and Administrator user management
- Responsive rendering at Desktop / Tablet / Mobile and screenshots saved to `artifacts/lab-03/screenshots/` as visual evidence

### Quality Bar

- Every AC in `specification.md` §9 has at least one passing automated test (see §3 traceability)
- No test may be skipped, disabled, or commented out on the final `main` branch
- Safe-error and existence-leak behavior (BR-14/BR-15, D-03) is asserted explicitly at the API layer
- Playwright screenshots are committed as submission evidence

### Naming Decision

Test-file paths use the repository convention `server/tests/lab-03/`, `client/tests/lab-03/`, and `e2e/lab-03/` (hyphenated), matching the required repository structure in Lab 3 handout §12 and the existing `lab-02` directories. The handout's §10 example rows that read `server/tests/lab03/` are treated as illustrations of the folder layout only.

---

## 2. Planned Tests

The table is the authoritative test inventory. **Type** values: `Unit`, `API`, `UI`, `E2E`, `MIG` (migration/regression). **Automated Test File** paths are root-relative. **Final** is filled in as `Pass` once a test passes on `main`; any test not yet green stays `Pending`.

### 2.1 Authentication and Passwords — `server/tests/lab-03/auth.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-01 | API | AC-01 / BR-01 | Valid login with active user + correct password | 200; authenticated `user` (id, name, email, role); `mustChangePassword` flag; `toktickit_session` cookie set (HttpOnly, SameSite=Lax, Path=/) | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-06 / BR-07 | Inactive account login | 403 `ACCOUNT_INACTIVE` with safe message; no extra account info returned | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-03 | API | BR-06 | Unknown email vs wrong password return identical responses | Both 401 `INVALID_CREDENTIALS` with the same "Invalid email or password" body — no existence leak | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-04 | API | AC-07 / BR-08 | Login rate limit and lockout window | 5 consecutive failures within 15 min → 429 `TOO_MANY_ATTEMPTS`; a successful login resets the counter | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-05 | API | AC-05 / BR-11 | Logout invalidates the session | 204; cookie-clearing instruction; subsequent `GET /api/auth/me` returns 401 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-06 | API | AC-05 / BR-12 | Expired session rejected | 401 `UNAUTHORIZED`; no user data returned | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-07 | API | AC-02 / BR-02, BR-10 | First-login change-password flow | 200; `mustChangePassword` → false; wrong `currentPassword` → 401 `INVALID_CURRENT_PASSWORD`; session remains valid | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-09 | API | BR-10 | Password rule boundaries | 400 `VALIDATION_ERROR` with `details` for: < 8 chars, no uppercase, no lowercase, no digit, no special char, equal to current password | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-10 | API | BR-09 | No password material in any API response | `passwordHash`, `failedLoginAttempts`, and token never appear in any response body | `server/tests/lab-03/auth.api.test.ts` | Pass |

### 2.2 Authorization and Safe Errors — `server/tests/lab-03/authorization.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-11 | API | AC-21 / BR-14 | No session on every protected endpoint | 401 for categories, related-systems, tickets (all), queue, comments, notes, attachments, users | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-12 | API | AC-22 / BR-36 | Role matrix enforced server-side | Requester → queue/users 403; IT_STAFF → users 403; IT_STAFF/ADMIN → create-ticket 403; ADMIN → queue 200 | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-13 | API | AC-23 / D-03 | Cross-owner access returns 404 identical to missing resource | Requester reading another user's Ticket, Attachment, or Note → 404 with the same message/shape as a nonexistent resource | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-14 | API | §1 CSRF | State-changing request with mismatched Origin/Referer | 403 `CSRF_ORIGIN_MISMATCH` when a session is present; matching Origin proceeds | `server/tests/lab-03/authorization.api.test.ts` | Pass |

### 2.3 IT Staff Ticket Queue — `server/tests/lab-03/staff-queue.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-15 | API | AC-08 / BR-39 | Default ordering + pagination metadata | No `sortBy` → `itPriority DESC, ticketDate ASC`; correct `page/pageSize/totalCount/totalPages/hasNext/hasPrevious` for page 2, size 10 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-16 | API | AC-08 / BR-37 | Queue search fields | Case-insensitive substring in ticketNumber, summary, description, Requester name, Requester email | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-17 | API | AC-08 / BR-38 | Filters: status, itPriority, category, relatedSystem (AND) | Rows match every applied filter simultaneously | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-18 | API | AC-08 / BR-38 | Assignment and ownerId filters | `unassigned` returns only null owners; `assignedToMe` returns only the caller's Tickets; `ownerId` filter narrows accordingly | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-19 | API | AC-08 / BR-39 | Sort fields and direction | `sortBy` ∈ {ticketDate, updatedAt, itPriority, requestedPriority, ticketNumber, currentStatus} × `asc`/`desc` return the declared order | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-20 | API | AC-08 / BR-39 | Invalid params and page-size fallback | Invalid `status`/`priority`/`assignment` → 400 `INVALID_PARAMETERS`; invalid `pageSize` → 10; invalid `page` → 1 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-21 | API | AC-08 / BR-36 | Empty queue and Requester denial | Empty DB → empty `data` with correct pagination; Requester request → 403 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |

### 2.4 IT Staff Ticket Operations — `server/tests/lab-03/staff-ticket-detail.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-22 | API | FR-15 / AC-08 | Ticket Detail returns operational fields | Includes owner, itPriority, `permittedStatusTransitions`, comments; notes present **only** for IT_STAFF/ADMIN viewers | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-23 | API | AC-09 / BR-18 | Claim an unassigned Ticket; claim an assigned one | Unassigned → owner = caller (200); already assigned → 409 `TICKET_ALREADY_ASSIGNED` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-24 | API | AC-10 / BR-17 | Assign/reassign ownership to eligible user | Active IT_STAFF/ADMIN owner accepted (200); inactive user or wrong role → 400/404 (no user enumeration) | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-25 | API | AC-11 / BR-19 | IT Priority lifecycle | New Ticket stores `itPriority = requestedPriority`; staff PATCH updates it; Requester PATCH → 403; invalid value → 400 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-26 | API | AC-12 / BR-20 | Status transition matrix — permitted moves | Every positive transition in `specification.md` §5.3 persists (e.g., NEW→OPEN, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, CLOSED→REOPENED) | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-27 | API | AC-12 / BR-20, BR-43 | Status transition matrix — rejected moves and stale writes | Disallowed pairs (e.g., NEW→CLOSED, CANCELLED→OPEN) → 409 `TICKET_STATUS_TRANSITION_NOT_ALLOWED`; concurrent/stale writes never silently overwrite | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-28 | API | FR-13 / BR-22 | Requester respond (`WAITING_FOR_REQUESTER`→`OPEN`) | 200 with status OPEN (+ optional Public Comment); from any other status → 409; IT_STAFF invoking it → 403 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-29 | API | AC-13 / BR-21 | "Problem Appears Resolved" indicator | 201 automatic Public Comment from allowed statuses; denied from RESOLVED/CLOSED/CANCELLED (409); staff invoking → 403; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-30 | API | AC-20 / FR-20 | Attachment access by role | Staff may download/preview any Ticket's active attachments (200); staff upload/remove → 403; Requester cross-owner attachment → 404 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |

### 2.5 Public Comments and Internal Notes — `server/tests/lab-03/comments-notes.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-08 | API | AC-04 / BR-28 | Requester requests Internal Notes | 403 `FORBIDDEN`; no note content returned (existence of notes never confirmed) | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-31 | API | AC-14 / BR-25, BR-26 | Create Public Comment (Requester + IT Staff) | 201; append-only; author and createdAt set by backend; content persisted verbatim | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-32 | API | BR-23, BR-24 | Comment/Note content boundaries | 1–2000 chars accepted; empty and whitespace-only rejected (400) | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-33 | API | AC-14, AC-15 / BR-04 | Comment vs Note visibility by role | Public Comments visible to Requester, IT_STAFF, ADMIN; Internal Notes visible only to IT_STAFF/ADMIN; lists ordered by createdAt | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-34 | API | AC-23 / BR-15 | Cross-owner comment write | Requester posting on another user's Ticket → 404 (no existence leak) | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |

### 2.6 Administrator User Management — `server/tests/lab-03/users-admin.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| API-35 | API | FR-21 / FR-24 | User list, search, role filter | `GET /api/users` returns users; `search` matches name/email case-insensitively; `role` filters; invalid role → 400 | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-36 | API | AC-16 / BR-29, BR-09 | Create user with one role + initial password | 201; password bcrypt-hashed; `mustChangePassword=true`; raw password never returned; only one role permitted | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-37 | API | AC-17 / BR-13, BR-30, BR-35 | Edit name/email/role/activation state | Updates persist; duplicate email → 409 `EMAIL_ALREADY_EXISTS`; invalid role → 400 | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-38 | API | FR-23 / BR-33 | Activation and deactivation | Toggle `isActive` works; deactivated user cannot log in (see API-02); users are never deleted | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-39 | API | AC-18 / BR-31 | Admin cannot deactivate own account | Self-deactivation → 409 `CANNOT_DEACTIVATE_SELF` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-40 | API | AC-18 / BR-32 | Last active Administrator protection | Any update (deactivate or demote) that would leave zero active Admins → 409 `LAST_ACTIVE_ADMIN` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-41 | API | AC-19 / BR-34 | Set/reset initial password | 200; target user's `mustChangePassword=true`; user cannot enter the app until changing it | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-42 | API | AC-22 / FR-21 | Non-Administrator denied all user endpoints | Requester/IT_STAFF → 403 for list/create/edit/reset password | `server/tests/lab-03/users-admin.api.test.ts` | Pass |

### 2.7 Migration, Seed, and Requester Regression — `server/tests/lab-03/migration-regression.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| MIG-01 | MIG | §5 / §7.5 | Seed data and idempotency | 4 Categories, 7 Related Systems, ≥4 active + 1 inactive Requester, ≥3 active + 1 inactive IT_STAFF, ≥2 active ADMIN, Tickets distributed across statuses/priorities/ownership, sample Public Comments + Internal Notes; re-running seed produces no duplicates | `server/tests/lab-03/migration-regression.api.test.ts` | Pass |
| MIG-02 | MIG | AC-20 / §7.4 | Lab 2 data preserved after migration | Ticket count, submitter mapping, and Attachment rows identical before/after migration; existing Tickets keep `NEW`, `itPriority = requestedPriority`, owner null | `server/tests/lab-03/migration-regression.api.test.ts` | Pass |
| MIG-03 | MIG | §5.2 / BR-09 | Migrated Requesters become valid Users | Every migrated account has `role = REQUESTER`, `isActive` preserved, a bcrypt `passwordHash`, and `mustChangePassword = true` | `server/tests/lab-03/migration-regression.api.test.ts` | Pass |
| MIG-04 | MIG | AC-20 / BR-42 | Development selector removed | `GET /api/requesters` → 404; no requester-selector state endpoint exists | `server/tests/lab-03/migration-regression.api.test.ts` | Pass |
| API-43 | API | AC-20 / BR-03, BR-41 | Requester full regression under authenticated identity | Create → My Tickets (search/filter/sort/pager) → Detail → upload → preview → soft-remove, all bound to the session user; a supplied `requesterId` body/query value is ignored | `server/tests/lab-03/migration-regression.api.test.ts` | Pass |

### 2.8 Unit Tests — `server/tests/lab-03/` (unit files)

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| UNIT-01 | Unit | BR-10 | Password-rule validator | Each rule (length, upper/lower/digit/special, differs-from-current) returns correct pass/fail | `server/tests/lab-03/password-rules.unit.test.ts` | Pass |
| UNIT-02 | Unit | §1 / BR-11 | Session token + hashing | Token is 32 random bytes; only the SHA-256 digest is stored/compared; two logins produce distinct tokens | `server/tests/lab-03/session.unit.test.ts` | Pass |
| UNIT-03 | Unit | BR-20 / §5.3 | Status-transition matrix function | Every (from, role, to) combination returns allowed/denied per the matrix; no side effects | `server/tests/lab-03/status-transitions.unit.test.ts` | Pass |
| UNIT-04 | Unit | BR-23, BR-24 | Comment/Note length + trim validation | Trim then 1–2000 boundary; whitespace-only rejected | `server/tests/lab-03/comments-notes.unit.test.ts` | Pass |
| UNIT-05 | Unit | §1 / BR-14 | CSRF origin-check helper | Matching origin allowed; mismatched/missing origin rejected | `server/tests/lab-03/csrf.unit.test.ts` | Pass |
| UNIT-06 | Unit | FR-21 / BR-13 | Email normalization | Emails normalized to lowercase before uniqueness checks | `server/tests/lab-03/users-admin.unit.test.ts` | Pass |

### 2.9 UI Component Tests — `client/tests/lab-03/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| UI-01 | UI | AC-06, AC-07 / FR-01 | Login form behaviour | Inline validation on blur; busy state; safe generic error banner; inactive-account banner; rate-limit banner; no data leak in messages | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | AC-01, AC-02 / FR-02 | Login routes by `mustChangePassword` | `false` → application shell; `true` → Change Password screen only | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-03 | UI | AC-02 / BR-10 | Change Password screen | Live rule checklist updates; submit disabled until all rules + confirmation match; success clears gate and opens shell | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-04 | UI | AC-21 / FR-05 | Auth gates | 401 → Login screen; `mustChangePassword` blocks the shell; logout returns to Login | `client/tests/lab-03/AuthGates.test.tsx` | Pass |
| UI-05 | UI | AC-22 / FR-07 | Role-based navigation | Requester sees only My Tickets/Create; IT_STAFF sees Ticket Queue; ADMIN sees Ticket Queue + User Management; unauthorized destinations never render | `client/tests/lab-03/AppShell.test.tsx` | Pass |
| UI-06 | UI | AC-08 / FR-14 | Ticket Queue toolbar and list | Debounced search, all filters, sort, pagination, "Clear Filters", empty + no-results states, 403 error state, skeleton loading | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-07 | UI | AC-09, AC-10, AC-11, AC-12 / FR-16,17,18 | Ticket Detail operational panel | Claim button only when unassigned; owner select on assigned; IT Priority select; Status select offers only `permittedStatusTransitions`; Save busy/disabled state | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-08 | UI | AC-14, AC-15 / FR-19,20 | Comments vs Notes tabs | Tabs render Public Comments and Internal Notes distinctly; Internal Notes carry the "internal only" hint; composers validate; new items append | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-09 | UI | AC-13 / FR-12, FR-13 | Requester Ticket Detail additions | Public Comments visible; Notes never rendered; "Problem Appears Resolved" per `canIndicateResolved`; "Provide Information" only when status is `WAITING_FOR_REQUESTER` | `client/tests/lab-03/RequesterRegression.test.tsx` | Pass |
| UI-10 | UI | AC-20 / FR-08,09,10 | Requester regression components under auth | Create/My-Tickets/Detail render with the session identity; attachment upload/remove flows unchanged (5-limit, type/size, removed-row muted) | `client/tests/lab-03/RequesterRegression.test.tsx` | Pass |
| UI-11 | UI | AC-16, AC-17, AC-18, AC-19 / FR-21–25 | User Management panel | List/search/role-filter; Create panel with initial-password checklist; Edit panel; own-account Active toggle disabled with hint; duplicate-email inline error; last-admin hint; panel responsive states | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-12 | UI | §8 Accessibility | Automated a11y audit | axe-core (jest-axe) reports no violations on Login, ChangePassword, Queue, Detail tabs, and User panel | `client/tests/lab-03/A11y.test.tsx` | Pass |
| UI-13 | UI | §8 Responsive | Responsive switching | Queue table → cards and User table → cards below 1024px; tab/detail stacking < 768px; no horizontal overflow at 375px | `client/tests/lab-03/Responsive.test.tsx` | Pass |

### 2.10 End-to-End Tests (Playwright) — `e2e/lab-03/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|-----------------|---------------|-----------------|---------------------|-------|
| E2E-01 | E2E | AC-01, AC-05 / FR-01,03 | Authentication workflow | Valid login → shell with name + role badge; invalid login → safe banner; Logout → Login screen; screenshots (`artifacts/lab-03/screenshots/authentication/`) | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-02 | E2E | AC-02 / FR-02 | Initial-password login and change | First-login user sees only Change Password; normal app opens only after a valid password change; rule violations block submit | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-03 | E2E | AC-06 / BR-07 | Inactive account handling | Login with inactive account shows the safe inactive banner; no other screens are reachable | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-04 | E2E | AC-08, AC-09, AC-11, AC-12, AC-14 / FR-14–20 | Staff ticket workflow | Queue search/filter → open detail → claim → set IT Priority → status change → post Public Comment → write Internal Note; screenshots (`staff-queue/`, `staff-ticket-detail/`) | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-05 | E2E | AC-04, AC-13, AC-15 / BR-04 | Visibility and resolution indicator | Requester sees the Public Comment but never the Internal Note; Requester uses "Problem Appears Resolved" (no status change); IT Staff formally Resolves/Closes | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-06 | E2E | UI-13 / §8 Responsive | Responsive queue + detail screenshots | Queue renders as table on desktop and cards on tablet/mobile; detail tabs stack; no horizontal scroll at 375px | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-07 | E2E | AC-23 / FR-06, AC-22 | Authorization from the browser | Requester navigating to another user's Ticket URL sees the not-found state (404); navigating to `/users` or queue is blocked (403 / redirect); role-based nav hides unauthorized destinations | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-08 | E2E | AC-22 / FR-07 | Role navigation | Requester and IT_STAFF headers contain only permitted links; no unauthorized pages reachable by URL | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-09 | E2E | AC-16, AC-18, AC-19 / FR-22–25 | User administration workflow | Admin creates a user with initial password → first login forces change; edit name/email/role; deactivate (inactive login fails); own-account Active toggle disabled; reset initial password → next login forces change | `e2e/lab-03/user-administration.spec.ts` | Pass |
| E2E-10 | E2E | FR-21 / FR-24 | User list interactions + screenshots | Search by name/email and single role filter; create-edit panel screenshots; mobile card layout (`artifacts/lab-03/screenshots/user-management/`) | `e2e/lab-03/user-administration.spec.ts` | Pass |
| E2E-11 | E2E | AC-20 / FR-08–10 | Requester regression in-browser | Authenticated Requester creates a Ticket, uploads/removes an attachment, posts a comment; behavior matches Lab 2 (selector gone) | `e2e/lab-03/requester-regression.spec.ts` | Pass |

---

## 3. Acceptance-Criterion Traceability

AC IDs match `specification.md` §9 exactly. Every AC maps to at least one automated test.

| AC ID | Title | Covered by Tests |
|-------|-------|-----------------|
| AC-01 | Valid login establishes authenticated access | API-01, UI-01, UI-02, E2E-01 |
| AC-02 | First-login password change gates the app | API-07, UI-02, UI-03, UI-04, E2E-02, E2E-09 |
| AC-03 | Authenticated identity overrides client `requesterId` | API-13, API-43, UI-10, E2E-07 |
| AC-04 | Requester cannot access Internal Notes | API-08, API-33, UI-09, E2E-05 |
| AC-05 | Logout invalidates the session | API-05, API-06, UI-04, E2E-01 |
| AC-06 | Inactive account login response | API-02, UI-01, E2E-03 |
| AC-07 | Login rate limit | API-04, UI-01 |
| AC-08 | Ticket Queue search/filter/sort/pagination | API-15–API-21, UI-06, E2E-04, E2E-06 |
| AC-09 | Claim unassigned Ticket; conflict on assigned | API-23, UI-07, E2E-04 |
| AC-10 | Assign/reassign ownership | API-24, UI-07 |
| AC-11 | IT Priority init + update rules | API-25, UI-07, E2E-04 |
| AC-12 | Status transition matrix enforced | API-26, API-27, UNIT-03, UI-07, E2E-04 |
| AC-13 | "Problem Appears Resolved" indicator only | API-29, UI-09, E2E-05 |
| AC-14 | Public Comment append-only + visibility | API-31, API-33, API-34, UI-08, E2E-04 |
| AC-15 | Internal Note append-only + staff-only visibility | API-08, API-33, UI-08, E2E-05 |
| AC-16 | Create user with one role + initial password | API-36, UI-11, E2E-09 |
| AC-17 | Edit user; duplicate email rejected | API-37, UI-11, E2E-09 |
| AC-18 | Self-deactivation + last-active-Administrator safety | API-39, API-40, UI-11, E2E-09 |
| AC-19 | New initial password forces change at next login | API-41, UI-11, E2E-09 |
| AC-20 | Lab 2 Requester functions regress under auth | API-43, MIG-02, UI-10, E2E-11 |
| AC-21 | Unauthenticated protected access → 401 | API-11, UI-04, E2E-07 |
| AC-22 | Wrong-role access to queue/users → 403 | API-12, API-21, API-42, UI-05, E2E-07, E2E-08 |
| AC-23 | Cross-owner access → 404 (no existence leak) | API-13, API-30, API-34, E2E-07 |

---

## 4. Responsive and Visual Checklist

Verified by manual inspection and Playwright screenshot capture, per `ui-spec.md` §12.

### Playwright Screenshots Required — `artifacts/lab-03/screenshots/`
- [x] Authentication — desktop login, validation, error, change-password (desktop + mobile) (`artifacts/lab-03/screenshots/authentication/`)
- [ ] Staff queue — desktop table, filters, no-results, tablet, mobile cards
- [ ] Staff ticket detail — tabs (comments / notes), operational panel, mobile layout, forbidden/not-found state
- [ ] User management — list, create panel, edit panel, self-deactivation hint, mobile cards

### Manual Visual Inspection
- [ ] Zen Green theme consistent; no development banner anywhere
- [ ] Header shows name + role badge and Logout; no "Switch Requester"
- [ ] Header Logout visible; role-filtered navigation (Requesters never see Queue/User Management)
- [ ] Role badge palette correct per role; status badge palette matches the 8 statuses
- [ ] Login shows safe generic failure; inactive-account and rate-limit banners distinct
- [ ] Change Password rule checklist updates live; submit disabled until satisfied
- [ ] Read-only versus editable fields distinct in Ticket Detail operational panel
- [ ] Status select lists only permitted transitions; current status badge beside it
- [ ] Public Comments vs Internal Notes visually distinct; Internal Notes carry the "internal only" amber hint
- [ ] Comments/Notes render pre-wrapped plain text (no HTML)
- [ ] "Problem Appears Resolved" only when allowed; "Provide Information" only when `WAITING_FOR_REQUESTER`
- [ ] User Management Active toggle disabled for the current Administrator
- [ ] Loading skeletons / spinners on every async boundary; success/conflict/failure banners present
- [ ] Queue table collapses to cards < 1024px; no horizontal scroll at 375px
- [ ] Focus rings on all interactive elements; WCAG AA contrast; axe audit clean (UI-12)

---

## 5. Test Commands

Run from the repository root unless noted. Local setup identical to Lab 2 (Docker PostgreSQL container required for server tests; see `README.md`).

```bash
# --- Backend / API + unit tests ---
cd server
npm run test                 # Vitest — all server tests (lab-01, lab-02, lab-03)

# --- Frontend / UI + unit tests ---
cd client
npm run test                 # Vitest — all client tests (includes client/tests/lab-03)

# --- End-to-end tests (Playwright) ---
# From the repository root. `playwright.config.ts` uses a dedicated client port
# (:5174) and server :3000; the E2E spec reseeds its own fixtures first
# (server `prisma:seed:e2e`). CORS/CSRF trusted origins include :5174 —
# set TRUSTED_ORIGINS accordingly in server/.env.
npx playwright test                           # testDir = e2e/lab-03
npx playwright test e2e/lab-03/authentication.spec.ts
npx playwright test --headed                  # watch the browser
npx playwright test --reporter=html           # HTML report

# --- Migration + seed (applied before running API tests) ---
cd server
npx prisma migrate dev
npm run prisma:seed                            # must be idempotent (MIG-01)
npm run prisma:seed:e2e                        # E2E auth fixture users (idempotent)
```

---

## 6. Final Results

_Scope: this sprint ships authentication, password hygiene, and role-gating (FR-01…FR-07) on the authenticated foundation. The queue, staff ticket detail, user administration, and requester-regression items in §2 remain pending by design (see §7 and the sprint scope note)._

### Verified on the current branch

| Suite | Command | Result |
|-------|---------|--------|
| Server suite (lab-01 + lab-02 + lab-03) | `cd server && npm test` | **13/13 files, 107/107 pass** (lab-01: health, categories; lab-02: seed + T-004…T-020 regression, auth-bound; lab-03: API-01…API-14, UNIT-01/02/05/06) |
| Client suite (lab-01 + lab-02 + lab-03) | `cd client && npm test` | **10/10 files, 62/62 pass** (incl. lab-01 App auth flow; lab-02 regression; lab-03 UI-01…UI-05) |
| E2E (lab-03 auth) | `npx playwright test` (repo root) | **4/4 pass** (E2E-01, E2E-02, E2E-03, E2E-08) |

### Result summary

| Type | Total | Pass | Fail | Pending |
|------|-------|------|------|---------|
| Unit (lab-03) | 6 | 4 | 0 | 2 |
| API (lab-03) | 43 | 14 | 0 | 29 |
| MIG | 4 | 0 | 0 | 4 |
| UI | 13 | 5 | 0 | 8 |
| E2E | 11 | 4 | 0 | 7 |
| **Total** | **77** | **27** | **0** | **50** |

### Notes
- The "Pending" rows (staff queue, staff ticket detail, comments/notes, user administration, requester regression, MIG) map to server handlers that remain stubbed/deferred under the strict-scope decision; their API/UI/E2E files are specified in §2 and will run once those handlers are migrated.
- The full server and client suites are green: the Lab 1/2 tests were rewritten for the Lab 3 data model — the ticket submitter/owner comes from the session (`submittedById`/`ownerId`), payloads no longer carry `requesterId`, and cross-owner access is asserted as 404 (D-03). Tests for the removed `GET /api/requesters` endpoint and Requester selector were deleted.
- Server API tests that drive ticket/attachment flows create dedicated active users (`mustChangePassword = false`) in `beforeAll`, log in via Supertest agents, and clean them up in `afterAll` (shared helper in `server/tests/helpers/testAuth.ts`).
- E2E runs against a dedicated Vite client port `:5174` (configurable via `playwright.config.ts`) so another project's dev server on `:5173` cannot be picked up by `reuseExistingServer`.

---

## 7. Known Limitations or Deferred Tests

| Item | Reason | Plan |
|------|--------|------|
| Email delivery of initial passwords / reset links | Explicitly excluded from Lab 3 scope (§4.2) | Initial passwords are set in-app by the Administrator (seed/local-lab behavior) |
| Social login, MFA, SSO, account unlocking, admin-approval workflows | Excluded from Lab 3 scope (§4.2) | Not planned |
| SLA, escalation, notification, dashboards/KPIs | Excluded from Lab 3 scope (§4.2) | Not planned |
| Deployed (production) session hardening | Local-lab stack; cookie `Secure` flag only in non-local environments | Manual verification of `COOKIE_SECURE` when a deployment target exists |
| Performance / load tests on the queue | Not required by the lab specification | Out of scope |
| Virus/malware scanning on upload | Not required in Lab 2 or Lab 3 | Out of scope |
| Full WCAG conformance audit | Automated axe checks (UI-12) plus WCAG AA spot-checks planned | Full audit requires an expert review, out of scope for the sprint |
| Locked accounts / persistent failure tracking across restarts | BR-08 uses an in-memory sliding window (D-07) | Only a persistent store would survive process restarts; acceptable for the lab |