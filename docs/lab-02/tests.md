# Lab 2 Test Specification

## Overview
This document defines the test-driven development (TDD) approach, acceptance criteria, and test scenarios for the Requester Ticketing System. All features must have corresponding automated tests that verify the acceptance criteria.

## Testing Strategy

### Test Levels

#### Unit Tests
- Individual functions, utilities, and business logic
- Component rendering and behavior in isolation
- Validation functions
- Filename sanitization

#### Integration Tests
- API endpoint behavior with database
- Multiple components working together
- Form submission and validation flows

#### End-to-End Tests
- Complete user workflows across frontend and backend
- Browser automation with Playwright screenshots as visual evidence

### Test Execution
- All tests must pass on the final main branch
- Evidence of passing tests must be attached as screenshots or test output

## Acceptance Criteria and Test Scenarios

---

## AC-01: Development Requester Selector

### Acceptance Criteria
- AC-01-01: System displays all active requesters in dropdown
- AC-01-02: System excludes inactive requesters from selector
- AC-01-03: Selected requester is stored and persists on page reload
- AC-01-04: Selected requester is displayed in app header
- AC-01-05: User can switch requester at any time
- AC-01-06: Switching requester clears current ticket context

### Test Scenarios

#### Backend Tests

**Test: GET /api/requesters returns only active requesters**
- Given: Database contains 4 active and 1 inactive requester
- When: GET /api/requesters is called
- Then: Response contains 4 requesters
- And: Inactive requester is not in response
- And: Status code is 200

**Test: GET /api/requesters handles database error gracefully**
- Given: Database connection fails
- When: GET /api/requesters is called
- Then: Status code is 500
- And: Error response contains safe error message

#### Frontend Tests

**Test: Requester selector displays active requesters**
- Given: API returns list of active requesters
- When: Requester selector component mounts
- Then: Dropdown contains all active requesters
- And: Each option shows name and email

**Test: Selected requester persists on page reload**
- Given: User selects a requester
- When: Page is reloaded
- Then: Same requester is still selected
- And: Selection is restored from localStorage

**Test: Requester name displayed in app header**
- Given: User selects requester "Alice Johnson"
- When: Selection is confirmed
- Then: App header shows "Logged in as: Alice Johnson"
- And: Email is displayed below name

**Test: Switch requester clears ticket context**
- Given: User is viewing "My Tickets" for Requester A
- When: User switches to Requester B
- Then: Ticket list is cleared and reloaded
- And: Only Requester B's tickets are shown

---

## AC-02: Create Ticket - Required Fields and Validation

### Acceptance Criteria
- AC-02-01: All required fields must be filled before submission
- AC-02-02: Summary must be 10-200 characters after trim
- AC-02-03: Description must be 20-2000 characters after trim
- AC-02-04: Category must be selected from active categories
- AC-02-05: Related System must be selected from active systems
- AC-02-06: Requested Priority must be selected (LOW, MEDIUM, HIGH)
- AC-02-07: Frontend validates inputs before submission
- AC-02-08: Backend validates inputs and rejects invalid data
- AC-02-09: Validation errors displayed inline with clear messages
- AC-02-10: Form data preserved after validation failure

### Test Scenarios

#### Backend Tests

**Test: Create ticket with valid data succeeds**
- Given: Valid ticket data with all required fields
- When: POST /api/tickets is called
- Then: Ticket is created in database
- And: Status code is 201
- And: Response contains ticket with generated ticket number
- And: Ticket number format is TKT-NNNNNN
- And: Current status is NEW
- And: Ticket date is set to current timestamp

**Test: Create ticket with missing summary fails**
- Given: Ticket data without summary
- When: POST /api/tickets is called
- Then: Status code is 400
- And: Error response indicates summary is required

**Test: Create ticket with short summary fails**
- Given: Ticket data with summary "Too short"
- When: POST /api/tickets is called
- Then: Status code is 400
- And: Error response indicates summary must be at least 10 characters

