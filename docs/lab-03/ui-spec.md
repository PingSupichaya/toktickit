# Lab 3 UI Specification

---

## 1. Purpose and Relationship to Lab 2

Lab 3 reuses the Lab 2 Zen Green design language, tokens, spacing, typography, form conventions, badges, buttons, validation placement, responsive rules, and accessibility expectations. This document defines only what is new or changed: the Login and mandatory Change Password screens, the authenticated application shell, the IT Staff Ticket Queue, the extended IT Staff Ticket Detail (Public Comments / Internal Notes / Attachments tabs), the Administrator User Management screen, and the new badge/states required by the wider scope. Where a rule is not restated here, the corresponding Lab 2 rule (`docs/lab-02/ui-spec.md`) remains in force.

Design principles are unchanged: **Clarity, Efficiency, Feedback, Consistency, Accessibility, Responsiveness.**

---

## 2. Color Tokens

All Lab 2 tokens remain valid. Below are the Lab 2 additions for Lab 3: a role badge palette and a full Ticket-status badge palette. These are the only new hues allowed; the coding agent must not introduce any other color.

### New: Role badge tokens

| Token | Hex | Intended Use |
|-------|-----|-------------|
| `color-role-requester-bg` | `#F0F0F0` | Requester role badge background |
| `color-role-requester-text` | `#5A6F65` | Requester role badge text |
| `color-role-staff-bg` | `#EFF6FF` | IT Staff role badge background |
| `color-role-staff-text` | `#1D4ED8` | IT Staff role badge text |
| `color-role-admin-bg` | `#FEF3C7` | Administrator role badge background |
| `color-role-admin-text` | `#92400E` | Administrator role badge text |

### New: Ticket status badge tokens (8 statuses)

| Token | Hex | Status |
|-------|-----|--------|
| `color-status-new-bg` / `-text` | `#EAF6EF` / `#006B3C` | NEW |
| `color-status-open-bg` / `-text` | `#EFF6FF` / `#1D4ED8` | OPEN |
| `color-status-inprogress-bg` / `-text` | `#FEF3C7` / `#92400E` | IN_PROGRESS |
| `color-status-waiting-bg` / `-text` | `#EEF1F0` / `#475569` | WAITING_FOR_REQUESTER |
| `color-status-resolved-bg` / `-text` | `#D1FAE5` / `#065F46` | RESOLVED |
| `color-status-closed-bg` / `-text` | `#F0F0F0` / `#5A6F65` | CLOSED |
| `color-status-reopened-bg` / `-text` | `#FDF0F2` / `#B91C1C` | REOPENED |
| `color-status-cancelled-bg` / `-text` | `#FDF0F2` / `#C41E3A` | CANCELLED |

Non-color indicator: the badge always shows the uppercase status text, so the eight states remain distinguishable without color.

---

## 3. Badges

### 3.1 Status badge (existing component, extended)

Same layout as Lab 2 (12px Medium, uppercase, padding 4px 8px, radius 4px) using the eight status token pairs above.

- Assertion target: `data-testid="status-badge"` with `data-value="IN_PROGRESS"` etc.

### 3.2 Priority badge

`data-testid="priority-badge"` with `data-value="LOW|MEDIUM|HIGH"` (unchanged). Used for both Requested Priority and, highlighted with a leading label "IT", for IT Priority. IT Priority badge is identical visually; the label prefix ("IT: MEDIUM") is the differentiator.

### 3.3 Role badge (new)

14px Medium, regular case, padding 4px 8px, radius 4px.

| Role | Background | Text |
|------|-----------|------|
| REQUESTER | `#F0F0F0` | `#5A6F65` |
| IT_STAFF | `#EFF6FF` | `#1D4ED8` |
| ADMIN | `#FEF3C7` | `#92400E` |

- Assertion target: `data-testid="role-badge"` with `data-value="REQUESTER|IT_STAFF|ADMIN"`.

---

## 4. Application Shell (changed from Lab 2)

### Header (desktop ≥ 1024px)

- Height 64px, background `#006B3C`, padding 0 24px.
- Left: "TokTickIT" logotype (white, 20px Bold) + role-filtered nav links:
  - **Requester:** My Tickets, Create Ticket
  - **IT Staff / Administrator:** Ticket Queue; Administrator additionally sees User Management
  - Links: white, 16px Medium, margin-left 32px; active page gets a 3px `#EAF6EF` underline 4px below text.
