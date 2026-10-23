# Lab 4 Engineering Contract

Source basis: the complete 11-page official **CPE 334 Lab 4: TokTickIT Actions Taken, Dashboards, and Final Regression** assignment, the inspected Lab 1–3 repository, and GitHub Issues #23–#32. This document distinguishes mandatory assignment behavior, confirmed existing behavior, and engineering decisions made where the handout leaves implementation details open.

## 1. Sprint Goal

Complete TokTickIT’s core service-desk workflow by adding assignable and auditable Actions Taken, enforcing final Ticket resolution rules, providing concise role-appropriate dashboards, and hardening all Lab 1–3 functionality for a secure, responsive, accessible final demonstration.

## 2. Stakeholder Request

IT Staff need to plan, assign, perform, and record work beneath a Ticket while the primary Ticket Owner continues coordinating the Ticket as a whole. Requesters need read-only visibility into Actions Taken on their own Tickets and a dashboard that highlights their work. Staff need an operational dashboard. Formal resolution remains an IT decision even when a Requester reports that the problem appears resolved.

## 3. Scope

### Included

- A one-to-many Ticket-to-Action Taken model with assignment and lifecycle state.
- Action list, detail, create, edit, assign/reassign, start, complete, and cancel behavior.
- Required Action Date/Time and Description; completion Result; automatic creator/performer identity; conditional follow-up note; optional attachment notes.
- Requester read-only Action access on owned Tickets; Staff/Admin operations enforced by the backend.
- Final Ticket transition matrix, resolution gate, advisory Requester feedback, stable ordering, and append-only workflow history.
- Requester and Staff dashboards with authoritative metrics, concise lists, and authorized drill-down.
- Administrator reuse of Staff behavior and dashboard.
- Additive Prisma migration/backfill, idempotent seed, security, concurrency, safe failures, responsive/accessibility work, and complete Lab 1–3 regression.
- Planning for Issues #24–#32, repository evidence, peer review, staged integration, and final nine-part report support.

### Explicitly excluded

- SLA clocks, escalation engines, on-call scheduling, or breach notifications.
- Email, SMS, LINE, push, or other external notifications.
- Inventory, spare parts, purchasing, service cost accounting, time-sheet billing, payroll, or labor-cost calculation.
- Multi-level approvals or electronic signatures.
- Advanced BI, custom report builders, export warehouses, or configurable analytics.
- Multi-tenant organizations or production-scale cloud operations.
- Action file uploads; `attachmentNotes` identifies relevant existing Ticket files or other context.
- Any unapproved product feature, final submission PDF generation, or fabricated evidence.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | A Ticket shall contain zero, one, or multiple ordered Actions Taken. |
| FR-02 | Staff/Admin shall create an Action with an eligible assignee; the backend shall derive its creator. |
| FR-03 | Staff/Admin shall view and edit permitted Action fields while the Action is non-terminal. |
| FR-04 | Staff/Admin shall assign or reassign a non-terminal Action to an active eligible User. |
| FR-05 | The Action lifecycle shall support planned, in-progress, completed, and cancelled work through explicit permitted transitions. |
| FR-06 | Completion shall validate the Result and automatically record the authenticated performer and completion time. |
| FR-07 | Cancellation shall require confirmation and a reason and shall preserve the historical record. |
| FR-08 | Requesters shall list and view all current Actions on owned Tickets but shall not create or change them. |
| FR-09 | Ticket Owner, Action assignee, Action creator, and Action performer shall remain distinct concepts. |
| FR-10 | Existing Staff/Admin Ticket claim, assignment, IT Priority, and status operations shall remain available. |
| FR-11 | Ticket status changes shall follow the explicit transition matrix and resolution gate. |
| FR-12 | Requester “Problem Appears Resolved” shall remain advisory and shall not automatically resolve a Ticket. |
| FR-13 | Requester dashboard shall show own open/waiting metrics plus attention-required, recently updated, and recently resolved owned Tickets. |
| FR-14 | Staff dashboard shall show unassigned/open work, current-owner work, counts by status and IT Priority, urgent/recent Tickets, and current-user Actions. |
| FR-15 | Administrator shall reuse the Staff dashboard and Staff Action/Ticket behavior. |
| FR-16 | The backend shall authoritatively compute every dashboard metric and return concise lists rather than complete Ticket collections. |
| FR-17 | Dashboard metrics and rows shall drill into authorized filtered lists, Ticket detail, or Action detail. |
| FR-18 | New screens shall provide loading, empty/no-results, success, validation, forbidden, conflict, not-found, and safe-failure states. |
| FR-19 | Mutations shall prevent duplicate submission and preserve safe entered data after recoverable failures. |
| FR-20 | New UI shall extend the Zen Green shell, responsive conventions, keyboard support, semantics, focus visibility, and non-color feedback. |
| FR-21 | Migration shall preserve all existing Users, Tickets, Attachments, Public Comments, Internal Notes, Sessions, and reference data. |
| FR-22 | Seed shall be repeatable and cover major Ticket/Action states, priorities, owners, and zero/non-zero dashboard results. |
| FR-23 | New APIs shall enforce session, password-change, CSRF, role, ownership, assignee eligibility, validation, and safe error rules. |
| FR-24 | Concurrent/stale Action and Ticket writes shall fail safely without partial changes or silent overwrite. |
| FR-25 | All completed Lab 1–3 features and approved APIs shall remain available to permitted Users and regression-tested. |
| FR-26 | Final hardening shall remove broken links, blocking console errors, placeholder text, obsolete controls, and inconsistent feedback. |

