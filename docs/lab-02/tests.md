# Lab 2 Test Plan

**Project:** TokTickIT Service Desk  
**Lab:** Lab 2 : Requester Ticketing MVP with UI Foundation  
**Status:** Implemented and verified; peer-review/release activities pending
**Last Updated:** 2026-09-02

---

## 1. Test Strategy

Lab 2 follows a Test-Driven / Test-Defined Development approach.

Tests are planned before or alongside implementation and are derived from the Functional Requirements, Business Rules, API Contract, UI Specification, and Acceptance Criteria.

The test suite covers:

- API / Integration tests
- UI Component tests
- UI Style and Responsive tests
- End-to-End tests
- Boundary and validation cases
- Ownership and multi-Requester isolation
- Loading, empty, no-results, and failure states
- Attachment lifecycle behavior

Each Acceptance Criterion must map to at least one planned automated test.

---

## 2. Test Levels

### 2.1 API / Integration Tests

API tests verify:

- Backend validation
- Database persistence
- Ticket ownership
- Search, filters, sorting, and pagination
- Attachment rules
- HTTP status codes
- Safe failure behavior

Planned files:

```text
server/tests/
├── create-ticket.api.test.ts
├── my-tickets.api.test.ts
├── ticket-detail.api.test.ts
└── attachments.test.ts
```

### 2.2 UI Component Tests

UI component tests verify:

- Rendering
- User interaction
- Form validation
- Loading states
- Empty states
- Failure states
- Success feedback
- Requester switching
- Attachment interaction

Planned files:

```text
client/tests/lab-02/
├── RequesterSelection.test.tsx
├── CreateTicket.test.tsx
├── MyTickets.test.tsx
├── TicketDetail.test.tsx
└── AttachmentSection.test.tsx
```

### 2.3 UI Style / Responsive Tests

Style and responsive tests verify:

- Zen Green tokens
- Required component states
- Responsive behavior
- Visibility of important controls
- No unintended horizontal overflow

Planned file:

```text
client/e2e/requester-ticket-flow.spec.ts
```

### 2.4 End-to-End Tests

E2E tests verify complete Requester workflows using the running application.

Planned file:

```text
client/e2e/requester-ticket-flow.spec.ts
```

---

# 3. Development Requester Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-01 | API | FR-01, BR-09, AC-01 | Retrieve Development Requesters | Only active Requesters are returned | `server/tests/requesters.api.test.ts` |
| T-02 | UI | FR-01, AC-01 | Render active Requesters | Active Requesters appear in selector | `RequesterSelection.test.tsx` |
| T-03 | UI | FR-02, AC-02 | Select Requester and continue | Selected Requester becomes current context | `RequesterSelection.test.tsx` |
| T-04 | UI | FR-03, AC-02 | Current Requester display | Selected Requester appears in application shell | `RequesterSelection.test.tsx` |
| T-05 | UI | FR-02, BR-10, AC-03 | Access without Requester | User is sent to/requested to complete Requester selection | `RequesterSelection.test.tsx` |
| T-06 | UI | FR-04, FR-05, AC-04 | Change Requester | Current context changes and Requester-specific data reloads | `RequesterSelection.test.tsx` |
| T-07 | UI | FR-06, AC-05 | Requester API failure | Safe failure message and Retry action appear | `RequesterSelection.test.tsx` |
| T-08 | UI | FR-06, BR-13, AC-06 | No active Requesters | Empty state shown and Continue unavailable | `RequesterSelection.test.tsx` |
| T-09 | UI | BR-08 | Testing-only explanation | UI clearly states selector is not authentication | `RequesterSelection.test.tsx` |

---

