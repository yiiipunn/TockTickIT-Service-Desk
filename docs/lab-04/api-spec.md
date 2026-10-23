# Lab 4 API Specification

Base path: `/api`. Dates are ISO 8601 UTC strings. React sends `credentials: "include"`. **Existing** means registered in the inspected `server/src/app.ts`; **Proposed** means required for Issues #24–#30 and not implemented by Issue #23.

## 1. Existing Relevant API Baseline

### Authentication/reference

| Method | Endpoint | Access | Status |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Existing |
| POST | `/api/auth/login` | Public | Existing |
| GET | `/api/auth/me` | Authenticated | Existing |
| POST | `/api/auth/change-password` | Authenticated + CSRF | Existing |
| POST | `/api/auth/logout` | Authenticated + CSRF | Existing |
| GET | `/api/categories` | Any unrestricted role | Existing |
| GET | `/api/related-systems` | Any unrestricted role | Existing |

### Ticket/communication/Attachment

| Method | Endpoint | Access | Status |
| --- | --- | --- | --- |
| POST | `/api/tickets` | Requester + CSRF | Existing |
| GET | `/api/tickets` | Requester, own only | Existing |
| GET | `/api/tickets/:id` | Requester, own only | Existing |
| POST | `/api/tickets/:id/attachments` | Requester, own + CSRF | Existing |
| DELETE | `/api/attachments/:attachmentId` | Requester, own + CSRF | Existing soft removal |
| GET | `/api/attachments/:attachmentId` | Owner/Staff/Admin | Existing |
| GET | `/api/attachments/:attachmentId/download` | Owner/Staff/Admin | Existing |
| GET/POST | `/api/tickets/:ticketId/public-comments` | Owner/Staff/Admin; CSRF on POST | Existing |
| GET/POST | `/api/staff/tickets/:ticketId/internal-notes` | Staff/Admin; CSRF on POST | Existing |
| POST | `/api/tickets/:ticketId/resolution-indication` | Requester, own + CSRF | Lab 3 contract only; route is not currently registered and remains required |

### Staff/Admin Ticket and User operations

| Method | Endpoint | Access | Status |
| --- | --- | --- | --- |
| GET | `/api/staff/tickets` | Staff/Admin | Existing |
| GET | `/api/staff/tickets/:ticketId` | Staff/Admin | Existing |
| GET | `/api/staff/eligible-owners` | Staff/Admin | Existing |
| POST | `/api/staff/tickets/:ticketId/claim` | Staff/Admin + CSRF | Existing |
| PATCH | `/api/staff/tickets/:ticketId/owner` | Staff/Admin + CSRF | Existing |
| PATCH | `/api/staff/tickets/:ticketId/it-priority` | Staff/Admin + CSRF | Existing |
| PATCH | `/api/staff/tickets/:ticketId/status` | Staff/Admin + CSRF | Existing |
| GET/POST | `/api/admin/users` | Admin; CSRF on POST | Existing |
| PATCH | `/api/admin/users/:userId` | Admin + CSRF | Existing |
| POST | `/api/admin/users/:userId/initial-password` | Admin + CSRF | Existing |

Retained endpoints keep their current success shapes unless this document explicitly adds versioned workflow fields. Lab 4 does not silently standardize every legacy Lab 2 response.

## 2. Shared Security and Data Shapes

- Existing opaque cookie sessions, active-User validation, mandatory-password-change restriction, Origin check, and `X-CSRF-Token` apply.
- Authentication occurs before resource lookup; role checks occur before role-restricted queries.
- Requester identity, Action creator, performer, lifecycle actor, and audit timestamps come from session/server state, never request fields.
- Missing/inaccessible Requester Ticket or Action uses safe `404`; Staff/Admin role denial uses `403` before protected lookup.
- Unknown fields and repeated/unknown query parameters return `400`.
- New success responses use `{ "data": ... }` or `{ "items": [...], "pagination": ... }`.

