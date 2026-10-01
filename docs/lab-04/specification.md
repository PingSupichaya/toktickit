# Lab 4 Specification: Actions Taken, Dashboards, and Final Regression

---

## 1. Sprint Goal

Complete the core TokTickIT service-desk workflow by giving IT Staff a way to plan and record the actual work performed on a Ticket (Actions Taken), enforcing the final Ticket resolution rule so a Ticket cannot be formally resolved without recorded work, and delivering concise role-appropriate dashboards for Requesters and IT Staff. Lab 4 also hardens the complete application built across Labs 1–3 so every earlier feature (authentication, authorization, Requester functions, IT Staff Ticket Queue and Detail, Public Comments, Internal Notes, Attachments, and Administrator User Management) continues to work correctly and consistently under the Zen Green design language.

---

## 2. Stakeholder Request

IT Staff can now talk to Requesters, but there is still no reliable record of the actual work performed on a Ticket. Add an Actions Taken log under each Ticket capturing what was done, the result, whether follow-up is needed, and where to find supporting files. The primary Ticket Owner still coordinates the Ticket as a whole, but any IT Staff member may add an Action Taken. Requesters may continue to indicate a problem appears resolved, but only IT Staff may formally resolve a Ticket, and the backend must refuse to resolve a Ticket that has no recorded work. Add dashboards for Requesters and IT Staff that summarize — not replace — the existing detailed screens. Finally, polish and harden the whole application so every earlier feature keeps working under one consistent design.

---

## 3. Scope

### Included

- Actions Taken: create and edit (IT Staff / Administrator) on any Ticket they can access; Requesters can view Actions Taken on their own Tickets (read-only)
- Ticket resolution gate: a Ticket cannot move to `RESOLVED` unless it has at least one Action Taken with no unresolved follow-up outstanding
- Final, complete Ticket status-transition matrix (supersedes the Lab 3 matrix; adds the Actions Taken gate on `RESOLVED`)
- Requester Dashboard: own-Ticket summary metrics, recent/attention-required Tickets, drill-down to My Tickets (filtered)
- IT Staff Dashboard (reused by Administrator): queue-wide metrics, current user's assigned Tickets, recent/urgent Tickets, drill-down to Ticket Queue (filtered) or Ticket Detail
- Optimistic-concurrency protection on Ticket workflow updates and Action Taken edits (stale-write detection)
- Final regression coverage and hardening of every Lab 2/3 feature
- Zen Green UI extensions: dashboard navigation, metric cards, Actions Taken list/form on Ticket Detail

### Excluded

- Automatic SLA clocks, escalation engines, on-call scheduling, and breach notifications
- Email, SMS, LINE, push, or other external notification services
- Inventory/spare-parts management, purchasing, or cost accounting
- Time-sheet billing, payroll, or labor-cost calculation
- Multi-level approval workflows and electronic signatures
- Advanced BI tools, custom report builders, or export/data-warehouse features
- Multi-tenant organizations and production-scale cloud operations
- Historical trend indicators on dashboard cards (e.g. "+3 from yesterday" shown in the reference mockup) — decorative only; would require a separate metric-snapshot mechanism not requested by any FR/BR (see D-06)
- Actual file upload for Action Taken "Attachment Notes" — this field is free text describing where to find a file (per the stakeholder request), not a new attachment upload channel; the existing Ticket-level Attachment feature from Lab 2 is unchanged (see D-02)
- Deleting Actions Taken (edit only; no deletion, consistent with the append-history spirit of the rest of the app)

---

## 4. Functional Requirements

### 4.1 Actions Taken

**FR-01** An IT Staff or Administrator user must be able to create an Action Taken on any Ticket, regardless of who owns it.

**FR-02** An Action Taken must record: Action Date/Time (`actionAt`, supplied by IT Staff — defaults to now, never in the future), Action Description, Result, Performed By (backend-set to the authenticated actor), Follow-Up Required (boolean), Follow-up Note (required only when Follow-Up Required is true), and Attachment Notes (optional free text). The record-creation timestamp (`createdAt`) is additionally set by the backend as an audit field and is never shown as the work date.

**FR-03** An IT Staff or Administrator user must be able to edit an existing Action Taken's Action Date/Time, Description, Result, Follow-Up Required, Follow-up Note, and Attachment Notes. Performed By never changes after creation.

