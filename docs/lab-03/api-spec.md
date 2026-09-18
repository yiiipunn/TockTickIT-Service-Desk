# Lab 3 API Specification

Base path: `/api`. React sends `credentials: "include"`. New APIs use `{ "data": ... }` or `{ "items": [...] }`; retained Lab 2 endpoints keep their existing success shapes.

## 1. Authentication

| Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | No | Public | Validate credentials and create a session. |
| GET | `/api/auth/me` | Yes | Any | Return current safe User and CSRF token. |
| POST | `/api/auth/change-password` | Yes | Any | Change own password and remove first-login restriction. |
| POST | `/api/auth/logout` | Yes | Any | Revoke session and clear cookie. |

### Session rules

- Cookie: `toktickit_session`, opaque 32-byte random value, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` outside local HTTP.
- Database stores only SHA-256 session/CSRF token digests.
- Expiry: 30 minutes idle, eight hours absolute.
- Unsafe requests require configured Origin and `X-CSRF-Token`.
- Passwords use Argon2id: 16-byte salt, 32-byte output, `m=19456 KiB`, `t=2`, `p=1` minimum.
- A password-change-required session may access only `me`, change-password, and logout.

### Authentication payloads

```json
POST /api/auth/login
{ "email": "staff@example.com", "password": "initial password" }
```

```json
200 OK
{
  "data": {
    "user": {
      "id": 7,
      "name": "Ari Staff",
      "email": "staff@example.com",
      "role": "IT_STAFF",
      "isActive": true,
      "mustChangePassword": true
    },
    "csrfToken": "random value"
  }
}
```

```json
POST /api/auth/change-password
{
  "currentPassword": "current value",
  "newPassword": "new value",
  "confirmPassword": "new value"
}
```

Successful password change revokes previous sessions and returns a new cookie/User/CSRF response. Logout returns `204`.

## 2. Requester

All endpoints require role `REQUESTER`; Ticket/Attachment access also requires ownership.

| Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/categories` | Yes | Any | Return Category reference data. |
| GET | `/api/related-systems` | Yes | Any | Return Related System data. |
| POST | `/api/tickets` | Yes | Requester | Create a Ticket for the session User. |
| GET | `/api/tickets` | Yes | Requester | Return authenticated User's Tickets. |
| GET | `/api/tickets/:ticketId` | Yes | Requester | Return owned Requester Ticket Detail. |
| POST | `/api/tickets/:ticketId/attachments` | Yes | Requester | Upload to owned Ticket. |
| DELETE | `/api/attachments/:attachmentId` | Yes | Requester | Soft-remove owned Attachment. |
| GET | `/api/attachments/:attachmentId` | Yes | Owner/Staff/Admin | Return safe Attachment metadata. |
| GET | `/api/attachments/:attachmentId/download` | Yes | Owner/Staff/Admin | Download active Attachment. |
| POST | `/api/tickets/:ticketId/resolution-indication` | Yes | Requester | Record Problem Appears Resolved. |

`GET /api/requesters` is removed. `requesterId` and `X-Requester-Id` never determine identity.

### Create Ticket

```json
{
  "categoryId": 4,
  "relatedSystemId": 2,
  "summary": "Cannot connect to Wi-Fi",
  "requestedPriority": "MEDIUM",
  "description": "Connection fails after login."
}
```

Backend sets `requesterId`, Ticket Number, `status=NEW`, `ownerId=null`, and `itPriority=requestedPriority`. Success is `201` with the existing bare Ticket shape plus Lab 3 fields.

### My Tickets query

| Parameter | Allowed values |
| --- | --- |
| `search` | Ticket Number or summary |
| `categoryId`, `relatedSystemId` | Valid positive IDs |
| `requestedPriority` | `LOW`, `MEDIUM`, `HIGH` |
| `status` | Any Lab 3 Ticket status |
| `sortBy` | `createdAt`, `updatedAt`, `ticketNumber` |
| `sortOrder` | `asc`, `desc` |
| `pageSize` | `10`, `20`, `50` |

Defaults: page 1, size 10, `updatedAt desc`, then `id desc`. Response remains `{items,pagination}`.

| Response | Fields |
| --- | --- |
| Ticket list item | `id`, `ticketNumber`, `summary`, `requestedPriority`, `itPriority`, `status`, `owner`, `category`, `relatedSystem`, `createdAt`, `updatedAt` |
| Requester Ticket Detail | List fields plus `requesterId`, `description`, `requesterResolutionIndicatedAt`, and safe `attachments` |
| Pagination | `page`, `pageSize`, `totalItems`, `totalPages` |

### Attachment rules

