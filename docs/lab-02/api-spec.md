# Lab 2 API Specification

## Overview
This document defines the REST API contract for the Requester Ticketing System. All endpoints follow RESTful conventions and return JSON responses.

## Base URL
```
http://localhost:3000/api
```

## Common Response Patterns

### Success Response
Successful responses include appropriate HTTP status code and data payload.

### Error Response Structure
All error responses follow this structure:
```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {}  // Optional additional error details
  }
}
```

### Pagination Metadata
Paginated responses include metadata:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## HTTP Status Codes

| Status | Meaning | Usage |
|--------|---------|-------|
| 200 | OK | Successful GET, PATCH, DELETE (soft removal) |
| 201 | Created | Successful POST that creates a resource |
| 400 | Bad Request | Validation failure, invalid input |
| 403 | Forbidden | Ownership check failed, permission denied |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource, constraint violation |
| 413 | Payload Too Large | File exceeds size limit |
| 415 | Unsupported Media Type | Invalid file type for upload |
| 422 | Unprocessable Entity | Semantic validation failure |
| 500 | Internal Server Error | Unexpected server error |

## Endpoints

---

## 1. Get Active Categories

Retrieve all active ticket categories.

**Endpoint:** `GET /api/categories`

**Authentication:** None (Development mode)

**Query Parameters:** None

**Request Example:**
```
GET /api/categories
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Account and Access"
    },
    {
      "id": 2,
      "name": "Hardware"
    },
    {
      "id": 3,
      "name": "Software"
    },
    {
      "id": 4,
      "name": "Network"
    }
  ]
}
```

**Error Responses:**
- `500 Internal Server Error` - Database or server error

---

## 2. Get Active Related Systems

Retrieve all active related systems.

**Endpoint:** `GET /api/related-systems`

**Authentication:** None (Development mode)

**Query Parameters:** None

**Request Example:**
```
GET /api/related-systems
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Email"
    },
    {
      "id": 2,
      "name": "Campus Wi-Fi"
    },
    {
      "id": 3,
      "name": "VPN"
    },
    {
      "id": 4,
      "name": "LEB2 App"
    },
    {
      "id": 5,
      "name": "Grade Submission App"
    },
    {
      "id": 6,
      "name": "Printer"
    },
    {
      "id": 7,
      "name": "Corporate Laptop"
    }
  ]
}
```

**Error Responses:**
- `500 Internal Server Error` - Database or server error

---

## 3. Get Active Development Requesters

Retrieve all active requesters for the Development Requester selector.

**Endpoint:** `GET /api/requesters`

**Authentication:** None (Development mode)

**Query Parameters:** None

**Request Example:**
```
GET /api/requesters
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice.johnson@example.com"
    },
    {
      "id": 2,
      "name": "Bob Smith",
      "email": "bob.smith@example.com"
    },
    {
      "id": 3,
      "name": "Carol Martinez",
      "email": "carol.martinez@example.com"
    },
    {
      "id": 4,
      "name": "David Lee",
      "email": "david.lee@example.com"
    }
  ]
}
```

**Notes:**
- Only active requesters are returned (isActive = true)
- Inactive requesters are excluded from the list

**Error Responses:**
- `500 Internal Server Error` - Database or server error

---

## 4. Create Ticket

Create a new support ticket.

**Endpoint:** `POST /api/tickets`

**Authentication:** None (Development mode)

