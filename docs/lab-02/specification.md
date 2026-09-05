# Lab 2 Specification: Requester Ticketing System

---

## 1. Sprint Goal

Deliver a professional, responsive, Requester-facing ticketing experience that lets a Requester describe a problem, select a category and related system, indicate a priority, attach supporting evidence, and submit a ticket. After submission the Requester must be able to locate their own tickets through a searchable, filterable list, open the Ticket Detail screen, and manage permitted attachments. The system generates the official Ticket Number, stores all data safely, and enforces ownership so that one Requester can never view or modify another Requester's data. A temporary Development Requester selector stands in for real authentication during this sprint.

---

## 2. Stakeholder Request

The stakeholder wants a complete end-user ticketing interface. Requesters must be able to submit tickets that capture a summary, a full description, a category, a related system, and a requested priority. Evidence files (images and PDFs) can be attached at submission time or added later. After submission, Requesters must be able to find their own tickets quickly using keyword search and multiple filters, read the full detail of any ticket they own, and remove attachments they no longer want. The system must guarantee that the Ticket Number is unique and official, that all data is persisted reliably, and that a Requester can never accidentally or deliberately access another person's tickets.

Because this is a lab environment, a simple Requester selector replaces the real login flow. The selector lets testers choose any active Requester as the current testing identity without passwords or sessions.

---

## 3. Scope

### Included

- Development Requester selector (testing mechanism, not authentication)
- Create Ticket screen with all required fields and client + server validation
- My Tickets list with keyword search, multi-field filtering, sorting, and pagination
- Ticket Detail screen with full read-only view and ownership check
- Attachment lifecycle: upload, download, preview, and soft removal with confirmation
- Ticket ownership protection on every data-access endpoint
- Loading, empty, and error states on every screen
- Responsive layout from mobile to desktop
- Zen Green themed UI following `ui-spec.md`
- REST API supporting all of the above
- Prisma data model migration and idempotent seed data

### Excluded

- Authentication and security: login, logout, passwords, sessions, tokens, and real role-based authorization
- IT Staff workflow: staff dashboard, ticket queue, claiming, reassigning, and changing IT Priority
- Ticket collaboration: Public Comments, Internal Notes, and Actions Taken
- Ticket lifecycle beyond creation: status changes, resolution, closing, reopening, and cancellation
- Administration functions: managing users, Requesters, roles, and reference data

---

## 4. Functional Requirements

### Requester Selector

**FR-01** The application must display a Requester Selection screen before granting access to ticket features.

**FR-02** The selector must fetch and display only active Requesters (name and email) from the API.

**FR-03** The selected Requester must be stored in browser storage and restored on page reload.

**FR-04** The current Requester's name must be displayed persistently in the application header.

**FR-05** The user must be able to switch the selected Requester at any time; switching must clear the current ticket context and reload data for the new Requester.

**FR-06** If no active Requesters exist or the API call fails, the selector must display an appropriate error message and a retry option.

### Create Ticket

**FR-07** The Create Ticket form must capture: Category, Related System, Summary, Description, Requested Priority, and optional Attachments. Ticket Number, Ticket Date, Requester, and Current Status are system-generated or system-assigned.

**FR-08** Category and Related System dropdowns must be populated from the API and contain only active records.

**FR-09** The form must validate all required fields on the frontend before submission and display inline error messages.

**FR-10** The backend must independently validate every field and return structured error responses for any violation.

**FR-11** On successful submission the system must navigate the user to the Ticket Detail screen or display a success confirmation.

**FR-12** If submission fails, all user-entered data must be preserved in the form and an actionable error message must be displayed.

**FR-13** The submit button must be disabled during an in-progress submission to prevent duplicate requests.

### My Tickets

**FR-14** My Tickets must display only tickets owned by the currently selected Requester.

**FR-15** Each ticket card must show: Ticket Number, Summary, Category, Related System, Requested Priority badge, Current Status badge, Ticket Date, and active attachment count.

**FR-16** My Tickets must support keyword search across Ticket Number, Summary, and Description (case-insensitive, partial match).