**Test: Create ticket with long summary fails**
- Given: Ticket data with summary exceeding 200 characters
- When: POST /api/tickets is called
- Then: Status code is 400
- And: Error response indicates summary exceeds maximum length

**Test: Summary is trimmed before validation**
- Given: Ticket data with summary "  Valid summary with spaces  "
- When: POST /api/tickets is called
- Then: Ticket is created successfully
- And: Stored summary is "Valid summary with spaces" (trimmed)

**Test: Create ticket with short description fails**
- Given: Ticket data with description under 20 characters
- When: POST /api/tickets is called
- Then: Status code is 400
- And: Error response indicates description too short

**Test: Create ticket with long description fails**
- Given: Ticket data with description exceeding 2000 characters
- When: POST /api/tickets is called
- Then: Status code is 400
- And: Error response indicates description exceeds maximum length

**Test: Create ticket with invalid category ID fails**
- Given: Ticket data with non-existent categoryId
- When: POST /api/tickets is called
- Then: Status code is 404 or 400
- And: Error response indicates invalid category

**Test: Create ticket with invalid related system ID fails**
- Given: Ticket data with non-existent relatedSystemId
- When: POST /api/tickets is called
- Then: Status code is 404 or 400
- And: Error response indicates invalid related system

**Test: Create ticket with invalid priority fails**
- Given: Ticket data with requestedPriority "URGENT" (not in enum)
- When: POST /api/tickets is called
- Then: Status code is 400
- And: Error response indicates invalid priority

**Test: Create ticket with invalid requester ID fails**
- Given: Ticket data with non-existent requesterId
- When: POST /api/tickets is called
- Then: Status code is 404
- And: Error response indicates requester not found

**Test: Create ticket with inactive requester fails**
- Given: Ticket data with inactive requesterId
- When: POST /api/tickets is called
- Then: Status code is 400 or 403
- And: Error response indicates requester is inactive

**Test: Ticket number is unique**
- Given: Multiple tickets created
- When: Each ticket is created
- Then: Each ticket has unique ticket number
- And: Numbers are sequential (TKT-000001, TKT-000002, etc.)

#### Frontend Tests

**Test: Submit button disabled when required fields empty**
- Given: Create ticket form is displayed
- When: Required fields are empty
- Then: Submit button is disabled
- And: Button shows disabled styling

**Test: Character counter updates as user types in summary**
- Given: Summary field is focused
- When: User types "Sample ticket summary"
- Then: Character counter shows "22 / 200 characters"

**Test: Character counter warns when near limit**
- Given: Summary has 190 characters
- When: Counter is displayed
- Then: Counter shows warning color (amber)

**Test: Character counter shows error when over limit**
- Given: Summary has 205 characters
- When: Counter is displayed
- Then: Counter shows error color (red)
- And: Validation error is shown

**Test: Inline error appears when summary too short**
- Given: User enters "Short" in summary
- When: User blurs summary field
- Then: Error message "Summary must be between 10 and 200 characters" appears below field
- And: Field has error border styling

**Test: Inline error clears when summary is corrected**
- Given: Summary field has validation error
- When: User corrects summary to valid length
- Then: Error message disappears
- And: Error border styling is removed

**Test: Form data preserved after backend validation failure**
- Given: User fills out form with invalid category ID (edge case)
- When: Backend returns validation error
- Then: All user-entered data remains in form
- And: Error message displayed at top of form
- And: User can correct and resubmit

**Test: Success message shown and form cleared after creation**
- Given: User submits valid ticket
- When: Backend successfully creates ticket
- Then: Success banner appears: "Ticket created successfully"
- And: User is navigated to Ticket Detail page OR form is cleared

---

## AC-03: Create Ticket - Ticket Number and Date Generation

### Acceptance Criteria
- AC-03-01: Ticket number is generated by backend
- AC-03-02: Ticket number is unique
- AC-03-03: Ticket number format is TKT-NNNNNN (6 digits, zero-padded)
- AC-03-04: Ticket date is set to current timestamp on creation
- AC-03-05: Ticket number and date are read-only, not editable by user

### Test Scenarios