# 4. Create Ticket API Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-10 | API | FR-12, AC-07 | Create valid Ticket | `201` and exactly one Ticket stored | `create-ticket.api.test.ts` |
| T-11 | API | FR-13, BR-01, AC-07 | Ticket Number generation | Unique backend-generated Ticket Number returned | `create-ticket.api.test.ts` |
| T-12 | API | FR-14, BR-02, AC-08 | Initial status | New Ticket has `NEW` status | `create-ticket.api.test.ts` |
| T-13 | API | BR-03, AC-09 | Ticket ownership | Created Ticket belongs to selected Requester | `create-ticket.api.test.ts` |
| T-14 | API | BR-27, AC-10 | Missing Category | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-15 | API | BR-27, AC-10 | Missing Related System | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-16 | API | BR-27, AC-10 | Missing Summary | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-17 | API | BR-27, AC-10 | Missing Priority | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-18 | API | BR-27, AC-10 | Missing Description | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-19 | API | BR-28, AC-10 | Whitespace-only Summary | Trimmed to empty and rejected | `create-ticket.api.test.ts` |
| T-20 | API | BR-28, AC-10 | Whitespace-only Description | Trimmed to empty and rejected | `create-ticket.api.test.ts` |
| T-21 | API | AC-11 | Summary at 120 chars | Accepted | `create-ticket.api.test.ts` |
| T-22 | API | AC-11 | Summary above 120 chars | `400`; rejected | `create-ticket.api.test.ts` |
| T-23 | API | AC-11 | Description at 2000 chars | Accepted | `create-ticket.api.test.ts` |
| T-24 | API | AC-11 | Description above 2000 chars | `400`; rejected | `create-ticket.api.test.ts` |
| T-25 | API | BR-06, AC-10 | Invalid Category ID | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-26 | API | BR-06, AC-10 | Invalid Related System ID | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-27 | API | BR-07, AC-10 | Invalid Priority | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-28 | API | BR-10 | Missing Requester context | `400`; Ticket not created | `create-ticket.api.test.ts` |
| T-29 | API | BR-09 | Inactive Requester | Request rejected | `create-ticket.api.test.ts` |

---

# 5. Create Ticket UI Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-30 | UI | FR-09 | Required fields render | All required Ticket inputs appear | `CreateTicket.test.tsx` |
| T-31 | UI | FR-10 | Read-only information | Requester/Ticket information is visually read-only | `CreateTicket.test.tsx` |
| T-32 | UI | FR-11, AC-10 | Client validation | Invalid fields show field-level messages | `CreateTicket.test.tsx` |
| T-33 | UI | FR-16, BR-30, AC-12 | Duplicate submit prevention | Submit becomes disabled/busy while processing | `CreateTicket.test.tsx` |
| T-34 | UI | FR-15, BR-32, AC-07 | Successful creation | Success feedback and Ticket Number displayed | `CreateTicket.test.tsx` |
| T-35 | UI | FR-17, BR-31, AC-13 | Backend failure | Error displayed and entered data retained | `CreateTicket.test.tsx` |
| T-36 | UI | FR-08 | Reference data loading | Category and Related System options load | `CreateTicket.test.tsx` |
| T-37 | UI | FR-08 | Reference data failure | Safe failure state shown | `CreateTicket.test.tsx` |

---

# 6. My Tickets API Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-38 | API | FR-18, AC-14 | Retrieve own Tickets | Only selected Requester's Tickets returned | `my-tickets.api.test.ts` |
| T-39 | API | FR-19, BR-16, AC-15 | Multi-Requester isolation | Another Requester's Tickets are excluded | `my-tickets.api.test.ts` |
| T-40 | API | FR-20, AC-16 | Search Ticket Number | Matching owned Tickets returned | `my-tickets.api.test.ts` |
| T-41 | API | FR-20, AC-16 | Search Ticket Summary | Matching owned Tickets returned | `my-tickets.api.test.ts` |
| T-42 | API | FR-21, AC-17 | Category filter | Correct owned Tickets returned | `my-tickets.api.test.ts` |
| T-43 | API | FR-21, AC-17 | Related System filter | Correct owned Tickets returned | `my-tickets.api.test.ts` |
| T-44 | API | FR-21, AC-17 | Priority filter | Correct owned Tickets returned | `my-tickets.api.test.ts` |
| T-45 | API | FR-21, AC-17 | Status filter | Correct owned Tickets returned | `my-tickets.api.test.ts` |
| T-46 | API | FR-22, AC-18 | Sort ascending | Correct order returned | `my-tickets.api.test.ts` |
| T-47 | API | FR-22, AC-18 | Sort descending | Correct order returned | `my-tickets.api.test.ts` |
| T-48 | API | BR-22, AC-18 | Default sort | Defaults to `updatedAt DESC` | `my-tickets.api.test.ts` |
| T-49 | API | BR-22, AC-18 | Secondary sort | Equal primary values use deterministic ID order | `my-tickets.api.test.ts` |
| T-50 | API | FR-23, AC-19 | Pagination | Correct page and records returned | `my-tickets.api.test.ts` |
| T-51 | API | FR-23, AC-19 | Pagination metadata | Correct totals/pages returned | `my-tickets.api.test.ts` |
| T-52 | API | BR-25 | Invalid page | `400 Bad Request` | `my-tickets.api.test.ts` |
| T-53 | API | BR-25 | Invalid page size | `400 Bad Request` | `my-tickets.api.test.ts` |
| T-54 | API | BR-25 | Invalid sort field | `400 Bad Request` | `my-tickets.api.test.ts` |
| T-55 | API | AC-20 | No owned Tickets | Empty data collection returned | `my-tickets.api.test.ts` |
| T-56 | API | AC-21 | No search matches | Empty filtered collection returned | `my-tickets.api.test.ts` |