**FR-17** My Tickets must support filtering by Category, Related System, Current Status, and Requested Priority; multiple filters may be active simultaneously.

**FR-18** My Tickets must support sorting by Ticket Date (default: newest first) and Ticket Number, each in ascending or descending order.

**FR-19** My Tickets must be paginated with a default page size of 10; supported page sizes are 10, 25, and 50.

**FR-20** When no tickets exist or no results match the current search/filter, a helpful empty state must be displayed.

### Ticket Detail

**FR-21** The Ticket Detail screen must display all ticket fields in read-only format, including the full attachment list.

**FR-22** The system must verify ticket ownership before returning detail data; a Requester must not be able to view a ticket they do not own.

**FR-23** The Ticket Detail screen must allow the Requester to upload additional attachments (if the active count is below five) and to soft-remove existing attachments.

### Attachments

**FR-24** The system must accept file uploads of types JPG, JPEG, PNG, WEBP, and PDF only.

**FR-25** Each uploaded file must not exceed 5 MB.

**FR-26** A ticket may have at most five active (non-removed) attachments at any time.

**FR-27** Attachment filenames must be sanitized before storage; the original filename must be preserved in the database for display.

**FR-28** Attachment removal must be soft removal: the record is marked removed, not deleted. Removed attachments remain visible as metadata on the Ticket Detail screen (showing filename, removal date, and reason) but must not be downloadable or previewable.

**FR-29** Removal requires explicit confirmation and accepts an optional removal reason.

**FR-30** If ticket creation succeeds but a subsequent attachment upload fails, the ticket must remain created and the Requester must be able to retry the upload from Ticket Detail.

---

## 5. Business Rules

**BR-01** The official Ticket Number is generated by the backend and must be unique. Format: `TKT-NNNNNN` (zero-padded six-digit sequential number, e.g., `TKT-000001`).

**BR-02** A new Ticket begins with Current Status **NEW**. Status changes beyond NEW are excluded from Lab 2.

**BR-03** Lab 2 uses a Development Requester selector instead of login. The selected identity is for testing only and is not authentication; it will be replaced with real authentication in Lab 3.

**BR-04** A Ticket belongs to exactly one Requester. Only the owning Requester may view the Ticket Detail or manage its Attachments.

**BR-05** Only active Requesters may appear in the Development Requester selector. Inactive Requesters must never appear.

**BR-06** Ticket Date is set by the backend to the current timestamp at creation and is not modifiable by the Requester.

**BR-07** All required fields must pass both frontend and backend validation before a ticket is persisted.

**BR-08** Every Ticket must reference exactly one active Category and one active Related System.

**BR-09** Ticket Summary must be 10–200 characters after trimming leading and trailing whitespace.

**BR-10** Ticket Description must be 20–2000 characters after trimming.

**BR-11** Requested Priority must be one of: `LOW`, `MEDIUM`, or `HIGH`.

**BR-12** Only JPG/JPEG, PNG, WEBP, and PDF files may be attached; other types must be rejected.

**BR-13** Each attachment file must not exceed 5 MB; oversized files must be rejected before upload begins.

**BR-14** A Ticket may have at most five active (non-removed) attachments; additional uploads must be blocked.

**BR-15** Attachment removal is always soft removal. Removed attachments are not deleted from storage but are marked as removed. Their metadata (filename, removal date, removal reason) remains visible on the Ticket Detail screen. Removed attachments must not be downloadable or previewable.

**BR-16** Only the owning Requester may soft-remove an attachment.

**BR-17** Attachment removal requires explicit confirmation; an optional removal reason may be recorded.

**BR-18** If ticket creation succeeds but a subsequent attachment upload fails, the ticket is not rolled back; the Requester may retry from Ticket Detail.

**BR-19** My Tickets search is case-insensitive and matches partial strings in Ticket Number, Summary, and Description.

**BR-20** Multiple filters (Category, Related System, Status, Priority) may be applied simultaneously using AND logic.