**FR-04** A Requester must be able to view all Actions Taken on a Ticket they own, in read-only form; a Requester must never be able to create or edit an Action Taken.

**FR-05** The Ticket Detail screen must list all Actions Taken for a Ticket in a stable, defined order and support a create mode and a view/edit mode.

### 4.2 Ticket Workflow and Resolution

**FR-06** The system must enforce the complete Ticket status-transition matrix (§7) identically to how Lab 3 enforced its subset; the backend is always authoritative regardless of what the client sends.

**FR-07** A Ticket must not be permitted to transition to `RESOLVED` unless it has at least one Action Taken and the most recent Action Taken by `actionAt` does not have an outstanding Follow-Up Required flag.

**FR-08** A Requester's "Problem Appears Resolved" indicator remains advisory only (per Lab 3 BR-05/BR-21) and never itself changes Ticket status.

**FR-09** A successful status or Action Taken change must cause the Ticket Detail screen to refresh the Ticket's summary status without a full page reload.

### 4.3 Dashboards

**FR-10** An authenticated Requester must be able to retrieve a dashboard summarizing only their own Tickets: open-ticket counts by category (§6.3), a recent-Tickets list, and drill-down links into a pre-filtered My Tickets view.

**FR-11** An authenticated IT Staff or Administrator user must be able to retrieve a dashboard summarizing queue-wide operational counts by status, the count of unassigned Tickets, a breakdown of active Tickets by IT Priority, the current user's assigned-Ticket count, a recent/urgent-Tickets list, and drill-down links into a pre-filtered Ticket Queue or a specific Ticket Detail (handout §6: "unassigned Tickets", "Tickets owned by the current user", "Tickets by status or IT Priority", and "recently updated Tickets"). When the caller is `ADMIN`, the response additionally includes concise active user-account counts (`userCounts`: active Requesters / IT Staff / Admins, BR-15).

**FR-12** Every dashboard metric must be computed by the backend from authoritative data at request time; no metric may be cached client-side beyond the current page view.

**FR-13** Every dashboard card and list item must define an empty-state message when its underlying query returns zero rows.

### 4.4 Final Hardening and Regression

**FR-14** All Lab 2 and Lab 3 authentication, authorization, Requester, IT Staff, Administrator, Public Comment, Internal Note, Attachment, and Administrator User Management behavior must continue to work identically under Lab 4's changes.

**FR-15** Every write-capable action (status change, Action Taken create/edit, comment/note post) must be safe against duplicate submission caused by repeated clicks or network retry.

**FR-16** Every important form (Action Taken create/edit, Ticket status change) must preserve entered data after a recoverable (e.g. `409`, `500`) failure so the user does not retype.

---

## 5. Authorization Matrix

Roles: `REQUESTER`, `IT_STAFF`, `ADMIN`. Per the Lab 3 model, "Staff" = `IT_STAFF` ∪ `ADMIN`; Administrator retains full IT Staff behavior (handout §4.3) plus User Management.

| Operation | Requester | IT_STAFF | ADMIN |
|---|---|---|---|
| View Actions Taken on owned/any Ticket | Owned only | Any | Any |
| Create Action Taken | — | ✔ | ✔ |
| Edit Action Taken | — | ✔ (any Ticket) | ✔ |
| Update Ticket status / IT Priority / owner via `PATCH /api/tickets/:ticketId` | — (Requesters never call PATCH; see below) | ✔ | ✔ |
| Requester respond `POST /api/tickets/:ticketId/requester-respond` (own Ticket `WAITING_FOR_REQUESTER` → `OPEN`, unchanged Lab 3) | Own Ticket only | — | — |
| Transition Ticket to RESOLVED | — | ✔ (subject to FR-07 gate) | ✔ (subject to FR-07 gate) |
| Requester Dashboard | Own data only | — | — |
| IT Staff Dashboard | — | ✔ | ✔ |

All other rows from the Lab 3 authorization matrix (login, tickets, comments, notes, attachments, user management) are unchanged and remain in force. Inactive users (`isActive = false`) are rejected on every authenticated endpoint with `403 ACCOUNT_INACTIVE` by the global session guard, so an inactive Staff member can neither create/edit Actions Taken nor call either dashboard.

---

## 6. Business Rules

*Numbering restarts at BR-01 for Lab 4, scoped to `docs/lab-04/`, independent of the Lab 2/3 BR numbering.*