| Rule | Value |
| --- | --- |
| Types | JPG/JPEG, PNG, WEBP, PDF with content validation |
| Size | Maximum 5 MB each |
| Active count | Maximum five per Ticket |
| Removal reason | Trimmed 1–250 characters |
| Storage | Backend-generated filename; never returned |
| Removal | Soft removal; removed files cannot download |

Upload uses multipart field `file`. Removal body is `{ "reason": "trimmed reason" }`. Attachment metadata includes `id`, `ticketId`, original filename, MIME type, byte size, removal state/reason/time, and timestamps; it excludes the stored filename.

Resolution indication uses an empty body. It returns the Ticket ID, existing/new indication time, and unchanged status. It is idempotent for active Tickets and returns `409` for Resolved, Closed, or Cancelled.

> **Implementation status:** This is an approved Lab 3 contract requirement, but the current server does not yet expose this endpoint. It remains open with the matching Requester UI and API/integration coverage; it must not be represented as completed by the release evidence.

## 3. IT Staff

All endpoints require `IT_STAFF` or `ADMINISTRATOR`.

| Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/staff/tickets` | Yes | Staff/Admin | Retrieve Ticket Queue. |
| GET | `/api/staff/tickets/:ticketId` | Yes | Staff/Admin | Retrieve operational Ticket Detail. |
| GET | `/api/staff/eligible-owners` | Yes | Staff/Admin | List active Staff/Admin owners. |
| POST | `/api/staff/tickets/:ticketId/claim` | Yes | Staff/Admin | Claim an unassigned Ticket. |
| PATCH | `/api/staff/tickets/:ticketId/owner` | Yes | Staff/Admin | Assign, reassign, or unassign. |
| PATCH | `/api/staff/tickets/:ticketId/it-priority` | Yes | Staff/Admin | Update IT Priority. |
| PATCH | `/api/staff/tickets/:ticketId/status` | Yes | Staff/Admin | Perform permitted status transition. |

### Queue query

| Parameter | Allowed values |
| --- | --- |
| `search` | Ticket Number, summary, Requester name/email; max 120 |
| `status` | One Ticket status |
| `requestedPriority`, `itPriority` | `LOW`, `MEDIUM`, `HIGH` |
| `owner` | `me`, `unassigned`, or eligible User ID |
| `sortBy` | `updatedAt`, `createdAt`, `ticketNumber`, `status`, `requestedPriority`, `itPriority` |
| `sortOrder` | `asc`, `desc` |
| `pageSize` | `10`, `20`, `50` |

Defaults: page 1, size 20, `updatedAt desc`, then `id desc`.

```json
{
  "items": [{
    "id": 25,
    "ticketNumber": "TKT-000025",
    "summary": "Cannot connect to Wi-Fi",
    "requester": { "id": 3, "name": "Narin S.", "email": "narin@example.com" },
    "status": "OPEN",
    "requestedPriority": "MEDIUM",
    "itPriority": "HIGH",
    "owner": { "id": 7, "name": "Ari Staff" },
    "updatedAt": "2026-09-11T03:15:00.000Z"
  }],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 },
  "counts": { "matching": 1, "matchingUnassigned": 0 }
}
```

### Mutation payloads

| Endpoint | Body | Success |
| --- | --- | --- |
| Claim | `{}` | `200` owner and assignment time; `409` if already owned |
| Owner | `{ "ownerId": 8 }` or `{ "ownerId": null }` | `200` owner and assignment time |
| IT Priority | `{ "itPriority": "HIGH" }` | `200` both priorities and updated time |
| Status | `{ "currentStatus": "RESOLVED", "status": "CLOSED", "confirmed": true }` | `200` new status and updated time |

Status validation follows [`specification.md`](./specification.md). Stale/unlisted transitions return `409`; missing close/cancel confirmation returns `400`.

Operational Ticket Detail returns `{data}` containing Ticket fields, Requester, Category, Related System, owner, both priorities, status, resolution indication, timestamps, Attachments, Public Comments, Internal Notes, and `allowedTransitions`.

## 4. Comments / Notes

| Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/tickets/:ticketId/public-comments` | Yes | Owner/Staff/Admin | List Public Comments oldest first. |
| POST | `/api/tickets/:ticketId/public-comments` | Yes | Owner/Staff/Admin | Append Public Comment. |
| GET | `/api/staff/tickets/:ticketId/internal-notes` | Yes | Staff/Admin | List Internal Notes oldest first. |
| POST | `/api/staff/tickets/:ticketId/internal-notes` | Yes | Staff/Admin | Append Internal Note. |

Create body:

```json
{ "content": "Trimmed plain text from 1 to 2000 characters." }
```