- Right: column (flex, align-end) showing:
  - Line 1 — "Logged in as: **[Name]**" (white, 14px) with the role badge (`data-testid="role-badge"`) next to it.
  - Line 2 — email (white, 80% opacity, 12px).
  - "Logout" ghost button (white border / white text, hover pale-green background), `data-testid="logout-btn"`.
- The Lab 2 "Switch Requester" button and the amber "DEVELOPMENT MODE" banner are **removed**.

### Header (mobile < 768px)

- Height 56px; hamburger icon right opens a full-screen `#006B3C` overlay with role-filtered links stacked (20px, padding 16px, full-width, active `#0B7A46`), name + role badge + Logout at the bottom. Tap targets ≥ 44px.

### Navigation behavior

- Unauthorized destinations are never rendered (FR-07). A Requester never sees Ticket Queue or User Management links; an IT Staff user never sees User Management.

---

## 5. Auth Screens

### 5.1 Login Screen

Centered card on `#F5F7F6`; card white, max-width 400px, padding 32px, radius 12px, card shadow.

- "TokTickIT" title `#006B3C` 28px Bold centered; subtitle "Sign in to your account" 16px `#5A6F65`.
- **Email** text input: label "Email *", `aria-required="true"`, `data-testid="login-email"`.
- **Password** text input with Show/Hide toggle (visibility icon, accessible label): label "Password *", `aria-required="true"`, `data-testid="login-password"`.
- Primary **"Sign In"** button, full-width, `data-testid="login-submit-btn"`.

**States:**

| State | Behaviour |
|-------|-----------|
| Initial | Fields empty; submit disabled |
| Busy | Button shows inline spinner + "Signing In…", `aria-busy="true"`, form disabled |
| Validation | Inline errors below fields (`data-testid="error-email"`, `data-testid="error-password"`), red borders |
| Failure (credentials) | Error banner (danger) at top: "Invalid email or password" — safe generic message `data-testid="login-error"` |
| Inactive account | Error banner: "Your account is not active. Contact your administrator." |
| Rate limited | Error banner: "Too many failed login attempts. Try again later." |
| Success | `mustChangePassword = false` → navigate to the shell home; `true` → change password screen |

### 5.2 Change Password Screen (mandatory first login)

Centered card (max-width 480px), title "Change Your Password", 16px helper text: "You must choose a new password before continuing."

- **Current Password** input (`data-testid="current-password"`).
- **New Password** input with a live rule checklist (list items, `data-testid="password-rule-{n}"`):
  1. At least 8 characters
  2. At least one uppercase letter
  3. At least one lowercase letter
  4. At least one digit
  5. At least one special character
  6. Different from the current password
- **Confirm New Password** input (`data-testid="confirm-password"`).
- Primary **"Change Password and Continue"** `data-testid="change-password-btn"`.

**Behaviour:** Submit disabled until all rules met and confirmation matches. On success, a success banner shows ("Password updated") and the app proceeds into the shell (`mustChangePassword` becomes false). Failure shows field-level or banner errors; wrong current password shows an inline error under Current Password. The user cannot navigate away while on this screen; logout remains available.

---

## 6. Screens by Role

### 6.1 Requester (regression + Public Comments)

#### My Tickets / Create Ticket

Unchanged from Lab 2 with two exceptions:

1. The Requester identity comes from `GET /api/auth/me`; the Requester Selection screen, "Switch Requester" control, and localStorage requester state are removed.
2. Ticket cards and detail show the new extended status badge (8 values) and (on detail) the IT Priority badge.

#### Requester Ticket Detail (extended)

Lab 2 layout (breadcrumb, Ticket Information card, Attachments card) plus new cards:

- **Public Comments card** below the Ticket Information card, above Attachments:
  - Title "Public Comments (N)" — `data-testid="public-comments"`
  - Newest first list; each item shows author name + time (14px `#5A6F65`) and content (16px, `white-space: pre-wrap`, plain text).
  - Composer: textarea (max 2000 chars, counter `data-testid="counter-comment"`), Primary "Post Comment" `data-testid="post-comment-btn"`, busy/validation states per Lab 2 form rules.
- **"Problem Appears Resolved"** secondary button in the Ticket Information card action row, `data-testid="indicate-resolved-btn"`, shown only when the API's `canIndicateResolved` is true and the Ticket is not already `RESOLVED`/`CLOSED`/`CANCELLED`. Requires a confirmation modal: "Have you confirmed the problem is resolved?" The action posts and immediately appends the automatic comment to the thread. After it is posted the button hides.
- **"Provide Information"** secondary button `data-testid="requester-respond-btn"` shown only when the Ticket status is `WAITING_FOR_REQUESTER`; it opens a small composer (optional Public Comment, max 2000 chars) and calls the requester-respond endpoint to move the Ticket to `OPEN` with the supplied reply.
- **Internal Notes are never visible** to a Requester (BR-04, BR-28).