**Request Body:**
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "My corporate laptop battery drains very quickly, lasting only 2 hours on a full charge. This started happening last week after a system update.",
  "requestedPriority": "MEDIUM"
}
```

**Request Body Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| requesterId | Integer | Yes | Must be valid active requester ID |
| categoryId | Integer | Yes | Must be valid active category ID |
| relatedSystemId | Integer | Yes | Must be valid active related system ID |
| summary | String | Yes | 10-200 characters after trim |
| description | String | Yes | 20-2000 characters after trim |
| requestedPriority | String | Yes | Must be "LOW", "MEDIUM", or "HIGH" |

**Success Response (201):**
```json
{
  "data": {
    "id": 42,
    "ticketNumber": "TKT-000042",
    "requesterId": 1,
    "requester": {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice.johnson@example.com"
    },
    "categoryId": 2,
    "category": {
      "id": 2,
      "name": "Hardware"
    },
    "relatedSystemId": 7,
    "relatedSystem": {
      "id": 7,
      "name": "Corporate Laptop"
    },
    "summary": "Laptop battery drains quickly",
    "description": "My corporate laptop battery drains very quickly, lasting only 2 hours on a full charge. This started happening last week after a system update.",
    "requestedPriority": "MEDIUM",
    "currentStatus": "NEW",
    "ticketDate": "2026-09-04T10:30:00.000Z",
    "createdAt": "2026-09-04T10:30:00.000Z",
    "updatedAt": "2026-09-04T10:30:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request** - Validation failure
```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "summary": "Summary must be between 10 and 200 characters",
      "categoryId": "Invalid category"
    }
  }
}
```

**404 Not Found** - Referenced resource not found
```json
{
  "error": {
    "message": "Requester not found",
    "code": "REQUESTER_NOT_FOUND"
  }
}
```

**500 Internal Server Error** - Server error

---

## 5. Get Requester's Tickets (My Tickets)

Retrieve tickets owned by a specific requester with search, filtering, sorting, and pagination.

**Endpoint:** `GET /api/tickets`

**Authentication:** None (Development mode)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| requesterId | Integer | Yes | ID of the requester whose tickets to retrieve |
| search | String | No | Text search across ticket number, summary, description |
| categoryId | Integer | No | Filter by category |
| relatedSystemId | Integer | No | Filter by related system |
| status | String | No | Filter by current status (e.g., "NEW") |
| priority | String | No | Filter by requested priority ("LOW", "MEDIUM", "HIGH") |
| sortBy | String | No | Field to sort by: "ticketDate" or "ticketNumber" (default: "ticketDate") |
| sortOrder | String | No | Sort direction: "asc" or "desc" (default: "desc") |
| page | Integer | No | Page number (1-indexed, default: 1) |
| pageSize | Integer | No | Items per page: 10, 25, or 50 (default: 10) |

**Request Example:**
```
GET /api/tickets?requesterId=1&search=battery&categoryId=2&sortBy=ticketDate&sortOrder=desc&page=1&pageSize=10
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-000042",
      "summary": "Laptop battery drains quickly",
      "description": "My corporate laptop battery drains very quickly...",
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "ticketDate": "2026-09-04T10:30:00.000Z",
      "category": {
        "id": 2,
        "name": "Hardware"
      },
      "relatedSystem": {
        "id": 7,
        "name": "Corporate Laptop"
      },
      "attachmentCount": 2
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Notes:**
- Search is case-insensitive and matches partial strings in ticketNumber, summary, or description
- Multiple filters can be applied simultaneously
- Default sort is ticketDate descending (newest first)
- Invalid page or pageSize parameters default to safe values
- Empty results return empty array with pagination metadata

**Error Responses:**

**400 Bad Request** - Invalid query parameters
```json
{
  "error": {
    "message": "Invalid query parameters",
    "code": "INVALID_PARAMETERS",
    "details": {
      "pageSize": "Page size must be 10, 25, or 50"
    }
  }
}
```

**500 Internal Server Error** - Server error

---

## 6. Get Ticket Detail

Retrieve full details of a specific ticket.

**Endpoint:** `GET /api/tickets/:ticketId`

**Authentication:** None (Development mode)

**Path Parameters:**
- `ticketId` (Integer) - ID of the ticket to retrieve

**Query Parameters:**
- `requesterId` (Integer, Required) - ID of the requester for ownership verification

**Request Example:**
```
GET /api/tickets/42?requesterId=1
```

**Success Response (200):**
```json
{
  "data": {
    "id": 42,
    "ticketNumber": "TKT-000042",
    "requesterId": 1,
    "requester": {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice.johnson@example.com"
    },
    "categoryId": 2,
    "category": {
      "id": 2,
      "name": "Hardware"
    },
    "relatedSystemId": 7,
    "relatedSystem": {
      "id": 7,
      "name": "Corporate Laptop"
    },
    "summary": "Laptop battery drains quickly",
    "description": "My corporate laptop battery drains very quickly, lasting only 2 hours on a full charge. This started happening last week after a system update.",
    "requestedPriority": "MEDIUM",
    "currentStatus": "NEW",
    "ticketDate": "2026-09-04T10:30:00.000Z",
    "createdAt": "2026-09-04T10:30:00.000Z",
    "updatedAt": "2026-09-04T10:30:00.000Z",
    "attachments": [
      {
        "id": 101,
        "originalFilename": "battery-usage.png",
        "fileSizeBytes": 245678,
        "contentType": "image/png",
        "uploadedAt": "2026-09-04T10:35:00.000Z",
        "isRemoved": false
      },
      {
        "id": 102,
        "originalFilename": "system-report.pdf",
        "fileSizeBytes": 1234567,
        "contentType": "application/pdf",
        "uploadedAt": "2026-09-04T10:36:00.000Z",
        "isRemoved": false
      }
    ]
  }
}
```

**Error Responses:**

**403 Forbidden** - Ownership check failed
```json
{
  "error": {
    "message": "You do not have permission to view this ticket",
    "code": "FORBIDDEN"
  }
}
```

**404 Not Found** - Ticket does not exist
```json
{
  "error": {
    "message": "Ticket not found",
    "code": "TICKET_NOT_FOUND"
  }
}
```

**400 Bad Request** - Missing requesterId
```json
{
  "error": {
    "message": "Requester ID is required",
    "code": "MISSING_REQUESTER_ID"
  }
}
```

**500 Internal Server Error** - Server error

---

## 7. Upload Attachment

Upload a file attachment to a ticket.

**Endpoint:** `POST /api/tickets/:ticketId/attachments`

**Authentication:** None (Development mode)

**Path Parameters:**
- `ticketId` (Integer) - ID of the ticket to attach file to

**Request Body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File to upload (JPG, JPEG, PNG, WEBP, PDF; max 5MB) |
| requesterId | Integer | Yes | ID of the requester for ownership verification |

**Request Example:**
```
POST /api/tickets/42/attachments
Content-Type: multipart/form-data

file: [binary data]
requesterId: 1
```

**Success Response (201):**
```json
{
  "data": {
    "id": 103,
    "ticketId": 42,
    "originalFilename": "error-screenshot.png",
    "fileSizeBytes": 345678,
    "contentType": "image/png",
    "uploadedAt": "2026-09-04T11:00:00.000Z",
    "isRemoved": false
  }
}
```

**Error Responses:**

**400 Bad Request** - Missing file or invalid input
```json
{
  "error": {
    "message": "No file provided",
    "code": "MISSING_FILE"
  }
}
```

**403 Forbidden** - Ownership check failed
```json
{
  "error": {
    "message": "You do not have permission to add attachments to this ticket",
    "code": "FORBIDDEN"
  }
}
```

**404 Not Found** - Ticket does not exist
```json
{
  "error": {
    "message": "Ticket not found",
    "code": "TICKET_NOT_FOUND"
  }
}
```

**409 Conflict** - Maximum attachment count reached
```json
{
  "error": {
    "message": "Maximum 5 attachments per ticket",
    "code": "MAX_ATTACHMENTS_REACHED"
  }
}
```

**413 Payload Too Large** - File exceeds size limit
```json
{
  "error": {
    "message": "File size must not exceed 5 MB",
    "code": "FILE_TOO_LARGE"
  }
}
```

**415 Unsupported Media Type** - Invalid file type
```json
{
  "error": {
    "message": "Only JPG, PNG, WEBP, and PDF files are allowed",
    "code": "INVALID_FILE_TYPE"
  }
}
```

**500 Internal Server Error** - Upload or server error

---

## 8. Get Attachment Metadata

Retrieve metadata for attachments of a ticket.

**Endpoint:** `GET /api/tickets/:ticketId/attachments`

**Authentication:** None (Development mode)

**Path Parameters:**
- `ticketId` (Integer) - ID of the ticket

**Query Parameters:**
- `requesterId` (Integer, Required) - ID of the requester for ownership verification
- `includeRemoved` (Boolean, Optional) - Include soft-removed attachments (default: false)

**Request Example:**
```
GET /api/tickets/42/attachments?requesterId=1
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 101,
      "originalFilename": "battery-usage.png",
      "fileSizeBytes": 245678,
      "contentType": "image/png",
      "uploadedAt": "2026-09-04T10:35:00.000Z",
      "isRemoved": false
    },
    {
      "id": 102,
      "originalFilename": "system-report.pdf",
      "fileSizeBytes": 1234567,
      "contentType": "application/pdf",
      "uploadedAt": "2026-09-04T10:36:00.000Z",
      "isRemoved": false
    }
  ]
}
```

**With includeRemoved=true:**
```json
{
  "data": [
    {
      "id": 101,
      "originalFilename": "battery-usage.png",
      "fileSizeBytes": 245678,
      "contentType": "image/png",
      "uploadedAt": "2026-09-04T10:35:00.000Z",
      "isRemoved": false
    },
    {
      "id": 103,
      "originalFilename": "old-screenshot.png",
      "fileSizeBytes": 456789,
      "contentType": "image/png",
      "uploadedAt": "2026-09-04T10:40:00.000Z",
      "isRemoved": true,
      "removedAt": "2026-09-04T11:00:00.000Z",
      "removalReason": "Uploaded wrong file"
    }
  ]
}
```

**Error Responses:**

**403 Forbidden** - Ownership check failed
**404 Not Found** - Ticket does not exist
**500 Internal Server Error** - Server error

---

## 9. Download Attachment

Download an attachment file.

**Endpoint:** `GET /api/attachments/:attachmentId/download`

**Authentication:** None (Development mode)

**Path Parameters:**
- `attachmentId` (Integer) - ID of the attachment to download

**Query Parameters:**
- `requesterId` (Integer, Required) - ID of the requester for ownership verification

**Request Example:**
```
GET /api/attachments/101/download?requesterId=1
```

**Success Response (200):**
- **Content-Type:** Matches stored content type (image/png, application/pdf, etc.)
- **Content-Disposition:** `attachment; filename="battery-usage.png"`
- **Body:** Binary file content

**Error Responses:**

**403 Forbidden** - Ownership check failed or attachment is removed
```json
{
  "error": {
    "message": "You do not have permission to download this attachment",
    "code": "FORBIDDEN"
  }
}
```

```json
{
  "error": {
    "message": "This attachment has been removed and cannot be downloaded",
    "code": "ATTACHMENT_REMOVED"
  }
}
```

**404 Not Found** - Attachment does not exist
```json
{
  "error": {
    "message": "Attachment not found",
    "code": "ATTACHMENT_NOT_FOUND"
  }
}
```

**500 Internal Server Error** - File read or server error

---

## 10. Soft-Remove Attachment

Mark an attachment as removed (soft delete).

**Endpoint:** `DELETE /api/attachments/:attachmentId`

**Authentication:** None (Development mode)

**Path Parameters:**
- `attachmentId` (Integer) - ID of the attachment to remove

**Request Body:**
```json
{
  "requesterId": 1,
  "removalReason": "Uploaded wrong file"
}
```

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| requesterId | Integer | Yes | ID of the requester for ownership verification |
| removalReason | String | No | Optional reason for removal (max 500 characters) |

**Success Response (200):**
```json
{
  "data": {
    "id": 103,
    "isRemoved": true,
    "removedAt": "2026-09-04T11:30:00.000Z",
    "removalReason": "Uploaded wrong file"
  }
}
```

**Error Responses:**

**403 Forbidden** - Ownership check failed
```json
{
  "error": {
    "message": "You do not have permission to remove this attachment",
    "code": "FORBIDDEN"
  }
}
```

**404 Not Found** - Attachment does not exist
```json
{
  "error": {
    "message": "Attachment not found",
    "code": "ATTACHMENT_NOT_FOUND"
  }
}
```

**409 Conflict** - Attachment already removed
```json
{
  "error": {
    "message": "Attachment is already removed",
    "code": "ALREADY_REMOVED"
  }
}
```

**500 Internal Server Error** - Server error

---

## Data Type Definitions

### RequestedPriority Enum
- `LOW`
- `MEDIUM`
- `HIGH`

### TicketStatus Enum (Lab 2)
- `NEW`

### ContentType Allowed Values
- `image/jpeg`
- `image/png`
- `image/webp`
- `application/pdf`

## Security and Validation Notes

### Ownership Verification
All endpoints that access or modify ticket or attachment data must verify that the provided `requesterId` matches the ticket owner. This prevents one requester from viewing or modifying another requester's tickets.

### Input Sanitization
- All string inputs are trimmed of leading/trailing whitespace before validation
- Filenames are sanitized to prevent path traversal attacks
- File content types are verified against MIME type, not just file extension

### File Storage
- Files are stored with sanitized, unique filenames (e.g., UUID-based)
- Original filenames are preserved in database for display
- Removed files remain in storage but are marked as removed

### Error Messages
Error messages are safe and do not expose internal implementation details, database structure, or sensitive information. They provide enough information for the client to handle the error appropriately.

## API Testing
All endpoints must have automated tests covering:
- Success cases
- Validation failures
- Ownership checks
- Missing resources (404)
- Edge cases (empty results, boundary values)
- Error handling

## Notes for Implementation

### Pagination Best Practices
- Always validate and sanitize page and pageSize parameters
- Set reasonable defaults (page 1, pageSize 10)
- Return total count for UI pagination controls
- Include hasNextPage and hasPreviousPage for easier navigation

### Search Implementation
- Use case-insensitive matching
- Search across multiple fields (ticketNumber, summary, description)

### File Upload Best Practices
- Validate file type using MIME type detection, not just extension
- Check file size before accepting the upload
- Generate unique storage filenames to prevent collisions
- Store files outside the web root for security

### Transaction Handling
- Ticket creation and initial attachment upload should be separate transactions
- If ticket creation succeeds but attachment upload fails, ticket remains created
- User can retry attachment upload from Ticket Detail screen

### Database Query Optimization
- Use indexes for frequently filtered and sorted fields
- Implement pagination at database level (LIMIT/OFFSET or cursor-based)
- Use SELECT only needed fields, avoid SELECT *
- Consider query result caching for reference data (categories, related systems)
