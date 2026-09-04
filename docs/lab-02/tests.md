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
| T-001 | API | AC-02 / BR-05 | `GET /api/requesters` returns only active requesters; inactive excluded | 200; active records only; inactive requester absent | `tests/lab-02/requesters.test.ts` | Pending |
| T-002 | UI  | AC-02 | Requester selector populates, persists selection in localStorage, and shows name in header | Dropdown shows active requesters; header shows selected name after reload | `client/tests/lab-02/RequesterSelector.test.tsx` | Pending |
| T-003 | UI  | AC-02 | Switching requester reloads ticket context for new requester | My Tickets reloads; previous requester's tickets not visible | `client/tests/lab-02/RequesterSelector.test.tsx` | Pending |
| T-004 | API | AC-01 / BR-01,02,06 | `POST /api/tickets` with all valid fields | 201; unique `ticketNumber` matches `TKT-\d{6}`; `currentStatus=NEW`; `ticketDate` set by backend | `tests/lab-02/tickets.test.ts` | Pending |
| T-005 | API | AC-04 / BR-09,10 | `POST /api/tickets` with summary < 10 chars and description > 2000 chars | 400; validation errors for both fields | `tests/lab-02/tickets.test.ts` | Pending |
| T-006 | API | AC-04 / BR-09 | Summary with leading/trailing spaces is trimmed before validation | 201; stored summary is trimmed value | `tests/lab-02/tickets.test.ts` | Pending |
| T-007 | API | AC-04 / BR-08,11 | `POST /api/tickets` with invalid categoryId, relatedSystemId, and priority enum | 400 or 404; appropriate error for each invalid field | `tests/lab-02/tickets.test.ts` | Pending |
| T-008 | API | AC-04 / BR-05 | `POST /api/tickets` with inactive requesterId | 400 or 403; requester inactive error | `tests/lab-02/tickets.test.ts` | Pending |
| T-009 | UI  | AC-04 | Submit disabled when required fields empty; inline error on blur; error clears on correction; form preserved after 500 | Button disabled; error shown below field; error gone after fix; field values retained after server error | `client/tests/lab-02/CreateTicketForm.test.tsx` | Pending |
| T-010 | UI  | AC-01 | Success banner shown after ticket created | Banner "Ticket created successfully" visible | `client/tests/lab-02/CreateTicketForm.test.tsx` | Pending |
| T-011 | API | AC-05 / BR-04 | `GET /api/tickets?requesterId=1` returns only that requester's tickets with default sort | All records have requesterId=1; ordered newest first | `tests/lab-02/tickets.test.ts` | Pending |
| T-012 | API | AC-08 | Search (case-insensitive), filter (category + priority AND), sort (ticketDate asc), and pagination (page 2, size 10) | Results match search term; match all filters; correct order; correct page slice and metadata | `tests/lab-02/tickets.test.ts` | Pending |
| T-013 | API | AC-08 | Invalid pageSize defaults to 10 | Response uses pageSize=10 | `tests/lab-02/tickets.test.ts` | Pending |
| T-014 | UI  | AC-05 | My Tickets shows only current requester's tickets; empty state when no tickets; loading state | No other requester's data; empty state with CTA; skeleton rendered during fetch | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| T-015 | API | AC-03 / BR-04 | `GET /api/tickets/:id` owned ticket returns full detail; wrong requesterId returns 403; non-existent returns 404 | 200 with all fields + attachments; 403 ownership error; 404 not found | `tests/lab-02/tickets.test.ts` | Pending |
| T-016 | UI  | AC-03 | Ticket Detail renders all fields read-only; 403 shows error state with Back button | No editable inputs; error screen displayed with navigation | `client/tests/lab-02/TicketDetail.test.tsx` | Pending |
| T-017 | API | AC-06 / BR-12,13,14 | Upload valid file (JPEG); invalid type (.txt); oversized (>5 MB); exceeds 5-attachment limit; wrong owner | 201 with metadata; 415; 413; 409; 403 respectively | `tests/lab-02/attachments.test.ts` | Pending |
| T-018 | Unit | AC-06 / BR-27 | Filename sanitisation — path-traversal name rejected | Stored filename is UUID-based; originalFilename preserved in DB | `tests/lab-02/filename.test.ts` | Pending |
| T-019 | API | AC-06 | Download owned active attachment; download with wrong owner; download removed attachment | 200 binary; 403 ownership; 403 removed | `tests/lab-02/attachments.test.ts` | Pending |
| T-020 | API | AC-07 / BR-15,16 | Soft-remove owned attachment; verify metadata visible with includeRemoved=true; re-remove returns 409; wrong owner returns 403 | 200 isRemoved=true; full list includes removed record; 409; 403 | `tests/lab-02/attachments.test.ts` | Pending |
| T-021 | UI  | AC-07 | Remove confirmation modal; count decreases; removed item visible in muted style with no download link | Modal renders; active count drops; muted item present | `client/tests/lab-02/AttachmentList.test.tsx` | Pending |
| T-022 | API | — / seed | Seed creates required reference data and is idempotent; `GET /api/categories` and `GET /api/related-systems` return active records only | Correct counts; no duplicates on re-run; 200 with expected records | `tests/lab-02/seed.test.ts` | Pending |
| T-023 | E2E | AC-01–AC-08 | Full workflow: select requester → create ticket → view detail → upload attachment | Ticket Detail shows correct data; attachment visible; Playwright screenshot saved | `e2e/lab-02/createTicket.spec.ts` | Pending |
| T-024 | E2E | AC-07 | Attachment lifecycle: upload → soft-remove → confirm metadata visible; download blocked | Removed item shown in muted style; download returns error; screenshot saved | `e2e/lab-02/attachments.spec.ts` | Pending |
| T-025 | E2E | AC-03 | Ownership block: Requester B cannot open Requester A's ticket | 403 error screen shown; screenshot saved | `e2e/lab-02/ownership.spec.ts` | Pending |

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
| AC-06 | Attachment upload enforces type and size limits | T-017, T-018, T-019, T-023 |
| AC-07 | Soft removal marks attachment inaccessible; metadata stays visible | T-019, T-020, T-021, T-024 |
| AC-08 | Pagination and search work together | T-012, T-013 |

