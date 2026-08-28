# Lab 2 API Specification

**Project:** TokTickIT Service Desk  
**Lab:** Lab 2 — Requester Ticketing MVP with UI Foundation  
**Base Path:** `/api`  
**Status:** Draft  
**Last Updated:** 2026-08-28

---

## 1. Purpose

This document defines the REST API contract for the Lab 2 Requester Ticketing MVP.

The API supports:

- Development Requester selection
- Category retrieval
- Related System retrieval
- Ticket creation
- My Tickets
- Ticket Detail
- Attachment upload
- Attachment metadata
- Attachment download
- Attachment soft removal

The API must enforce Requester ownership on the backend.

The Development Requester mechanism is temporary and is used only for development and testing in Lab 2. It is not authentication.

---

## 2. General Conventions

### 2.1 Base URL

All Lab 2 API endpoints use:

```text
/api
```

Example:

```text
GET /api/tickets
```

### 2.2 Content Types

Standard request and response bodies use:

```text
application/json
```

Attachment upload requests use:

```text
multipart/form-data
```

### 2.3 Requester Context

Requester-scoped endpoints require the selected Development Requester ID in the following request header:

```http
X-Requester-Id: 3
```

The backend must verify that:

- The header is present when required.
- The value represents a valid Requester identifier.
- The Development Requester exists.
- The Development Requester is active.

`X-Requester-Id` is a temporary Lab 2 development mechanism and must not be treated as authentication.

### 2.4 Standard Success Response

Success response structures may differ by endpoint, but should use predictable JSON.

Example:

```json
{
  "data": {
    "id": 1
  }
}
```

For collection endpoints:

```json
{
  "data": []
}
```

### 2.5 Standard Error Response

Errors should use a predictable JSON structure.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data."
  }
}
```

Field-level validation may include details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": {
      "summary": "Ticket Summary is required."
    }
  }
}
```

Error responses must not expose:

- Stack traces
- SQL statements
- Database connection details
- Server filesystem paths
- Internal exception details

---

# 3. HTTP Status Codes

The API will use the following status codes where appropriate.

| Status | Meaning | Usage |
|---:|---|---|
| `200 OK` | Successful request | Retrieval and successful non-creation operations |
| `201 Created` | Resource created | Ticket and Attachment creation |
| `400 Bad Request` | Invalid request | Validation, invalid query parameters, invalid Requester context |
| `404 Not Found` | Resource unavailable | Missing or inaccessible Ticket/Attachment |
| `409 Conflict` | State conflict | Example: active Attachment limit exceeded |
| `413 Payload Too Large` | File too large | Attachment exceeds 5 MB |
| `415 Unsupported Media Type` | Invalid file type | Unsupported Attachment format |
| `500 Internal Server Error` | Unexpected server failure | Unhandled backend failure |

---

# 4. Development Requesters

## 4.1 Get Active Development Requesters

```http
GET /api/requesters
```

Returns all active Development Requesters available in the Lab 2 selector.

### Request Headers

No Requester context is required.

### Query Parameters

None.

### Success Response

```text
200 OK
```

Example:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Narin S.",
      "email": "narin@example.com"
    },
    {
      "id": 2,
      "name": "Ploy K.",
      "email": "ploy@example.com"
    }
  ]
}
```

### Rules

- Only active Development Requesters are returned.
- Inactive Development Requesters must not appear.
- Results should use a predictable default ordering.

### Empty Result

If no active Development Requesters exist:

```json
{
  "data": []
}
```

### Failure

```text
500 Internal Server Error
```

Example:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unable to load Development Requesters."
  }
}
```

---

# 5. Categories

## 5.1 Get Categories

```http
GET /api/categories
```

Returns available Ticket Categories.

### Request Headers

No Requester context is required.

### Query Parameters

None.

### Success Response

```text
200 OK
```

Example:

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

### Required Seed Values

The database contains the following required Categories:

1. Account and Access
2. Hardware
3. Software
4. Network

---

# 6. Related Systems

## 6.1 Get Related Systems

```http
GET /api/related-systems
```

Returns available Related Systems.

### Request Headers

No Requester context is required.

### Query Parameters

None.

### Success Response

```text
200 OK
```

