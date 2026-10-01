# Lab 4 UI Specification

---

## 1. Purpose and Relationship to Labs 2–3

Lab 4 reuses the Zen Green design language, tokens, spacing, typography, form conventions, badges, buttons, validation placement, responsive rules, and accessibility expectations established in Lab 2 and extended in Lab 3. This document defines only what is new or changed: the IT Staff Dashboard, the Requester Dashboard, the Actions Taken area on Ticket Detail, the extended status control (resolution gate), and final-polish navigation changes. Where a rule is not restated here, the corresponding Lab 2/3 rule remains in force.

Design principles are unchanged: **Clarity, Efficiency, Feedback, Consistency, Accessibility, Responsiveness.**

---

## 2. Color and Component Tokens

All Lab 2/3 tokens remain valid. No new color tokens are introduced in Lab 4 — dashboards and Actions Taken reuse existing status/priority/role badge tokens and the standard card/button/form components. This is a deliberate constraint so the finished product still looks like one coherent application (handout §7).

### Metric Card (new component)

- Container: `.card` styling (white surface, `1px solid #D8E2DC`, radius 8px, padding 20px), consistent with existing Lab 2/3 cards.
- Label: 13px Medium, `#5A6F65`, uppercase-tracking optional.
- Value: 32px Bold, `#1C2A22`.
- Optional link row beneath the value: "View all" ghost link, 13px, `#006B3C`, `data-testid="metric-card-link"` — this is the metric's drill-down.
- Metric cards never show a trend delta (excluded per specification.md D-06).

### Priority Breakdown Strip (new component)

- Single-line flex row, 13px Medium text, `#5A6F65` labels with `#1C2A22` bold counts: "Low **N**  ·  Medium **N**  ·  High **N**" separated by a muted dot.
- Each segment is an individually clickable link (`data-testid="priority-breakdown-{low|medium|high}"`), same hover/focus treatment as `metric-card-link`.
- No new priority colors — reuses the existing `LOW`/`MEDIUM`/`HIGH` priority-badge token values as text-color accents only (no badge pill chrome, to keep the strip visually lighter than the card row).

---

## 3. Application Shell (changed from Lab 3)

- **Dashboard** becomes a new nav link and the default landing route after login for every role, added leftmost in the role-filtered nav list:
  - **Requester:** Dashboard, My Tickets, Create Ticket
  - **IT Staff:** Dashboard, Ticket Queue
  - **Administrator:** Dashboard, Ticket Queue, User Management
- Active-page indicator (3px underline) applies to Dashboard exactly as it does to other nav links.
- No other shell changes from Lab 3 (header layout, role badge, Logout, mobile hamburger overlay all unchanged).

---

## 4. IT Staff Dashboard (`/dashboard`, IT_STAFF / ADMIN)

Full width, max-width 1280px, consistent with the Ticket Queue container.

### Layout