### Current Action shape

```json
{
  "id": 41,
  "ticketId": 25,
  "actionAt": "2026-10-24T03:30:00.000Z",
  "description": "Replace the expired wireless profile and verify connectivity.",
  "result": null,
  "status": "PLANNED",
  "assignee": { "id": 8, "name": "Mali Staff", "role": "IT_STAFF", "isActive": true },
  "createdBy": { "id": 7, "name": "Ari Staff", "role": "IT_STAFF" },
  "performedBy": null,
  "followUpRequired": true,
  "followUpNote": "Confirm connection stability the next business day.",
  "attachmentNotes": "See wifi-diagnostics.pdf on the Ticket.",
  "completedAt": null,
  "cancelledAt": null,
  "cancelledBy": null,
  "cancellationReason": null,
  "version": 1,
  "createdAt": "2026-10-23T08:30:00.000Z",
  "updatedAt": "2026-10-23T08:30:00.000Z"
}
```

Requesters receive this current shape. They never receive Action event snapshots/history.

## 3. Proposed Actions Taken API

### 3.1 List Actions

```http
GET /api/tickets/25/actions?page=1&pageSize=20
```

Access: owning Requester, Staff, Administrator.

| Query | Rule |
| --- | --- |
| `page` | Positive integer; default `1`. |
| `pageSize` | `10`, `20`, `50`; default `20`. |

Fixed order: `actionAt desc`, then `id desc`.

```json
200 OK
{
  "items": [{ "id": 41, "ticketId": 25, "actionAt": "2026-10-24T03:30:00.000Z", "description": "Replace the expired wireless profile and verify connectivity.", "result": null, "status": "PLANNED", "assignee": { "id": 8, "name": "Mali Staff", "role": "IT_STAFF", "isActive": true }, "createdBy": { "id": 7, "name": "Ari Staff", "role": "IT_STAFF" }, "performedBy": null, "followUpRequired": true, "followUpNote": "Confirm connection stability the next business day.", "attachmentNotes": "See wifi-diagnostics.pdf on the Ticket.", "completedAt": null, "cancelledAt": null, "cancelledBy": null, "cancellationReason": null, "version": 1, "createdAt": "2026-10-23T08:30:00.000Z", "updatedAt": "2026-10-23T08:30:00.000Z" }],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 }
}
```

Empty is `200` with `items: []`, `totalItems: 0`, `totalPages: 0`.

### 3.2 Get Action detail

```http
GET /api/actions/41
```

Access: owning Requester, Staff, Administrator. Success: `200 {"data": Action}`. Missing/inaccessible: `404 ACTION_NOT_FOUND`.

### 3.3 List Action events

```http
GET /api/staff/actions/41/events
```

Access: Staff, Administrator. No pagination for the seed-scale lab; order `createdAt asc`, then `id asc`.

```json
200 OK
{
  "items": [
    {
      "id": 90,
      "type": "CREATED",
      "actor": { "id": 7, "name": "Ari Staff", "role": "IT_STAFF" },
      "fromStatus": null,
      "toStatus": "PLANNED",
      "fromAssignee": null,
      "toAssignee": { "id": 8, "name": "Mali Staff" },
      "createdAt": "2026-10-23T08:30:00.000Z"
    }
  ]
}
```

Snapshots are server-generated and never include credentials/tokens. Requesters receive `403` without event/existence detail.

### 3.4 Create Action

```http
POST /api/staff/tickets/25/actions
X-CSRF-Token: <session token>
Content-Type: application/json
```

```json
{
  "actionAt": "2026-10-24T03:30:00.000Z",
  "description": "Replace the expired wireless profile and verify connectivity.",
  "result": null,
  "assigneeId": 8,
  "followUpRequired": true,
  "followUpNote": "Confirm connection stability the next business day.",
  "attachmentNotes": "See wifi-diagnostics.pdf on the Ticket."
}
```