## 5. Business Rules

### Actions Taken

| ID | Rule |
| --- | --- |
| BR-01 | Action Taken belongs to exactly one Ticket. |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be by a different IT Staff member. |
| BR-03 | An Action is created in `PLANNED` with exactly one assignee. The assignee must be an active `IT_STAFF` or `ADMINISTRATOR` User. |
| BR-04 | `actionAt` is a required ISO 8601 instant stored in UTC. It is the planned/performed business time, may be future while non-terminal, and must not be future when completing. |
| BR-05 | `description` is required trimmed plain text of 1–2000 characters. |
| BR-06 | `result` is nullable while `PLANNED`/`IN_PROGRESS` and required trimmed plain text of 1–2000 characters before `COMPLETED`. |
| BR-07 | `followUpRequired` is Boolean. `followUpNote` is required trimmed plain text of 1–1000 characters when true and must be null when false. |
| BR-08 | `attachmentNotes` is nullable trimmed plain text up to 1000 characters. It describes where to find relevant images/files and does not upload or replace an existing Ticket Attachment. |
| BR-09 | `createdById` comes from the authenticated creator and is immutable. `performedById` is null until completion, then becomes the authenticated completing User and is immutable. Neither is accepted from client input. |
| BR-10 | Staff/Admin may edit Action Date/Time, Description, Result, follow-up fields, and attachment notes only in `PLANNED` or `IN_PROGRESS`; Ticket, creator, performer, status, and assignee use dedicated operations or are immutable. |
| BR-11 | Staff/Admin may reassign `PLANNED` or `IN_PROGRESS` Actions. Missing, inactive, or Requester assignees are rejected without mutation. Deactivation does not erase historical assignment. |
| BR-12 | Only the current Action assignee or an Administrator may start or complete an Action. Any Staff/Admin with Ticket access may cancel or reassign it. |
| BR-13 | Action transitions are `PLANNED → IN_PROGRESS`, `PLANNED → CANCELLED`, `IN_PROGRESS → COMPLETED`, and `IN_PROGRESS → CANCELLED`; no other transition is allowed. |
| BR-14 | Completion sets `performedById` and `completedAt` from the authenticated session/server clock. Cancellation requires confirmation and a trimmed reason of 1–500 characters and records `cancelledById`/`cancelledAt`. |
| BR-15 | `COMPLETED` and `CANCELLED` are terminal and read-only. New Actions may be created only while the parent Ticket is active/open; existing Actions are never hard-deleted and remain visible after Ticket resolution, closure, reopening, or cancellation. |
| BR-16 | Action order is `actionAt desc`, then `id desc`; default page is 1 with 20 items and allowed page sizes are 10, 20, and 50. |
| BR-17 | Every Action create, edit, reassignment, and transition appends an Action event with actor, type, before/after values or snapshot, and UTC time in the same transaction. |

