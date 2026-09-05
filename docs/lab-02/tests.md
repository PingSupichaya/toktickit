# Lab 2 Test Plan

---

## 1. Test Strategy

### Approach

This document applies Test-Driven Development (TDD). Test scenarios are written against the Acceptance Criteria defined in `specification.md` before implementation begins. Every AC must be covered by at least one automated test; tests must pass on the final `main` branch.

### Test Levels

**Unit Tests**
- Individual utility functions (ticket-number formatter, filename sanitiser, trim helpers)
- Validation logic (length rules, enum checks, MIME-type checking)
- Component rendering in isolation with mocked data

**API / Integration Tests**
- Each REST endpoint against a real (test) database
- Happy-path, validation failure, ownership failure, 404, and 500 scenarios
- Seed-data idempotency

**End-to-End Tests**
- Full user workflows executed in a real browser via Playwright
- Playwright screenshots saved as visual evidence for each workflow

### Quality Bar

- Every AC listed in `specification.md` must have at least one passing automated test
- No test may be skipped, disabled, or commented out on the final `main` branch
- Playwright screenshots must be attached as submission evidence

---

## 2. Planned Tests

The table below is the authoritative test inventory. **Type** values: `Unit`, `API`, `UI`, `E2E`. **Automated Test File** cells will be filled in once files are created; pre-fill with `TBD` until then. **Status** values: `Pass`, `Fail`, `Pending`.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Status |
|---------|------|-----------------|---------------|-----------------|---------------------|--------|
| T-001 | API | AC-02 / BR-05 | `GET /api/requesters` returns only active requesters (inactive excluded) and handles database errors with a 500 structured error | 200; active records only; inactive requester absent; 500 + `INTERNAL_SERVER_ERROR` on DB failure | `tests/lab-02/requesters.api.test.ts` | Pass |
| T-002 | UI  | AC-02 | Requester selector populates, persists selection in localStorage, and shows name in header | Dropdown shows active requesters; header shows selected name after reload | `client/tests/lab-02/RequesterSelector.test.tsx` | Pass |
| T-003 | UI  | AC-02 | Switching requester reloads ticket context for new requester; selection persisted/restored via localStorage | New requester shown; previous requester's context/tickets not visible | `client/tests/lab-02/RequesterSelector.test.tsx`, `client/tests/lab-02/RequesterContext.test.tsx` | Pass |
| T-004 | API | AC-01 / BR-01,02,06 | `POST /api/tickets` with all valid fields | 201; unique `ticketNumber` matches `TKT-\d{6}`; `currentStatus=NEW`; `ticketDate` set by backend | `tests/lab-02/create-ticket.api.test.ts` | Pass |
| T-005 | API | AC-04 / BR-09,10 | `POST /api/tickets` with summary < 10 chars and description > 2000 chars | 400; validation errors for both fields | `tests/lab-02/create-ticket.api.test.ts` | Pass |
| T-006 | API | AC-04 / BR-09 | Summary with leading/trailing spaces is trimmed before validation | 201; stored summary is trimmed value | `tests/lab-02/create-ticket.api.test.ts` | Pass |
| T-007 | API | AC-04 / BR-08,11 | `POST /api/tickets` with invalid categoryId, relatedSystemId, and priority enum | 400 or 404; appropriate error for each invalid field | `tests/lab-02/create-ticket.api.test.ts` | Pass |
| T-008 | API | AC-04 / BR-05 | `POST /api/tickets` with inactive requesterId | 400 or 403; requester inactive error | `tests/lab-02/create-ticket.api.test.ts` | Pass |
| T-009 | UI  | AC-04 | Submit disabled when required fields empty; inline error on blur; error clears on correction; form preserved after 500 | Button disabled; error shown below field; error gone after fix; field values retained after server error | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| T-010 | UI  | AC-01 | Success banner shown after ticket created | Banner "Ticket created successfully" visible | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| T-011 | API | AC-05 / BR-04 | `GET /api/tickets?requesterId=1` returns only that requester's tickets with default sort | All records have requesterId=1; ordered newest first | `tests/lab-02/my-tickets.api.test.ts` | Pass |
| T-012 | API | AC-08 | Search (case-insensitive), filter (category + priority AND), sort (ticketDate asc), and pagination (page 2, size 10) | Results match search term; match all filters; correct order; correct page slice and metadata | `tests/lab-02/my-tickets.api.test.ts` | Pass |
| T-013 | API | AC-08 | Invalid pageSize defaults to 10 | Response uses pageSize=10 | `tests/lab-02/my-tickets.api.test.ts` | Pass |
| T-014 | UI  | AC-05 | My Tickets shows only current requester's tickets; empty state when no tickets; loading state | No other requester's data; empty state with CTA; skeleton rendered during fetch | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| T-027 | UI  | AC-08 / AC-05 | My Tickets toolbar: debounced search, Category/Related System/Status/Priority filters, sort, pagination, Clear Filters, No Results state, empty-state CTA to Create Ticket | Refetch carries debounced search term + filter params + sort + page/size; "No Results" state with Clear Filters; Clear Filters hidden when only sort is active; "No Tickets Yet" CTA navigates to Create Ticket | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| T-015 | API | AC-03 / BR-04 | `GET /api/tickets/:id` owned ticket returns full detail; wrong requesterId returns 403; non-existent returns 404 | 200 with all fields + attachments; 403 ownership error; 404 not found | `tests/lab-02/ticket-detail.api.test.ts` | Pass |
| T-016 | UI  | AC-03 | Ticket Detail renders all fields read-only; 403 shows error state with Back button | No editable inputs; error screen displayed with navigation | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| T-017 | API | AC-06 / BR-12,13,14 | Upload valid file (JPEG); invalid type (.txt); oversized (>5 MB); exceeds 5-attachment limit; wrong owner | 201 with metadata; 415; 413; 409; 403 respectively | `tests/lab-02/attachments.api.test.ts` | Pass |
| T-018 | Unit | AC-06 / BR-27 | Filename sanitisation — path-traversal name rejected | Stored filename is UUID-based; originalFilename preserved in DB | `tests/lab-02/attachments.api.test.ts` | Pass |
| T-019 | API | AC-06 | Download owned active attachment; download with wrong owner; download removed attachment | 200 binary; 403 ownership; 403 removed | `tests/lab-02/attachments.api.test.ts` | Pass |
| T-020 | API | AC-07 / BR-15,16 | Soft-remove owned attachment; verify metadata visible with includeRemoved=true; re-remove returns 409; wrong owner returns 403 | 200 isRemoved=true; full list includes removed record; 409; 403 | `tests/lab-02/attachments.api.test.ts` | Pass |
| T-021 | UI  | AC-07 | Remove confirmation modal; count decreases; removed item visible in muted style with no download link | Modal renders; active count drops; muted item present | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| T-022 | API | §7 Seed Data / BR-05 | Seed creates required reference data (4 Categories, ≥6 active Related Systems, ≥4 active Requesters + ≥1 inactive Requester), is idempotent (re-run creates no duplicates), and `GET /api/categories` + `GET /api/related-systems` return active records only | Seeded counts match spec; re-running seed keeps counts identical; 200 with only active records | `tests/lab-02/seed.test.ts` | Pass |
| T-023 | E2E | AC-01–AC-08 | Full workflow: select requester → create ticket → view detail → upload attachment; requester-selection + create-ticket + my-tickets responsive/search/empty-state screenshots at Desktop/Tablet/Mobile | Ticket Detail shows correct data; attachment visible; screenshots saved per `ui-spec` §17 tree | `e2e/lab-02/requester-ticket-flow.spec.ts` (tests 1–2) | Pass |
| T-024 | E2E | AC-07 | Attachment lifecycle: upload → soft-remove confirmation modal → confirm → removed row visible in muted style with reason; no horizontal overflow; no console errors | Attachment uploaded; modal centered; removed item muted with reason; no JS errors | `e2e/lab-02/requester-ticket-flow.spec.ts` (test 3) | Pass |
| T-026 | UI  | AC-06 / BR-12,13,14 | Create Ticket form rejects disallowed/oversized files, enforces the 5-attachment limit, and uploads selected files to the created ticket with retry on failure | Invalid files rejected inline; max 5 enforced; files uploaded after ticket creation; failed upload retryable | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| T-025 | E2E | AC-03 | Ownership block: Requester B cannot open Requester A's ticket | 403 error screen shown; screenshot saved | `e2e/lab-02/requester-ticket-flow.spec.ts` (test 4) | Pass |