---

# 7. My Tickets UI Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-57 | UI | FR-18, AC-14 | Ticket results render | Owned Ticket information displayed | `MyTickets.test.tsx` |
| T-58 | UI | FR-20, AC-16 | Search interaction | Search updates displayed results/request | `MyTickets.test.tsx` |
| T-59 | UI | FR-21, AC-17 | Filter interaction | Selected filters update results | `MyTickets.test.tsx` |
| T-60 | UI | FR-22, AC-18 | Sort interaction | Selected sort updates results | `MyTickets.test.tsx` |
| T-61 | UI | FR-23, AC-19 | Pagination controls | User can navigate valid pages | `MyTickets.test.tsx` |
| T-62 | UI | FR-24 | Loading state | Loading feedback displayed | `MyTickets.test.tsx` |
| T-63 | UI | FR-24, AC-20 | Empty state | No-Tickets message and Create action displayed | `MyTickets.test.tsx` |
| T-64 | UI | FR-24, AC-21 | No-results state | No-results feedback displayed separately | `MyTickets.test.tsx` |
| T-65 | UI | FR-24, AC-22 | API failure | Safe failure feedback displayed | `MyTickets.test.tsx` |
| T-66 | UI | FR-25 | Open Ticket | Selecting result opens Ticket Detail | `MyTickets.test.tsx` |
| T-67 | UI | AC-17 | Clear Filters | Search/filters reset to default state | `MyTickets.test.tsx` |

---

# 8. Ticket Detail Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-68 | API | FR-26, AC-23 | Retrieve owned Ticket | Correct Ticket data returned | `ticket-detail.api.test.ts` |
| T-69 | API | FR-28, BR-17, AC-24 | Cross-Requester access | `404`; Ticket data not returned | `ticket-detail.api.test.ts` |
| T-70 | API | FR-30, AC-25 | Missing Ticket | `404 Not Found` | `ticket-detail.api.test.ts` |
| T-71 | UI | FR-27, AC-23 | Ticket Detail rendering | Correct Ticket information displayed | `TicketDetail.test.tsx` |
| T-72 | UI | FR-27, AC-26 | Read-only presentation | Requester cannot edit Ticket Detail fields | `TicketDetail.test.tsx` |
| T-73 | UI | FR-30 | Loading state | Loading feedback displayed | `TicketDetail.test.tsx` |
| T-74 | UI | FR-30, AC-25 | Missing state | Safe not-found feedback displayed | `TicketDetail.test.tsx` |
| T-75 | UI | FR-30, AC-24 | Ownership failure | No other Requester's Ticket data displayed | `TicketDetail.test.tsx` |
| T-76 | UI | FR-30 | API failure | Safe error feedback displayed | `TicketDetail.test.tsx` |

---

