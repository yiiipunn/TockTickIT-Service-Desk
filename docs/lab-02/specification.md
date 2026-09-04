# Lab 2 Sprint Engineering Specification

> **Project:** TokTickIT Service Desk  
> **Lab:** Lab 2 : Requester Ticketing MVP with UI Foundation  
> **Status:** Done  
> **Last Updated:** 2026-08-28

---

## 1. Sprint Goal

The goal of Lab 2 is to build a Requester-facing MVP for TokTickIT. A Development Requester can create a support ticket, attach supporting files, receive an official Ticket Number, view and search their own tickets, open ticket details, and manage their own attachments. The application will also establish a reusable Zen Green UI foundation with responsive behavior for desktop, tablet, and mobile devices.

---

## 2. Stakeholder Request Interpretation

The stakeholder needs a professional and responsive Requester experience for submitting and tracking support requests. A Requester should be able to describe a problem, select the relevant Category, Related System, and Requested Priority, attach supporting evidence, and submit the request.

After submission, the backend must generate a unique official Ticket Number. The Requester must then be able to view only their own tickets through My Tickets, use search, filters, sorting, and pagination, open a Ticket Detail page, and manage permitted attachments.

Because real authentication will be introduced in Lab 3, Lab 2 will use a temporary Development Requester Selection screen to simulate different Requesters. This mechanism is for development and testing only and must not be treated as authentication.

---

## 3. Scope

### 3.1 Included

- Development Requester selection for testing
- Display and switching of the current Development Requester
- Create Ticket workflow
- Backend-generated unique Ticket Number
- Initial Ticket status of `New`
- Category and Related System reference data
- Requested Priority selection
- Attachment upload during the Requester workflow
- My Tickets page
- Requester-specific Ticket listing
- Ticket search
- Ticket filtering
- Ticket sorting
- Ticket pagination
- Requester Ticket Detail page
- Attachment metadata display
- Adding Attachments to an existing Ticket
- Downloading active Attachments
- Soft-removing owned Attachments
- Requester ownership protection
- Loading, validation, empty, no-results, and failure states
- Zen Green UI conventions
- Responsive desktop, tablet, and mobile layouts
- Accessibility considerations
- Automated and End-to-End testing

### 3.2 Excluded

The following features are outside the scope of Lab 2:

- Real authentication and authorization
- Login, logout, passwords, or sessions
- Production identity management
- IT Staff workflow
- Public Comments
- Internal Notes
- Actions Taken
- Ticket lifecycle management beyond the initial `New` status
- IT Priority management
- Administrative functionality
---

## 4. Functional Requirements

### 4.1 Development Requester

| ID | Functional Requirement |
|---|---|
| FR-01 | The system shall retrieve active Development Requesters from PostgreSQL and display them on the Development Requester Selection screen. |
| FR-02 | The user shall be able to select an active Development Requester before accessing Requester-specific workflows. |
| FR-03 | The system shall display the currently selected Development Requester in the application shell. |
| FR-04 | The user shall be able to change the selected Development Requester. |
| FR-05 | When the Development Requester changes, the system shall reload Requester-specific data for the newly selected Requester. |
| FR-06 | The Development Requester Selection screen shall handle loading, empty, and API failure states. |

### 4.2 Create Ticket

| ID | Functional Requirement |
|---|---|
| FR-07 | The selected Development Requester shall be able to open the Create Ticket page. |
| FR-08 | The system shall retrieve available Categories and Related Systems from the backend. |
| FR-09 | The Create Ticket form shall provide Category, Related System, Ticket Summary, Requested Priority, Description, and Attachment inputs. |
| FR-10 | The Create Ticket page shall display appropriate read-only information, including Requester information. |
| FR-11 | The system shall validate Ticket input before accepting a submission. |
| FR-12 | The backend shall create a Ticket associated with the selected Development Requester. |
| FR-13 | The backend shall generate a unique official Ticket Number for every successfully created Ticket. |
| FR-14 | The system shall assign the initial Current Status `New` to every newly created Ticket. |
| FR-15 | After successful creation, the system shall display the generated Ticket Number and an appropriate next action. |
| FR-16 | The system shall prevent duplicate submission while a Ticket creation request is being processed. |
| FR-17 | If Ticket creation fails, the system shall display safe failure feedback without unnecessarily clearing the Requester's entered form data. |

### 4.3 My Tickets

| ID | Functional Requirement |
|---|---|
| FR-18 | The selected Development Requester shall be able to view a list of their own Tickets. |
| FR-19 | The system shall prevent Tickets owned by other Development Requesters from appearing in My Tickets. |
| FR-20 | The user shall be able to search their Tickets using the supported searchable fields. |
| FR-21 | The user shall be able to filter their Tickets using the supported filters. |
| FR-22 | The user shall be able to sort their Tickets using the supported sort options. |
| FR-23 | The system shall paginate Ticket results and provide the required pagination metadata. |
| FR-24 | My Tickets shall provide distinct loading, empty, no-results, and API failure states. |
| FR-25 | The user shall be able to open an owned Ticket from My Tickets. |

### 4.4 Requester Ticket Detail

| ID | Functional Requirement |
|---|---|
| FR-26 | The selected Development Requester shall be able to retrieve and view the details of a Ticket they own. |
| FR-27 | Ticket Detail shall present Requester-facing Ticket information as read-only information. |
| FR-28 | The backend shall prevent a Development Requester from retrieving Ticket data owned by another Requester. |
| FR-29 | Ticket Detail shall display Attachment metadata associated with the Ticket. |
| FR-30 | Ticket Detail shall handle loading, missing Ticket, ownership failure, and API failure states safely. |