### 6.2 IT Staff Ticket Queue

Full width, max-width 1280px.

**Controls row 1 (flex, space-between):**
- Search input (`data-testid="queue-search-input"`), placeholder "Search tickets…", debounce 300ms.
- Queue count line: "Showing X of Y tickets" 14px `#5A6F65`.

**Controls row 2 (flex wrap, gap space-4):** filter dropdowns `data-testid="queue-filter-status"`, `data-testid="queue-filter-priority"` (IT Priority), `data-testid="queue-filter-category"`, `data-testid="queue-filter-system"`, `data-testid="queue-filter-assignment"` (All / Unassigned / Assigned to me), sort dropdown `data-testid="queue-sort-control"`, and "Clear Filters" ghost (`data-testid="queue-clear-filters-btn"`, visible only when any filter/search is active).

**Desktop table (≥ 1024px)** `data-testid="queue-table"`:

| Column | Content | Sortable |
|--------|---------|----------|
| Ticket | Number (semibold, link to detail) + created date line | ticketNumber |
| Summary | Single-line truncated summary; category + related system metadata below | — |
| Requester | Name + email | — |
| Req. Priority | Priority badge | requestedPriority |
| IT Priority | "IT:" + priority badge | itPriority |
| Status | Status badge; also the row's secondary indicator | currentStatus |
| Owner | Owner name + role, or "Unassigned" muted text | — |
| Last Updated | Date/time | updatedAt |

Columns are selectable from the sort dropdown (mapped to `sortBy` values in api-spec §4.8). Rows are clickable → Ticket Detail. Owner names are links to nothing; assignment handled on detail.

**Mobile / tablet (< 1024px): card list** `data-testid="queue-card"` — stacked cards (Ticket + status badge on top line, summary below, metadata wrap), tap target ≥ 44px, filter row collapses to a stacked panel toggled by "Filters" button.

**States:**

| State | Treatment |
|-------|-----------|
| Loading | Skeleton rows in table / skeleton cards |
| Empty (no tickets at all) | EmptyState: "No Tickets in Queue" |
| No results (filters/search) | EmptyState: "No Results / No tickets match your current filters." + "Clear Filters" |
| Forbidden (403) | ErrorState "You are not authorized to view the ticket queue." |
| Failure | Error banner with safe message; retry |
| Pagination | `data-testid="queue-pagination"`; page sizes 10/25/50 |

### 6.3 IT Staff Ticket Detail

Same page header pattern (breadcrumb "Ticket Queue / TKT-XXXXXX"). Layout:

**1. Ticket Information Card (top).** Reuses the Lab 2 grouped read-only grid, but only operational fields are editable:

- Read-only: Ticket Number, Ticket Date, Requester, Category, Related System, Requested Priority, Summary, Description.
- **Operational group (write surface):**
  - **Owner** — "Unassigned" chip + Secondary **"Claim"** button (`data-testid="claim-btn"`) when unassigned; when assigned, an Owner select (`data-testid="owner-select"`) listing active IT_STAFF/ADMIN users for reassignment.
  - **IT Priority** select `data-testid="it-priority-select"` (LOW/MEDIUM/HIGH). Editable field styling (white bg, `#C0C8C4` border).
  - **Status** select `data-testid="status-select"` populated only with `permittedStatusTransitions` from the API (never the full enum). The current status badge is always shown next to the label; changing it is validated server-side.
- Action row: Primary **"Save Changes"** `data-testid="save-ticket-btn"` for the operational group; busy/disabled states per Lab 2 button rules. Success banner "Ticket updated." Validation/failure banners per Lab 2 alert rules.

**2. Tabs card** `data-testid="detail-tabs"` below the information card. Three tabs; the coding agent must keep Public Comments and Internal Notes visually distinct:

- **Public Comments** tab (default, `data-testid="tab-comments"`):
  - Thread list (newest first): author + time, content (pre-wrap). Composer textarea + "Post Comment" `data-testid="post-comment-btn"` (IT Staff/Admin only).
  - Badge labeled "Visible to Requester, IT Staff, and Administrator" — a small muted hint with a globe/eye icon.