**BR-21** Default sort order for My Tickets is Ticket Date descending (newest first).

**BR-22** Pagination defaults to page 1, page size 10; valid page sizes are 10, 25, and 50; invalid values fall back to defaults.

**BR-23** Attachment downloads must verify ownership; only the owning Requester may download or preview an attachment. Removed attachments are not downloadable.

**BR-24** Duplicate ticket submission (e.g., double-click) must be prevented by disabling the submit control during an in-progress request.

---

## 6. UI Specification Summary

Full visual and interaction details are defined in [`ui-spec.md`](./ui-spec.md). The summary below describes screens, key controls, states, and responsive rules.

### Screens

| Screen | Purpose |
|--------|---------|
| Requester Selection | Development Requester selector shown before accessing ticket features |
| Create Ticket | Form for submitting a new ticket with all required fields |
| My Tickets | Paginated, searchable, filterable list of the current Requester's tickets |
| Ticket Detail | Full read-only view of one ticket; attachment management |

### Key Controls

- **Requester selector dropdown** — populates from `GET /api/requesters`; shows name and email; persists selection in localStorage
- **Create Ticket form** — Category select, Related System select, Summary input (character counter), Description textarea (character counter), Priority radio group, file upload zone
- **Search input** — debounced text search in My Tickets
- **Filter dropdowns** — Category, Related System, Status, Priority in My Tickets
- **Sort control** — sort field and direction for My Tickets
- **Pagination controls** — previous/next, page size selector
- **Attachment list** — file icon, original filename (download link), file size, upload date, Remove button
- **Remove confirmation modal** — shows filename, optional reason textarea, Danger "Remove" and "Cancel" buttons

### Required States

Every screen and data-fetching component must implement:
- **Loading** — spinner or skeleton while API request is in-progress
- **Empty** — helpful message and primary action when no data exists
- **Error** — clear, actionable message when an API call fails; data preserved on forms
- **Success** — confirmation banner after ticket creation or attachment removal

### Responsive Behavior

- **Desktop (≥ 1024 px):** horizontal navigation, multi-column form grid on Ticket Detail, filters visible in a single row
- **Tablet (768 – 1023 px):** same as desktop with reduced spacing; filters may wrap
- **Mobile (< 768 px):** hamburger navigation overlay, single-column form and detail layout, full-width buttons, stacked filter panel

### Zen Green Theme

The fixed color palette and typography tokens are defined in `ui-spec.md`. Key values:

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#006B3C` | Header, primary buttons, strong emphasis |
| Secondary | `#0B7A46` | Active tabs, focus rings, links, hover |
| Pale green | `#EAF6EF` | Selected, success, subtle section fill |
| Page background | `#F5F7F6` | Page canvas |
| Error | `#C41E3A` | Validation borders and messages |

---

## 7. Data Changes

### New Tables and Models

#### Requester

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| name | String | No | Full name |
| email | String | No | Unique |
| isActive | Boolean | No | Default `true` |
| createdAt | DateTime | No | Auto |
| updatedAt | DateTime | No | Auto |

Indexes: unique on `email`; index on `isActive`.

#### Category

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| name | String | No | Unique |
| isActive | Boolean | No | Default `true` |

Seed: Account and Access, Hardware, Software, Network.

#### RelatedSystem

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| name | String | No | Unique |
| isActive | Boolean | No | Default `true` |

Seed (minimum 6): Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop.

#### Ticket

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| ticketNumber | String | No | Unique; format `TKT-NNNNNN` |
| requesterId | Int | No | FK → Requester |
| categoryId | Int | No | FK → Category |
| relatedSystemId | Int | No | FK → RelatedSystem |
| summary | String | No | 10–200 chars (trimmed) |
| description | String | No | 20–2000 chars (trimmed) |
| requestedPriority | Enum | No | `LOW \| MEDIUM \| HIGH` |
| currentStatus | Enum | No | `NEW` (default); Lab 2 only |
| ticketDate | DateTime | No | Backend-set at creation |
| createdAt | DateTime | No | Auto |
| updatedAt | DateTime | No | Auto |