Success: `201 {data:{id,ticketId,content,author:{id,name,role},createdAt}}`. List: `200 {items:[...]}`. Author/time come from the backend. No edit/delete endpoints exist.

## 5. Administrator

All endpoints require `ADMINISTRATOR`.

| Method | Endpoint | Auth | Role | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/users` | Yes | Administrator | List/search/role-filter Users. |
| POST | `/api/admin/users` | Yes | Administrator | Create one User. |
| PATCH | `/api/admin/users/:userId` | Yes | Administrator | Edit basic account fields. |
| POST | `/api/admin/users/:userId/initial-password` | Yes | Administrator | Set new initial password. |

List query supports `search` across name/email and one `role`. Results order by normalized name then ID. Pagination/sort/advanced filters are rejected.

User list returns `{items: SafeUser[]}`. `SafeUser` contains only `id`, `name`, `email`, `role`, `isActive`, `mustChangePassword`, `createdAt`, and `updatedAt`.

### User payloads

```json
POST /api/admin/users
{
  "name": "Mali Requester",
  "email": "mali@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "initialPassword": "local initial value"
}
```

```json
PATCH /api/admin/users/9
{ "name": "Mali R.", "role": "IT_STAFF", "isActive": true }
```

```json
POST /api/admin/users/9/initial-password
{ "initialPassword": "new local initial value" }
```

- Create returns `201 {data:SafeUser}` with `mustChangePassword=true`.
- Edit returns `200 {data:SafeUser}`.
- Password reset returns `200 {data:{userId,mustChangePassword:true}}`.
- Plaintext passwords/hashes are never returned.
- Duplicate email, self-deactivation, and last-active-Administrator conflicts return `409`.
- Deactivation revokes sessions; deactivation/change to Requester unassigns operational Tickets.

## 6. Common Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Successful retrieval/update/login. |
| `201` | Resource created. |
| `204` | Logout complete. |
| `400` | Invalid input/query or missing confirmation. |
| `401` | Unauthenticated or invalid credentials. |
| `403` | Forbidden, inactive, CSRF failure, or password change required. |
| `404` | Protected resource unavailable/not found. |
| `409` | Duplicate/state/ownership/Administrator safety conflict. |
| `413` | Attachment too large. |
| `415` | Unsupported Attachment type. |
| `429` | Login temporarily throttled. |
| `500` | Safe unexpected server failure. |

| Code | Status | Use |
| --- | ---: | --- |
| `VALIDATION_ERROR`, `INVALID_QUERY`, `CONFIRMATION_REQUIRED` | `400` | Invalid body/query/confirmation. |
| `INVALID_CREDENTIALS`, `AUTH_REQUIRED` | `401` | Login or missing/expired session. |
| `ACCOUNT_INACTIVE`, `PASSWORD_CHANGE_REQUIRED`, `FORBIDDEN`, `CSRF_INVALID` | `403` | Authenticated access is not permitted. |
| `TICKET_NOT_FOUND`, `ATTACHMENT_NOT_FOUND`, `USER_NOT_FOUND` | `404` | Safe unavailable resource. |
| `DUPLICATE_EMAIL`, `OWNER_CONFLICT`, `STATUS_CONFLICT`, `SELF_DEACTIVATION`, `LAST_ACTIVE_ADMIN` | `409` | State conflict. |
| `LOGIN_THROTTLED` | `429` | Temporary login throttle; include `Retry-After`. |
| `INTERNAL_ERROR` | `500` | Generic operation failure. |

Error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

`fields` is optional.

## 7. Authorization and Safe Errors

- Authentication runs before protected resource lookup; role checks run before restricted queries.
- Requester ownership is included in the database query.
- Missing and inaccessible Requester Tickets/Attachments use the same `404`.
- Requesters receive `403` for Internal Notes without note/Ticket existence details.
- Unknown JSON fields and client-supplied identity fields are rejected.
- Errors never expose passwords, hashes, tokens, SQL, stack traces, paths, or protected data.

## 8. Validation

| Field | Rule |
| --- | --- |
| Email | Trim/lowercase, valid, max 254, unique case-insensitively. |
| User name | Trimmed 1–100. |
| Password | 12–128, not all whitespace, new differs from current. |
| Role | One of `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`. |
| Priority | One of `LOW`, `MEDIUM`, `HIGH`. |
| Comment/note | Trimmed plain text 1–2000. |
| Ticket summary/description | Lab 2 limits: 1–120 / 1–2000. |
| IDs | Positive integers referencing permitted records. |
| Dates | ISO 8601 UTC responses. |

Exact business and transition rules remain authoritative in [`specification.md`](./specification.md).