**Test: Ticket number generated in correct format**
- Given: Valid ticket data
- When: POST /api/tickets is called
- Then: Response contains ticketNumber matching format TKT-\\d{6}

**Test: First ticket number is TKT-000001**
- Given: Empty database (or after reset)
- When: First ticket is created
- Then: Ticket number is TKT-000001

**Test: Subsequent tickets increment ticket number**
- Given: Last ticket number was TKT-000042
- When: New ticket is created
- Then: Ticket number is TKT-000043

**Test: Ticket date is current timestamp**
- Given: Valid ticket data
- When: POST /api/tickets is called at specific time
- Then: Ticket ticketDate is within 1 second of request time

**Test: Ticket number and date are not in request body**
- Given: Request body includes ticketNumber and ticketDate
- When: POST /api/tickets is called
- Then: Provided values are ignored
- And: Backend generates new values

---

## AC-04: Create Ticket - Initial Status

### Acceptance Criteria
- AC-04-01: New ticket starts with status NEW
- AC-04-02: Status is set by backend, not user
- AC-04-03: Status cannot be changed in Lab 2

### Test Scenarios

**Test: New ticket has status NEW**
- Given: Valid ticket data without status
- When: POST /api/tickets is called
- Then: Created ticket has currentStatus = NEW

**Test: Provided status is ignored**
- Given: Request body includes currentStatus = RESOLVED
- When: POST /api/tickets is called
- Then: Created ticket has currentStatus = NEW

---

## AC-05: My Tickets - List Requester's Tickets

### Acceptance Criteria
- AC-05-01: List displays only tickets owned by selected requester
- AC-05-02: Tickets from other requesters are not visible
- AC-05-03: Each ticket shows: number, summary, category, related system, priority, status, date, attachment count
- AC-05-04: Default sort is ticket date descending (newest first)

### Test Scenarios

#### Backend Tests

**Test: Get tickets for specific requester**
- Given: Database contains tickets for multiple requesters
- When: GET /api/tickets?requesterId=1 is called
- Then: Response contains only tickets for requester 1
- And: Status code is 200

**Test: Requester with no tickets returns empty list**
- Given: Requester has no tickets
- When: GET /api/tickets?requesterId=1 is called
- Then: Response data is empty array
- And: Status code is 200
- And: Pagination metadata shows totalCount = 0

**Test: Default sort is ticket date descending**
- Given: Requester has 3 tickets created on different dates
- When: GET /api/tickets?requesterId=1 is called (no sort params)
- Then: Tickets are ordered by ticketDate descending (newest first)

#### Frontend Tests

**Test: My Tickets displays requester's tickets**
- Given: API returns list of tickets for requester
- When: My Tickets screen loads
- Then: All tickets are displayed as cards
- And: Each card shows ticket number, summary, category, related system, priority badge, status badge, date

**Test: Ticket from different requester not displayed**
- Given: Database contains tickets for Requester A and Requester B
- When: Requester A views My Tickets
- Then: Only Requester A's tickets are shown

**Test: Empty state displayed when no tickets exist**
- Given: Requester has no tickets
- When: My Tickets screen loads
- Then: Empty state component is displayed
- And: Message says "You haven't created any tickets yet"
- And: "Create Your First Ticket" button is shown

**Test: Attachment count displayed on ticket card**
- Given: Ticket has 2 active attachments
- When: Ticket is displayed in list
- Then: Card shows "📎 2 attachments"

---

## AC-06: My Tickets - Search Functionality

### Acceptance Criteria
- AC-06-01: Search is case-insensitive
- AC-06-02: Search matches partial strings in ticket number, summary, or description
- AC-06-03: Search updates results immediately (or on submit/debounce)
- AC-06-04: Empty search shows all tickets

### Test Scenarios

**Test: Search by ticket number**
- Given: Requester has tickets TKT-000001, TKT-000002, TKT-000123
- When: Search query is "123"
- Then: Only ticket TKT-000123 is returned

**Test: Search by summary (case-insensitive)**
- Given: Ticket has summary "Laptop battery drains quickly"
- When: Search query is "BATTERY"
- Then: Ticket is returned in results