Indexes: unique on `ticketNumber`; index on `requesterId`; index on `ticketDate`; composite `(requesterId, ticketDate)`; indexes on `currentStatus`, `categoryId`, `relatedSystemId`.

#### Attachment

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | Int | No | PK, auto-increment |
| ticketId | Int | No | FK → Ticket |
| originalFilename | String | No | Display name |
| storedFilename | String | No | Sanitized, unique storage name |
| fileSizeBytes | Int | No | Max 5 242 880 bytes |
| contentType | String | No | `image/jpeg \| image/png \| image/webp \| application/pdf` |
| uploadedAt | DateTime | No | Backend-set at upload |
| isRemoved | Boolean | No | Default `false` |
| removedAt | DateTime | Yes | Set on soft removal |
| removalReason | String | Yes | Optional |
| createdAt | DateTime | No | Auto |
| updatedAt | DateTime | No | Auto |

Indexes: index on `ticketId`; composite `(ticketId, isRemoved)`.

### Enums

```
enum RequestedPriority { LOW  MEDIUM  HIGH }
enum TicketStatus      { NEW }
```

### Relationships

- One Requester → many Tickets
- One Category → many Tickets
- One RelatedSystem → many Tickets
- One Ticket → many Attachments

### Migration Decisions

**Soft removal for Attachments** — `isRemoved` flag plus `removedAt` / `removalReason` preserves an audit trail, prevents accidental data loss, and allows future IT Staff workflows to inspect removed files without a schema change. Crucially, the Ticket Detail screen always fetches **all** attachment records for the ticket (both active and removed) so it can display removed attachment metadata (filename, removal date, reason) in a muted style. The `isRemoved` flag is used to gate download/preview access, not to hide the record from the detail view. The composite index `(ticketId, isRemoved)` optimises the separate count query used to enforce the five-attachment active limit.

**String-typed Ticket Number** — stores the full human-readable code (`TKT-000001`) rather than deriving it from `id`, allowing future prefix changes without altering the integer PK.

**Composite index `(requesterId, ticketDate)`** — the My Tickets query always filters by `requesterId` and sorts by `ticketDate`; the composite index satisfies both clauses in a single index scan.

**Separate Category and RelatedSystem tables** — distinct lifecycles, independent isActive flags, and different future admin requirements justify separate tables over a single generic lookup table.

### Seed Data

The seed script must be idempotent (safe to run repeatedly without creating duplicates). It must create:
- 4 required Categories (Account and Access, Hardware, Software, Network)
- At least 6 active Related Systems
- At least 4 active Development Requesters
- At least 1 inactive Development Requester

---

## 8. API Contract

Full endpoint details, request/response shapes, query parameters, and example JSON are defined in [`api-spec.md`](./api-spec.md). The table below is the authoritative endpoint inventory.

| # | Method | Path | Purpose | Success |
|---|--------|------|---------|---------|
| 1 | GET | `/api/categories` | Retrieve active categories | 200 |
| 2 | GET | `/api/related-systems` | Retrieve active related systems | 200 |
| 3 | GET | `/api/requesters` | Retrieve active Development Requesters | 200 |
| 4 | POST | `/api/tickets` | Create a ticket | 201 |
| 5 | GET | `/api/tickets` | List Requester's tickets (search, filter, sort, paginate) | 200 |
| 6 | GET | `/api/tickets/:ticketId` | Retrieve one owned ticket | 200 |
| 7 | POST | `/api/tickets/:ticketId/attachments` | Upload an attachment | 201 |
| 8 | GET | `/api/tickets/:ticketId/attachments` | Retrieve attachment metadata | 200 |
| 9 | GET | `/api/attachments/:attachmentId/download` | Download an active attachment | 200 |
| 10 | DELETE | `/api/attachments/:attachmentId` | Soft-remove an attachment | 200 |

### Key Validation Rules (Summary)

