# Lab 4 Test Plan

---

## 1. Test Strategy

### Approach

This document applies Test-Driven Development and the Specification-Driven Development contract (`specification.md`, `api-spec.md`) produced alongside it. Scenarios below are planned **before implementation begins** and are not reconstructed afterward from generated tests. Every Acceptance Criterion in `specification.md` §11 maps to at least one automated test.

### Test Levels

**Unit Tests**
- Pure logic: resolution-gate evaluator, optimistic-concurrency comparator, dashboard metric query builders, follow-up-note conditional validator

**API / Integration Tests**
- Every REST endpoint in `api-spec.md` against a real (test) PostgreSQL database via Supertest
- Happy-path, validation failure, role-authorization failure, ownership/existence-leak failure, missing-resource, conflict (stale-write and resolution-gate), and 500 scenarios

**UI Component Tests**
- Actions Taken list/form (conditional follow-up field, busy/validation/conflict states), Dashboard metric cards and recent-Tickets lists (loading/empty/zero-value states), Status select resolution-gate hint

**End-to-End Tests (Playwright)**
- Full workflows in a real (headless) Chromium browser: create an Action Taken → attempt premature resolution (blocked) → satisfy the gate → resolve; dashboard drill-down navigation; concurrent-edit conflict
- Responsive rendering at Desktop / Tablet / Mobile and screenshots saved to `artifacts/lab-04/screenshots/`

**Migration / Regression Tests**
- Schema migration preserves Lab 2/3 data; full Lab 2/3 functional regression re-run under Lab 4 code

**Performance-Smoke Tests**
- Seed-scale timing check that both dashboard endpoints respond within budget (PERF-01); not a full load test

### Quality Bar

- Every AC in `specification.md` §11 has at least one passing automated test (see §3 traceability)
- No test may be skipped, disabled, or commented out on the final `main` branch
- Dashboard metric tests assert against a known, seeded dataset with hand-computed expected values — not just "returns 200"
- Resolution-gate and stale-write behavior (BR-10, BR-12) is asserted explicitly at the API layer
- Playwright screenshots are committed as submission evidence

---

## 2. Planned Tests

**Type** values: `Unit`, `API`, `UI`, `E2E`, `MIG` (migration/regression).

### 2.1 Actions Taken — `server/tests/lab-04/actions-taken.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| API-01 | API | AC-01 / BR-03, BR-06 | Create a valid Action Taken | 201; correct `ticketId`, supplied `actionAt` stored, `performedById` = actor, `createdAt` server-set, `version = 1` | Pass |
| API-02 | API | BR-04 | Follow-up Note required when toggle is on, auto-cleared when off | `followUpRequired=true` + empty note → 400 `FOLLOW_UP_NOTE_REQUIRED`; `followUpRequired=false` + non-empty note → 201 with `followUpNote: null` (auto-clear, never 400) | Pass |
| API-03 | API | AC-01 / BR-03 | Description/Result boundaries | 1–2000 chars accepted; empty/whitespace-only rejected (400) | Pass |
| API-04 | API | BR-05 | Attachment Notes boundary and optionality | 0–500 chars accepted; omitted → stored as null; no Attachment record is created or referenced | Pass |
| API-05 | API | AC-09 / BR-02 | Requester cannot create | Requester → 403; no record created | Pass |
| API-06 | API | BR-02 | Staff member other than the Ticket Owner can create | Non-owner IT_STAFF creates successfully (200/201) | Pass |
| API-07 | API | AC-08 / FR-04 | Requester can list (read-only) | 200; Requester on owned Ticket sees full list; cross-owner → 404 | Pass |
| API-08 | API | FR-05 / BR-08 | List ordering | Returned oldest → newest by `actionAt` asc, tie-break `id` asc | Pass |
| API-09 | API | AC-01 | Empty Ticket returns empty list | Ticket with zero Actions Taken → `{ "data": [] }`, not an error | Pass |
| API-10 | API | AC-09 / BR-02 | Edit — role restriction | Requester → 403; IT_STAFF/ADMIN (including non-author) → 200 | Pass |
| API-11 | API | BR-06, BR-07 | Edit preserves immutable fields | `performedById` and `createdAt` unchanged after edit; `actionAt` editable with revalidation; `updatedById`/`updatedAt` set to the editor | Pass |
| API-12 | API | AC-07 / BR-12 | Stale-write rejected on edit | Submitting an outdated `version` → 409 `STALE_UPDATE` with current record in `details`; correct `version` → 200, `version` incremented | Pass |
| API-13 | API | BR-04 | Edit re-validates follow-up conditional | Editing to `followUpRequired=true` without a note → 400, even if the record previously had `followUpRequired=false` | Pass |
| API-37 | API | AC-13 / BR-06 | `actionAt` future rejected, past accepted | Future `actionAt` (>5 min / 300s ahead) → 400 `ACTION_AT_IN_FUTURE`; within +5 min or past → 201 and stored verbatim | Pass |
| API-38 | API | AC-04, AC-05 / BR-10 | Gate keys off latest `actionAt` | Backdated action inserted after a newer one does not become the gate reference; latest by `actionAt` (tie highest `id`) decides | Planned |