### 4.5 Attachment Management

| ID | Functional Requirement |
|---|---|
| FR-31 | The selected Development Requester shall be able to upload permitted Attachments to a Ticket they own. |
| FR-32 | The system shall validate Attachment type, file size, and active Attachment count. |
| FR-33 | The selected Development Requester shall be able to retrieve Attachment metadata for Attachments belonging to their own Ticket. |
| FR-34 | The selected Development Requester shall be able to download an active Attachment belonging to their own Ticket. |
| FR-35 | The selected Development Requester shall be able to soft-remove an Attachment belonging to their own Ticket. |
| FR-36 | The system shall retain metadata for soft-removed Attachments. |
| FR-37 | The system shall prevent removed Attachments from being downloaded or previewed. |
| FR-38 | The backend shall prevent cross-Requester access to Attachments. |

### 4.6 UI, Responsive Behavior, and Accessibility

| ID | Functional Requirement |
|---|---|
| FR-39 | The Requester application shall follow the Zen Green UI conventions defined in `ui-spec.md`. |
| FR-40 | The application shall provide responsive layouts for desktop, tablet, and mobile viewports. |
| FR-41 | The application shall avoid clipped content, overlapping controls, hidden actions, and unintended horizontal page scrolling at supported viewport sizes. |
| FR-42 | Form controls and interactive elements shall support keyboard interaction and visible focus states. |
| FR-43 | Validation and status feedback shall use text or other indicators in addition to color. |

---

## 5. Business Rules

### 5.1 Ticket Rules

| ID | Business Rule |
|---|---|
| BR-01 | The official Ticket Number must be generated by the backend and must be unique. |
| BR-02 | Every newly created Ticket must begin with Current Status `New`. |
| BR-03 | A Ticket must be associated with exactly one Development Requester. |
| BR-04 | Ticket Number is read-only and is available only after the backend successfully creates the Ticket. |
| BR-05 | Ticket Summary and Description are required and must be trimmed before validation and storage. |
| BR-06 | Category and Related System values must reference valid records stored in the database. |
| BR-07 | Requested Priority must use one of the values supported by the application. |

### 5.2 Development Requester Rules

| ID | Business Rule |
|---|---|
| BR-08 | The Development Requester selector is a temporary Lab 2 testing mechanism and must not be treated as authentication. |
| BR-09 | Only active Development Requesters may appear in the Requester selector. |
| BR-10 | A Development Requester must be selected before Requester-specific workflows can be used. |
| BR-11 | The currently selected Development Requester must be visible in the application shell. |
| BR-12 | When the selected Development Requester changes, Requester-specific data must be reloaded for the newly selected Requester. |
| BR-13 | If no active Development Requesters are available, the selector must show an empty state and must not allow the user to continue. |
| BR-14 | If Development Requester loading fails, the application must show a safe failure state and provide a way to retry. |

### 5.3 Ownership Rules

| ID | Business Rule |
|---|---|
| BR-15 | A Development Requester may view only Tickets that belong to that Requester. |
| BR-16 | My Tickets must return only Tickets belonging to the currently selected Development Requester. |
| BR-17 | A Development Requester must not receive Ticket data belonging to another Requester through direct API access. |
| BR-18 | Attachment operations are allowed only when the Attachment belongs to a Ticket owned by the currently selected Development Requester. |
| BR-19 | Ownership checks must be enforced by the backend and must not rely only on frontend filtering. |

### 5.4 Search, Filter, Sort, and Pagination Rules

| ID | Business Rule |
|---|---|
| BR-20 | Ticket search must operate only within the selected Development Requester's Tickets. |
| BR-21 | Ticket filters must not expose Tickets owned by another Development Requester. |
| BR-22 | Ticket sorting must use a documented default order and a deterministic secondary sort. |
| BR-23 | Ticket list results must be paginated. |
| BR-24 | The API must return pagination metadata required by the My Tickets interface. |
| BR-25 | Invalid search, filter, sort, or pagination parameters must be handled according to the API contract. |
| BR-26 | An empty Ticket list and a search/filter operation with no matching results must be presented as different UI states. |

### 5.5 Validation and Submission Rules

| ID | Business Rule |
|---|---|
| BR-27 | Required Ticket fields must be validated by both the frontend and backend. |
| BR-28 | Text input must be trimmed before required-field and length validation. |
| BR-29 | Invalid Ticket data must not create a Ticket. |
| BR-30 | The Create Ticket submit action must be disabled or placed in a busy state while a submission is being processed to prevent accidental duplicate submission. |
| BR-31 | If Ticket creation fails, the application must provide safe error feedback and preserve the Requester's entered form data where practical. |
| BR-32 | A successful Ticket creation must clearly display the backend-generated official Ticket Number and an appropriate next action. |

### 5.6 Attachment Rules

| ID | Business Rule |
|---|---|
| BR-33 | Allowed Attachment file types are JPG/JPEG, PNG, WEBP, and PDF. |
| BR-34 | The maximum Attachment size is 5 MB per file. |
| BR-35 | A Ticket may have a maximum of 5 active Attachments. |
| BR-36 | Attachment removal must use soft removal rather than deleting the Attachment metadata. |
| BR-37 | Metadata for a removed Attachment must remain available after removal. |
| BR-38 | A removed Attachment must not be downloadable or previewable. |
| BR-39 | The system must store sufficient Attachment metadata to identify the original file and its lifecycle state. |
| BR-40 | Stored Attachment filenames or storage identifiers must be generated safely and must not trust a user-supplied path. |
| BR-41 | Attachment type, size, active-count, and ownership rules must be validated by the backend. |
| BR-42 | Attachment upload and removal failures must return safe errors without corrupting the Ticket or existing Attachment metadata. |
| BR-43 | Soft removal must record the information required by the approved Attachment removal design, including the removal reason. |