Access: Staff, Administrator. Backend sets Ticket, `status=PLANNED`, creator, null performer/completion/cancellation fields, `version=1`, timestamps, and one `CREATED` event. Success: `201 {"data": Action}`.

Creation is allowed when Ticket status is `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`. `RESOLVED`, `CLOSED`, and `CANCELLED` return `409 TICKET_STATE_CONFLICT`.

### 3.5 Edit non-terminal Action

```http
PATCH /api/staff/actions/41
X-CSRF-Token: <session token>
```

```json
{
  "expectedVersion": 1,
  "actionAt": "2026-10-24T04:00:00.000Z",
  "description": "Replace the expired wireless profile and verify connectivity on two networks.",
  "result": "Initial office-network verification succeeded.",
  "followUpRequired": true,
  "followUpNote": "Verify the guest network before completion.",
  "attachmentNotes": null
}
```

Access: Staff, Administrator. All listed fields plus `expectedVersion` are required for replacement of editable content. Only `PLANNED`/`IN_PROGRESS` may change. The transaction writes an `UPDATED` before-change snapshot, increments version, and returns `200 {"data": Action}`.

### 3.6 Reassign Action

```http
PATCH /api/staff/actions/41/assignee
X-CSRF-Token: <session token>
```

```json
{ "expectedVersion": 2, "assigneeId": 9 }
```

Access: Staff, Administrator. Target must be active Staff/Admin; Action must be `PLANNED`/`IN_PROGRESS`. Success increments version, appends `ASSIGNEE_CHANGED`, and returns `200 {"data": Action}`. Invalid target: `400 INELIGIBLE_ASSIGNEE`; stale: `409 ACTION_VERSION_CONFLICT`.

### 3.7 Transition Action status

```http
PATCH /api/staff/actions/41/status
X-CSRF-Token: <session token>
```

Start request:

```json
{ "expectedVersion": 3, "status": "IN_PROGRESS" }
```

Complete request atomically supplies final completion fields:

```json
{
  "expectedVersion": 4,
  "status": "COMPLETED",
  "actionAt": "2026-10-23T09:05:00.000Z",
  "result": "Both wireless networks connected successfully.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "Final diagnostic output is wifi-diagnostics.pdf."
}
```

Cancel request:

```json
{
  "expectedVersion": 4,
  "status": "CANCELLED",
  "confirmed": true,
  "cancellationReason": "Duplicate planned action; work is tracked under Action 40."
}
```

- Current assignee or Admin may start/complete; Staff/Admin may cancel.
- Complete validates non-future `actionAt`, Result, and follow-up rule; server sets `performedBy` and `completedAt`.
- Cancel requires `confirmed=true`, 1–500 reason; server sets cancelling actor/time.
- Success increments version, appends one status event, and returns `200 {"data": Action}`.
- Unlisted/terminal transition is `409 ACTION_STATUS_CONFLICT`; missing confirmation is `400 CONFIRMATION_REQUIRED`.

No Action `DELETE` endpoint exists.

### 3.8 Action validation

| Field | Rule |
| --- | --- |
| `actionAt` | Required valid ISO instant; future allowed until completion; non-future to complete. |
| `description` | Required trimmed string, 1–2000. |
| `result` | Null or trimmed 1–2000 while non-terminal; required 1–2000 to complete. |
| `assigneeId` | Positive integer referencing active Staff/Admin. |
| `followUpRequired` | Boolean only. |
| `followUpNote` | Required trimmed 1–1000 when true; null when false. |
| `attachmentNotes` | Null or trimmed 1–1000. |
| `expectedVersion` | Positive integer for every update. |
| `cancellationReason` | Required trimmed 1–500 on cancellation. |

```json
400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": { "followUpNote": "Enter a follow-up note when follow-up is required." }
  }
}
```

## 4. Proposed Dashboard API

Responses represent one server `asOf` instant, use `Cache-Control: no-store`, contain all keys when zero/empty, and fail as one response if any required calculation fails.