### 2.2 Ticket Workflow and Resolution — `server/tests/lab-04/ticket-workflow.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| API-14 | API | AC-03 / BR-10 | Resolve with zero Actions Taken | 422 `RESOLUTION_NOT_ALLOWED`; status unchanged | Pass |
| API-15 | API | AC-04 / BR-10 | Resolve with outstanding follow-up on latest action | Latest Action Taken has `followUpRequired=true` → 422 `RESOLUTION_NOT_ALLOWED` | Pass |
| API-16 | API | AC-05 / BR-10 | Resolve when gate satisfied | ≥1 Action Taken, latest has `followUpRequired=false` → 200, status = RESOLVED | Pass |
| API-17 | API | BR-10 | Gate looks only at the most recent action | Ticket has an earlier action with `followUpRequired=true` followed by a later action with `followUpRequired=false` → resolution succeeds | Pass |
| API-18 | API | FR-06 / §7 matrix | Full transition matrix — permitted moves | Every positive transition in `specification.md` §7 persists | Pass |
| API-19 | API | FR-06 / §7 matrix | Full transition matrix — rejected moves | Every disallowed pair (e.g. NEW→CLOSED, CANCELLED→OPEN) → 409 `TICKET_STATUS_TRANSITION_NOT_ALLOWED` | Pass |
| API-20 | API | AC-07 / BR-12 | Stale-write on Ticket status/priority/owner update | Outdated `version` → 409 `STALE_UPDATE`; correct `version` → 200, `version` incremented | Pass |
| API-21 | API | BR-10, BR-13 | Requester "Problem Appears Resolved" unaffected by the gate | Indicator call succeeds regardless of Action Taken state and never changes status (Lab 3 behavior unchanged) | Pass |
| API-22 | API | BR-11 | Evaluation order | Stale version alongside an invalid target status → `STALE_UPDATE` reported (version checked before transition legality), per api-spec §5 | Pass |

### 2.3 Requester Dashboard — `server/tests/lab-04/requester-dashboard.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| API-23 | API | AC-02 / BR-14 | Metrics scoped to own Tickets only | Seeded Requester with known Ticket mix → each metric matches a hand-computed expected count; another Requester's Tickets never counted | Pass |
| API-24 | API | AC-11 / BR-17 | Zero-Ticket Requester | All metrics = 0; `recentTickets: []`; 200, not an error | Pass |
| API-25 | API | BR-14 | Recent Tickets cap and ordering | Returns at most 5, ordered `updatedAt desc` | Pass |
| API-26 | API | FR-10 | Non-Requester denied | IT_STAFF/ADMIN calling this endpoint → 403 | Pass |
| API-27 | API | BR-18 | Timestamps in UTC ISO-8601 | `recentTickets[].updatedAt` format verified | Pass |