**Test: Search by description**
- Given: Ticket has description containing "Wi-Fi connection drops"
- When: Search query is "Wi-Fi"
- Then: Ticket is returned in results

**Test: Search with no matches returns empty**
- Given: Requester has several tickets
- When: Search query is "nonexistent term"
- Then: Empty array is returned
- And: Empty state message "No tickets found" is displayed

**Test: Empty search returns all tickets**
- Given: Search query is empty string
- When: GET /api/tickets?requesterId=1&search= is called
- Then: All requester's tickets are returned

**Test: Search is trimmed**
- Given: Search query is "  battery  "
- When: Request is made
- Then: Search is performed for "battery" (trimmed)

---

## AC-07: My Tickets - Filtering

### Acceptance Criteria
- AC-07-01: Filter by category
- AC-07-02: Filter by related system
- AC-07-03: Filter by status (currently only NEW in Lab 2)
- AC-07-04: Filter by requested priority
- AC-07-05: Multiple filters applied simultaneously (AND logic)
- AC-07-06: Clear filters resets to all tickets

### Test Scenarios

**Test: Filter by category**
- Given: Requester has tickets in categories Hardware and Software
- When: Filter categoryId=2 (Hardware) is applied
- Then: Only tickets in Hardware category are returned

**Test: Filter by related system**
- Given: Requester has tickets for Email and VPN
- When: Filter relatedSystemId=3 (VPN) is applied
- Then: Only tickets for VPN are returned

**Test: Filter by status**
- Given: All tickets have status NEW in Lab 2
- When: Filter status=NEW is applied
- Then: All tickets are returned

**Test: Filter by priority**
- Given: Requester has tickets with priorities LOW, MEDIUM, HIGH
- When: Filter priority=HIGH is applied
- Then: Only tickets with HIGH priority are returned

**Test: Multiple filters applied simultaneously**
- Given: Requester has various tickets
- When: Filters categoryId=2 AND priority=HIGH are applied
- Then: Only tickets matching both filters are returned

**Test: Clear filters button resets filters**
- Given: User has applied multiple filters
- When: User clicks "Clear Filters"
- Then: All filter dropdowns reset to default
- And: All tickets are displayed

---

## AC-08: My Tickets - Sorting

### Acceptance Criteria
- AC-08-01: Sort by ticket date (ascending or descending)
- AC-08-02: Sort by ticket number (ascending or descending)
- AC-08-03: Default sort is ticket date descending

### Test Scenarios

**Test: Sort by ticket date descending (default)**
- Given: Requester has 3 tickets created on different dates
- When: No sort parameter is provided
- Then: Tickets are ordered newest first

**Test: Sort by ticket date ascending**
- Given: Requester has 3 tickets
- When: sortBy=ticketDate&sortOrder=asc is provided
- Then: Tickets are ordered oldest first

**Test: Sort by ticket number ascending**
- Given: Requester has tickets TKT-000003, TKT-000001, TKT-000002
- When: sortBy=ticketNumber&sortOrder=asc is provided
- Then: Tickets are ordered TKT-000001, TKT-000002, TKT-000003

**Test: Sort by ticket number descending**
- Given: Requester has tickets TKT-000001, TKT-000002, TKT-000003
- When: sortBy=ticketNumber&sortOrder=desc is provided
- Then: Tickets are ordered TKT-000003, TKT-000002, TKT-000001

---

## AC-09: My Tickets - Pagination

### Acceptance Criteria
- AC-09-01: Default page size is 10
- AC-09-02: Supported page sizes: 10, 25, 50
- AC-09-03: Pagination metadata includes: page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage
- AC-09-04: Invalid page defaults to page 1
- AC-09-05: Invalid pageSize defaults to 10

### Test Scenarios

**Test: Default pagination (page 1, size 10)**
- Given: Requester has 25 tickets
- When: GET /api/tickets?requesterId=1 is called (no pagination params)
- Then: Response contains first 10 tickets
- And: Pagination metadata shows page=1, pageSize=10, totalCount=25, totalPages=3, hasNextPage=true, hasPreviousPage=false