1. **Welcome header:** "Welcome back, {FirstName}!" (24px Semi-bold) + subtitle "Here's what's happening with your queue today." (14px `#5A6F65`) + a "Refresh" ghost button top-right (`data-testid="dashboard-refresh-btn"`) that re-fetches without a full page reload.
2. **Metric card row** (`data-testid="staff-metric-cards"`), 6 cards in a responsive grid (6 columns desktop ≥ 1024px, 3 columns tablet 768–1023px, 1-column stack mobile < 768px — see §9): **New**, **Open**, **In Progress**, **Waiting for Requester**, **Unassigned**, **My Assigned**. Each card's link drills into the Ticket Queue pre-filtered by that status (`assignment=unassigned` for **Unassigned**; `assignment=assignedToMe` for **My Assigned**; `status=` / `priority=` per api-spec §4.6).
3. **Priority breakdown strip** (`data-testid="staff-priority-breakdown"`), directly beneath the metric card row: a single compact row of three inline counts — "Low: N", "Medium: N", "High: N" — over active (non-terminal-status) Tickets. Each count is a link that drills into the Ticket Queue pre-filtered by that `itPriority`. Rendered smaller and visually subordinate to the primary card row (13px labels) so it reads as a secondary detail, not a duplicate set of cards (specification.md D-08).
3b. **Administrator-only user strip** (`data-testid="staff-user-counts"`, rendered only when the session role is `ADMIN`): single compact row — "Requesters **N** · IT Staff **N** · Admins **N**" (13px, same treatment as the priority strip; counts from `data.userCounts`, active users only). Each segment drills into User Management pre-filtered by that role (`/users?role=REQUESTER`, etc.); zero renders as `0`, never hidden.
4. **Two-column content row** (stacks to one column < 1024px):
   - **Left — "My Recent Tickets"** (`data-testid="staff-recent-tickets"`): list of the current user's 5 most recently updated owned Tickets — ticket number (semibold, link to Ticket Detail), status badge, relative/short date. "View all" link (top-right of the card) → Ticket Queue filtered to `assignment=assignedToMe`.
   - **Right — "Quick Actions"** (`data-testid="staff-quick-actions"`): 3 icon-buttons — **Browse Unassigned** (→ Ticket Queue filtered to `assignment=unassigned`), **Search Tickets** (→ Ticket Queue with search focused), **My Queue** (→ Ticket Queue filtered to `assignment=assignedToMe`). No Create Ticket button for Staff (see specification.md D-11 — `POST /api/tickets` remains `REQUESTER only` per Lab 3).

### States

| State | Treatment |
|---|---|
| Loading | Skeleton metric cards + skeleton list rows |
| Empty ("My Recent Tickets" has none) | EmptyState: "No assigned Tickets yet." with a "Browse Queue" action |
| Metrics all zero | Cards render normally showing `0` — this is not an error state |
| Forbidden (403) | ErrorState: "You are not authorized to view this dashboard." |
| Failure | Error banner, safe message, "Retry" action re-triggers the fetch |

---

## 5. Requester Dashboard (`/dashboard`, REQUESTER)

Full width, max-width 1280px.

### Layout

1. **Welcome header:** "Welcome, {FirstName}!" + subtitle "Here's the latest on your requests." + Refresh button (`data-testid="dashboard-refresh-btn"`).
2. **Metric card row** (`data-testid="requester-metric-cards"`), 4 cards: **My Open Tickets**, **Waiting on You**, **Resolved**, **Closed**. Each links to My Tickets pre-filtered by the corresponding status group.
3. **Two-column content row** (stacks to one column < 1024px):
   - **Left — "My Recent Tickets"** (`data-testid="requester-recent-tickets"`): 5 most recently updated owned Tickets, same row format as the Staff Dashboard. "View all" → My Tickets (unfiltered).
   - **Right — "Quick Actions"** (`data-testid="requester-quick-actions"`): **Create Ticket** ("Submit a new request"), **View My Tickets** ("Track existing requests").

### States

Same pattern as §4: Loading (skeleton), Empty ("No tickets submitted yet." with a "Create Ticket" action — reused from the Lab 2 My Tickets empty state), zero-metrics is normal, Forbidden, Failure.

---

## 6. Actions Taken (Ticket Detail extension)

### 6.1 Placement

Added as a new tab in the existing IT Staff Ticket Detail tabs card (Lab 3 §6.3): **Actions Taken** (`data-testid="tab-actions"`), positioned after Internal Notes and before Attachments. For the **Requester** Ticket Detail (Lab 3 §6.1), Actions Taken appears as a new read-only card below Public Comments, titled "Actions Taken (N)" (`data-testid="actions-taken-readonly"`).

### 6.2 List (all roles that can view)