### Action authorization matrix

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| List/view Actions | Own Tickets only | All accessible Tickets | All accessible Tickets |
| Create/edit Action | Deny | Allow under BR-03–BR-10 | Allow under BR-03–BR-10 |
| Assign/reassign Action | Deny | Allow under BR-11 | Allow under BR-11 |
| Start/complete Action | Deny | Current assignee only | Allow override |
| Cancel Action | Deny | Allow with confirmation/reason | Allow with confirmation/reason |
| View Action event/audit history | Deny | Allow | Allow |

### Ticket workflow

| ID | Rule |
| --- | --- |
| BR-18 | Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`. |
| BR-19 | Only active Staff/Admin may own a Ticket or change owner, IT Priority, or formal Ticket status. |
| BR-20 | `IN_PROGRESS` and `RESOLVED` require an active eligible Ticket Owner. |
| BR-21 | Resolution requires an active owner, at least one `COMPLETED` Action, and no `PLANNED` or `IN_PROGRESS` Actions. A `CANCELLED` Action does not satisfy the completed-work requirement. |
| BR-22 | `CLOSED` and `CANCELLED` require explicit confirmation. Ticket `CANCELLED` remains terminal. |
| BR-23 | Requester resolution indication is idempotent advisory feedback, never changes status, and clears on `REOPENED`. |
| BR-24 | Every Ticket owner/status change appends a workflow event. Existing history is never rewritten or deleted. |
| BR-25 | Ticket and Action mutations require `expectedVersion`; mismatch returns `409`, includes minimum authorized current state, and changes nothing. |

#### Ticket transition matrix

| From | Allowed to | Roles | Additional gate |
| --- | --- | --- | --- |
| `NEW` | `OPEN`, `CANCELLED` | Staff, Admin | Cancel confirmation. |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Staff, Admin | Active owner for progress/resolution; BR-21 for resolution; cancel confirmation. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Staff, Admin | BR-21 for resolution; cancel confirmation. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | Staff, Admin | Active owner for progress/resolution; BR-21 for resolution; cancel confirmation. |
| `RESOLVED` | `CLOSED`, `REOPENED` | Staff, Admin | Close confirmation. |
| `CLOSED` | `REOPENED` | Staff, Admin | Clear Requester indication. |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Staff, Admin | Active owner for progress/resolution; BR-21 for resolution; cancel confirmation. |
| `CANCELLED` | None | None | Terminal. |

### Dashboard calculations

Capture one backend `asOf` instant per response. Store/compare UTC; relative windows include the lower boundary. All enumerated count keys appear with zero when empty.

| ID | Rule |
| --- | --- |
| BR-26 | Active/open Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`. |
| BR-27 | Requester `openCount` counts owned active/open Tickets; `waitingForRequesterCount` counts the owned `WAITING_FOR_REQUESTER` subset. |
| BR-28 | Requester `attentionRequired` is up to 10 owned `WAITING_FOR_REQUESTER` Tickets ordered `updatedAt desc`, `id desc`. |
| BR-29 | Requester `recentlyUpdated` is up to 10 owned Tickets updated in the inclusive previous 30 days, ordered `updatedAt desc`, `id desc`. |
| BR-30 | Requester `recentlyResolved` is up to 10 owned Tickets with `resolvedAt` in the inclusive previous 30 days, ordered `resolvedAt desc`, `id desc`. |
| BR-31 | Staff `unassignedOpenCount` counts active/open Tickets with null owner; `myOpenTicketCount` counts active/open Tickets owned by the authenticated User. |
| BR-32 | `countsByStatus` counts all Tickets across all eight statuses; `countsByItPriority` counts active/open Tickets across `LOW`, `MEDIUM`, and `HIGH`. |
| BR-33 | Staff `urgentTickets` is up to 10 active/open `HIGH` IT Priority Tickets; `recentlyUpdated` is up to 10 active/open Tickets updated in the inclusive previous 7 days. Both order by `updatedAt desc`, `id desc`. |
| BR-34 | Staff `myActiveActionsCount` and `myActiveActions` use Actions assigned to the authenticated User in `PLANNED`/`IN_PROGRESS`; the list is limited to 10 and orders `actionAt asc`, `id asc`. |
| BR-35 | Staff `myRecentCompletedActions` is up to 10 Actions performed by the authenticated User in the previous 30 days, ordered `completedAt desc`, `id desc`. |
| BR-36 | Administrator receives the Staff dashboard; “my” metrics use the authenticated Administrator. No optional account counts are added. |
| BR-37 | Every metric/list is computed by authorized backend queries. Dashboard failure returns a safe whole-response error, not partial values presented as authoritative. |