- **Internal Notes** tab (`data-testid="tab-notes"`):
  - Note list (newest first) with a small "Internal" marker; same composer pattern, `data-testid="post-note-btn"`.
  - Amber hint banner: "Internal only — not visible to Requesters" (warning tokens `#FEF3C7`/`#92400E`) so private information is never accidentally posted publicly.
- **Attachments** tab (`data-testid="tab-attachments"`): read-only attachment metadata rows (download enabled for active attachments; removed rows muted with "Removed" badge; no upload zone for staff).

**Error states for detail:** 404 → ErrorState "Ticket not found." with "Back to Ticket Queue"; 403 → ErrorState "You are not authorized to view this ticket."; skeleton loading; safe failure banner.

### 6.4 Administrator User Management

Full width, max-width 1200px.

**Controls row 1 (flex, space-between):** search input `data-testid="user-search-input"` (placeholder "Search by name or email…", debounce 300ms) + Primary **"Create User"** button `data-testid="create-user-btn"`.

**Controls row 2:** role filter dropdown `data-testid="user-filter-role"` (All / Requester / IT Staff / Administrator) + "Clear Filters" ghost when active.

**User table** `data-testid="users-table"` (desktop/tablet; card list `data-testid="user-card"` on mobile):

| Column | Content |
|--------|---------|
| Name | Full name (semibold) + created date below |
| Email | Email |
| Role | Role badge `data-testid="role-badge"` with `data-value` |
| Status | "Active"/"Inactive" text badge; no pagination required (Excluded Scope) |
| Actions | Ghost "Edit" `data-testid="edit-user-btn"` |

Empty/no-results states use EmptyState ("No users found" / "No results match your search or filter." with Clear Filters). Loading uses skeleton rows. Forbidden (403) and safe-failure banners per standard rules.

**Create / Edit side panel** (modal-like side panel, max-width 520px, `role="dialog"`, `aria-modal="true"`):

- **Full Name** input (`data-testid="user-name-input"`)
- **Email** input (`data-testid="user-email-input"`)
- **Role** select (`data-testid="user-role-select"`): one of Requester / IT Staff / Administrator
- **Active** toggle (`data-testid="user-active-toggle"`), default on; labelled "Active"
- **Create mode only:** "Initial Password" input (`data-testid="user-initial-password"`) with the same rule checklist as §5.2; helper "The user must change this at first sign-in."
- **Edit mode only:** "Set New Initial Password" secondary control `data-testid="reset-password-btn"` that reveals a password field; submitting marks the user `mustChangePassword`.
- Actions: Primary Save (`data-testid="save-user-btn"`), Secondary Cancel (`data-testid="cancel-btn"`).

**Edit-mode safety behaviour (client + server):**
- When editing the current Administrator's own account, the Active toggle is disabled with a muted hint "You cannot deactivate your own account." (BR-31).
- The UI hints when a change would remove the last active Administrator; the server is authoritative (`409 LAST_ACTIVE_ADMIN`).
- Duplicate email handling: inline error "This email is already in use." on the Email field (from `409 EMAIL_ALREADY_EXISTS`).
- Validation/success/busy/failure feedback follows the standard form rules.

---

## 7. Required Screen Modes and Feedback Matrix

| Condition | Feedback |
|-----------|----------|
| Loading | Skeletons / spinners with `role="status"` |
| Validation | Inline errors below fields, `role="alert"`, red borders, field-level preserved values |
| Submitting | Busy primary button (`aria-busy="true"`), form disabled |
| Success | Success alert banner; comments/notes appended in place |
| Empty | EmptyState component with a primary next action |
| No results | EmptyState with "Clear Filters" |
| Forbidden (403) | ErrorState; navigation simply omits the unauthorized destination |
| Not found (404) | ErrorState "not found" + back action |
| Conflict (409) | Inline or banner with the specific conflict (duplicate email, invalid status transition, self-deactivation, last admin) |
| Safe failure (500) | Error banner with a safe message; no technical detail |
| Rate limited (429) | Login banner; retry later |

---

## 8. Responsive Behavior

Breakpoints and general adaptation follow Lab 2 §13 (mobile < 768px, tablet 768–1023px, desktop ≥ 1024px). Specific rules:

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Header | Horizontal nav + user/role + Logout | Same | Hamburger overlay |
| Login / Change Password card | Centered, max-width 400/480px | Same | Full-width with margin, no clipping at 375px |
| Queue | Table layout | Cards (1 column) | Cards; filters in collapsible panel |
| Ticket Detail writes | Operational group in a 2-column grid with the tabs card | Same | 1-column; selects full-width |
| Comments / Notes thread | Metalist beside composer (stacked within tab) | Stacked | Stacked; composer above list |
| User Management | Table + side panel | Table + side panel | Card list + full-screen side panel |
| Buttons | Inline rows | Inline | Full-width, ≥ 44px targets |