# 9. Attachment API Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-77 | API | FR-31, AC-27 | Valid JPG/JPEG upload | `201`; Attachment stored | `attachments.test.ts` |
| T-78 | API | FR-31, AC-27 | Valid PNG upload | `201`; Attachment stored | `attachments.test.ts` |
| T-79 | API | FR-31, AC-27 | Valid WEBP upload | `201`; Attachment stored | `attachments.test.ts` |
| T-80 | API | FR-31, AC-27 | Valid PDF upload | `201`; Attachment stored | `attachments.test.ts` |
| T-81 | API | FR-32, BR-33, AC-28 | Unsupported type | `415`; Attachment rejected | `attachments.test.ts` |
| T-82 | API | FR-32, BR-34, AC-29 | File exactly 5 MB | Accepted if otherwise valid | `attachments.test.ts` |
| T-83 | API | FR-32, BR-34, AC-29 | File over 5 MB | `413`; Attachment rejected | `attachments.test.ts` |
| T-84 | API | FR-32, BR-35, AC-30 | Fifth active Attachment | Accepted | `attachments.test.ts` |
| T-85 | API | FR-32, BR-35, AC-30 | Sixth or concurrent Attachment beyond limit | `409`; exactly 5 remain active | `attachments.test.ts` |
| T-86 | API | FR-34, AC-31 | Download active Attachment | File returned | `attachments.test.ts` |
| T-87 | API | FR-35, AC-32 | Soft-remove own Attachment | Metadata marked removed | `attachments.test.ts` |
| T-88 | API | BR-43, AC-32 | Valid removal reason | Reason and timestamp stored | `attachments.test.ts` |
| T-89 | API | BR-43, AC-32 | Missing removal reason | `400`; removal rejected | `attachments.test.ts` |
| T-90 | API | BR-43, AC-32 | Whitespace removal reason | `400`; removal rejected | `attachments.test.ts` |
| T-91 | API | BR-43 | Removal reason >250 chars | `400`; removal rejected | `attachments.test.ts` |
| T-92 | API | FR-36, AC-32 | Metadata after removal | Metadata remains stored | `attachments.test.ts` |
| T-93 | API | FR-37, AC-33 | Download removed Attachment | File not returned | `attachments.test.ts` |
| T-94 | API | FR-38, AC-34 | Upload to another Requester's Ticket | `404`; upload rejected | `attachments.test.ts` |
| T-95 | API | FR-38, AC-34 | Metadata/download for another Requester's Attachment | `404`; no metadata or file returned | `attachments.test.ts` |
| T-96 | API | FR-38, AC-34 | Remove another Requester's Attachment | `404`; no modification | `attachments.test.ts` |
| T-97 | API | BR-36 | Remove already removed Attachment | `409`; predictable conflict response | `attachments.test.ts` |
| T-98 | UI | AC-35 | Attachment failure after Ticket creation | Existing Ticket remains visible and retry is offered | `CreateTicket.test.tsx` |

---

# 10. Attachment UI Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-99 | UI | FR-29 | Active Attachment metadata | Filename/type/size/state displayed | `AttachmentSection.test.tsx` |
| T-100 | UI | FR-31 | Upload interaction | Valid file can be selected/uploaded | `AttachmentSection.test.tsx` |
| T-101 | UI | FR-32, AC-28 | Invalid file type | Validation feedback displayed | `AttachmentSection.test.tsx` |
| T-102 | UI | FR-32, AC-29 | Oversized file | Validation feedback displayed | `AttachmentSection.test.tsx` |
| T-103 | UI | FR-32, AC-30 | Five active files | Additional upload unavailable/explained | `AttachmentSection.test.tsx` |
| T-104 | UI | FR-34, AC-31 | Download active file | Download action available | `AttachmentSection.test.tsx` |
| T-105 | UI | FR-35, AC-32 | Remove Attachment | Confirmation/reason interaction displayed | `AttachmentSection.test.tsx` |
| T-106 | UI | FR-36, AC-32 | Removed metadata | Removed state/reason remains visible | `AttachmentSection.test.tsx` |
| T-107 | UI | FR-37, AC-33 | Removed file actions | Download/Preview unavailable | `AttachmentSection.test.tsx` |
| T-108 | UI | AC-35 | Upload failure | Failed upload reported; Ticket remains usable | `AttachmentSection.test.tsx` |

---