---

## 3. Acceptance-Criterion Traceability

The AC IDs below match exactly the Acceptance Criteria defined in `specification.md` section 9.

| AC ID | Title | Covered by Tests |
|-------|-------|-----------------|
| AC-01 | Valid ticket data accepted and stored | T-004, T-010 |
| AC-02 | Requester Selection populates correctly | T-001, T-002, T-003 |
| AC-03 | Ticket ownership enforced across requesters | T-015, T-016, T-025 |
| AC-04 | Invalid ticket data rejected with inline errors | T-005, T-006, T-007, T-008, T-009 |
| AC-05 | My Tickets shows only current requester's tickets | T-011, T-014 |
| AC-06 | Attachment upload enforces type and size limits | T-017, T-018, T-019, T-023, T-026 |
| AC-07 | Soft removal marks attachment inaccessible; metadata stays visible | T-019, T-020, T-021, T-024 |
| AC-08 | Pagination and search work together | T-012, T-013, T-027 |

---

## 4. Responsive and Visual Checklist

These items are verified by manual inspection and Playwright screenshot capture. Mark each item after verification.

### Playwright Screenshots Required (per E2E test) — captured to `artifacts/lab-02/screenshots/`
- [x] Requester Selection screen — desktop / tablet / mobile
- [x] Create Ticket form — desktop initial + validation + submitting + success
- [x] Create Ticket form — tablet / mobile viewport (< 768 px)
- [x] My Tickets list — desktop / tablet / mobile, with tickets loaded
- [x] My Tickets — empty state
- [x] My Tickets — search results (active search + no-results)
- [x] Ticket Detail — desktop / tablet / mobile
- [x] Ticket Detail — attachment uploaded (active) and removed (muted, with reason)
- [x] Remove attachment confirmation modal (centered)
- [x] Error state — ownership failure (403 screen)