### 5.7 Failure and State Rules

| ID | Business Rule |
|---|---|
| BR-44 | Loading states must be shown while Requester-specific or Ticket data is being retrieved. |
| BR-45 | API and unexpected server failures must display safe user-facing messages without exposing internal implementation details. |
| BR-46 | Missing or inaccessible Ticket and Attachment resources must be handled according to the API contract. |
| BR-47 | The UI must distinguish loading, success, empty, no-results, validation-error, and API-failure states where applicable. |
---

## 6. UI Specification Summary

The Lab 2 Requester interface will follow the Zen Green design direction and provide a consistent, professional, and responsive experience across all Requester workflows.

### 6.1 Zen Green Visual Direction

The application will use the following required visual foundation:

- Primary Green: `#006B3C`
- Secondary Green: `#0B7A46`
- Pale Green: `#EAF6EF`
- Page Background: `#F5F7F6`
- White surfaces for cards and primary content areas
- Dark charcoal-green text for readable content
- Visually distinct editable and read-only fields
- Dark red with supporting text for error states
- Amber for warning states
- Green with supporting text for success states
- Subtle borders and shadows to separate content surfaces

### 6.2 Application Shell

After a Development Requester is selected, the Requester application shell will provide:

- TokTickIT application identity
- My Tickets navigation
- Create Ticket navigation
- Clear indication of the active page
- Display of the currently selected Development Requester
- Change Requester action
- Responsive navigation behavior for smaller screens

Changing the Development Requester will reload Requester-specific information for the newly selected Requester.

### 6.3 Development Requester Selection

Before accessing Requester-specific workflows, the application will provide a Development Requester Selection screen.

The screen will include:

- A clear page title
- An explanation that Development Requester selection is for testing only and is not authentication
- A dropdown containing active Development Requesters retrieved from PostgreSQL
- A Continue action
- Loading state
- Empty state when no active Requesters are available
- Safe API failure state with retry behavior

The selector must support keyboard interaction and remain usable across supported viewport sizes.

### 6.4 Create Ticket

The Create Ticket page will provide a structured form containing the required Ticket information:

- Ticket Number
- Ticket Date
- Requester
- Category
- Related System
- Ticket Summary
- Requested Priority
- Description
- Attachments

Editable and read-only fields will be visually distinguishable.

Required fields will use visible required markers and field-level validation messages. The submit action will provide a busy/disabled state while the request is being processed.

After successful creation, the interface will clearly display the official backend-generated Ticket Number and provide an appropriate next action.

### 6.5 My Tickets

The My Tickets page will allow the selected Development Requester to browse and find their own Tickets.

The interface will provide:

- Ticket search
- Suitable filters
- Sorting controls
- Clear Filters behavior
- Pagination
- Create Ticket action
- Loading state
- Empty state
- No-results state
- API failure state

Each Ticket result will display enough information for the Requester to identify and open the Ticket, such as:

- Ticket Number
- Ticket Summary
- Category
- Current Status
- Last Updated

The desktop representation may use a table, while smaller viewports may use a responsive table or card-based representation where appropriate.

### 6.6 Requester Ticket Detail

The Requester Ticket Detail page will present the selected owned Ticket as read-only Requester-facing information.

The page will:

- Display the Ticket's relevant details
- Display Attachment metadata
- Allow permitted Attachment actions
- Distinguish active and removed Attachments
- Provide loading and safe failure states
- Exclude IT Staff-only workflow controls

Comments, Internal Notes, Actions Taken, and Ticket status workflow controls are outside the Lab 2 Requester interface.

### 6.7 Component and Interaction Rules

The interface will follow consistent component behavior:

- Labels appear above form controls.
- Required fields use a visible red asterisk.
- Form controls use consistent heights and spacing.
- Buttons use text labels where appropriate.
- Icon-only controls include accessible labels.
- Disabled controls are visually distinguishable and cannot be activated.
- Keyboard focus remains visible.
- Validation messages appear close to the related field.
- Error, warning, and success states do not rely on color alone.
- Submit actions provide clear processing feedback.

### 6.8 Responsive Behavior

The application will support the following viewport ranges:

| Viewport | Width | Expected Behavior |
|---|---:|---|
| Desktop | `≥ 992 px` | Multi-column layout with a sensible maximum content width |
| Tablet | `768–991 px` | Two-column layout where practical |
| Mobile | `< 768 px` | Vertically stacked layout with touch-friendly controls |

Across all supported viewport sizes:

- Content must not be clipped.
- Controls and messages must not overlap.
- Important actions must remain visible.
- Attachment filenames must remain readable.
- The page must not introduce unintended horizontal scrolling.

### 6.9 Accessibility

The Requester interface will provide:

- Keyboard-accessible interactive controls
- Visible keyboard focus
- Labels associated with form controls
- Accessible names for icon-only controls
- Visible required-field indicators
- Validation messages in addition to color
- Readable feedback for loading, success, warning, and failure states

> Detailed UI tokens, component states, screen behavior, responsive rules, and the visual inspection checklist are defined in [`ui-spec.md`](./ui-spec.md).

---
## 7. Data Changes

Lab 2 introduces and extends the data model required to support Requester ticket creation, ticket ownership, reference data, and Attachment management.

### 7.1 Required Models

The Lab 2 data layer will include the following concepts:

- Development Requester
- Ticket
- Attachment
- Category
- Related System

### 7.2 Model Responsibilities