### 4.1 Requester dashboard

```http
GET /api/dashboards/requester
```

Access: Requester. No query parameters.

```json
200 OK
{
  "data": {
    "asOf": "2026-10-23T10:00:00.000Z",
    "timezone": "UTC",
    "metrics": { "openCount": 3, "waitingForRequesterCount": 1 },
    "attentionRequired": [
      { "id": 25, "ticketNumber": "TKT-000025", "summary": "Cannot connect to Wi-Fi", "status": "WAITING_FOR_REQUESTER", "requestedPriority": "MEDIUM", "updatedAt": "2026-10-22T08:40:00.000Z" }
    ],
    "recentlyUpdated": [],
    "recentlyResolved": [
      { "id": 18, "ticketNumber": "TKT-000018", "summary": "VPN profile failed", "status": "RESOLVED", "requestedPriority": "HIGH", "resolvedAt": "2026-10-20T09:12:00.000Z" }
    ],
    "links": {
      "open": "/api/tickets?scope=open&page=1&pageSize=10",
      "waitingForRequester": "/api/tickets?status=WAITING_FOR_REQUESTER&page=1&pageSize=10"
    }
  }
}
```

Calculations are BR-26–BR-30. Every Ticket is owned by the authenticated Requester. Empty returns zero metrics and empty arrays.

### 4.2 Staff/Administrator dashboard

```http
GET /api/dashboards/staff
```

Access: Staff, Administrator. No query parameters.

```json
200 OK
{
  "data": {
    "asOf": "2026-10-23T10:00:00.000Z",
    "timezone": "UTC",
    "metrics": {
      "unassignedOpenCount": 4,
      "myOpenTicketCount": 2,
      "myActiveActionsCount": 1,
      "countsByStatus": { "NEW": 2, "OPEN": 3, "IN_PROGRESS": 1, "WAITING_FOR_REQUESTER": 1, "RESOLVED": 2, "CLOSED": 5, "REOPENED": 1, "CANCELLED": 1 },
      "countsByItPriority": { "LOW": 2, "MEDIUM": 3, "HIGH": 3 }
    },
    "urgentTickets": [],
    "recentlyUpdated": [],
    "myActiveActions": [
      { "id": 41, "ticket": { "id": 25, "ticketNumber": "TKT-000025", "summary": "Cannot connect to Wi-Fi" }, "status": "PLANNED", "actionAt": "2026-10-24T03:30:00.000Z", "description": "Replace the expired wireless profile." }
    ],
    "myRecentCompletedActions": [],
    "links": {
      "unassigned": "/api/staff/tickets?owner=unassigned&scope=open&page=1&pageSize=20",
      "mine": "/api/staff/tickets?owner=me&scope=open&page=1&pageSize=20",
      "urgent": "/api/staff/tickets?itPriority=HIGH&scope=open&page=1&pageSize=20"
    }
  }
}
```

Calculations are BR-26 and BR-31–BR-36. Administrator receives the same shape; “my” uses the Administrator ID. Lists are limited to 10 and include only fields needed for display/drill-down.

## 5. Drill-Down Query Extensions

| Existing endpoint | Proposed query | Rule |
| --- | --- | --- |
| `GET /api/tickets` | `scope=open` | Requester-owned five active/open statuses. |
| `GET /api/staff/tickets` | `scope=open` | Global five active/open statuses. |

`scope=open` with explicit terminal `status` is `400 INVALID_QUERY`. Existing search/filter/sort/pagination rules remain. Queue ordering stays `updatedAt desc`, then `id desc`.

## 6. Ticket Workflow and Resolution API Increment

Existing paths remain but every mutation accepts `expectedVersion`, increments `Ticket.version`, and appends a workflow event atomically.