- `POST /api/tickets` — all six body fields required; `summary` 10–200 chars trimmed; `description` 20–2000 chars trimmed; `requestedPriority` must be `LOW | MEDIUM | HIGH`; `requesterId`, `categoryId`, `relatedSystemId` must exist and be active.
- `POST /api/tickets/:ticketId/attachments` — file required; MIME type must be `image/jpeg`, `image/png`, `image/webp`, or `application/pdf`; size ≤ 5 MB; active attachment count must be < 5.
- `DELETE /api/attachments/:attachmentId` — attachment must not already be removed.
- Ownership check on endpoints 6, 7, 8, 9, 10: `requesterId` in query/body must match `ticket.requesterId`.

### HTTP Status Codes Used

| Code | Meaning |
|------|---------|
| 200 | Successful retrieval or soft-removal |
| 201 | Resource created |
| 400 | Invalid input or validation failure |
| 403 | Ownership check failed or attachment removed |
| 404 | Resource not found |
| 409 | Conflict (duplicate, already removed, max attachments) |
| 413 | File too large |
| 415 | Unsupported file type |
| 500 | Unexpected server error |

### Error Response Shape

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

### AC-01: Valid ticket data is accepted and stored

**Given** an active Requester is selected and all required form fields contain valid data  
**When** the Requester submits the Create Ticket form  
**Then** the server responds with HTTP 201  
**And** the response body contains a unique `ticketNumber` matching the pattern `TKT-\d{6}`  
**And** `currentStatus` is `NEW`  
**And** `ticketDate` is set to the current timestamp  
**And** the Ticket Detail screen is displayed (or a success confirmation is shown)

### AC-02: Requester Selection modal opens and populates

**Given** the application loads for the first time (or no Requester is stored in localStorage)  
**When** the Requester Selection screen is displayed  
**Then** the dropdown contains all active Requesters (name and email)  
**And** inactive Requesters do not appear in the list  
**And** if the API call fails, an error message and a Retry button are shown

### AC-03: Ticket ownership is enforced across Requesters

**Given** Requester A owns Ticket X and Requester B is currently selected  
**When** a request is made for the detail of Ticket X with Requester B's ID  
**Then** the server responds with HTTP 403  
**And** the frontend displays "You do not have permission to view this ticket"  
**And** a "Back to My Tickets" button is available

### AC-04: Invalid ticket data is rejected with inline errors

**Given** the Create Ticket form is submitted with a Summary shorter than 10 characters  
**Then** the server responds with HTTP 400  
**And** the frontend displays an inline error below the Summary field: "Summary must be between 10 and 200 characters"  
**And** all other user-entered data is preserved in the form

### AC-05: My Tickets shows only the current Requester's tickets

**Given** Requester A and Requester B each have tickets in the database  
**When** Requester A views My Tickets  
**Then** only Requester A's tickets are displayed  
**And** none of Requester B's tickets appear

### AC-06: Attachment upload enforces type and size limits

**Given** a Requester owns a ticket  
**When** a file with an unsupported type (e.g., `.txt`) is uploaded  
**Then** the server responds with HTTP 415 and an appropriate error message  
**When** a valid file exceeding 5 MB is uploaded  
**Then** the server responds with HTTP 413 and an appropriate error message

### AC-07: Soft removal marks attachment as inaccessible but keeps metadata visible

**Given** a Requester soft-removes an attachment from their ticket  
**When** a download is attempted for that attachment  
**Then** the server responds with HTTP 403  
**And** the attachment no longer appears in the active (downloadable) attachment list  
**And** the attachment's metadata (filename, removal date, removal reason) is still visible on the Ticket Detail screen in a muted/removed style  
**And** the file record remains in the database with `isRemoved = true`

### AC-08: Pagination and search work together

**Given** Requester A has 25 tickets and 10 of them contain the word "battery" in the summary  
**When** `GET /api/tickets?requesterId=1&search=battery&page=1&pageSize=10` is called  
**Then** the response contains at most 10 tickets  
**And** all returned tickets contain "battery" (case-insensitive)  
**And** `pagination.totalCount` equals 10