# 11. UI Foundation and Responsive Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-109 | UI Style | FR-39 | Zen Green primary token | Required primary green is defined and rendered | `client/e2e/requester-ticket-flow.spec.ts` |
| T-110 | UI Style | FR-39 | Zen Green backgrounds/surfaces | Required foundation colors render in the browser | `client/e2e/requester-ticket-flow.spec.ts` |
| T-111 | UI Style | FR-43, AC-40 | Error communication | Error includes text, not color alone | `client/tests/lab-02/CreateTicket.test.tsx` |
| T-112 | UI Style | FR-42, AC-39 | Keyboard focus | Visible focus rule is served to the browser | `client/e2e/requester-ticket-flow.spec.ts` |
| T-113 | Responsive | FR-40, AC-36 | Desktop ≥992 px | Desktop layout remains usable | `requester-ticket-flow.spec.ts` |
| T-114 | Responsive | FR-40, AC-37 | Tablet 768–991 px | Tablet layout remains usable | `requester-ticket-flow.spec.ts` |
| T-115 | Responsive | FR-40, AC-38 | Mobile <768 px | Mobile layout stacks appropriately | `requester-ticket-flow.spec.ts` |
| T-116 | Responsive | FR-41, AC-36–38 | Horizontal overflow | No unintended page-level horizontal scroll | `requester-ticket-flow.spec.ts` |
| T-117 | Responsive | FR-41, AC-36–38 | Required actions visible | Important actions remain accessible | `requester-ticket-flow.spec.ts` |
| T-118 | Responsive | FR-41 | Long Attachment filename | Filename remains readable/wraps safely | `requester-ticket-flow.spec.ts` |

---

# 12. End-to-End Tests

| ID | Type | Req / AC | What is Tested | Expected Result | Planned Test File |
|---|---|---|---|---|---|
| T-119 | E2E | AC-02, AC-07, AC-14, AC-23 | Complete happy path | Select Requester → Create → My Tickets → Detail succeeds | `requester-ticket-flow.spec.ts` |
| T-120 | E2E | AC-04, AC-15 | Switch Requester | Ticket results change to selected Requester's data | `requester-ticket-flow.spec.ts` |
| T-121 | E2E | AC-16–19 | Search/filter/sort/page | My Tickets controls operate together correctly | `requester-ticket-flow.spec.ts` |
| T-122 | E2E | AC-27, AC-31, AC-32, AC-33 | Attachment lifecycle | Upload → download → remove → download unavailable | `requester-ticket-flow.spec.ts` |
| T-123 | E2E | AC-24, AC-34 | Ownership | Cross-Requester Ticket/Attachment access exposes no data | `requester-ticket-flow.spec.ts` |
| T-124 | E2E | AC-36 | Desktop workflow | Core workflow usable at desktop viewport | `requester-ticket-flow.spec.ts` |
| T-125 | E2E | AC-37 | Tablet workflow | Core workflow usable at tablet viewport | `requester-ticket-flow.spec.ts` |
| T-126 | E2E | AC-38 | Mobile workflow | Core workflow usable at mobile viewport | `requester-ticket-flow.spec.ts` |

---

# 13. Acceptance Criteria Traceability

| Acceptance Criterion | Planned Tests |
|---|---|
| AC-01 | T-01, T-02 |
| AC-02 | T-03, T-04, T-119 |
| AC-03 | T-05 |
| AC-04 | T-06, T-120 |
| AC-05 | T-07 |
| AC-06 | T-08 |
| AC-07 | T-10, T-11, T-34, T-119 |
| AC-08 | T-12 |
| AC-09 | T-13 |
| AC-10 | T-14–T-20, T-25–T-27, T-32 |
| AC-11 | T-21–T-24 |
| AC-12 | T-33 |
| AC-13 | T-35 |
| AC-14 | T-38, T-57, T-119 |
| AC-15 | T-39, T-120 |
| AC-16 | T-40, T-41, T-58, T-121 |
| AC-17 | T-42–T-45, T-59, T-67, T-121 |
| AC-18 | T-46–T-49, T-60, T-121 |
| AC-19 | T-50, T-51, T-61, T-121 |
| AC-20 | T-55, T-63 |
| AC-21 | T-56, T-64 |
| AC-22 | T-65 |
| AC-23 | T-68, T-71, T-119 |
| AC-24 | T-69, T-75, T-123 |
| AC-25 | T-70, T-74 |
| AC-26 | T-72 |
| AC-27 | T-77–T-80, T-100, T-122 |
| AC-28 | T-81, T-101 |
| AC-29 | T-82, T-83, T-102 |
| AC-30 | T-84, T-85, T-103 |
| AC-31 | T-86, T-104, T-122 |
| AC-32 | T-87–T-90, T-105, T-106, T-122 |
| AC-33 | T-93, T-107, T-122 |
| AC-34 | T-94–T-96, T-123 |
| AC-35 | T-98, T-108 |
| AC-36 | T-113, T-116, T-117, T-124 |
| AC-37 | T-114, T-116, T-117, T-125 |
| AC-38 | T-115–T-118, T-126 |
| AC-39 | T-112 |
| AC-40 | T-111 |