**Test: Request page 2**
- Given: Requester has 25 tickets
- When: GET /api/tickets?requesterId=1&page=2&pageSize=10 is called
- Then: Response contains tickets 11-20
- And: Pagination metadata shows page=2, hasNextPage=true, hasPreviousPage=true

**Test: Request last page**
- Given: Requester has 25 tickets
- When: GET /api/tickets?requesterId=1&page=3&pageSize=10 is called
- Then: Response contains tickets 21-25 (5 tickets)
- And: Pagination metadata shows page=3, hasNextPage=false, hasPreviousPage=true

**Test: Page size 25**
- Given: Requester has 30 tickets
- When: GET /api/tickets?requesterId=1&pageSize=25 is called
- Then: Response contains first 25 tickets
- And: Pagination metadata shows totalPages=2

**Test: Page size 50**
- Given: Requester has 30 tickets
- When: GET /api/tickets?requesterId=1&pageSize=50 is called
- Then: Response contains all 30 tickets
- And: Pagination metadata shows totalPages=1

**Test: Invalid page size defaults to 10**
- Given: Request with pageSize=100 (invalid)
- When: GET /api/tickets is called
- Then: Response uses pageSize=10

**Test: Invalid page number defaults to 1**
- Given: Request with page=-1 or page=0
- When: GET /api/tickets is called
- Then: Response uses page=1

---

## AC-10: Ticket Detail - View Owned Ticket

### Acceptance Criteria
- AC-10-01: Requester can view full details of owned ticket
- AC-10-02: Ticket detail shows: number, date, requester, category, related system, summary, description, priority, status
- AC-10-03: Ticket detail shows list of active attachments
- AC-10-04: Ownership is verified before displaying details

### Test Scenarios

**Test: Get owned ticket detail**
- Given: Requester 1 owns ticket 42
- When: GET /api/tickets/42?requesterId=1 is called
- Then: Status code is 200
- And: Response contains full ticket details
- And: Response includes requester, category, relatedSystem objects
- And: Response includes attachments array

**Test: Ticket detail includes all required fields**
- Given: Ticket exists
- When: Ticket detail is retrieved
- Then: Response includes: id, ticketNumber, ticketDate, requesterId, requester, categoryId, category, relatedSystemId, relatedSystem, summary, description, requestedPriority, currentStatus, createdAt, updatedAt, attachments

**Test: Frontend displays ticket detail**
- Given: API returns ticket detail
- When: Ticket Detail screen loads
- Then: All fields are displayed in read-only format
- And: Summary is displayed as heading
- And: Description preserves line breaks

---

## AC-11: Ticket Detail - Ownership Verification

### Acceptance Criteria
- AC-11-01: Requester can only view tickets they own
- AC-11-02: Attempting to view another requester's ticket returns 403 Forbidden
- AC-11-03: Error message is clear and safe

### Test Scenarios

**Test: Get ticket owned by different requester fails**
- Given: Requester 1 owns ticket 42
- When: GET /api/tickets/42?requesterId=2 is called
- Then: Status code is 403
- And: Error message is "You do not have permission to view this ticket"

**Test: Get non-existent ticket returns 404**
- Given: Ticket 999 does not exist
- When: GET /api/tickets/999?requesterId=1 is called
- Then: Status code is 404
- And: Error message is "Ticket not found"

**Test: Frontend displays ownership error**
- Given: User tries to access ticket they don't own
- When: API returns 403 error
- Then: Error state component is displayed
- And: Error message is shown
- And: "Back to My Tickets" button is available

---

## AC-12: Attachments - Upload

### Acceptance Criteria
- AC-12-01: Allowed file types: JPG, JPEG, PNG, WEBP, PDF
- AC-12-02: Maximum file size: 5 MB
- AC-12-03: Maximum 5 active attachments per ticket
- AC-12-04: Ownership verified before upload
- AC-12-05: Filename sanitized for safe storage
- AC-12-06: Metadata stored: original filename, storage filename, size, content type, upload timestamp