---

## 10. Definition of Done

### Development
- [ ] All features in the Included Scope are implemented
- [ ] No feature from the Excluded Scope is present
- [ ] All business rules (BR-01 – BR-24) are enforced in both frontend and backend
- [ ] Prisma schema matches the Data Changes section; migration applied cleanly
- [ ] Seed script runs without errors and is idempotent

### Testing
- [ ] All acceptance criteria (AC-01 – AC-08) pass with automated tests
- [ ] Backend tests cover every API endpoint for success, validation failure, ownership failure, 404, and 500 cases
- [ ] Frontend tests cover form validation, loading/empty/error states, and ownership error display
- [ ] Playwright screenshots capture E2E workflows as visual evidence
- [ ] No test is skipped, disabled, or commented out on the final main branch

### UI Screens
- [ ] Requester Selection screen implemented and matches `ui-spec.md`
- [ ] Create Ticket screen implemented with all fields, validation, and states
- [ ] My Tickets screen implemented with search, filter, sort, and pagination
- [ ] Ticket Detail screen implemented with ownership check and attachment management
- [ ] Zen Green theme applied consistently across all screens
- [ ] Responsive layout verified on mobile, tablet, and desktop viewports
- [ ] Loading, empty, error, and success states present on every screen

### Review
- [ ] Every change merged via Pull Request with peer review and approval
- [ ] All review comments resolved before merging
- [ ] No sensitive data (credentials, tokens) committed to the repository

### Documentation
- [ ] `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are complete and current
- [ ] README contains up-to-date setup, migration, seed, and test instructions
- [ ] Environment variable requirements documented in `.env.example`

### Demonstration
- [ ] The implemented screens and APIs conform to the approved engineering contract
- [ ] All required test evidence (screenshots or test output) is attached per course submission requirements

---

## 11. Assumptions and Decisions

**A-01: requesterId passed as query parameter / request body**  
Because real authentication (session tokens, JWT) is excluded from Lab 2, `requesterId` is transmitted as a query parameter (GET requests) or body field (POST/DELETE requests) to identify the current Requester for ownership checks. This is intentionally insecure and will be replaced with server-side session lookup in Lab 3.

**A-02: Ticket Number generation strategy**  
Ticket Number is generated by reading the current maximum sequence value from the database and incrementing it, then formatting as `TKT-NNNNNN`. A database-level unique constraint on `ticketNumber` acts as a safety net against race conditions.

**A-03: File storage location**  
Uploaded files are stored on the local filesystem in a directory outside the web root (e.g., `server/uploads/`). The stored filename is a UUID to prevent collisions and path-traversal attacks. In production this would be replaced with object storage (e.g., S3), but that is out of scope for Lab 2.

**A-04: Attachment count enforced in application logic**  
The five-attachment limit per ticket is enforced in the service layer, not by a database constraint, because the constraint must count only non-removed rows. The service queries `COUNT(id) WHERE ticketId = X AND isRemoved = false` before accepting an upload.

**A-05: Requester switching does not warn about unsaved data**  
Lab 2 only requires displaying the Requester name and providing a "Change Requester" function. No unsaved-data warning or confirmation dialog is required when switching Requesters.

**A-06: Removed attachments visible to owner with `includeRemoved=true`**  
The attachment metadata endpoint accepts an optional `includeRemoved=true` query parameter so the owning Requester can see the history of removed attachments (filename, removal date, reason) without being able to download the file.

**A-07: Search is implemented with SQL LIKE / contains**  
Full-text indexing is not required for Lab 2. Search across `ticketNumber`, `summary`, and `description` is implemented with database `LIKE '%term%'` (Prisma `contains` with `mode: 'insensitive'`). Performance is acceptable for the expected data volume in a lab environment.

**A-08: Schema evolution path to Lab 3**  
The `requesterId` foreign key on `Ticket` currently references the `Requester` table. In Lab 3 this will be migrated to reference an authenticated `User` table. Existing Requester records can be migrated directly to User records, so no data loss is expected.