### 6.1 Actions Taken

**BR-01** An Action Taken belongs to exactly one Ticket and cannot be moved between Tickets.

**BR-02** The Ticket Owner coordinates the Ticket as a whole, but any active `IT_STAFF` or `ADMIN` user may create or edit an Action Taken on a Ticket they do not own.

**BR-03** Action Description and Result are required, 1–2000 characters after trimming; whitespace-only content is rejected.

**BR-04** Follow-up Note is required and must be 1–1000 characters after trimming when Follow-Up Required is `true`; it must be empty/null when Follow-Up Required is `false`. Submitting a non-empty Follow-up Note while Follow-Up Required is `false` is rejected as invalid.

**BR-05** Attachment Notes is optional free text, 0–500 characters after trimming, and never references or validates an actual uploaded file — it exists only to tell a reader where to look (BR-05 does not create or modify any Attachment record).

**BR-06** Action Date/Time (`actionAt`) is supplied by the client as UTC ISO-8601, required on create; Performed By (`performedById`) is set exclusively by the backend from the authenticated session and is never accepted from the client. `actionAt` must not be in the future beyond a 60-second clock-skew tolerance (otherwise `400 VALIDATION_ERROR`, code `ACTION_AT_IN_FUTURE`); the UI defaults the picker to now and caps `max` at now. `createdAt` (record-log time) is set exclusively by the backend at creation and is never used as the displayed work date.

**BR-07** Editing an Action Taken updates `actionAt` (when supplied, revalidated per BR-06), `updatedAt`, and `updatedById` (the editor, which may differ from the original `performedById`); the original `performedById` and `createdAt` never change.

**BR-08** Actions Taken are listed on Ticket Detail ordered by `actionAt` ascending (oldest work first), tie-broken by `id` ascending; this preserves a stable chronological work-log order even when actions are backdated.

### 6.2 Ticket Status, Resolution, and Concurrency