All Acceptance Criteria have at least one planned test.

---

# 14. Required Test States

The test suite must include representative coverage for the following states.

### Development Requester Selection

- Loading
- Ready
- Empty
- Failure
- Selected
- Requester switching

### Create Ticket

- Initial
- Valid submission
- Invalid submission
- Boundary values
- Submitting
- Success
- Backend failure
- Duplicate-submit prevention

### My Tickets

- Loading
- Results
- Empty
- No Results
- Search
- Filter
- Sort
- Pagination
- Failure

### Ticket Detail

- Loading
- Owned Ticket
- Missing Ticket
- Cross-Requester Ticket
- Failure

### Attachments

- Valid upload
- Unsupported type
- Size boundary
- Oversized
- Active count boundary
- Download
- Soft removal
- Removed metadata
- Removed download blocked
- Cross-Requester access
- Upload failure

---

# 15. Test Data Requirements

Tests should use controlled and repeatable test data.

Required representative data includes:

- At least two active Development Requesters for ownership tests
- At least one inactive Development Requester
- All required Categories
- Multiple Related Systems
- Multiple Tickets owned by different Requesters
- Tickets with different Categories
- Tickets with different Requested Priorities
- Tickets with sortable timestamps
- Active Attachments
- Soft-removed Attachments

Tests must not depend on manual data created by a developer before execution.

---

# 16. Test Execution Record

The table below will be updated after implementation.

| Test Area | Command | Result | Evidence |
|---|---|---|---|
| Server API / Integration | `cd server && npm test` | Passed | 8 files, 78 tests; includes `server/tests/lab-02/attachments.test.ts` |
| Client Component | `cd client && npm test` | Passed | 6 files, 40 tests; includes `AttachmentSection.test.tsx` and Create Ticket attachment coverage |
| Server Production Build | `cd server && npm run build` | Passed | TypeScript compilation completed successfully |
| Client Production Build | `cd client && npm run build` | Passed | TypeScript and Vite production build completed successfully |
| UI Style / Responsive | `cd client && npm run test:e2e` | Passed | Browser assertions for Zen Green colors, visible focus rule, desktop/tablet/mobile layouts, required controls, and no horizontal overflow |
| E2E | `cd client && npm run test:e2e` | Passed | 2 tests; requester flow, attachment lifecycle, and access isolation. Transient captures use ignored `artifacts/lab-02/runtime-screenshots/`; reviewed evidence remains in `artifacts/lab-02/screenshots/`. |
| Full Test Suite | Server/client `npm test`, builds, and client `npm run test:e2e` | Passed | 120 tests passed across 16 files, plus production builds |

Final values must use the actual project commands and evidence paths.

---

# 17. Final Test Summary

```text
Total Tests: 120
Passed: 120
Failed: 0
Skipped: 0
```

Expected final condition:

- All required tests pass.
- No required tests are skipped.
- Acceptance Criteria remain fully traceable.
- Tests use actual implementation paths.
- Responsive evidence is captured.
- Ownership behavior is verified with multiple Development Requesters.

---

# 18. Test Maintenance Rule

If a Functional Requirement, Business Rule, API contract, UI behavior, or Acceptance Criterion changes:

1. Update the relevant specification document.
2. Update the affected planned test.
3. Update the AC traceability table if required.
4. Implement the change.
5. Run the affected tests.
6. Record the final result and evidence.

The final `tests.md`, implementation, and Acceptance Criteria must remain consistent.