### Manual Visual Inspection
- [x] Zen Green theme (`#006B3C`, `#0B7A46`, `#EAF6EF`) applied consistently on all screens
- [x] Page background is `#F5F7F6`; surface/cards are white with subtle border and shadow
- [x] Error states use dark red `#C41E3A` text and border; message appears below field
- [x] Priority badges: LOW = grey, MEDIUM = amber, HIGH = red
- [x] Status badge NEW = pale green background, primary green text
- [x] Hover states visible on ticket cards (shadow + green border)
- [x] Focus rings visible on all interactive elements (2 px outline `#0B7A46`)
- [x] Hamburger menu appears on mobile; navigation links collapse correctly (verified in E2E test 5)
- [x] Ticket Detail grid switches from 2-column to 1-column on mobile (verified in E2E test 5)
- [x] Form buttons stack full-width on mobile (verified in E2E test 5)
- [x] Character counters visible in summary and description fields
- [x] Development Mode indicator banner present below app header
- [x] Loading spinner shown during all API requests
- [x] Empty state component shown when no tickets or no search results

---

## 5. Test Commands

Run from the repository root unless otherwise noted.

```bash
# Install all dependencies (run once or after pulling changes)
npm install

# --- Backend / API tests ---
cd server
npm run test              # Run all server-side tests (Vitest)
npm run test:watch        # Watch mode (development)

# --- Frontend / Unit + UI tests ---
cd client
npm run test              # Run all client-side tests (Vitest)
npm run test:watch        # Watch mode (development)

# --- End-to-End tests (Playwright) ---
# Run from the repository root; testDir is e2e/ — requires the API server on :3000
npx playwright test                          # Run all E2E specs (testDir = e2e/lab-02; client started automatically via webServer)
npx playwright test --headed                 # Run with browser visible
npx playwright test --reporter=html          # Generate HTML report

# --- Playwright screenshot evidence ---
# Screenshots are saved automatically to artifacts/lab-02/screenshots/ (each viewport/step)
# Commit these alongside the E2E spec as submission evidence
```

---

## 6. Final Results

_Completed on the final `main` branch before submission._

| Category | Total | Pass | Fail | Pending |
|----------|-------|------|------|---------|
| Unit | 1 | 1 | 0 | 0 |
| API | 14 | 14 | 0 | 0 |
| UI | 9 | 9 | 0 | 0 |
| E2E | 3 | 3 | 0 | 0 |
| **Total** | **27** | **27** | **0** | **0** |

Unit: T-018. API: T-001, T-004..T-008, T-011..T-013, T-015, T-017, T-019, T-020, T-022. UI: T-002, T-003, T-009, T-010, T-014, T-016, T-021, T-026, T-027. E2E: T-023, T-024, T-025.

### Notes
- Client unit/UI suite: 45 tests / 7 files pass (`client npm run test`); server suite: 49 tests / 8 files pass (`server npm run test`).
- E2E suite (`e2e/lab-02/requester-ticket-flow.spec.ts`): 5 tests pass in a real Chromium browser, capturing all `artifacts/lab-02/screenshots/` evidence with no skipped tests and no uncaught page/console errors.
- Screenshots and this report committed as submission evidence.

---

## 7. Known Limitations or Deferred Tests

| Item | Reason | Plan |
|------|--------|------|
| Authentication-layer tests | Real auth is excluded from Lab 2; `requesterId` is passed as a plain parameter | Will be covered in Lab 3 when JWT/session auth is introduced |
| IT Staff ownership scenarios | IT Staff workflow is excluded from Lab 2 scope | Deferred to Lab 3 |
| Ticket status transition tests | Only NEW status exists in Lab 2 | Deferred to Lab 3 when status lifecycle is introduced |
| Virus scanning on upload | Not required in Lab 2; production-only concern | Out of scope for this sprint |
| Object-storage (S3) upload tests | Files stored on local filesystem in Lab 2 | Out of scope; to be addressed when deployment target is defined |
| Performance / load tests | Not required by the lab specification | Out of scope |
| Full WCAG automated audit | `ui-spec.md` notes WCAG AA contrast targets; full audit requires manual expert review | Manual spot-check during visual inspection; automated audit deferred |