---

## 9. Accessibility

Lab 2 §14 rules remain in force. Additions:

- Role badge and status badges are text labels first; color is supplementary (non-color indicator preserved).
- Public/Internal distinction is conveyed by text ("Public", "Internal"), not color alone.
- Comment/Note content areas use `role="log"`/`aria-live="polite"` so an appended item is announced.
- Password toggles use `aria-pressed`; show/hide label read by screen readers.
- Tabs implement the ARIA tab pattern (`role="tablist"`, `role="tab"`, `aria-selected`, `tabindex`).
- All new dialogs use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.

---

## 10. Animation and Transitions

Same durations/easings as Lab 2 §15. Tab switches fade in 200ms ease. New comment/note items animate in 200ms ease. Side panel slides in 200ms ease.

---

## 11. Automated Assertion Targets

All Lab 2 `data-testid` values remain. New Lab 3 targets:

| `data-testid` | Element |
|--------------|---------|
| `login-email` / `login-password` | Login inputs |
| `login-submit-btn` | Sign In button |
| `login-error` | Login error banner |
| `current-password` | Change Password current field |
| `confirm-password` | Change Password confirm field |
| `password-rule-{n}` | Password rule checklist items |
| `change-password-btn` | Change Password submit |
| `logout-btn` | Header Logout button |
| `role-badge` | Role badge (with `data-value`) |
| `queue-search-input` | Queue search |
| `queue-filter-{status\|priority\|category\|system\|assignment}` | Queue filter dropdowns |
| `queue-sort-control` | Queue sort dropdown |
| `queue-clear-filters-btn` | Queue Clear Filters |
| `queue-table` / `queue-card` | Queue table / mobile card list |
| `queue-pagination` | Queue pagination |
| `claim-btn` | Claim unassigned Ticket |
| `owner-select` | Owner reassignment select |
| `it-priority-select` | IT Priority select |
| `status-select` | Status select (permitted transitions only) |
| `save-ticket-btn` | Save operational changes |
| `detail-tabs` | Tabs container |
| `tab-comments` / `tab-notes` / `tab-attachments` | Detail tabs |
| `post-comment-btn` / `post-note-btn` | Comment / Note post buttons |
| `counter-comment` / `counter-note` | Comment / Note character counters |
| `indicate-resolved-btn` | "Problem Appears Resolved" action |
| `requester-respond-btn` | "Provide Information" action (`WAITING_FOR_REQUESTER` → `OPEN`)
| `public-comments` | Public Comments card on Requester detail |
| `user-search-input` | User Management search |
| `user-filter-role` | User Management role filter |
| `create-user-btn` | Create User button |
| `users-table` / `user-card` | User table / mobile card list |
| `edit-user-btn` | Edit user action |
| `user-name-input` / `user-email-input` / `user-role-select` | User form fields |
| `user-active-toggle` | Active toggle |
| `user-initial-password` | Initial password field (create) |
| `reset-password-btn` | Set new initial password (edit) |
| `save-user-btn` | Save user |

---

## 12. Visual Inspection Checklist and Screenshot Paths

Playwright saves screenshots to `artifacts/lab-03/screenshots/`:

```
artifacts/lab-03/screenshots/
├── authentication/
│   ├── desktop-login.png
│   ├── desktop-login-validation.png
│   ├── desktop-login-error.png
│   ├── desktop-change-password.png
│   ├── mobile-login.png
│   └── mobile-change-password.png
├── staff-queue/
│   ├── desktop-queue.png
│   ├── desktop-queue-filters.png
│   ├── desktop-queue-no-results.png
│   ├── tablet-queue.png
│   └── mobile-queue.png
├── staff-ticket-detail/
│   ├── desktop-detail-tabs-comments.png
│   ├── desktop-detail-tabs-notes.png
│   ├── desktop-detail-operational.png
│   ├── mobile-detail.png
│   └── forbidden-or-notfound.png
└── user-management/
    ├── desktop-users-list.png
    ├── desktop-create-user-panel.png
    ├── desktop-edit-user-panel.png
    ├── desktop-self-deactivation-disabled.png
    └── mobile-users.png
```