Example:

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
    }
  ]
}
```

The seeded database must contain at least six realistic Related Systems.

---

# 7. Tickets

## 7.1 Create Ticket

```http
POST /api/tickets
```

Creates a new Ticket for the currently selected Development Requester.

### Request Headers

```http
Content-Type: application/json
X-Requester-Id: <requesterId>
```

### Request Body

```json
{
  "categoryId": 4,
  "relatedSystemId": 2,
  "summary": "Cannot connect to Campus Wi-Fi",
  "requestedPriority": "MEDIUM",
  "description": "The connection fails after entering my university credentials."
}
```

### Fields

| Field | Type | Required | Validation |
|---|---|---:|---|
| `categoryId` | Integer | Yes | Must reference a valid Category |
| `relatedSystemId` | Integer | Yes | Must reference a valid Related System |
| `summary` | String | Yes | Trimmed, 1–120 characters |
| `requestedPriority` | Enum | Yes | `LOW`, `MEDIUM`, or `HIGH` |
| `description` | String | Yes | Trimmed, 1–2000 characters |

### Backend-Generated Values

The client must not provide:

- Ticket Number
- Ticket Status
- Ticket ownership
- Created timestamp

The backend determines these values.

### Initial Status

Every newly created Ticket must have:

```text
NEW
```

The UI may display the value as:

```text
New
```

### Success Response

```text
201 Created
```

Example:

```json
{
  "data": {
    "id": 25,
    "ticketNumber": "TK-2026-000025",
    "status": "NEW",
    "createdAt": "2026-08-28T10:30:00.000Z"
  }
}
```

The exact Ticket Number format may change during implementation, but it must remain:

- Unique
- Backend-generated
- Read-only to the Requester

### Validation Failure

```text
400 Bad Request
```

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": {
      "summary": "Ticket Summary is required."
    }
  }
}
```

### Missing Requester Context

```text
400 Bad Request
```

Example:

```json
{
  "error": {
    "code": "REQUESTER_REQUIRED",
    "message": "A Development Requester must be selected."
  }
}
```

### Invalid Requester

```text
400 Bad Request
```

Example:

```json
{
  "error": {
    "code": "INVALID_REQUESTER",
    "message": "The selected Development Requester is unavailable."
  }
}
```

---

# 8. My Tickets

## 8.1 Get Requester's Tickets

```http
GET /api/tickets
```

Returns only Tickets owned by the currently selected Development Requester.

### Request Headers

```http
X-Requester-Id: <requesterId>
```

### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `search` | String | No | Search Ticket Number and Ticket Summary |
| `categoryId` | Integer | No | Filter by Category |
| `relatedSystemId` | Integer | No | Filter by Related System |
| `priority` | Enum | No | Filter by Requested Priority |
| `status` | Enum | No | Filter by Current Status |
| `sort` | String | No | Select sort field |
| `order` | String | No | `asc` or `desc` |
| `page` | Integer | No | Result page, minimum 1 |
| `pageSize` | Integer | No | `10`, `20`, or `50` |

### Example Request

```http
GET /api/tickets?search=laptop&categoryId=2&sort=updatedAt&order=desc&page=1&pageSize=10
X-Requester-Id: 3
```

### Searchable Fields

Search applies to:

- Ticket Number
- Ticket Summary

Search should operate only within Tickets owned by the current Development Requester.

### Supported Filters

#### `categoryId`

Example:

```text
categoryId=2
```

#### `relatedSystemId`

Example:

```text
relatedSystemId=6
```

#### `priority`

Allowed values:

```text
LOW
MEDIUM
HIGH
```

#### `status`

For Lab 2, created Tickets initially use:

```text
NEW
```

The API structure may support future status values, but Lab 2 must not implement additional Requester lifecycle functionality outside scope.

### Sorting

Supported values for `sort`:

```text
createdAt
updatedAt
ticketNumber
```

Supported values for `order`:

```text
asc
desc
```

Default:

```text
sort=updatedAt
order=desc
```

A deterministic secondary sort uses:

```text
id DESC
```

### Pagination

Defaults:

```text
page=1
pageSize=10
```

Allowed page sizes:

```text
10
20
50
```

### Success Response

```text
200 OK
```

Example:

```json
{
  "data": [
    {
      "id": 25,
      "ticketNumber": "TK-2026-000025",
      "summary": "Cannot connect to Campus Wi-Fi",
      "category": {
        "id": 4,
        "name": "Network"
      },
      "relatedSystem": {
        "id": 2,
        "name": "Campus Wi-Fi"
      },
      "requestedPriority": "MEDIUM",
      "status": "NEW",
      "createdAt": "2026-08-28T10:30:00.000Z",
      "updatedAt": "2026-08-28T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### Empty Result

If the Requester owns no Tickets:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

The frontend determines whether this represents:

- An empty Ticket list
- A search/filter no-results state

based on the active query.

### Invalid Query Parameter

Example:

```http
GET /api/tickets?page=0
```

Response:

```text
400 Bad Request
```

Example:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Invalid pagination parameters."
  }
}
```