### 2.4 IT Staff Dashboard — `server/tests/lab-04/staff-dashboard.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| API-28 | API | AC-10 / BR-15 | Metrics computed queue-wide | Seeded dataset with known status distribution → `new`/`open`/`inProgress`/`waitingForRequester` match hand-computed counts | Pass |
| API-29 | API | BR-15 | `myAssigned` excludes terminal statuses | Owned Tickets in RESOLVED/CLOSED/CANCELLED are excluded from the count | Pass |
| API-30 | API | AC-10 / BR-17 | Zero-assignment Staff user | `myAssigned = 0`; `recentTickets: []`; 200, not an error | Pass |
| API-31 | API | AC-10 / BR-15 | `unassigned` metric | Count matches active Tickets (`ownerId IS NULL`, non-terminal status) against a hand-computed expected value; assigned and terminal-status Tickets excluded | Pass |
| API-32 | API | AC-10 / BR-15 | `byPriority` breakdown | `low`/`medium`/`high` sub-counts each match hand-computed expected values over active Tickets only; terminal-status Tickets excluded from all three | Pass |
| API-33 | API | FR-11 | Requester denied | Requester calling this endpoint → 403 | Pass |
| API-34 | API | FR-11 / BR-15 | Administrator sees queue metrics plus userCounts | ADMIN receives 200 with identical queue metrics plus `userCounts` matching hand-computed active-user counts; `IT_STAFF` response omits `userCounts` entirely (D-07) | Pass |
| API-35 | API | FR-12 / safe failure | Safe 500 shape on dashboard/actions endpoints | Forced server error → 500 with `{ error: { message, code: INTERNAL_SERVER_ERROR } }`, no stack/technical detail leaked | Planned |
| API-36 | API | FR-11 / BR-15 | `userCounts` counts active users only | Inactive users excluded from all three sub-counts; verified against seeded active/inactive mix | Pass |
| API-39 | API | BR-02 / §5 Auth matrix | Inactive Staff denied on Lab 4 endpoints | Deactivated session → `401 UNAUTHORIZED` (session invalidated by `requireSession`); fresh login → `403 ACCOUNT_INACTIVE`; no record created | Pass |

### 2.5 Unit Tests — `server/tests/lab-04/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-10 | Resolution-gate evaluator | `(actionCount, latestByActionAtFollowUpRequired) → allowed/denied` for all 4 input combinations | Pass |
| UNIT-02 | Unit | BR-12 | Optimistic-concurrency comparator | Matching version → proceed; mismatched → reject, no side effects | Pass |
| UNIT-03 | Unit | BR-04 | Follow-up conditional validator | `true` + empty → fail; `true` + note → pass; `false` ± note → pass with note normalized to `null` | Pass |
| UNIT-04 | Unit | BR-14, BR-15 | Dashboard metric query builders | Given a mocked ticket set, each metric function returns the mathematically correct count (including `userCounts` per role) | Pass |
| UNIT-05 | Unit | BR-06 | `actionAt` validator | Future beyond +5 min → reject; within tolerance/past/now → accept; invalid ISO → reject | Planned |

### 2.6 UI Component Tests — `client/tests/lab-04/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| UI-01 | UI | AC-01 / FR-02 | ActionTakenForm — follow-up conditional field | Note field hidden/cleared when toggle off; shown and required when toggle on | `client/tests/lab-04/ActionsTaken.test.tsx` |
| UI-02 | UI | FR-03 | ActionTakenForm — edit mode | Performed By rendered as static text, never as input; Action Date/Time is an editable picker; Save busy/disabled during submit | `client/tests/lab-04/ActionsTaken.test.tsx` |
| UI-10 | UI | AC-13 / BR-06 | Action Date/Time picker | Defaults to now, `max` = now; future pick shows inline "Date cannot be in the future"; past pick submits UTC ISO-8601 | `client/tests/lab-04/ActionsTaken.test.tsx` |
| UI-03 | UI | AC-08, AC-09 / FR-04 | Requester read-only rendering | No Add/Edit buttons rendered for a Requester viewer, regardless of API response shape | `client/tests/lab-04/ActionsTaken.test.tsx` |
| UI-04 | UI | AC-07 / BR-12 | Conflict banner on stale write | 409 STALE_UPDATE response repopulates the form and shows the banner | `client/tests/lab-04/ActionsTaken.test.tsx` |
| UI-05 | UI | FR-07 | Resolution-gate hint | `canResolve=false` disables the RESOLVED option with the hint text; `canResolve=true` enables it | `client/tests/lab-04/TicketWorkflow.test.tsx` |
| UI-06 | UI | FR-09 | In-place status refresh | Successful status change updates the badge without a full remount/reload | `client/tests/lab-04/TicketWorkflow.test.tsx` |
| UI-07 | UI | AC-02, AC-11 / FR-10 | Requester Dashboard rendering | Metric cards render correct counts; zero-metrics show `0` not empty; recent-Tickets empty state renders correctly | `client/tests/lab-04/RequesterDashboard.test.tsx` |
| UI-08 | UI | AC-10 / FR-11 | Staff Dashboard rendering | Same coverage as UI-07 for the Staff Dashboard, plus the Unassigned card and the Low/Medium/High priority breakdown strip; drill-down links (including each priority segment) carry the correct filter query params; ADMIN viewer additionally renders the `staff-user-counts` strip, IT_STAFF viewer omits it | `client/tests/lab-04/StaffDashboard.test.tsx` |
| UI-09 | UI | FR-13 | Dashboard loading/failure states | Skeletons on load; safe error banner + Retry on failure | `client/tests/lab-04/StaffDashboard.test.tsx` |
| UI-11 | UI | §8 Responsive + §10 A11y | Automated axe audit for Lab 4 screens | Dashboards + Actions Taken list/form render with zero axe violations (contrast stays manual per `axeAudit.ts` jsdom limitation) | `client/tests/lab-04/A11yLab04.test.tsx` |