### Test Scenarios

**Test: Upload valid JPEG attachment**
- Given: Requester owns ticket 42
- When: POST /api/tickets/42/attachments with valid JPEG file and requesterId
- Then: Status code is 201
- And: Response contains attachment metadata
- And: File is stored on server
- And: Attachment record created in database

**Test: Upload valid PNG attachment**
- Given: Requester owns ticket 42
- When: POST /api/tickets/42/attachments with valid PNG file
- Then: Attachment is uploaded successfully

**Test: Upload valid WEBP attachment**
- Given: Requester owns ticket 42
- When: POST /api/tickets/42/attachments with valid WEBP file
- Then: Attachment is uploaded successfully

**Test: Upload valid PDF attachment**
- Given: Requester owns ticket 42
- When: POST /api/tickets/42/attachments with valid PDF file
- Then: Attachment is uploaded successfully

**Test: Upload invalid file type fails**
- Given: Requester owns ticket 42
- When: POST /api/tickets/42/attachments with .txt file
- Then: Status code is 415
- And: Error message is "Only JPG, PNG, WEBP, and PDF files are allowed"

**Test: Upload oversized file fails**
- Given: Requester owns ticket 42
- When: POST /api/tickets/42/attachments with 6 MB file
- Then: Status code is 413
- And: Error message is "File size must not exceed 5 MB"

**Test: Upload to ticket at max attachments fails**
- Given: Ticket 42 has 5 active attachments
- When: POST /api/tickets/42/attachments with valid file
- Then: Status code is 409
- And: Error message is "Maximum 5 attachments per ticket"

**Test: Upload to ticket owned by different requester fails**
- Given: Requester 1 owns ticket 42
- When: POST /api/tickets/42/attachments with requesterId=2
- Then: Status code is 403
- And: Error message is "You do not have permission to add attachments to this ticket"

**Test: Upload to non-existent ticket fails**
- Given: Ticket 999 does not exist
- When: POST /api/tickets/999/attachments with valid file
- Then: Status code is 404
- And: Error message is "Ticket not found"

**Test: Filename is sanitized**
- Given: File with name "../../../malicious.pdf"
- When: File is uploaded
- Then: Stored filename is sanitized (e.g., UUID-based)
- And: Original filename is preserved in database

**Test: Attachment metadata stored correctly**
- Given: File "report.pdf" (1.2 MB) is uploaded
- When: Upload completes
- Then: Database record contains:
  - originalFilename: "report.pdf"
  - storedFilename: unique sanitized name
  - fileSizeBytes: 1200000 (approx)
  - contentType: "application/pdf"
  - uploadedAt: current timestamp
  - isRemoved: false

---

## AC-13: Attachments - Download

### Acceptance Criteria
- AC-13-01: Requester can download attachments from owned tickets
- AC-13-02: Ownership verified before download
- AC-13-03: Removed attachments cannot be downloaded
- AC-13-04: Downloaded file has correct content type and filename

### Test Scenarios

**Test: Download owned attachment**
- Given: Requester 1 owns ticket 42 with attachment 101
- When: GET /api/attachments/101/download?requesterId=1 is called
- Then: Status code is 200
- And: Response Content-Type matches stored content type
- And: Response Content-Disposition includes original filename
- And: Response body is file binary data

**Test: Download attachment from unowned ticket fails**
- Given: Requester 1 owns ticket 42 with attachment 101
- When: GET /api/attachments/101/download?requesterId=2 is called
- Then: Status code is 403
- And: Error message is "You do not have permission to download this attachment"

**Test: Download removed attachment fails**
- Given: Attachment 101 is marked as removed
- When: GET /api/attachments/101/download?requesterId=1 is called
- Then: Status code is 403
- And: Error message is "This attachment has been removed and cannot be downloaded"

**Test: Download non-existent attachment fails**
- Given: Attachment 999 does not exist
- When: GET /api/attachments/999/download?requesterId=1 is called
- Then: Status code is 404
- And: Error message is "Attachment not found"

---