---

# 9. Ticket Detail

## 9.1 Get Owned Ticket

```http
GET /api/tickets/:id
```

Returns one Ticket only if it belongs to the currently selected Development Requester.

### Request Headers

```http
X-Requester-Id: <requesterId>
```

### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | Integer | Internal Ticket ID |

### Success Response

```text
200 OK
```

Example:

```json
{
  "data": {
    "id": 25,
    "ticketNumber": "TK-2026-000025",
    "summary": "Cannot connect to Campus Wi-Fi",
    "description": "The connection fails after entering my university credentials.",
    "requestedPriority": "MEDIUM",
    "status": "NEW",
    "requester": {
      "id": 3,
      "name": "Narin S."
    },
    "category": {
      "id": 4,
      "name": "Network"
    },
    "relatedSystem": {
      "id": 2,
      "name": "Campus Wi-Fi"
    },
    "createdAt": "2026-08-28T10:30:00.000Z",
    "updatedAt": "2026-08-28T10:30:00.000Z",
    "attachments": []
  }
}
```

### Missing Ticket

```text
404 Not Found
```

### Cross-Requester Access

If Requester B requests a Ticket belonging to Requester A:

```text
404 Not Found
```

The API must not return Ticket data.

Example:

```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket not found."
  }
}
```

The same public response is used for missing and inaccessible Tickets.

---

# 10. Attachments

Attachment rules are fixed for Lab 2:

| Rule | Value |
|---|---|
| Allowed types | JPG/JPEG, PNG, WEBP, PDF |
| Maximum file size | 5 MB |
| Maximum active Attachments | 5 per Ticket |
| Removal | Soft removal |

Removed Attachments retain metadata but cannot be downloaded or previewed.

---

## 10.1 Upload Attachment

```http
POST /api/tickets/:id/attachments
```

Uploads a file to an owned Ticket.

### Request Headers

```http
X-Requester-Id: <requesterId>
Content-Type: multipart/form-data
```

### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | Integer | Internal Ticket ID |

### Form Data

| Field | Type | Required |
|---|---|---:|
| `file` | File | Yes |

### Allowed MIME Types

Expected supported file formats include:

```text
image/jpeg
image/png
image/webp
application/pdf
```

The backend must validate the file rather than relying only on the filename extension.

### File Size

Maximum:

```text
5 MB
```

### Active Attachment Limit

A Ticket may contain no more than:

```text
5 active Attachments
```

Soft-removed Attachments do not count toward the active Attachment limit.

### Success Response

```text
201 Created
```

Example:

```json
{
  "data": {
    "id": 15,
    "ticketId": 25,
    "originalFilename": "wifi-error.png",
    "mimeType": "image/png",
    "sizeBytes": 245810,
    "isRemoved": false,
    "createdAt": "2026-08-28T10:35:00.000Z"
  }
}
```

### Unsupported Type

```text
415 Unsupported Media Type
```

Example:

```json
{
  "error": {
    "code": "UNSUPPORTED_ATTACHMENT_TYPE",
    "message": "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed."
  }
}
```

### Oversized File

```text
413 Payload Too Large
```

Example:

```json
{
  "error": {
    "code": "ATTACHMENT_TOO_LARGE",
    "message": "The attachment must not exceed 5 MB."
  }
}
```

### Active Attachment Limit Reached

```text
409 Conflict
```

Example:

```json
{
  "error": {
    "code": "ATTACHMENT_LIMIT_REACHED",
    "message": "This ticket already has the maximum of 5 active attachments."
  }
}
```

### Ticket Ownership Failure

```text
404 Not Found
```

No information about another Requester's Ticket must be returned.

---

## 10.2 Get Attachment Metadata

```http
GET /api/attachments/:id
```

Returns Attachment metadata when the Attachment belongs to a Ticket owned by the current Development Requester.

### Request Headers

```http
X-Requester-Id: <requesterId>
```

### Success Response

```text
200 OK
```

Example active Attachment:

```json
{
  "data": {
    "id": 15,
    "ticketId": 25,
    "originalFilename": "wifi-error.png",
    "mimeType": "image/png",
    "sizeBytes": 245810,
    "isRemoved": false,
    "removedAt": null,
    "removalReason": null,
    "createdAt": "2026-08-28T10:35:00.000Z"
  }
}
```

Example removed Attachment:

```json
{
  "data": {
    "id": 15,
    "ticketId": 25,
    "originalFilename": "wifi-error.png",
    "mimeType": "image/png",
    "sizeBytes": 245810,
    "isRemoved": true,
    "removedAt": "2026-08-28T11:00:00.000Z",
    "removalReason": "Uploaded the wrong file",
    "createdAt": "2026-08-28T10:35:00.000Z"
  }
}
```

---

## 10.3 Download Active Attachment

```http
GET /api/attachments/:id/download
```

Downloads an active Attachment when it belongs to an owned Ticket.

### Request Headers

```http
X-Requester-Id: <requesterId>
```

### Success

```text
200 OK
```

The response returns the file content with an appropriate content type and safe filename.

### Removed Attachment

A removed Attachment must not be downloadable.

Response:

```text
404 Not Found
```

### Ownership Failure

If the Attachment belongs to another Requester's Ticket:

```text
404 Not Found
```

The API must not expose Attachment file content or metadata belonging to another Requester.

---

## 10.4 Soft-Remove Attachment

```http
DELETE /api/attachments/:id
```

Soft-removes an Attachment.

The database record and required Attachment metadata remain stored.

### Request Headers

```http
Content-Type: application/json
X-Requester-Id: <requesterId>
```

### Request Body

```json
{
  "reason": "Uploaded the wrong file"
}
```

### Removal Reason Validation

| Rule | Value |
|---|---|
| Required | Yes |
| Trim whitespace | Yes |
| Minimum length | 1 character |
| Maximum length | 250 characters |

### Success Response

```text
200 OK
```

Example:

```json
{
  "data": {
    "id": 15,
    "isRemoved": true,
    "removedAt": "2026-08-28T11:00:00.000Z",
    "removalReason": "Uploaded the wrong file"
  }
}
```

### Invalid Reason

```text
400 Bad Request
```

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A valid removal reason is required.",
    "fields": {
      "reason": "Removal reason is required."
    }
  }
}
```

### Already Removed

An attempt to remove an already removed Attachment should return a predictable conflict response.

```text
409 Conflict
```

Example:

```json
{
  "error": {
    "code": "ATTACHMENT_ALREADY_REMOVED",
    "message": "This attachment has already been removed."
  }
}
```

### Ownership Failure

```text
404 Not Found
```

---

# 11. Ticket Creation and Attachment Failure Behavior

Ticket creation and Attachment upload are separate operations.

Expected workflow:

```text
Create Ticket
     ↓
Ticket Created Successfully
     ↓
Receive Ticket ID + Official Ticket Number
     ↓