### 2.7 End-to-End Tests (Playwright) — `e2e/lab-04/`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-05, AC-13 / FR-01–05 | Actions Taken full flow | Staff adds an Action Taken (picker defaults to now; backdated value accepted, future blocked), edits it (clears follow-up, corrects date), list updates in `actionAt` order; screenshots (`actions-taken/`) | `e2e/lab-04/actions-taken-flow.spec.ts` |
| E2E-02 | E2E | AC-03, AC-04, AC-05 | Resolution gate end-to-end | Attempt to resolve with no actions (blocked, hint visible) → add a qualifying action → resolve succeeds; screenshots | `e2e/lab-04/ticket-resolution.spec.ts` |
| E2E-03 | E2E | AC-07 | Concurrent-edit conflict | Two browser contexts edit the same Ticket; second submission shows the conflict banner and does not overwrite the first | `e2e/lab-04/ticket-resolution.spec.ts` |
| E2E-04 | E2E | AC-02, AC-10, AC-11, AC-14 | Dashboards end-to-end | Login as Requester, Staff, and Admin separately; verify metric cards, recent Tickets, and drill-down navigation for all; Admin additionally shows the userCounts strip, Staff omits it; screenshots (`staff-dashboard/`, `requester-dashboard/`) | `e2e/lab-04/dashboards.spec.ts` |
| E2E-05 | E2E | AC-08, AC-09 | Requester Actions Taken visibility | Requester opens own Ticket, sees Actions Taken read-only, no write controls anywhere in the DOM | `e2e/lab-04/actions-taken-flow.spec.ts` |
| E2E-06 | E2E | §9 Responsive | Dashboards responsive screenshots | Metric grid collapses correctly at each breakpoint; no horizontal scroll at 375px | `e2e/lab-04/dashboards.spec.ts` |

### 2.8 Migration and Regression — `server/tests/lab-04/migration-regression.api.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| MIG-01 | MIG | §9.5 / AC-12 | Migration preserves Lab 2/3 data | Row counts for `ticket`, `user`, `public_comment`, `internal_note`, `attachment` identical before/after migration; every existing Ticket gets `version = 1` | Pass |
| MIG-02 | MIG | §9.6 | Seed data and idempotency | Tickets with 0 / 1 / multiple Actions Taken present (incl. one backdated `actionAt`); at least one qualifying-for-resolution Ticket; active/inactive users per role for `userCounts`; re-running seed produces no duplicates | Pass |
| MIG-03 | MIG | AC-12 / BR-20 | Full Lab 2/3 functional regression | Authentication, Requester Ticket/Attachment lifecycle, IT Staff Queue/Ticket ops, Public Comments, Internal Notes, Administrator User Management — every Lab 3 AC re-verified and still passes | Planned |
| MIG-04 | MIG | D-03 | Pre-existing Resolved/Closed Tickets not retroactively blocked | Legacy Resolved/Closed Tickets from Lab 3 seed remain valid without a backfilled Action Taken | Pass |
| MIG-05 | MIG | §9.5 rollback | Rollback / recovery path | Failed migration can be rolled back (`prisma migrate resolve --rolled-back`) or restored from pre-migration backup; re-run is safe with no data loss (verified by MIG-01 counts) | Pass |

### 2.9 Performance Smoke — `server/tests/lab-04/dashboard-smoke.perf.test.ts`

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Final |
|---|---|---|---|---|---|
| PERF-01 | PERF | FR-12 / BR-16 | Dashboard smoke at seed scale | With seed-scale data (dozens–low hundreds of Tickets), `GET /api/dashboard/requester` and `GET /api/dashboard/staff` each respond 200 within the smoke budget (e.g. < 2s local) with no N+1 failure; asserts status + shape only, not load testing | Planned |

---

## 3. Acceptance-Criterion Traceability