## AC-14: Attachments - Soft Removal

### Acceptance Criteria
- AC-14-01: Attachments are soft-removed, not deleted
- AC-14-02: Removal sets isRemoved flag to true
- AC-14-03: Removal records timestamp and optional reason
- AC-14-04: Ownership verified before removal
- AC-14-05: Removed attachments not shown in active list
- AC-14-06: Removed attachments cannot be downloaded

### Test Scenarios

**Test: Soft remove owned attachment**
- Given: Requester 1 owns ticket 42 with attachment 101
- When: DELETE /api/attachments/101 with requesterId=1 and removalReason
- Then: Status code is 200
- And: Response confirms removal
- And: Database record has isRemoved=true, removedAt set, removalReason stored
- And: File still exists in storage

**Test: Soft remove without reason**
- Given: Requester 1 owns ticket 42 with attachment 101
- When: DELETE /api/attachments/101 with requesterId=1 (no removalReason)
- Then: Attachment is removed successfully
- And: removalReason is null

**Test: Remove attachment from unowned ticket fails**
- Given: Requester 1 owns ticket 42 with attachment 101
- When: DELETE /api/attachments/101 with requesterId=2
- Then: Status code is 403
- And: Error message is "You do not have permission to remove this attachment"

**Test: Remove already removed attachment fails**
- Given: Attachment 101 is already removed
- When: DELETE /api/attachments/101 with requesterId=1
- Then: Status code is 409
- And: Error message is "Attachment is already removed"

**Test: Remove non-existent attachment fails**
- Given: Attachment 999 does not exist
- When: DELETE /api/attachments/999 with requesterId=1
- Then: Status code is 404
- And: Error message is "Attachment not found"

**Test: Removed attachment not in active attachments list**
- Given: Ticket 42 has 3 attachments, one is removed
- When: GET /api/tickets/42/attachments?requesterId=1 is called
- Then: Response contains only 2 active attachments
- And: Removed attachment is not included

**Test: Removed attachment shown when includeRemoved=true**
- Given: Ticket 42 has 1 removed attachment
- When: GET /api/tickets/42/attachments?requesterId=1&includeRemoved=true is called
- Then: Response includes removed attachment
- And: Removed attachment shows isRemoved=true, removedAt, removalReason

**Test: Frontend displays remove confirmation dialog**
- Given: User clicks remove button on attachment
- When: Confirmation dialog appears
- Then: Dialog shows attachment filename
- And: Dialog warns attachment will be removed
- And: Dialog provides optional reason input
- And: Dialog has "Remove" (danger) and "Cancel" buttons

**Test: After removal, attachment count decreases**
- Given: Ticket 42 has 5 active attachments (at limit)
- When: User removes one attachment
- Then: Attachment count is 4
- And: User can upload new attachment

---

## AC-15: Reference Data - Categories and Related Systems

### Acceptance Criteria
- AC-15-01: System provides 4 required categories
- AC-15-02: System provides at least 6 related systems
- AC-15-03: Only active categories and systems shown in dropdowns
- AC-15-04: Seed data can be run repeatedly without duplicates

### Test Scenarios

**Test: Seed data creates 4 categories**
- Given: Empty database
- When: Seed script runs
- Then: Database contains exactly 4 categories: Account and Access, Hardware, Software, Network

**Test: Seed data creates at least 6 related systems**
- Given: Empty database
- When: Seed script runs
- Then: Database contains at least 6 related systems (Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop, etc.)

**Test: Seed data creates at least 4 active requesters**
- Given: Empty database
- When: Seed script runs
- Then: Database contains at least 4 active requesters

**Test: Seed data creates at least 1 inactive requester**
- Given: Empty database
- When: Seed script runs
- Then: Database contains at least 1 requester with isActive=false

**Test: Seed data is idempotent**
- Given: Seed data already exists
- When: Seed script runs again
- Then: No duplicate records are created
- And: Existing records are not modified

**Test: GET /api/categories returns active categories**
- Given: Database has seeded categories
- When: GET /api/categories is called
- Then: Response contains 4 active categories