---

## 4. Responsive and Visual Checklist

These items are verified by manual inspection and Playwright screenshot capture. Mark each item after verification.

### Playwright Screenshots Required (per E2E test)
- [ ] Requester Selection screen — desktop
- [ ] Create Ticket form — desktop with all fields filled
- [ ] Create Ticket form — mobile viewport (< 768 px)
- [ ] My Tickets list — desktop with tickets loaded
- [ ] My Tickets list — mobile viewport
- [ ] My Tickets — empty state
- [ ] My Tickets — search results
- [ ] Ticket Detail — desktop
- [ ] Ticket Detail — mobile viewport
- [ ] Ticket Detail — removed attachment visible in muted style
- [ ] Remove attachment confirmation modal
- [ ] Error state — ownership failure (403 screen)

### Manual Visual Inspection
- [ ] Zen Green theme (`#006B3C`, `#0B7A46`, `#EAF6EF`) applied consistently on all screens
- [ ] Page background is `#F5F7F6`; surface/cards are white with subtle border and shadow
- [ ] Error states use dark red `#C41E3A` text and border; message appears below field
- [ ] Priority badges: LOW = grey, MEDIUM = amber, HIGH = red
- [ ] Status badge NEW = pale green background, primary green text
- [ ] Hover states visible on ticket cards (shadow + green border)
- [ ] Focus rings visible on all interactive elements (2 px outline `#0B7A46`)
- [ ] Hamburger menu appears on mobile; navigation links collapse correctly
- [ ] Ticket Detail grid switches from 2-column to 1-column on mobile
- [ ] Form buttons stack full-width on mobile
- [ ] Character counters visible in summary and description fields
- [ ] Development Mode indicator banner present below app header
- [ ] Loading spinner shown during all API requests
- [ ] Empty state component shown when no tickets or no search results

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
# Requires both server and client dev servers to be running
cd client
npx playwright test                          # Run all E2E specs
npx playwright test --headed                 # Run with browser visible
npx playwright test e2e/lab-02/             # Run only Lab 2 E2E specs
npx playwright test --reporter=html          # Generate HTML report

# --- Playwright screenshot evidence ---
# Screenshots are saved automatically to playwright-report/ and test-results/
# Attach the contents of these directories as submission evidence
```

---

## 6. Final Results

_To be completed on the final `main` branch before submission._

| Category | Total | Pass | Fail | Pending |
|----------|-------|------|------|---------|
| Unit | — | — | — | — |
| API | — | — | — | — |
| UI | — | — | — | — |
| E2E | — | — | — | — |
| **Total** | **25** | — | — | — |

### Notes
- Record actual counts once tests are implemented and run
- Attach test runner output (screenshot or terminal capture) as submission evidence
- All Fail and Pending rows must be explained in section 7

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