**BR-09** The required Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED` (unchanged from Lab 3).

**BR-10** A Ticket may transition to `RESOLVED` only if: (a) at least one Action Taken exists on the Ticket, and (b) the most recent Action Taken by `actionAt` (tie-break highest `id`) has `followUpRequired = false`. Violating either condition returns `409 RESOLUTION_NOT_ALLOWED` and is enforced server-side even if the client UI is bypassed.

**BR-11** All other permitted transitions and roles are unchanged from the Lab 3 transition matrix (reproduced in full in §7 for completeness, since this document supersedes Lab 3's).

**BR-12** Every write to a Ticket's operational fields (status, IT Priority, owner) and every edit of an Action Taken must include the version the client last read (`updatedAt` timestamp or `version` integer — see D-01). If the current stored value does not match, the write is rejected with `409 STALE_UPDATE` and the current server state is returned so the client can refresh and retry; the write is never silently applied over a newer change.

**BR-13** A Requester's "Problem Appears Resolved" indicator (Lab 3 `POST /api/tickets/:id/indicate-resolved`) never changes Ticket status and is unaffected by the resolution gate in BR-10.

### 6.3 Dashboard Calculations

**BR-14** Requester Dashboard metrics are computed only over Tickets where `submittedById = session.user.id`:
- **My Open Tickets** — count where `currentStatus ∈ {NEW, OPEN, IN_PROGRESS, REOPENED}`
- **Waiting on You** — count where `currentStatus = WAITING_FOR_REQUESTER`
- **Resolved** — count where `currentStatus = RESOLVED`
- **Closed** — count where `currentStatus = CLOSED`
- **Recent Tickets** — the 5 most recently updated owned Tickets (`updatedAt desc`), each with ticket number, summary, status badge, and last-updated time

**BR-15** IT Staff Dashboard metrics (available to `IT_STAFF` and `ADMIN`) are computed over the entire queue unless noted:
- **New** — count where `currentStatus = NEW`
- **Open** — count where `currentStatus = OPEN`
- **In Progress** — count where `currentStatus = IN_PROGRESS`
- **Waiting for Requester** — count where `currentStatus = WAITING_FOR_REQUESTER`
- **Unassigned** — count where `ownerId IS NULL` and `currentStatus ∉ {RESOLVED, CLOSED, CANCELLED}` (an active Ticket with no owner; handout §6 explicitly requires this metric)
- **My Assigned** — count where `ownerId = session.user.id` and `currentStatus ∉ {RESOLVED, CLOSED, CANCELLED}`
- **By IT Priority** — three sub-counts (`low`, `medium`, `high`) of Tickets where `itPriority ∈ {LOW, MEDIUM, HIGH}` respectively and `currentStatus ∉ {RESOLVED, CLOSED, CANCELLED}` (satisfies handout §6's "Tickets by status or IT Priority"; shown as a compact secondary breakdown rather than a 6th–8th full metric card, per D-08)
- **My Recent Tickets** — the 5 most recently updated Tickets owned by the current user (`updatedAt desc`)
- **Administrator-only extension (`userCounts`)** — when the caller is `ADMIN`, the same response additionally includes concise active user-account counts (handout §4.6, optional clause adopted per reviewer feedback): `requesters` (count where `role = REQUESTER AND isActive = true`), `itStaff` (`IT_STAFF`, active), `admins` (`ADMIN`, active). Returned inside `data.userCounts`; omitted entirely (not `null`) for `IT_STAFF` callers. Inactive users are never counted.

**BR-16** Every dashboard count and list is computed fresh on each request against the current database state; no dashboard value is pre-aggregated or cached across requests (FR-12). Pre-Lab-4 (legacy) Tickets are counted normally under the same rules — there is no separate legacy bucket; the only historical exception is the resolution gate (D-03).

**BR-17** When a dashboard list query returns zero rows, the API returns an empty array (never `null`) and the UI renders the screen's defined empty-state message (never a blank card).

**BR-18** All dashboard date/time values are returned in UTC ISO-8601; the client renders them in the browser's local time zone, consistent with every other timestamp in the application.

### 6.4 Validation and Regression

**BR-19** All string inputs for Actions Taken are trimmed before validation; server-side revalidation occurs even when the client already validated (consistent with Lab 3 BR-40).

**BR-20** All Lab 2 and Lab 3 functional behavior (authentication, Requester Ticket/Attachment lifecycle, IT Staff Queue/Ticket operations, Public Comments, Internal Notes, Administrator User Management) must behave identically after the Lab 4 migration; this is part of scope and is tested explicitly (§ tests.md Migration/Regression suite).

**BR-21** A duplicate Action Taken submission caused by a double-click or network retry must not create two records via the approved client-side guard: the client disables the submit control and shows a busy state for the duration of the request (same pattern as Lab 2/3 forms). No server-side idempotency key is implemented in Lab 4 (see D-05); if duplicate rows are observed during testing despite the guard, the team revisits D-05 before final submission.

---

## 7. Ticket Status Transition Matrix (Final, Complete)

Supersedes the Lab 3 matrix; identical apart from the resolution gate added by BR-10.

| From | To — IT Staff / Administrator | To — Requester |
|---|---|---|
| `NEW` | `OPEN`, `IN_PROGRESS`, `CANCELLED` | — |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`*, `CANCELLED` | — |
| `IN_PROGRESS` | `OPEN`, `WAITING_FOR_REQUESTER`, `RESOLVED`*, `CANCELLED` | — |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`*, `CANCELLED` | `OPEN` |
| `RESOLVED` | `CLOSED`, `REOPENED` | — |
| `CLOSED` | `REOPENED` | — |
| `REOPENED` | `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`*, `CANCELLED` | — |
| `CANCELLED` | — (terminal) | — |

`*` — transition to `RESOLVED` is additionally gated by BR-10 (at least one Action Taken, no outstanding follow-up on the latest one). All other cells are unchanged from Lab 3.

---

## 8. UI Specification Summary

Full visual, interaction, token, and state detail is defined in [`ui-spec.md`](./ui-spec.md). Summary:

### Screens (new/changed in Lab 4)

| Screen | Purpose | Roles |
|---|---|---|
| IT Staff Dashboard | Operational starting point: queue metrics, current user's assigned Tickets, recent/urgent Tickets, quick actions | IT Staff, Admin |
| Requester Dashboard | Personal starting point: own-Ticket status summary, recent Tickets, quick actions | Requester |
| Ticket Detail — Actions Taken tab | List + create/edit form for Actions Taken; read-only list for Requesters | All (write: Staff only) |
| Ticket Detail — status controls (extended) | Status dropdown now blocks `RESOLVED` client-side when the gate (BR-10) is not met, with a clear inline reason; backend remains authoritative | IT Staff, Admin |

### Required Feedback States

Every new screen implements loading (skeleton), empty, no-results, forbidden, not-found, conflict (`409 STALE_UPDATE`, `409 RESOLUTION_NOT_ALLOWED`), validation, success, and safe API-failure feedback, consistent with the Lab 3 feedback matrix.

### Navigation

Dashboard becomes the landing page after login for `IT_STAFF`/`ADMIN` (replacing a bare redirect to the Queue) and for `REQUESTER` (replacing a bare redirect to My Tickets). Role-filtered navigation gains a "Dashboard" link as the active-by-default destination; all other Lab 3 navigation links are unchanged.

### Responsive and Accessibility

Same breakpoints and rules as Labs 2–3 (desktop ≥ 1024px, tablet 768–1023px, mobile < 768px); dashboard metric cards reflow from a multi-column grid (desktop) to 2-column (tablet) to 1-column (mobile); all cards keep non-color status cues, visible focus rings, and WCAG AA contrast.

---

## 9. Data Changes

### 9.1 New Model: ActionTaken

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | Int | No | PK, auto-increment |
| ticketId | Int | No | FK → Ticket |
| actionAt | DateTime | No | Work-occurred time, client-supplied (BR-06); this is the Action Date/Time shown in the UI |
| description | String | No | 1–2000 chars after trim (BR-03) |
| result | String | No | 1–2000 chars after trim (BR-03) |
| followUpRequired | Boolean | No | Default `false` |
| followUpNote | String | Yes | Required iff `followUpRequired = true` (BR-04); enforced at the application layer, not a DB constraint |
| attachmentNotes | String | Yes | 0–500 chars after trim (BR-05) |
| performedById | Int | No | FK → User; set once at creation (BR-06) |
| updatedById | Int | Yes | FK → User; set on every edit (BR-07) |
| version | Int | No | Default `1`; optimistic-concurrency counter, incremented on every successful edit (D-01) |
| createdAt | DateTime | No | Backend-set audit field (record-log time); never displayed as the work date |
| updatedAt | DateTime | No | Auto, updated on edit |

Indexes: index on `ticketId`; composite `(ticketId, actionAt, id)` for the ordered list (BR-08).

### 9.2 Changed Model: Ticket

| Field | Type | Nullable | Notes |
|---|---|---|---|
| version | Int | No | **New.** Default `1`; incremented on every successful operational update (status, IT Priority, owner); used for optimistic-concurrency checks (BR-12, D-01) |

No other Ticket fields change. `currentStatus` enum is unchanged (already the full 8-value set from Lab 3).

### 9.3 Enums

No new enums. `TicketStatus` is unchanged from Lab 3.

### 9.4 Relationships

- One Ticket → many ActionTaken (`ticket.actionsTaken`)
- One User → many ActionTaken as `performedBy` and, separately, many as `updatedBy`

### 9.5 Migration Strategy (Lab 3 → Lab 4)

1. **Create** the `action_taken` table with the fields in §9.1.
2. **Add** `version` (default `1`) to the `ticket` table; every existing Ticket row receives `version = 1`.
3. **No data loss**: no existing Ticket, Attachment, PublicComment, or InternalNote row is modified or deleted.
4. **Backfill decision (D-03):** legacy Tickets that already have `currentStatus = RESOLVED` or `CLOSED` from Lab 3 seed/testing data are **not** retroactively blocked or altered — the resolution gate (BR-10) only applies going forward, to new resolution attempts; a Ticket already resolved before Lab 4 is not required to have a backfilled Action Taken. This is documented as a one-time historical exception, not a rule relaxation.
5. **Verify** row counts for `ticket`, `user`, `public_comment`, `internal_note`, and `attachment` are identical before and after migration (migration/regression test MIG-01).
6. **Rollback / recovery:** the migration is a single Prisma forward migration (new table + additive `version` column with default `1`, no destructive DDL). Rollback is `prisma migrate resolve --rolled-back` followed by re-apply, or restore from the pre-migration database backup taken before running the migration. Because no existing row is modified except the additive `version` default, re-running the migration after a failed attempt is safe; data-loss verification is MIG-01.

### 9.6 Seed Data

Seed script must remain idempotent (safe to run repeatedly) and add, without removing Lab 3 seed data:
- Tickets covering every status in the transition matrix, with a mix of assigned and unassigned ownership (reusing/extending Lab 3 seed Tickets where possible)
- At least one Ticket with **zero** Actions Taken
- At least one Ticket with **exactly one** Action Taken
- At least one Ticket with **multiple** Actions Taken (including at least one with `followUpRequired = true`)
- At least one Ticket that is `RESOLVED` with a qualifying Action Taken, to demonstrate the gate being satisfied
- Enough data spread across Requesters and IT Staff so both dashboards show non-zero metrics for at least one seeded user of each role, and zero metrics for at least one other seeded user (to exercise empty states)
- At least one backdated Action Taken (`actionAt` in the past) to exercise `actionAt` ordering (BR-08)
- A mix of active and inactive users per role so `userCounts` (active-only) has hand-computable non-trivial expected values (API-36)

---

## 10. API Contract

Full endpoint details are defined in [`api-spec.md`](./api-spec.md). Authoritative endpoint inventory (new/changed in Lab 4 only — all Lab 2/3 endpoints remain unchanged and in force):

| # | Method | Path | Purpose | Roles | Success |
|---|--------|------|---------|-------|---------|
| 1 | POST | `/api/tickets/:ticketId/actions` | Create an Action Taken | Staff | 201 |
| 2 | GET | `/api/tickets/:ticketId/actions` | List Actions Taken for a Ticket | Owner-Req or Staff | 200 |
| 3 | PATCH | `/api/tickets/:ticketId/actions/:actionId` | Edit an Action Taken (optimistic concurrency) | Staff | 200 |
| 4 | PATCH | `/api/tickets/:ticketId` | *(Lab 3, extended)* Update status/IT Priority/owner; now requires `version` and enforces the resolution gate; response refreshes `canResolve` | Staff | 200 |
| 5 | GET | `/api/dashboard/requester` | Requester Dashboard metrics + recent Tickets | Requester | 200 |
| 6 | GET | `/api/dashboard/staff` | IT Staff Dashboard metrics + recent Tickets; `ADMIN` callers additionally receive `userCounts` (api-spec §4.6) | Staff | 200 |
| 7 | GET | `/api/tickets/:ticketId` | *(Lab 3, extended)* Ticket Detail now includes `version`, `canResolve`, `actionCount`, `hasOutstandingFollowUp` (api-spec §4.7) | Owner-Req or Staff | 200 |

---

## 11. Acceptance Criteria

**AC-01** Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated actor as `performedById`, the supplied `actionAt` as the work date, and the server clock as `createdAt` (audit field).

**AC-02** Given an authenticated Requester, when the Requester Dashboard is requested, then only metrics and recent Tickets for that Requester's own Tickets are returned.

**AC-03** Given a Ticket with zero Actions Taken, when IT Staff attempts to transition it to `RESOLVED`, then the request is rejected `409 RESOLUTION_NOT_ALLOWED` and the Ticket status is unchanged.

**AC-04** Given a Ticket whose most recent Action Taken has `followUpRequired = true`, when IT Staff attempts to transition it to `RESOLVED`, then the request is rejected `409 RESOLUTION_NOT_ALLOWED`.

**AC-05** Given a Ticket with at least one Action Taken and no outstanding follow-up, when IT Staff transitions it to `RESOLVED`, then the transition succeeds and the Ticket summary refreshes.

**AC-06** Given an Action Taken submission with `followUpRequired = true` and an empty Follow-up Note, when the request is sent, then it is rejected `400 VALIDATION_ERROR`.

**AC-07** Given two IT Staff users viewing the same Ticket, when the first successfully updates the Ticket status and the second then submits a stale-version update, then the second request is rejected `409 STALE_UPDATE` and no data is silently overwritten.

**AC-08** Given a Requester viewing their own Ticket, when the Ticket Detail loads, then all Actions Taken are visible read-only and no create/edit control is rendered.

**AC-09** Given a Requester attempting to call the Action Taken create/edit endpoint directly, then the request is rejected `403 FORBIDDEN`.

**AC-10** Given an IT Staff user with zero assigned Tickets, when the IT Staff Dashboard is requested, then the "My Assigned" metric returns `0` and the recent-Tickets list returns an empty array, not an error.

**AC-11** Given an authenticated Requester with no Tickets, when the Requester Dashboard is requested, then every metric returns `0` and the UI renders the defined empty state.

**AC-12** Given all Lab 2/3 regression scenarios (authentication, Requester Ticket/Attachment lifecycle, IT Staff Queue/Ticket operations, Public Comments, Internal Notes, Administrator User Management), when re-run after the Lab 4 migration, then every scenario passes identically to Lab 3.

**AC-13** Given an Action Taken submission with `actionAt` in the future (beyond 60s tolerance), when the request is sent, then it is rejected `400 ACTION_AT_IN_FUTURE`; a past `actionAt` is accepted and appears in `actionAt`-ordered list position.

**AC-14** Given an authenticated `ADMIN` user, when the Staff Dashboard is requested, then the response includes `userCounts` matching hand-computed active-user counts per role; an `IT_STAFF` caller receives the identical queue metrics without `userCounts`.

---

## 12. Definition of Done

### Development
- [ ] All features in the Included Scope are implemented
- [ ] No feature from the Excluded Scope is present
- [ ] All business rules (BR-01 – BR-21, as amended for `actionAt`/`userCounts`) are enforced server-side
- [ ] Prisma schema matches §9; migration applies cleanly and preserves all Lab 2/3 data
- [ ] Seed script runs without errors and is idempotent

### Workflow and Concurrency
- [ ] Resolution gate (BR-10) enforced server-side even when the client UI is bypassed
- [ ] Optimistic-concurrency checks (BR-12) reject stale writes on Ticket updates and Action Taken edits
- [ ] Duplicate-submission protection (BR-21) verified for Action Taken creation

### Testing
- [ ] All acceptance criteria (AC-01 – AC-14) pass with automated tests
- [ ] Dashboard calculation tests verify each metric against a known seeded dataset
- [ ] Full Lab 2/3 regression suite passes unmodified in behavior
- [ ] No test is skipped, disabled, or commented out on the final main branch

### UI Screens
- [ ] IT Staff Dashboard and Requester Dashboard implemented and match `ui-spec.md`
- [ ] Actions Taken list + create/edit form implemented on Ticket Detail
- [ ] Requesters see a read-only Actions Taken view with no write controls rendered
- [ ] Status controls show only permitted transitions and a clear reason when `RESOLVED` is blocked
- [ ] Zen Green theme applied consistently; loading/empty/no-results/forbidden/conflict/success/failure feedback present on every new screen
- [ ] Responsive layout verified on mobile, tablet, and desktop

### Final Hardening
- [ ] No console errors, broken links, placeholder text, or unfinished controls remain
- [ ] README setup, seed, migration, test, and demonstration instructions are current
- [ ] Every change merged via Pull Request with peer review and approval

---

## 13. Assumptions and Decisions

**D-01: Optimistic concurrency via an integer `version` column (not timestamp comparison).** An explicit `version` counter on `Ticket` and `ActionTaken`, incremented on every successful write, is simpler to compare exactly (`WHERE id = ? AND version = ?`) than comparing `updatedAt` timestamps, which can collide at low time resolution or drift across client/server clocks. The client must echo back the `version` it last read; a mismatch means someone else wrote first, and the API returns `409 STALE_UPDATE` with the current record so the client can refresh and retry. This directly satisfies handout §5.1's requirement that at least two database-design decisions be justified.

**D-02: Attachment Notes is plain text, not a new upload channel.** The stakeholder request explicitly frames Attachment Notes as "what file to look for" rather than a new file, and the handout's Excluded Scope contains no request for expanded attachment capability in Lab 4. Reusing the existing Lab 2 Attachment model for this would conflate two different concerns (a formal Ticket attachment vs. an informal pointer inside a work log). A plain text field keeps the two features clearly separate and avoids unnecessary schema/API growth. This satisfies the second required database-design justification.

**D-03: The resolution gate (BR-10) is not applied retroactively to Tickets already Resolved/Closed from Lab 3 seed or test data.** Applying it retroactively would require either deleting historical status or fabricating backdated Actions Taken, neither of which reflects real history; the gate is a going-forward workflow control, not a data-integrity constraint on the past.

**D-04: Dashboards are computed on-demand, not pre-aggregated.** At lab scale (seed data of dozens–low hundreds of Tickets), a live `COUNT`/`SELECT` per dashboard card is fast enough and avoids the complexity, staleness risk, and extra migration surface of a materialized summary table or scheduled job — consistent with FR-12's "no caching beyond the current page view."

**D-05: Duplicate-submission protection is client-side (disabled submit + busy state) rather than a server-side idempotency-key mechanism.** A dedicated idempotency-key table/header is standard practice at production scale but is not requested by any FR/BR and adds meaningful scope; the Lab 3 precedent (busy-button pattern on Login/Change Password/Create Ticket) is reused here. If duplicate Action Taken rows are observed in testing despite the client guard, the team will revisit this decision before final submission.

**D-06: Dashboard "trend" deltas (e.g. "+3 from yesterday") shown in the reference mockup are excluded.** Computing a same-time-yesterday delta requires either a snapshot table or replaying historical Ticket state, which is disproportionate to the value for a lab-scale dashboard and is not named in any FR/BR. The dashboard shows only current, authoritative counts.

**D-07: The IT Staff Dashboard is reused for Administrator users with one additive strip** (per handout §4.6's optional clause). Administrators see the identical queue metrics plus a compact `userCounts` strip (active Requesters / IT Staff / Admins); `IT_STAFF` callers never receive that field. No separate Administrator dashboard route is built; Administrators additionally keep their existing User Management navigation link from Lab 3.

**D-08: IT Priority is shown as a compact secondary breakdown, not as three additional full metric cards.** Handout §6 requires "Tickets by status **or** IT Priority" (either satisfies the requirement on its own), and this document already covers "by status" via the New/Open/In Progress/Waiting for Requester cards. Adding three more full-size cards (Low/Medium/High) would push the primary card row to eight items, working against the handout's explicit instruction to "keep them concise" (§3, stakeholder request). The priority breakdown is instead rendered as a small inline three-segment list/bar beneath the main card row — still backend-calculated and drill-down-capable, but visually subordinate to the primary status counts.

**D-09 (revised per review): Action Date/Time is user-supplied (`actionAt`) with a future-date guard, not backend-only.** Only "Performed by (auto)" is explicitly marked auto in the stakeholder request and handout §8.3 lists "Action create date/time" as a regular field, so IT Staff must be able to backdate work that happened earlier (e.g. night-shift fix logged in the morning). The UI offers a `datetime-local` picker defaulting to now with `max` = now; the backend rejects `actionAt` more than 60s in the future (`ACTION_AT_IN_FUTURE`) while accepting any past value. Auditability is preserved via the separate backend-set `createdAt` log timestamp, and ordering (BR-08) plus the resolution gate (BR-10) key off `actionAt` so the work log stays chronological.

**D-10: Requester Dashboard uses Waiting on You instead of the mockup's In Progress card.** Handout §4.6 requires "Tickets waiting for the Requester" and §8.2's figure shows "In Progress (2)" in that slot. §4.6 (normative dashboard rules) takes precedence over the illustrative figure; "Waiting on You" (`WAITING_FOR_REQUESTER`) is the only Requester-actionable state and directly supports FR-10's "attention-required" goal, while In Progress work is already covered inside the My Open Tickets aggregate (BR-14).

**D-11: Staff Quick Actions omits Create Ticket shown in the §8.1 figure.** `POST /api/tickets` remains `REQUESTER only` per the Lab 3 contract (api-spec §4.6), and FR-14/BR-20 require Lab 2/3 auth behavior to continue identically — allowing Staff to create Tickets would be a new product feature outside the Sprint 4 contract. The Staff Quick Actions therefore offers only queue views the role may access: Browse Unassigned, Search Tickets, My Queue (ui-spec §4). Requester Dashboard keeps its Create Ticket quick action unchanged.

**D-12: PDF Parts 5/6/7 wording map (no new behavior).** Part 5 "current-user Actions Taken" = `My Assigned` + `My Recent Tickets` on the Staff Dashboard (no per-action dashboard strip by design). Part 6 "assign / complete / cancel / inactive-assignee" = Ticket-level assign/claim and status moves from Lab 3 (unchanged, FR-14/BR-20); Actions Taken itself is create/edit-only with no delete/complete/cancel state, and inactive users receive `403 ACCOUNT_INACTIVE`. Part 7 "append-only" = no deletion of Actions Taken, comments, or notes; edit is allowed with `version` + `updatedById` audit (BR-07/BR-12).