**Test: GET /api/related-systems returns active related systems**
- Given: Database has seeded related systems
- When: GET /api/related-systems is called
- Then: Response contains all active related systems

---

## AC-16: Error Handling and User Feedback

### Acceptance Criteria
- AC-16-01: Loading states shown during API requests
- AC-16-02: Error states shown when requests fail
- AC-16-03: Success feedback shown after successful actions
- AC-16-04: Error messages are safe and actionable
- AC-16-05: User data preserved after errors when possible

### Test Scenarios

**Test: Loading spinner shown during ticket creation**
- Given: User submits Create Ticket form
- When: API request is in progress
- Then: Loading spinner is displayed
- And: Form is disabled
- And: Submit button shows loading state

**Test: Success banner shown after ticket created**
- Given: User successfully creates ticket
- When: API returns success
- Then: Success banner appears: "Ticket created successfully"
- And: User is navigated to Ticket Detail or My Tickets

**Test: Error banner shown when ticket creation fails**
- Given: API request fails with 500 error
- When: Error response is received
- Then: Error banner appears at top: "Unable to create ticket. Please try again."
- And: Form data is preserved
- And: User can retry

**Test: Network error handled gracefully**
- Given: Network connection fails during request
- When: Error occurs
- Then: Error message: "Network error. Please check your connection and try again."
- And: Retry button available

---

## AC-17: Responsive Design and Mobile Support

### Acceptance Criteria
- AC-17-01: UI adapts to mobile, tablet, and desktop screen sizes
- AC-17-02: Touch targets are at least 44px on mobile
- AC-17-03: Forms are usable on mobile devices
- AC-17-04: Navigation adapts to mobile (hamburger menu)

### Test Scenarios

**Test: App header shows hamburger menu on mobile**
- Given: Viewport width < 768px
- When: Page loads
- Then: Hamburger menu icon is displayed
- And: Navigation links are hidden in collapsed menu

**Test: Create ticket form stacks vertically on mobile**
- Given: Viewport width < 768px
- When: Create Ticket screen loads
- Then: All form fields are full-width
- And: Buttons are stacked vertically

**Test: Ticket cards adapt to mobile layout**
- Given: Viewport width < 768px
- When: My Tickets screen loads
- Then: Ticket cards are single-column
- And: Metadata is stacked vertically

**Test: Touch targets are large enough on mobile**
- Given: Mobile viewport
- When: Interactive elements are rendered
- Then: All buttons, links, inputs are at least 44px × 44px

---

## Test Execution and Reporting

### Evidence Requirements
- All tests must pass on the final main branch
- Attach screenshots or test output as evidence of passing tests per course submission requirements

---

## Manual Testing Checklist

In addition to automated tests, perform manual verification:

- [ ] Visual inspection of all screens matches ui-spec.md
- [ ] Zen Green theme applied consistently
- [ ] All interactive elements have hover and focus states
- [ ] Keyboard navigation works for all features
- [ ] Forms validate correctly and show helpful errors
- [ ] Success and error messages are clear and actionable
- [ ] Responsive behavior works on mobile, tablet, desktop
- [ ] File upload works with all allowed file types
- [ ] File download works and delivers correct file
- [ ] Attachment removal confirmation works
- [ ] Requester switching works and clears context
- [ ] Search, filter, sort, pagination work together correctly
- [ ] Empty states display when appropriate
- [ ] Loading states display during API requests

---

## Definition of Done for Tests

- [ ] All acceptance criteria have corresponding test scenarios
- [ ] All test scenarios have been implemented as automated tests
- [ ] All tests pass on the final main branch
- [ ] No tests are skipped, disabled, or commented out
- [ ] Tests are well-organized and maintainable
- [ ] Test names clearly describe what is being tested
- [ ] Test failures provide clear diagnostic information
- [ ] Playwright screenshots captured as visual evidence for E2E scenarios
- [ ] Manual testing checklist completed and documented

---

This test specification provides comprehensive coverage of the Requester Ticketing System. All features must have automated tests that verify the acceptance criteria before being considered complete.