### Shared security and failure rules

| ID | Rule |
| --- | --- |
| BR-38 | Unknown fields, client-supplied identity/audit fields, invalid enums, and malformed dates/IDs are rejected. |
| BR-39 | New mutations require the existing authenticated session, completed password change, permitted Origin, and session-bound CSRF token. |
| BR-40 | Missing and inaccessible Requester resources use the same safe `404`; errors never expose protected data, hashes, tokens, SQL, stack traces, paths, or stored filenames. |
| BR-41 | Duplicate clicks are blocked client-side; server version/state predicates and transactions prevent duplicate/partial effects during retries or races. |

## 6. UI Specification Summary

| Area | Required behavior |
| --- | --- |
| Shell/navigation | Add role-appropriate Dashboard navigation and active-page indication without removing permitted Lab 1–3 screens. |
| Actions Taken | Operational Ticket Detail supports list, create, view/edit, assign/reassign, start, complete, cancel, audit view, validation, and conflicts. Requester Ticket Detail shows the same current Actions read-only. |
| Ticket workflow | Display only backend-provided permitted transitions; distinguish Ticket status from Action status; show the BR-21 gate and refresh Ticket summary after success. |
| Requester dashboard | Own metrics, attention-required, recent, resolved, empty/error behavior, and authorized drill-down without duplicating My Tickets. |
| Staff/Admin dashboard | Concise Ticket metrics, recent/urgent lists, assigned/current-user Action work, completed-by-me history, and drill-down. |
| Feedback/hardening | Consistent loading, validation, success, empty, forbidden, conflict, not-found, and safe-failure states; protect form values and prevent repeat actions. |
| Responsive/accessibility | Zen Green at desktop/tablet/mobile, 320 px reflow, semantic labels, keyboard operation, visible focus, accessible dialogs, announcements, contrast, and no color-only meaning. |

Detailed screen structure, fields, messages, focus behavior, and responsive rules are in [`ui-spec.md`](./ui-spec.md).

## 7. Data Changes

### Proposed Prisma increment