| Endpoint | Proposed body |
| --- | --- |
| `POST /api/staff/tickets/:ticketId/claim` | `{ "expectedVersion": 4 }` |
| `PATCH /api/staff/tickets/:ticketId/owner` | `{ "expectedVersion": 4, "ownerId": 8 }` or null owner |
| `PATCH /api/staff/tickets/:ticketId/it-priority` | `{ "expectedVersion": 4, "itPriority": "HIGH" }` |
| `PATCH /api/staff/tickets/:ticketId/status` | `{ "expectedVersion": 4, "currentStatus": "IN_PROGRESS", "status": "RESOLVED", "confirmed": false }` |

Resolution checks an active owner, at least one completed Action, and zero planned/in-progress Actions in the same transaction. Success sets `resolvedAt` to server time. Reopen sets `resolvedAt=null` and clears Requester advisory feedback. Close preserves `resolvedAt`.

```json
409 Conflict
{
  "error": {
    "code": "RESOLUTION_GATE_FAILED",
    "message": "The Ticket does not meet the resolution requirements.",
    "fields": {
      "actions": "Complete at least one Action and finish or cancel all remaining active Actions."
    },
    "current": { "ticketId": 25, "status": "IN_PROGRESS", "version": 4 }
  }
}
```

Requester advisory route:

```http
POST /api/tickets/:ticketId/resolution-indication
```

Body `{}`; owning Requester only. It is idempotent on active/open Tickets, returns the unchanged formal status, and conflicts for `RESOLVED`, `CLOSED`, or `CANCELLED`.

## 7. Error and Conflict Convention

```json
{
  "error": {
    "code": "ACTION_VERSION_CONFLICT",
    "message": "The Action changed after it was loaded.",
    "fields": null,
    "current": { "id": 41, "status": "IN_PROGRESS", "assigneeId": 8, "version": 4, "updatedAt": "2026-10-23T09:00:00.000Z" }
  }
}
```

`fields` and `current` are optional; `current` contains only minimum authorized recovery data.

| Status | Codes/use |
| ---: | --- |
| `200` | Retrieval/update/dashboard success. |
| `201` | Action created. |
| `400` | `VALIDATION_ERROR`, `INVALID_QUERY`, `INELIGIBLE_ASSIGNEE`, `INELIGIBLE_OWNER`, `CONFIRMATION_REQUIRED`. |
| `401` | `AUTH_REQUIRED`. |
| `403` | `FORBIDDEN`, `ACCOUNT_INACTIVE`, `PASSWORD_CHANGE_REQUIRED`, `CSRF_INVALID`. |
| `404` | `TICKET_NOT_FOUND`, `ACTION_NOT_FOUND`, safe missing/inaccessible response. |
| `409` | `ACTION_VERSION_CONFLICT`, `ACTION_STATUS_CONFLICT`, `TICKET_VERSION_CONFLICT`, `TICKET_STATE_CONFLICT`, `STATUS_CONFLICT`, `RESOLUTION_GATE_FAILED`, `OWNER_CONFLICT`. |
| `429` | Existing throttle behavior where applicable with `Retry-After`. |
| `500` | `INTERNAL_ERROR`; safe generic operation message, no partial dashboard. |

## 8. Atomicity, Retry, and Safe Failure

- Version/state checks are database update predicates, not only earlier reads.
- Action/Ticket mutation, version increment, and event insertion commit together or roll back together.
- A zero-row compare-and-swap returns `409`, followed by a minimal authorized current-state read.
- Retrying after conflict requires a new explicit request with current version. No automatic merge or silent overwrite.
- Event insert/database failure rolls back the corresponding current-state mutation.
- Logs redact cookies, CSRF/password values, and sensitive content where not operationally required.
- Responses never include hashes, session/CSRF digests, Prisma/SQL detail, stack traces, local paths, stored filenames, or unauthorized audit snapshots.

The role matrices, Action lifecycle, Ticket matrix, dashboard rules, and validation in [`specification.md`](./specification.md) are authoritative when this summary and the detailed contract are read together.