| AC ID | Title | Covered by Tests |
|---|---|---|
| AC-01 | Action Taken created correctly | API-01, API-03, UI-01, E2E-01 |
| AC-02 | Requester Dashboard scoped to own Tickets | API-23, UI-07, E2E-04 |
| AC-03 | Resolve blocked with zero Actions Taken | API-14, E2E-02 |
| AC-04 | Resolve blocked with outstanding follow-up | API-15, API-38, E2E-02 |
| AC-05 | Resolve succeeds when gate satisfied | API-16, API-38, UI-06, E2E-01, E2E-02 |
| AC-06 | Follow-up Note required when toggle is on | API-02, UI-01 |
| AC-07 | Stale-write rejected, no silent overwrite | API-12, API-20, UI-04, E2E-03 |
| AC-08 | Requester sees Actions Taken read-only | API-07, UI-03, E2E-05 |
| AC-09 | Requester denied write access | API-05, API-10, UI-03, E2E-05 |
| AC-10 | Staff Dashboard scoped correctly (zero and non-zero) | API-28, API-29, API-30, API-31, API-32, UI-08, E2E-04 |
| AC-11 | Requester Dashboard zero-Ticket empty state | API-24, UI-07, E2E-04 |
| AC-12 | Full Lab 2/3 regression passes | MIG-01, MIG-03, MIG-05 |
| AC-13 | Action Date/Time backdate allowed, future rejected | API-37, API-38, UNIT-05, UI-10, E2E-01 |
| AC-14 | Admin dashboard includes active userCounts | API-34, API-36, UNIT-04, UI-08, E2E-04 |

---

## 4. Responsive and Visual Checklist

Verified by manual inspection and Playwright screenshot capture, per `ui-spec.md` §12.

### Playwright Screenshots Required — `artifacts/lab-04/screenshots/`
- [ ] Staff Dashboard — desktop, empty state, tablet, mobile
- [ ] Requester Dashboard — desktop, empty state, tablet, mobile
- [ ] Actions Taken — list, create form, follow-up-required state, resolution-blocked hint, stale-conflict banner, mobile, Requester read-only view

### Manual Visual Inspection
- [ ] Dashboard is the default landing page for every role after login
- [ ] Metric cards use only existing Zen Green tokens; no new colors introduced
- [ ] Zero-value metrics render as `0`, never blank
- [ ] Drill-down links from every metric card land on the correctly filtered Queue/My Tickets view
- [ ] Actions Taken list clearly distinguishes Performed By, Result, and the Follow-up amber tag
- [ ] Resolution-gate hint is visible and clearly worded when RESOLVED is disabled
- [ ] Stale-write conflict banner is visually consistent between the Actions Taken form and the Ticket status control
- [ ] No horizontal scroll at 375px on any new screen
- [ ] Focus rings visible on all new interactive elements; WCAG AA contrast
- [ ] No console errors, broken links, or placeholder text anywhere in the final application (final hardening pass)

---

## 5. Test Commands

```bash
# --- Backend / API + unit tests ---
cd server
npm run test                 # Vitest — all server tests (lab-01..lab-04)

# --- Frontend / UI tests ---
cd client
npm run test                 # Vitest — includes client/tests/lab-04

# --- End-to-end tests ---
npx playwright test e2e/lab-04

# --- Full regression (all labs) ---
npm run test:all

# --- Migration + seed ---
cd server
npx prisma migrate dev
npm run prisma:seed          # must be idempotent (MIG-02)
```

---

## 6. Final Results

_Filled in on the final `main` branch before submission._

| Type | Total | Pass | Fail | Pending |
|---|---|---|---|---|
| Unit | 5 | 0 | 0 | 5 |
| API | 39 | 0 | 0 | 39 |
| MIG | 5 | 0 | 0 | 5 |
| UI | 11 | 0 | 0 | 11 |
| E2E | 6 | 0 | 0 | 6 |
| PERF | 1 | 0 | 0 | 1 |
| **Total** | **67** | **0** | **0** | **67** |

---

## 7. Known Limitations or Deferred Tests

| Item | Reason | Plan |
|---|---|---|
| SLA/escalation timing tests | Excluded from Lab 4 scope (§4.2 of the handout) | Not planned |
| Dashboard trend-delta tests | Feature excluded (D-06) | Not planned |
| Server-side idempotency-key tests for Action Taken duplicate submission | Client-side guard only, per D-05 | Revisit only if duplicate rows are observed during E2E-01 |
| Full load testing of dashboard queries at scale | Only smoke-level timing required (PERF-01); production load testing not required by the lab | Covered by PERF-01 smoke only |