#### Development Requester

Represents the temporary Requester identity used only for Lab 2 development and testing.

The model must support:

- Unique identity
- Display information
- Active / inactive status
- Relationships to owned Tickets
- Created and updated timestamps

Inactive Development Requesters must remain stored in the database but must not appear in the Development Requester selector.

#### Ticket

Represents a support request created by one Development Requester.

The model must support:

- Internal primary key
- Unique official Ticket Number
- Ticket date / creation timestamp
- Development Requester ownership
- Category
- Related System
- Ticket Summary
- Requested Priority
- Description
- Current Status
- Created and updated timestamps

A Ticket belongs to exactly one Development Requester, one Category, and one Related System.

#### Attachment

Represents a file associated with a Ticket.

The model must support:

- Internal primary key
- Ticket relationship
- Original filename
- Safe stored filename or storage identifier
- MIME type
- File size
- Upload timestamp
- Soft-removal state
- Removal timestamp
- Removal reason
- Created and updated timestamps

Soft-removing an Attachment must preserve its metadata.

#### Category

Represents the high-level classification of a Ticket.

Required seeded Categories:

- Account and Access
- Hardware
- Software
- Network

The seed process must be idempotent.

#### Related System

Represents the system, service, or equipment related to the Requester's issue.

The database must contain at least six realistic Related Systems.

Example values may include:

- Email
- Campus Wi-Fi
- VPN
- LEB2 App
- Grade Submission App
- Printer
- Corporate Laptop

The seed process must be idempotent.

### 7.3 Relationships

The data model will use the following relationships:

```text
Development Requester
        │
        │ 1
        │
        └──────────────< Ticket
                          │
                          │ 1
                          │
                          └──────────────< Attachment

Category
   │
   │ 1
   └─────────────────────< Ticket

Related System
   │
   │ 1
   └─────────────────────< Ticket
```
   ### 7.4 Constraints and Indexes

The database must enforce appropriate constraints and indexes to maintain data integrity and support common Lab 2 queries.

#### Constraints

- Each model must have a primary key.
- Ticket Number must be unique.
- Every Ticket must reference exactly one Development Requester.
- Every Ticket must reference a valid Category.
- Every Ticket must reference a valid Related System.
- Every Attachment must reference exactly one Ticket.
- Required Ticket fields must not allow `NULL`.
- Required Attachment metadata must not allow `NULL`.
- Foreign-key constraints must prevent invalid references.
- Soft-removed Attachments must remain stored in the database.

#### Indexes

The initial indexing plan includes:

- A unique index on Ticket Number.
- An index supporting Ticket lookup by Development Requester.
- An index supporting My Tickets sorting.
- Indexes for commonly filtered Ticket fields where appropriate.
- An index on the Attachment-to-Ticket relationship.
- An index supporting active and removed Attachment lookup where appropriate.

The final index definitions will be reflected in the Prisma schema and migration.

### 7.5 Migration Decisions

Database changes for Lab 2 will be implemented using Prisma migrations.

The migration process will:

1. Update the Prisma schema with the approved Lab 2 models and relationships.
2. Add the required primary keys, foreign keys, constraints, and indexes.
3. Add fields required for Attachment soft removal.
4. Preserve existing Lab 1 functionality and data where applicable.
5. Verify that the migration can be applied successfully to the development database.

### 7.6 Seed Data

The Lab 2 seed process must be idempotent so that running the seed multiple times does not create duplicate reference data.

#### Development Requesters

The database must contain:

- At least 4 active Development Requesters.
- At least 1 inactive Development Requester.

Only active Development Requesters may appear in the Development Requester selector.

#### Categories

The following Categories must be seeded:

1. Account and Access
2. Hardware
3. Software
4. Network

#### Related Systems

At least 6 realistic Related Systems must be seeded.

Example values include:

- Email
- Campus Wi-Fi
- VPN
- LEB2 App
- Grade Submission App
- Printer
- Corporate Laptop

---

## 8. API Contract

Lab 2 provides a REST API for Development Requester selection, reference data, Ticket creation, My Tickets, Ticket Detail, and Attachment management.

The complete endpoint-level contract is documented in [`api-spec.md`](./api-spec.md).

### 8.1 General API Conventions

- Base path: `/api`
- Standard request and response bodies use JSON.
- Attachment uploads use `multipart/form-data`.
- Backend validation is required even when equivalent frontend validation exists.
- API errors must not expose stack traces, database details, or other internal implementation information.
- Requester ownership must always be enforced by the backend.

### 8.2 Development Requester Context

Lab 2 uses a temporary Development Requester context for development and testing only.

Requester-scoped API requests will send the selected Development Requester ID using the following request header:

```http
X-Requester-Id: 3
```

The backend must verify that the supplied Development Requester exists and is active before processing Requester-scoped operations.

The Development Requester mechanism is not authentication and will be replaced by authenticated user context in Lab 3.

### 8.3 Reference Data Endpoints

#### GET `/api/requesters`

Returns active Development Requesters.

Inactive Development Requesters must not be included in the response.

#### GET `/api/categories`

Returns the available Ticket Categories.

#### GET `/api/related-systems`

Returns the available Related Systems.

### 8.4 Create Ticket

#### POST `/api/tickets`

Creates one Ticket for the currently selected Development Requester.