| Model/change | Fields/purpose |
| --- | --- |
| `ActionTaken` | `id`, `ticketId`, `actionAt`, `description`, nullable `result`, `status`, `assigneeId`, `createdById`, nullable `performedById`, `followUpRequired`, nullable `followUpNote`, nullable `attachmentNotes`, nullable `completedAt`, nullable `cancelledAt`, nullable `cancelledById`, nullable `cancellationReason`, `version`, `createdAt`, `updatedAt`. |
| `ActionTakenEvent` | `id`, `actionTakenId`, `actorId`, `eventType`, `fromStatus`, `toStatus`, `fromAssigneeId`, `toAssigneeId`, nullable `snapshot Json`, `createdAt`; append-only. |
| `TicketWorkflowEvent` | `id`, `ticketId`, `actorId`, event type, before/after status and owner, `createdAt`; append-only for post-migration mutations. |
| `Ticket` | Add `version Int @default(1)` and nullable `resolvedAt DateTime`. Existing fields/relations remain. |
| Enums | `ActionStatus`: `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; `ActionEventType` and `TicketEventType` for contracted events. |

Foreign keys use `onDelete: Restrict` for historical Ticket/User/Action references; User deactivation is not deletion. Indexes:

- `ActionTaken(ticketId, actionAt, id)` for Ticket history;
- `ActionTaken(assigneeId, status, actionAt, id)` for current-user work;
- `ActionTaken(performedById, completedAt, id)` for completed-by-me;
- `ActionTakenEvent(actionTakenId, createdAt, id)` and `TicketWorkflowEvent(ticketId, createdAt, id)` for audit order;
- existing Ticket status/owner/priority/update indexes remain; add `(status, ownerId)` and `(status, itPriority, updatedAt)` only after query-plan verification.

### Migration, backfill, recovery, and seed

- Add structures without renaming/deleting Lab 1–3 data; backfill every existing `Ticket.version=1`.
- Existing Tickets begin with zero Actions. This is valid and does not block viewing; BR-21 applies only when a later resolution is attempted.
- Backfill `resolvedAt=updatedAt` for existing `RESOLVED` or `CLOSED` Tickets as a documented deterministic proxy because Lab 3 stored no authoritative resolution time. Do not fabricate historical actors or workflow events. Other Tickets receive null.
- Validate foreign keys/constraints after backfill. Verify populated-data counts, IDs, relations, and representative content before/after migration.
- Take a database backup before deployment. A down migration is safe only before Lab 4 data exists; afterward recover forward or restore/export rather than dropping history-bearing tables.
- Seed by stable natural keys/upserts so repeated runs converge without duplicates. Include all Ticket statuses/priorities, assigned/unassigned owners, active/inactive Users, zero/one/multiple Actions, all Action statuses, different owner/assignee/performer combinations, dashboard zero/non-zero/boundary data, and resolution-gate pass/fail cases.

Database decisions:

1. **Normalize Action Taken and event rows.** One-to-many relations, foreign keys, pagination, assignee/performer queries, and append-only history are safer and more queryable than embedded Ticket JSON.
2. **Keep current state plus append-only events and integer versions.** Reads stay direct while every mutation is attributable and compare-and-swap prevents silent lost updates.
3. **Separate creator, assignee, performer, and Ticket owner.** These identities represent different responsibilities required by the handout and must not be inferred from one another.

## 8. API Contract

Existing Lab 1–3 routes remain. Proposed Lab 4 routes are:

| Method | Endpoint | Authorization | Purpose |
| --- | --- | --- | --- |
| GET | `/api/tickets/:ticketId/actions` | Owning Requester, Staff, Admin | Ordered Action list. |
| GET | `/api/actions/:actionId` | Owning Requester, Staff, Admin | Current Action detail. |
| GET | `/api/staff/actions/:actionId/events` | Staff, Admin | Append-only Action event history. |
| POST | `/api/staff/tickets/:ticketId/actions` | Staff, Admin | Create assigned `PLANNED` Action. |
| PATCH | `/api/staff/actions/:actionId` | Staff, Admin | Edit non-terminal Action content. |
| PATCH | `/api/staff/actions/:actionId/assignee` | Staff, Admin | Reassign eligible User. |
| PATCH | `/api/staff/actions/:actionId/status` | Staff, Admin | Start, complete, or cancel under the Action matrix. |
| GET | `/api/dashboards/requester` | Requester | Own concise metrics/lists. |
| GET | `/api/dashboards/staff` | Staff, Admin | Operational concise metrics/lists. |

Existing Ticket owner, priority, and status routes gain `expectedVersion`; status resolution enforces BR-21. The documented-but-currently-unimplemented Requester resolution-indication route remains required. Exact existing/proposed distinctions, payloads, validation, errors, pagination, and JSON examples are in [`api-spec.md`](./api-spec.md).

## 9. Acceptance Criteria

| ID | Acceptance criterion |
| --- | --- |
| AC-01 | Given permitted Staff and valid data, creating an Action stores it under the correct Ticket with authenticated creator, approved active assignee, `PLANNED` status, and version 1. |
| AC-02 | Given an authenticated Requester, dashboard data contains only metrics and recent Tickets owned by that Requester. |
| AC-03 | Tickets with zero, one, or multiple Actions return the correct fields, total, and deterministic order. |
| AC-04 | Requesters can read all current Actions on owned Tickets but cannot mutate or read audit events; cross-owner access is safely unavailable. |
| AC-05 | Staff/Admin Action creation/editing validates dates, text limits, conditional follow-up note, attachment notes, unknown fields, and terminal-state rules without partial changes. |
| AC-06 | Reassignment accepts only active Staff/Admin Users and rejects inactive, Requester, missing, terminal, unauthorized, and stale targets without mutation. |
| AC-07 | Only the four listed Action transitions succeed; role/assignee rules apply and invalid transitions leave state/history unchanged. |
| AC-08 | Completing an Action requires a valid non-future action time and Result and records authenticated performer/completion time atomically. |
| AC-09 | Cancelling requires confirmation/reason, records actor/time, remains visible, and makes the Action terminal. |
| AC-10 | Action edits and lifecycle/assignment changes increment version and append ordered audit events; stale concurrent writes return recoverable `409`. |
| AC-11 | Ticket owner, Action creator, assignee, and performer can differ and remain correctly labelled and historically preserved. |
| AC-12 | Every permitted Ticket transition succeeds for Staff/Admin and every invalid, unauthorized, unconfirmed, or terminal transition fails atomically. |
| AC-13 | Ticket resolution succeeds only with an active owner, at least one completed Action, and no planned/in-progress Actions; close remains separate. |
| AC-14 | “Problem Appears Resolved” is idempotent advisory feedback, never changes status, and clears on reopen. |
| AC-15 | Requester dashboard counts, attention/recent/resolved lists, boundaries, ordering, empty behavior, and drill-down match BR-26–BR-30. |
| AC-16 | Staff dashboard Ticket metrics, urgent/recent lists, assigned Actions, completed-by-me list, boundaries, ordering, and drill-down match BR-26 and BR-31–BR-35. |
| AC-17 | Administrator receives the Staff dashboard with global values unchanged and Administrator-scoped “my” values. |
| AC-18 | Dashboard values come from authorized backend queries, contain concise bounded data, show all zero keys, and fail as one safe response rather than misleading partial metrics. |
| AC-19 | Migration preserves Lab 1–3 data/relations, applies documented backfill, creates required constraints/indexes, and has a tested recovery strategy. |
| AC-20 | Repeated seed runs create no duplicates and provide every required Ticket, Action, ownership, gate, and dashboard scenario. |
| AC-21 | UI exposes role-appropriate list/create/assign/edit/transition/complete/cancel controls and complete loading/empty/success/validation/forbidden/conflict/not-found/error feedback. |
| AC-22 | Duplicate submission is prevented or safely rejected and important form values survive recoverable failure. |
| AC-23 | Major Lab 4 screens preserve Zen Green and work without clipping, overlap, hidden actions, or page-level horizontal scrolling at desktop, tablet, mobile, 320 px, and 200% zoom. |
| AC-24 | New workflows are keyboard operable, labelled, focus-visible/managed, announced readably, non-color-dependent, and WCAG 2.1 AA compatible. |
| AC-25 | New endpoints enforce authentication, password-change, CSRF, role, ownership, and safe errors without exposing protected/internal data. |
| AC-26 | Concurrent Action/Ticket operations use atomic version/state predicates so one winner is recorded and losing requests cannot silently overwrite or partially mutate. |
| AC-27 | All completed Lab 1–3 authentication, Requester, Attachment, queue, workflow, communication, and Administrator workflows remain available and pass regression coverage. |
| AC-28 | Seed-scale dashboard and Action list requests remain bounded, avoid evident N+1 behavior, and meet documented smoke thresholds. |
| AC-29 | Final hardening finds no known blocking broken link, console error, placeholder, unfinished control, obsolete duplicate UI, or inaccurate setup/test instruction. |

## 10. Definition of Done

- [ ] AC-01–AC-29 are implemented and traced to automated/planned verification; actual results replace `Planned / Not Run` only after execution.
- [ ] Migration is verified on populated Lab 3 data, recovery is documented, and seed is idempotent.
- [ ] Backend authorization, validation, concurrency, Action/Ticket history, and dashboard calculations are tested directly.
- [ ] Staff/Admin and Requester UI cover required Action, workflow, dashboard, feedback, responsive, and accessibility behavior.
- [ ] Lab 1–3 regression, production builds, performance smoke, and representative E2E suites pass with no required skips.
- [ ] Desktop, tablet, mobile, 320 px, 200% zoom, keyboard, contrast, focus, clipping, overlap, and overflow checks have genuine evidence.
- [ ] README setup/migration/seed/test/demo instructions are current; no real secret, placeholder, broken link, or blocking console error remains.
- [ ] Each implementation issue receives peer review; the `reviewer.md` and `ai-use.md` templates are completed with real review, AI-use, reflection, and verification evidence, and genuine screenshots are retained.
- [ ] Feature branches merge through `lab4-staging` and then `main`; Issue #32 prepares—but Issue #23 does not generate—the final Answer Part 1–9 PDF.

## 11. Assumptions and Decisions

### Engineering decisions left open by the handout

| Topic | Decision | Reason |
| --- | --- | --- |
| Action lifecycle | `PLANNED → IN_PROGRESS → COMPLETED`, with cancellation from either non-terminal state | Minimal state model covering assign, transition, complete, and cancel without equating Action/Ticket statuses. |
| Initial assignment | One eligible assignee required on create | Matches the handout example criterion and avoids unowned planned work. |
| Performer | Authenticated completer, nullable before completion | “Performed by (auto)” becomes truthful only when work completes. |
| Pending Result | Nullable before completion and required at completion | Planned work may not have an outcome yet; completed work must record one. |
| Attachment Notes | Optional text naming relevant existing Ticket files/context; no Action upload | Matches the handout’s “what file to look for” purpose without adding an excluded/unrequested file subsystem. |
| Lifecycle authority | Assignee starts/completes; Admin may override; Staff/Admin may reassign/cancel | Keeps assignment meaningful while retaining support recovery. |
| Resolution gate | Active owner, one completed Action, no active Actions | Prevents formal resolution while planned/in-progress work remains. |
| Dashboard windows | Requester 30 days; Staff recent 7 days; completed-by-me 30 days; lists max 10 | Precise, concise, and testable. |
| Legacy resolution time | Backfill current Resolved/Closed Tickets from `updatedAt` and label it as proxy | Gives deterministic dashboard treatment without fabricating actor/history. |
| Admin dashboard | Reuse Staff dashboard without optional account counts | Meets the handout with minimal divergence. |
| Concurrency | Integer version compare-and-swap plus transaction/event | Covers content, assignment, and state races uniformly. |

### Issue and implementation order

| Course issue | Repository issue | Planned dependency/scope |
| --- | --- | --- |
| #23 | GitHub #54 | This contract and test plan only. |
| #24 | GitHub #55 | Action data model, migration, backfill, seed. |
| #25 | GitHub #56 | Action API, authorization, lifecycle, tests. |
| #26 | GitHub #57 | Action Ticket Detail UI and component/responsive tests. |
| #27 | GitHub #58 | Ticket workflow, resolution gate, history, conflicts. |
| #28 | GitHub #59 | Staff/Admin dashboard API/UI and accuracy tests. |
| #29 | GitHub #60 | Requester dashboard API/UI and ownership tests. |
| #30 | GitHub #61 | Regression, security, responsive/accessibility, UI hardening. |
| #31 | GitHub #62 | E2E tests, release integration, genuine evidence. |
| #32 | GitHub #63 | README/final docs, review/AI/screenshot evidence, final report preparation. |

### Required future repository structure

The following tree preserves the handout's minimum Lab 4 structure and filename order. The handout abbreviates the component-test location as `client/.../lab-04 tests/`; this contract resolves that placeholder to the repository's established `client/tests/lab-04/` Vitest directory. The handout's repository-root `e2e/lab-04/` path is retained exactly. `dashboards.spec.ts` appears at the top of the handout's following page and completes that E2E subtree.

```text
docs/lab-04/
  specification.md
  tests.md
  ui-spec.md
  api-spec.md
  reviewer.md                 # template now; real evidence completed by Issue #32
  ai-use.md                   # template now; real evidence completed by Issue #32
server/tests/lab-04/
  actions-taken.api.test.ts
  ticket-workflow.api.test.ts
  requester-dashboard.api.test.ts
  staff-dashboard.api.test.ts
client/tests/lab-04/
  StaffDashboard.test.tsx
  RequesterDashboard.test.tsx
  ActionsTaken.test.tsx
  TicketWorkflow.test.tsx
e2e/lab-04/
  actions-taken-flow.spec.ts
  ticket-resolution.spec.ts
  dashboards.spec.ts
artifacts/lab-04/screenshots/
  staff-dashboard/
  requester-dashboard/
  actions-taken/
```

This is the required minimum, not the complete verification inventory. Additional unit, migration, seed, performance, style, responsive, and accessibility test files listed in [`tests.md`](./tests.md#supplementary-planned-test-files) remain inside the same required `server/tests/lab-04/`, `client/tests/lab-04/`, and `e2e/lab-04/` directories.

Issue #23 originally produced the four contract documents. At the user's request, `reviewer.md` and `ai-use.md` now exist as clearly marked templates only; their real evidence remains an Issue #32 responsibility. Future tests, evidence folders, README changes, implementation, Git operations, and the final PDF still belong to Issues #24–#32 and the user-managed branch/PR workflow.