### Authentication — checklist
- [ ] Login card centered; Zen Green; no development banner anywhere.
- [ ] Password Show/Hide toggle works; toggle `aria-pressed`.
- [ ] Generic "Invalid email or password" on failure (no account existence leak).
- [ ] Inactive account shows the specific safe banner.
- [ ] First-login users land on Change Password and cannot navigate elsewhere.
- [ ] Rule checklist updates live; submit disabled until all rules pass.
- [ ] After change: success banner, `mustChangePassword` cleared, shell opens.

### Shell — checklist
- [ ] Header shows name + role badge; email second line; Logout present.
- [ ] Requester sees only My Tickets / Create Ticket; IT Staff sees Ticket Queue; Admin sees Ticket Queue + User Management.
- [ ] No amber development banner; no Switch Requester.
- [ ] Hamburger overlay on mobile; tap targets ≥ 44px.

### Queue — checklist
- [ ] Desktop renders the table; tablet/mobile render cards; no horizontal scroll.
- [ ] Sortable columns surfaced in the sort dropdown; IT Priority, Status, Owner clearly visible.
- [ ] Filters + search combine; "Clear Filters" appears only when active.
- [ ] Empty / no-results states rendered; pagination visible and usable on mobile.
- [ ] Forbidden (Requester forced) shows the 403 ErrorState.

### Staff Ticket Detail — checklist
- [ ] Read-only vs editable fields visually distinct (`#F9F9F7` vs white).
- [ ] Status dropdown shows only permitted transitions; labeled with current status badge.
- [ ] Claim button appears only when unassigned; owner select when assigned.
- [ ] Public Comments and Internal Notes tabs visually distinct; Internal Notes tab carries the amber "internal only" hint.
- [ ] No upload zone for staff in Attachments tab; removed rows muted.
- [ ] "Problem Appears Resolved" visible/hidden per `canIndicateResolved` on the Requester view.

### User Management — checklist
- [ ] Search + single role filter work; no pagination needed.
- [ ] Create panel includes initial-password rule checklist; success marks `mustChangePassword`.
- [ ] Editing own account disables the Active toggle with the self-deactivation hint.
- [ ] Duplicate email inline error; last-admin safety hint shown; server still authoritative.
- [ ] Panel responsive: side panel on desktop, full-screen on mobile.

### General — checklist
- [ ] Zen Green header consistent on every screen; new badge palettes applied only where specified.
- [ ] Focus rings visible on all new controls; contrast ratios pass WCAG AA.
- [ ] Comments/Notes render pre-wrapped plain text; no HTML executes.
- [ ] No horizontal scroll at 375px on any new screen.

---

## 13. Component Structure Reference

Extensions to the Lab 2 tree:

```
/components
  /ui
    LoginForm.tsx          ← email/password + show/hide + safe error banner
    ChangePasswordForm.tsx ← current/new/confirm + live rule checklist
    RoleBadge.tsx          ← role badge (data-testid="role-badge")
    StatusBadge.tsx        ← 8-status variant of Lab 2 Badge
    TabPanel.tsx           ← ARIA tab pattern
    Toggle.tsx             ← Active toggle
    SidePanel.tsx          ← user management create/edit panel
    PasswordStrengthList.tsx
  /layout
    AppShell.tsx           ← authenticated header (name + role badge + Logout), role-filtered nav
    AuthLayout.tsx         ← centered card layout for Login / Change Password
    RequireAuth.tsx        ← session gate (401) + role gate (403) wrapper
    RequirePasswordChange.tsx ← mustChangePassword gate
  /features
    TicketQueue.tsx        ← table + card list + filters/search/sort/pagination
    QueueFilters.tsx
    QueueTable.tsx
    QueueCards.tsx
    TicketOperationalPanel.tsx  ← owner/claim, IT priority, status controls
    CommentThread.tsx
    InternalNotes.tsx
    CommentComposer.tsx
    UserList.tsx
    UserFormPanel.tsx
```

---

## 14. Developer Notes

- Centralize the new color tokens in the theme config alongside Lab 2 tokens; never hard-code hex values in components.
- React Query/SWR keys split by role: `auth.me`, `queue`, `ticket.{id}`, `users`. Invalidate `auth.me` on login/logout/password change.
- Keep Requester screen data fetching on `ticket` keys unaffected; only the identity source changes.
- Debounce queue and user searches 300ms; skeleton-load every async boundary.
- Run Lab 2 E2E as a regression suite (updated for removed selector) plus the new Lab 3 suites.