Upload Attachment(s)
```

If Ticket creation fails:

- No Ticket is created.
- Attachment upload does not begin.

If Ticket creation succeeds but Attachment upload fails:

- The Ticket remains created.
- Successfully uploaded Attachments remain associated with the Ticket.
- Failed files are reported to the Requester.
- The Requester may retry the Attachment upload from Ticket Detail.

The backend must not remove the successfully created Ticket solely because a later Attachment upload fails.

---

# 12. Ownership Rules

Ownership must be enforced on the backend.

The current Development Requester may only:

- List their own Tickets.
- View their own Ticket Detail.
- Upload Attachments to their own Tickets.
- View metadata of Attachments on their own Tickets.
- Download active Attachments from their own Tickets.
- Soft-remove Attachments from their own Tickets.

Example:

```text
Requester A owns Ticket 10
Requester B requests GET /api/tickets/10
```

Expected:

```text
404 Not Found
```

No Ticket data is returned.

Frontend filtering is not considered ownership enforcement.

---

# 13. Validation Rules Summary

## 13.1 Ticket

| Field | Required | Validation |
|---|---:|---|
| `categoryId` | Yes | Valid Category |
| `relatedSystemId` | Yes | Valid Related System |
| `summary` | Yes | Trimmed, 1–120 chars |
| `requestedPriority` | Yes | `LOW`, `MEDIUM`, `HIGH` |
| `description` | Yes | Trimmed, 1–2000 chars |

## 13.2 Attachment

| Field | Rule |
|---|---|
| File type | JPG/JPEG, PNG, WEBP, PDF |
| File size | Maximum 5 MB |
| Active count | Maximum 5 per Ticket |
| Removal reason | Trimmed, 1–250 chars |

## 13.3 Pagination

| Parameter | Rule |
|---|---|
| `page` | Integer ≥ 1 |
| `pageSize` | `10`, `20`, or `50` |

## 13.4 Sorting

| Parameter | Allowed Values |
|---|---|
| `sort` | `createdAt`, `updatedAt`, `ticketNumber` |
| `order` | `asc`, `desc` |

Invalid values return:

```text
400 Bad Request
```

---

# 14. Loading, Empty, and Failure Behavior

The API must provide enough information for the frontend to represent the required UI states.

### Development Requesters

Possible frontend states:

- Loading
- Ready
- Empty
- Failure

### My Tickets

Possible frontend states:

- Loading
- Results
- Empty
- No Results
- Failure

### Ticket Detail

Possible frontend states:

- Loading
- Loaded
- Missing / inaccessible
- Failure

### Attachments

Possible frontend states:

- Active
- Uploading
- Removed
- Invalid
- Unavailable
- Failure

---

# 15. API Security and Lab 2 Scope

Lab 2 does not implement real authentication or authorization.

`X-Requester-Id` exists only to simulate Requester context during development.

The backend must still enforce data ownership according to the selected Development Requester.

The following are out of scope:

- Login
- Logout
- Password handling
- Session management
- Tokens
- Production authentication
- IT Staff API workflows
- Admin APIs
- Ticket lifecycle transitions beyond the initial `New` state
- Internal Notes
- Public Comments
- Actions Taken

---

# 16. API Test Mapping

The API implementation must be covered by the Lab 2 automated tests.

Expected API/integration test files include:

```text
server/tests/
├── create-ticket.api.test.ts
├── my-tickets.api.test.ts
├── ticket-detail.api.test.ts
└── attachments.api.test.ts
```

Coverage should include:

### Create Ticket

- Successful Ticket creation
- Official Ticket Number generation
- Initial `NEW` status
- Missing required fields
- Invalid Category
- Invalid Related System
- Invalid priority
- Summary boundaries
- Description boundaries
- Requester ownership
- Backend failure behavior

### My Tickets

- Own Tickets only
- Multi-Requester isolation
- Search
- Filters
- Sorting
- Default sorting
- Secondary deterministic sorting
- Pagination
- Invalid pagination
- Empty result

### Ticket Detail

- Owned Ticket retrieval
- Missing Ticket
- Cross-Requester access
- Correct related data
- Attachment metadata

### Attachments

- Valid upload
- Supported image types
- PDF upload
- Unsupported type
- 5 MB boundary
- Oversized file
- Maximum 5 active Attachments
- Ownership checks
- Active download
- Soft removal
- Removal reason validation
- Removed Attachment download blocked
- Already removed behavior

---

# 17. Implementation Decisions

The following API choices are Lab 2 design decisions and must remain consistent with `specification.md` and the implementation.

| ID | Decision |
|---|---|
| API-DEC-01 | Requester context uses `X-Requester-Id`. |
| API-DEC-02 | Summary length is 1–120 trimmed characters. |
| API-DEC-03 | Description length is 1–2000 trimmed characters. |
| API-DEC-04 | Requested Priority values are `LOW`, `MEDIUM`, and `HIGH`. |
| API-DEC-05 | Search covers Ticket Number and Ticket Summary. |
| API-DEC-06 | Default sort is `updatedAt DESC`. |
| API-DEC-07 | Internal Ticket ID descending is the deterministic secondary sort. |
| API-DEC-08 | Default page size is 10. |
| API-DEC-09 | Supported page sizes are 10, 20, and 50. |
| API-DEC-10 | Missing and cross-Requester resources use the same `404` response. |
| API-DEC-11 | Removal reason is 1–250 trimmed characters. |
| API-DEC-12 | Ticket creation and Attachment upload are separate operations. |

---

# 18. Change Control

If the implementation requires changing an API rule defined in this document:

1. Update `api-spec.md`.
2. Update the corresponding rule in `specification.md`.
3. Update affected Acceptance Criteria if necessary.
4. Update planned tests in `tests.md`.
5. Implement the change.
6. Run affected automated tests.
7. Record significant AI-assisted decisions in `ai-use.md` where appropriate.

The final implementation, API specification, Acceptance Criteria, and tests must remain consistent.