Example request body:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Cannot connect to Campus Wi-Fi",
  "requestedPriority": "MEDIUM",
  "description": "The connection fails after entering my university credentials."
}
```

The Requester ID is not accepted as the source of ownership from the request body. Ticket ownership is determined from the current Development Requester context.

#### Validation

| Field | Validation Rule |
|---|---|
| Category | Required and must reference an existing Category |
| Related System | Required and must reference an existing Related System |
| Ticket Summary | Required, trimmed, 1–120 characters |
| Requested Priority | Required and must be an allowed value |
| Description | Required, trimmed, 1–2000 characters |

Supported Requested Priority values:

- `LOW`
- `MEDIUM`
- `HIGH`

#### Successful Creation

A successful request returns:

`201 Created`

The response includes:

- Internal Ticket ID
- Official Ticket Number
- Current Status
- Created timestamp

The backend must generate the official Ticket Number.

Every newly created Ticket must have Current Status `New`.

### 8.5 Ticket Number

The official Ticket Number must:

- Be generated by the backend.
- Be unique.
- Be read-only to the Requester.
- Never be generated by the frontend.

The exact Ticket Number format will be finalized during database implementation and documented before implementation is considered complete.

### 8.6 My Tickets

#### GET `/api/tickets`

Returns only Tickets owned by the currently selected Development Requester.

Supported query parameters:

| Parameter | Required | Purpose |
|---|---|---|
| `search` | No | Search by Ticket Number or Ticket Summary |
| `categoryId` | No | Filter by Category |
| `relatedSystemId` | No | Filter by Related System |
| `priority` | No | Filter by Requested Priority |
| `status` | No | Filter by Current Status |
| `sort` | No | Select the sort field |
| `order` | No | Select ascending or descending order |
| `page` | No | Select the requested page |
| `pageSize` | No | Select the number of results per page |

#### Searchable Fields

Search will operate on:

- Ticket Number
- Ticket Summary

Ticket Description is excluded from the initial search scope to keep the behavior predictable.

#### Sortable Fields

Supported sort fields:

- `createdAt`
- `updatedAt`
- `ticketNumber`

Supported sort orders:

- `asc`
- `desc`

Default sorting:

`updatedAt DESC`

A deterministic secondary sort will use the internal Ticket ID in descending order.

#### Pagination

Default pagination:

- `page = 1`
- `pageSize = 10`

Supported page sizes:

- `10`
- `20`
- `50`

The response must include pagination metadata such as:

```json
{
  "page": 1,
  "pageSize": 10,
  "totalItems": 24,
  "totalPages": 3
}
```

Invalid search, filter, sorting, or pagination parameters must return:

`400 Bad Request`

### 8.7 Ticket Detail

#### GET `/api/tickets/:id`

Returns one Ticket only when it belongs to the currently selected Development Requester.

The response includes the Requester-facing Ticket information and Attachment metadata required by the Ticket Detail interface.

If the Ticket does not exist or does not belong to the currently selected Requester, the API returns:

`404 Not Found`

The same response is used for both missing and inaccessible Tickets so that the API does not reveal the existence of another Requester's Ticket.

### 8.8 Attachment Upload

#### POST `/api/tickets/:id/attachments`

Uploads an Attachment to a Ticket owned by the currently selected Development Requester.

The endpoint uses:

`multipart/form-data`

Allowed Attachment types:

- JPG / JPEG
- PNG
- WEBP
- PDF

Maximum file size:

`5 MB per file`

Maximum active Attachments:

`5 per Ticket`

The backend must validate:

- Ticket ownership
- File type
- File size
- Active Attachment count

The backend must generate a safe stored filename or storage identifier rather than trusting a user-supplied storage path.

### 8.9 Attachment Metadata

#### GET `/api/attachments/:id`

Returns metadata for an Attachment belonging to a Ticket owned by the currently selected Development Requester.

Attachment metadata includes information such as:

- Original filename
- MIME type
- File size
- Upload timestamp
- Removal status
- Removal timestamp
- Removal reason

Removed Attachment metadata remains available.

### 8.10 Attachment Download

#### GET `/api/attachments/:id/download`

Allows the selected Development Requester to download an active Attachment belonging to their own Ticket.

The backend must verify Attachment ownership before returning the file.

A soft-removed Attachment must not be downloadable or previewable.

### 8.11 Soft-Remove Attachment

#### DELETE `/api/attachments/:id`

Soft-removes an Attachment belonging to a Ticket owned by the currently selected Development Requester.

Example request body:

```json
{
  "reason": "Uploaded the wrong file"
}
```

Removal reason validation:

- Required
- Trimmed
- 1–250 characters

Soft removal must record:

- Removal state
- Removal timestamp
- Removal reason

The Attachment metadata must remain stored after removal.

### 8.12 Ticket Creation with Attachments

Ticket creation and Attachment upload are treated as separate operations.

The workflow is:

1. Validate the Ticket form.
2. Create the Ticket.
3. Receive the official Ticket Number and Ticket ID.
4. Upload selected Attachments to the newly created Ticket.

If Ticket creation succeeds but one or more Attachment uploads fail:

- The Ticket remains created.
- Successfully uploaded Attachments remain associated with the Ticket.
- Failed Attachment uploads are reported to the Requester.
- The Requester may retry the failed uploads from Ticket Detail.
- A valid Ticket must not be deleted only because a later file upload fails.

### 8.13 Duplicate Submission Prevention

The frontend must prevent accidental duplicate submission by disabling the Create Ticket submit action and displaying a busy state while the request is being processed.

The backend must still validate every incoming request independently.

If stronger backend idempotency is introduced during implementation, the selected mechanism must be documented in this specification and `api-spec.md`.

### 8.14 HTTP Status Decisions

| Status | Usage |
|---:|---|
| `200 OK` | Successful retrieval or successful non-creation operation |
| `201 Created` | Ticket or Attachment successfully created |
| `400 Bad Request` | Invalid input or invalid query parameters |
| `404 Not Found` | Missing or inaccessible owned resource |
| `409 Conflict` | State conflict, such as exceeding the maximum active Attachment count |
| `413 Payload Too Large` | Attachment exceeds the 5 MB limit |
| `415 Unsupported Media Type` | Unsupported Attachment file type |
| `500 Internal Server Error` | Unexpected backend failure |

### 8.15 Ownership Enforcement

Backend ownership checks are required for:

- My Tickets
- Ticket Detail
- Attachment upload
- Attachment metadata
- Attachment download
- Attachment soft removal

Frontend filtering must not be treated as sufficient ownership protection.

### 8.16 Safe Error Behavior

API failures must:

- Return an appropriate HTTP status.
- Return a predictable error response where applicable.
- Avoid exposing internal implementation details.
- Allow the frontend to display clear and safe feedback.
- Avoid corrupting existing Ticket or Attachment data.

---

## 9. Acceptance Criteria

The following Acceptance Criteria define observable conditions that must be satisfied before Lab 2 is considered complete.

### 9.1 Development Requester

#### AC-01 — Load Active Development Requesters

**Given** active and inactive Development Requesters exist in the database  
**When** the Development Requester Selection screen loads  
**Then** only active Development Requesters are displayed.

#### AC-02 — Select Development Requester

**Given** active Development Requesters are available  
**When** the user selects a Requester and continues  
**Then** the selected Requester becomes the current Development Requester and is displayed in the application shell.

#### AC-03 — No Requester Selected

**Given** no Development Requester is currently selected  
**When** the user attempts to access a Requester-specific page  
**Then** the application requires Development Requester selection before continuing.

#### AC-04 — Change Development Requester

**Given** Requester A is currently selected  
**When** the user changes to Requester B  
**Then** Requester-specific data is reloaded and data belonging only to Requester A is no longer shown.

#### AC-05 — Requester Loading Failure

**Given** the Development Requester API cannot be loaded  
**When** the selection screen is opened  
**Then** a safe failure message and retry action are displayed.

#### AC-06 — No Active Requesters

**Given** no active Development Requesters are available  
**When** the selection screen loads  
**Then** an empty state is displayed and the user cannot continue.

### 9.2 Create Ticket

#### AC-07 — Create Valid Ticket

**Given** a Development Requester is selected and valid Ticket data is entered  
**When** the Requester submits the form  
**Then** exactly one Ticket is stored and the official backend-generated Ticket Number is displayed.

#### AC-08 — Initial Ticket Status

**Given** a valid Ticket is submitted  
**When** the backend creates the Ticket  
**Then** its Current Status is `New`.

#### AC-09 — Correct Ticket Ownership

**Given** Requester A is selected  
**When** Requester A creates a Ticket  
**Then** the created Ticket belongs to Requester A.

#### AC-10 — Required Field Validation

**Given** one or more required fields are empty or invalid  
**When** the Requester attempts to submit the Ticket  
**Then** the invalid fields are identified and no Ticket is created.

#### AC-11 — Text Validation

**Given** Ticket Summary or Description violates the approved validation rules  
**When** the Requester submits the form  
**Then** the request is rejected and an appropriate field-level validation message is displayed.

#### AC-12 — Duplicate Submission Prevention

**Given** a Ticket submission is already being processed  
**When** the Requester attempts to submit again  
**Then** an additional accidental submission is prevented.

#### AC-13 — Ticket Creation Failure

**Given** valid Ticket information has been entered  
**When** Ticket creation fails because of a backend error  
**Then** safe failure feedback is displayed and the entered form data remains available where practical.

### 9.3 My Tickets

#### AC-14 — View Own Tickets

**Given** Requester A is selected and owns existing Tickets  
**When** My Tickets is opened  
**Then** only Tickets owned by Requester A are displayed.

#### AC-15 — Requester Isolation

**Given** Requester A and Requester B own different Tickets  
**When** Requester B is selected  
**Then** Tickets owned only by Requester A are not displayed.

#### AC-16 — Search Tickets

**Given** the selected Requester owns multiple Tickets  
**When** a supported search term is entered  
**Then** only matching Tickets belonging to that Requester are returned.

#### AC-17 — Filter Tickets

**Given** the selected Requester owns Tickets with different Categories, Related Systems, priorities, or statuses  
**When** a supported filter is applied  
**Then** only matching owned Tickets are returned.

#### AC-18 — Sort Tickets

**Given** the selected Requester owns multiple Tickets  
**When** a supported sorting option is selected  
**Then** the Ticket list is returned in the documented deterministic order.

#### AC-19 — Paginate Tickets

**Given** the number of matching Tickets exceeds the selected page size  
**When** the Requester navigates between pages  
**Then** the correct page of owned Ticket results and pagination metadata are returned.

#### AC-20 — Empty Ticket State

**Given** the selected Requester owns no Tickets  
**When** My Tickets is opened  
**Then** an appropriate empty state is displayed.

#### AC-21 — No Search Results

**Given** the selected Requester owns Tickets  
**When** the applied search or filters match no Tickets  
**Then** a no-results state is displayed separately from the empty Ticket state.

#### AC-22 — My Tickets API Failure

**Given** the Ticket list cannot be retrieved  
**When** My Tickets loads  
**Then** the application displays safe failure feedback.

### 9.4 Ticket Detail and Ownership

#### AC-23 — Open Owned Ticket

**Given** the selected Development Requester owns a Ticket  
**When** the Requester opens that Ticket  
**Then** the Ticket Detail page displays the correct Requester-facing Ticket information.

#### AC-24 — Prevent Cross-Requester Ticket Access

**Given** Ticket A belongs to Requester A  
**And** Requester B is currently selected  
**When** Requester B directly requests Ticket A  
**Then** Ticket A's data is not returned.

#### AC-25 — Missing Ticket

**Given** a requested Ticket does not exist  
**When** Ticket Detail is requested  
**Then** the application handles the missing Ticket safely.

#### AC-26 — Read-Only Ticket Detail

**Given** an owned Ticket is displayed  
**When** the Requester views Ticket Detail  
**Then** Requester-facing Ticket information that is not editable in Lab 2 is presented as read-only.

### 9.5 Attachments

#### AC-27 — Upload Valid Attachment

**Given** the selected Requester owns the Ticket and the file meets all Attachment rules  
**When** the file is uploaded  
**Then** the Attachment is stored and associated with the correct Ticket.

#### AC-28 — Reject Unsupported File Type

**Given** a file type other than JPG/JPEG, PNG, WEBP, or PDF is selected  
**When** an upload is attempted  
**Then** the Attachment is rejected and is not stored as an active Attachment.

#### AC-29 — Reject Oversized Attachment

**Given** an Attachment is larger than 5 MB  
**When** an upload is attempted  
**Then** the Attachment is rejected.

#### AC-30 — Maximum Active Attachments

**Given** a Ticket already has 5 active Attachments  
**When** another Attachment upload is attempted  
**Then** the additional Attachment is rejected.

#### AC-31 — Download Active Attachment

**Given** an active Attachment belongs to an owned Ticket  
**When** the Requester downloads the Attachment  
**Then** the file is returned successfully.

#### AC-32 — Soft-Remove Attachment

**Given** an active Attachment belongs to an owned Ticket  
**When** the Requester confirms removal with a valid reason  
**Then** the Attachment is marked as removed while its metadata remains stored.

#### AC-33 — Block Removed Attachment Download

**Given** an Attachment has been soft-removed  
**When** the Requester attempts to download or preview it  
**Then** the file content is not returned.

#### AC-34 — Cross-Requester Attachment Protection

**Given** an Attachment belongs to a Ticket owned by Requester A  
**And** Requester B is selected  
**When** Requester B directly requests the Attachment  
**Then** the Attachment data or file content is not returned.

#### AC-35 — Attachment Upload Failure After Ticket Creation

**Given** a Ticket has been created successfully  
**When** a later Attachment upload fails  
**Then** the Ticket remains created and the failed upload is reported without removing successfully uploaded Attachments.

### 9.6 Responsive UI and Accessibility

#### AC-36 — Desktop Layout

**Given** the application is displayed at a viewport width of at least 992 px  
**When** a Requester uses the required Lab 2 screens  
**Then** the interface uses an appropriate desktop layout without clipping, overlap, or unintended horizontal scrolling.

#### AC-37 — Tablet Layout

**Given** the application is displayed between 768 px and 991 px  
**When** a Requester uses the required Lab 2 screens  
**Then** the interface adapts appropriately and all required controls remain usable.

#### AC-38 — Mobile Layout

**Given** the application is displayed below 768 px  
**When** a Requester uses the required Lab 2 screens  
**Then** content stacks appropriately, controls remain touch-friendly, and no unintended horizontal page scrolling occurs.

#### AC-39 — Keyboard Accessibility

**Given** a Requester uses keyboard navigation  
**When** they move through interactive controls  
**Then** required controls are keyboard accessible and visible focus indicators are provided.

#### AC-40 — Accessible Feedback

**Given** validation, warning, success, or failure feedback is displayed  
**When** the Requester views the feedback  
**Then** meaning is communicated using text or another indicator in addition to color.

### 9.7 Acceptance Criteria Traceability

Every Acceptance Criterion in this section must map to at least one planned test in [`tests.md`](./tests.md).

The test plan must include appropriate coverage across:

- Unit tests
- API / integration tests
- UI component tests
- UI style tests
- Responsive tests
- End-to-End tests

---

## 10. Definition of Done

Lab 2 is considered complete only when both the product requirements and course delivery requirements are satisfied.

### 10.1 Product Completion

- [ ] All approved Lab 2 scope is implemented.
- [ ] All Functional Requirements are implemented.
- [ ] All Business Rules are enforced.
- [ ] All Acceptance Criteria are satisfied.
- [ ] Every Acceptance Criterion maps to planned and executed test evidence.
- [ ] Required automated tests pass.
- [ ] No required tests are skipped or disabled.
- [ ] Tests are deterministic and repeatable.
- [ ] Database models match the approved specification.
- [ ] Prisma migrations apply successfully.
- [ ] Seed data is idempotent.
- [ ] API implementation matches `api-spec.md`.
- [ ] UI implementation matches `ui-spec.md`.
- [ ] Requester ownership is enforced by the backend.
- [ ] Create Ticket handles valid, invalid, submitting, success, and failure states.
- [ ] My Tickets handles search, filtering, sorting, pagination, loading, empty, no-results, and failure states.
- [ ] Ticket Detail handles owned, missing, and inaccessible Tickets safely.
- [ ] Attachment upload, download, and soft removal follow the approved rules.
- [ ] Removed Attachment metadata remains stored.
- [ ] Removed Attachments cannot be downloaded or previewed.
- [ ] Desktop, tablet, and mobile layouts are verified.
- [ ] Required accessibility behavior is verified.
- [ ] No required page contains unintended clipping, overlap, hidden controls, or horizontal overflow.
- [ ] README setup and test instructions are current.
- [ ] Required screenshot evidence has been captured.

### 10.2 Documentation Completion

- [ ] `docs/lab-02/specification.md` is complete.
- [ ] `docs/lab-02/tests.md` is complete.
- [ ] `docs/lab-02/ui-spec.md` is complete.
- [ ] `docs/lab-02/api-spec.md` is complete.
- [ ] `docs/lab-02/reviewer.md` is complete.
- [ ] `docs/lab-02/ai-use.md` is complete.
- [ ] Test results in `tests.md` match the final implementation.
- [ ] Acceptance Criteria traceability is complete.
- [ ] AI usage records include selected key prompts and reflection.
- [ ] Peer-review evidence is documented.

### 10.3 Git and Course Delivery

- [ ] Lab 2 work is tracked using GitHub Issues.
- [ ] GitHub Project statuses reflect the actual development state.
- [ ] Each implementation Issue uses an appropriate feature branch.
- [ ] No Lab 2 feature is developed directly on `main`.
- [ ] No Lab 2 feature is developed directly on `lab2-staging`.
- [ ] Feature Pull Requests target `lab2-staging`.
- [ ] Required Pull Requests receive peer review before merge.
- [ ] Review feedback is addressed and documented.
- [ ] All required Issues reach `Done`.
- [ ] The integrated Lab 2 implementation passes the complete test suite.
- [ ] The final release Pull Request is created from `lab2-staging` to `main`.
- [ ] The final `main` branch contains the completed Lab 2 release.

---

## 11. Assumptions and Decisions

The following decisions resolve implementation details that are not completely prescribed by the Lab 2 stakeholder request.

| ID | Assumption / Decision | Rationale |
|---|---|---|
| AD-01 | Development Requester selection is a temporary testing mechanism and is not authentication. | Real authentication is outside Lab 2 scope and will be introduced in Lab 3. |
| AD-02 | Requester-scoped API requests use the `X-Requester-Id` request header. | This keeps temporary Requester context separate from Ticket request bodies and makes Requester-scoped API behavior consistent. |
| AD-03 | Only active Development Requesters are selectable. | Inactive Requesters remain available as database records but must not be used for new Lab 2 Requester sessions. |
| AD-04 | Requested Priority supports `LOW`, `MEDIUM`, and `HIGH`. | These values provide a simple Requester-facing priority model suitable for the Lab 2 MVP. |
| AD-05 | Ticket Summary is trimmed and limited to 1–120 characters. | This keeps Ticket summaries concise while still allowing meaningful descriptions. |
| AD-06 | Ticket Description is trimmed and limited to 1–2000 characters. | This provides enough space for issue details while placing a predictable bound on input. |
| AD-07 | My Tickets search covers Ticket Number and Ticket Summary. | These are the most useful identification fields while keeping search behavior predictable. |
| AD-08 | My Tickets defaults to `updatedAt DESC`. | Recently changed Tickets are likely to be most relevant to the Requester. |
| AD-09 | Internal Ticket ID descending is used as the secondary sort. | This provides deterministic ordering when two Tickets have the same primary sort value. |
| AD-10 | Pagination defaults to page 1 with 10 records per page. | Ten records provides a manageable default list size for the MVP. |
| AD-11 | Supported page sizes are 10, 20, and 50. | These options provide reasonable list-size choices without unnecessary complexity. |
| AD-12 | Missing and cross-Requester Ticket access both return `404 Not Found`. | Using the same response avoids revealing whether another Requester's Ticket exists. |
| AD-13 | Attachment removal reason is required, trimmed, and limited to 1–250 characters. | A short reason provides useful removal history without requiring unnecessary detail. |
| AD-14 | Ticket creation and Attachment upload are separate operations. | A file-transfer failure should not invalidate an otherwise successfully created Ticket. |
| AD-15 | If an Attachment upload fails after Ticket creation, the Ticket remains created. | This prevents loss of valid Ticket data and allows failed files to be retried later. |
| AD-16 | Attachment metadata is retained after soft removal. | This preserves the Attachment lifecycle history required by Lab 2. |
| AD-17 | Attachment bytes are stored under `server/storage/attachments` by default, with `ATTACHMENT_STORAGE_DIR` available as an environment override. Stored filenames use a generated UUID plus the extension derived from the validated MIME type; the user-supplied filename is retained only as metadata. Soft removal retains the stored bytes but blocks access through the API. | This gives development and deployment a concrete, configurable storage location, prevents path traversal through uploaded filenames, and preserves the removal audit trail. |
| AD-18 | The frontend disables Ticket submission while a creation request is in progress. | This reduces accidental duplicate submissions and provides clear processing feedback. |
| AD-19 | Desktop may use a Ticket table while mobile may use a responsive table or card representation. | Different representations may provide better usability at different viewport widths while preserving the same Ticket information. |
| AD-20 | Development Requester context will be designed so it can be replaced by authenticated user context in Lab 3. | This reduces unnecessary coupling between the temporary Lab 2 mechanism and future authentication. |

### 11.1 Decisions to Confirm During Implementation

The following implementation-level details may be finalized when their related Issue begins, but any change must be reflected in this specification before the implementation is considered complete:

- Exact official Ticket Number format
- Exact Prisma field types
- Exact database index definitions
- Exact frontend persistence mechanism for the selected Development Requester
- Exact UI component implementation
- Additional safe API error codes where required

### 11.2 Change Control

If an implementation decision changes an approved Functional Requirement, Business Rule, API behavior, UI behavior, or Acceptance Criterion:

1. Update the relevant Lab 2 specification document.
2. Update affected planned tests in `tests.md`.
3. Confirm that Acceptance Criteria remain traceable to tests.
4. Implement the change.
5. Run the affected automated tests.
6. Record important AI-assisted decisions in `ai-use.md` where applicable.