- Ordered oldest → newest by Action Date/Time (BR-08), each row/card showing: Action Date/Time from `actionAt` (formatted, e.g. "Sep 20, 2026, 9:15 AM"), Performed By (name + role badge), Description, Result, a "Follow-up required" amber tag when `followUpRequired = true` (with the Follow-up Note shown beneath it), Attachment Notes (muted italic, shown only if present), and — for IT Staff/Admin only — an "Edit" ghost button (`data-testid="edit-action-btn"`) per row.
- Empty state: "No Actions Taken recorded yet." (`data-testid="actions-taken-empty"`), shown to all roles; IT Staff/Admin additionally see the "Add Action Taken" primary button in this state.

### 6.3 Create / Edit Form (IT Staff / Admin only)

Side panel or inline expanding form (implementation's choice, must not obscure the existing list) with:

- **Action Date/Time** `datetime-local` picker (`data-testid="action-datetime-input"`), required — defaults to now, `max` set to now (blocks future dates client-side); converts to UTC ISO-8601 on submit. Past values allowed for backdated logging (BR-06).
- **Description** textarea, required, counter "0 / 2000" (`data-testid="action-description-input"`)
- **Result** textarea, required, counter "0 / 2000" (`data-testid="action-result-input"`)
- **Follow-Up Required?** toggle (`data-testid="action-followup-toggle"`), default off
- **Follow-up Note** textarea (`data-testid="action-followup-note-input"`) — rendered and required only when the toggle above is on; hidden and cleared client-side when the toggle is off (the backend additionally auto-clears any stale note to `null` per BR-04, so untoggling never causes a `400`)
- **Attachment Notes** text input, optional, counter "0 / 500" (`data-testid="action-attachment-notes-input"`), helper text: "e.g. 'See diagnostic_log_2.pdf on the shared drive.'"
- Primary **"Save Action Taken"** (`data-testid="save-action-btn"`), busy/disabled during submit (per Lab 2/3 button rules); Secondary "Cancel"
- Read-only, non-editable in this form: Performed By only (shown as static text at the top of the form when editing an existing entry, never as an input). Action Date/Time remains editable for correction.

**Validation feedback:** inline error under Follow-up Note ("Required when follow-up is needed") when the toggle is on and the field is empty; inline error under Description/Result if outside the 1–2000 range; inline error under Action Date/Time ("Date cannot be in the future") when a future value is picked or the server returns `ACTION_AT_IN_FUTURE`.

**Conflict feedback (`409 STALE_UPDATE`):** banner above the form: "This Action Taken was updated by someone else. The latest version has been loaded — please review and try again." — the form is repopulated with the server's current values and the hidden `version` field is refreshed automatically; the user's own unsaved edits in open fields are not silently discarded without this warning.

### 6.4 Requester View

Identical list rendering to §6.2 minus the Edit button and the "Add Action Taken" button — enforced by role check in the component, never merely by the backend rejecting the request (FR-04, AC-08, AC-09).

---

## 7. Ticket Status Controls (extended from Lab 3 §6.3)

- The Status select (`data-testid="status-select"`) continues to list only `permittedStatusTransitions` returned by the API.
- When the current user attempts to select `RESOLVED` and the API's `canResolve` flag (new helper field on Ticket Detail response, mirrors `canIndicateResolved`) is `false`, the option is shown but disabled with an inline hint directly beneath the select: "Add an Action Taken with no outstanding follow-up before resolving." (`data-testid="resolution-gate-hint"`). This is a UI convenience only — the backend independently rejects the write per BR-10 regardless of what the client renders (FR-06).
- On a successful status/priority/owner change, the Ticket Information Card's status badge and the page's `version` state refresh immediately without a full reload (FR-09).
- `409 STALE_UPDATE` on this form shows the same conflict banner pattern as §6.3, refreshing the operational fields to the server's current values.

---

## 8. Required Screen Modes and Feedback Matrix (dashboards + Actions Taken)

| Condition | Feedback |
|---|---|
| Loading | Skeletons with `role="status"` |
| Validation | Inline errors below fields, `role="alert"`, red borders, field values preserved |
| Submitting | Busy primary button (`aria-busy="true"`), form disabled |
| Success | Success banner or in-place list update (new/edited Action Taken appears without a full reload) |
| Empty | EmptyState component with a primary next action where one exists |
| Zero-value metrics | Rendered normally as `0` — never treated as an empty/error state |
| Forbidden (403) | ErrorState; navigation simply omits the unauthorized destination |
| Not found (404) | ErrorState "not found" + back action |
| Conflict (409 STALE_UPDATE) | Conflict banner; form/fields refreshed to current server state |
| Unprocessable (422 RESOLUTION_NOT_ALLOWED) | Inline hint on the Status select (§7) plus a banner if the write was attempted via a stale/disabled control |
| Safe failure (500) | Error banner with a safe message; no technical detail |

---

## 9. Responsive Behavior

Breakpoints unchanged from Lab 2/3 (mobile < 768px, tablet 768–1023px, desktop ≥ 1024px).

| Element | Desktop | Tablet | Mobile |
|---|---|---|---|
| Dashboard metric cards | 6-column (staff) / 4-column (requester) grid | 3-column / 2-column grid | 1-column stack |
| Staff priority breakdown strip | Single inline row | Single inline row | Wraps to 3 stacked rows |
| Dashboard content row (Recent Tickets + Quick Actions) | 2-column | 2-column | 1-column, Recent Tickets first |
| Actions Taken list | Table-like rows | Stacked cards | Stacked cards |
| Actions Taken create/edit form | Side panel, max-width 480px | Side panel, full-height | Full-screen sheet |
| Status select + resolution hint | Inline with other operational controls | Same | Full-width, hint wraps below |

---

## 10. Accessibility

Lab 2/3 rules remain in force. Additions:

- Metric cards are not purely decorative — each has an accessible name combining label + value (e.g. `aria-label="New: 14 tickets"`) so screen readers announce the count, not just the digits.
- The disabled `RESOLVED` option in the Status select carries `aria-disabled="true"` plus the hint text is associated via `aria-describedby`.
- Conflict banners use `role="alert"` so they are announced immediately when a stale-write response arrives.
- Follow-Up Required toggle uses `aria-pressed`/`role="switch"` consistent with the Lab 3 Active toggle pattern.

---

## 11. Automated Assertion Targets (new in Lab 4)

All Lab 2/3 `data-testid` values remain. New Lab 4 targets:

| `data-testid` | Element |
|---|---|
| `dashboard-refresh-btn` | Dashboard refresh action (both dashboards) |
| `staff-metric-cards` / `requester-metric-cards` | Metric card row containers |
| `metric-card-link` | "View all" drill-down link on a metric card |
| `staff-priority-breakdown` | Priority breakdown strip container (Staff Dashboard) |
| `priority-breakdown-low` / `-medium` / `-high` | Individual priority-breakdown drill-down links |
| `staff-user-counts` | Admin-only user strip (ADMIN viewers only; omitted for IT_STAFF) |
| `action-datetime-input` | Action Date/Time datetime-local picker |
| `staff-recent-tickets` / `requester-recent-tickets` | Recent Tickets list card |
| `staff-quick-actions` / `requester-quick-actions` | Quick Actions card |
| `tab-actions` | Actions Taken tab (Staff Ticket Detail) |
| `actions-taken-readonly` | Actions Taken read-only card (Requester Ticket Detail) |
| `actions-taken-empty` | Actions Taken empty state |
| `edit-action-btn` | Edit action on an Actions Taken row |
| `action-description-input` / `action-result-input` | Create/edit form fields |
| `action-followup-toggle` / `action-followup-note-input` | Follow-up controls |
| `action-attachment-notes-input` | Attachment Notes field |
| `save-action-btn` | Save Action Taken |
| `resolution-gate-hint` | Inline hint blocking premature Resolve |

---

## 12. Visual Inspection Checklist and Screenshot Paths

Playwright saves screenshots to `artifacts/lab-04/screenshots/`:

```
artifacts/lab-04/screenshots/
├── staff-dashboard/
│   ├── desktop-dashboard.png
│   ├── desktop-dashboard-empty.png
│   ├── tablet-dashboard.png
│   └── mobile-dashboard.png
├── requester-dashboard/
│   ├── desktop-dashboard.png
│   ├── desktop-dashboard-empty.png
│   ├── tablet-dashboard.png
│   └── mobile-dashboard.png
└── actions-taken/
    ├── desktop-list.png
    ├── desktop-create-form.png
    ├── desktop-followup-required.png
    ├── desktop-resolution-blocked.png
    ├── desktop-stale-conflict.png
    ├── mobile-list.png
    └── requester-readonly-view.png
```

### Dashboards — checklist
- [ ] Metric cards show correct counts against seeded data (cross-checked with a direct query — Part 5 evidence requirement).
- [ ] Zero-value metrics render as `0`, not blank or hidden.
- [ ] Unassigned card and the Low/Medium/High priority breakdown strip both render with correct counts and drill-down links (Staff Dashboard).
- [ ] Admin-only user strip renders for ADMIN (Requesters / IT Staff / Admins active counts with role-filtered drill-down) and is omitted for IT_STAFF.
- [ ] Every card's drill-down opens the correctly pre-filtered Queue/My Tickets view.
- [ ] Recent Tickets empty state renders correctly for a user with no Tickets.
- [ ] Dashboard is the default landing page after login for every role.
- [ ] Responsive grid collapses correctly at each breakpoint; no horizontal scroll at 375px.

### Actions Taken — checklist
- [ ] List ordered oldest → newest by Action Date/Time (`actionAt`); Performed By is never editable, Action Date/Time is editable via picker.
- [ ] Picker defaults to now with `max` = now; future dates blocked client-side and rejected server-side (`ACTION_AT_IN_FUTURE`).
- [ ] Follow-up Note required only when the toggle is on; validation blocks the mismatched case.
- [ ] Requester view has zero write controls (no Add/Edit buttons rendered, not just disabled).
- [ ] Staff can edit an Action Taken they did not personally create.
- [ ] Stale-write conflict banner appears and repopulates the form correctly.
- [ ] Resolution blocked with a clear inline reason when the gate is not satisfied; unblocked and successful once satisfied.

### General — checklist
- [ ] No new color tokens introduced; Zen Green consistent across every new screen.
- [ ] Focus rings visible on all new controls; contrast ratios pass WCAG AA.
- [ ] No console errors, broken links, or placeholder text anywhere in the app (final hardening).
- [ ] Full Lab 2/3 regression screenshots re-captured and still match expected behavior.

---

## 13. Component Structure Reference

Extensions to the Lab 3 tree:

```
/components
  /ui
    MetricCard.tsx          ← label + value + optional drill-down link
    ActionTakenForm.tsx     ← create/edit form, follow-up conditional field
    ActionTakenRow.tsx      ← list row/card (read-only + edit-button variants)
    ConflictBanner.tsx      ← reusable 409 STALE_UPDATE banner
  /layout
    (AppShell.tsx extended with the Dashboard nav link)
  /features
    StaffDashboard.tsx
    RequesterDashboard.tsx
    ActionsTakenPanel.tsx   ← tab content: list + form + empty state
    ResolutionGateHint.tsx
```

---

## 14. Developer Notes

- Dashboard fetches use their own query keys (`dashboard.staff`, `dashboard.requester`); invalidate on any Ticket/Action-Taken mutation so counts stay fresh after navigating back.
- Conflict handling (`ConflictBanner`) is a shared component between the Actions Taken form and the Ticket status control — implement once, reuse both places.
- Skeleton-load every async boundary; debounce nothing new is required in Lab 4 beyond what Lab 3 already debounces.
- Reuse the Lab 3 `role="dialog"` side-panel pattern for the Actions Taken form on mobile (full-screen sheet), consistent with the User Management panel.
