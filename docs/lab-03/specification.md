# Lab 3 Specification

## 1. Sprint Goal

Replace the Development Requester selector with secure users and role-based access while preserving Lab 2 Requester ticketing and adding IT Staff ticket operations and simple Administrator user management.

## 2. Stakeholder Request

Users must sign in with one role. Requesters manage only their own Tickets, IT Staff operate the shared Ticket Queue, and Administrators manage accounts. Initial passwords must be changed before normal access, and every permission must be enforced by the backend.

## 3. Scope

### Included

- Login, logout, current User, sessions, throttling, and mandatory password change.
- Requester, IT Staff, and Administrator roles.
- Backend role and ownership authorization.
- Authenticated Lab 2 Requester Ticket and Attachment workflows.
- IT Staff queue, Ticket ownership, IT Priority, and status workflow.
- Public Comments, Internal Notes, and Requester resolution indication.
- Minimal User Management and required seed data.
- Zen Green responsive UI and complete automated test coverage.

### Excluded

- Registration, email invitations/reset, MFA, social login, and SSO.
- Multiple roles, user deletion, bulk actions, import/export, and extended profiles.
- Departments, organizations, role history, and account audit screens.
- Actions Taken, SLA/escalation, notifications, and advanced dashboards.
- Comment/note editing or deletion.
- Multi-tenancy and production/cloud infrastructure changes.
- Advanced user-list pagination, sorting, and multi-filter features.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Active Users shall sign in with email and password. |
| FR-02 | Users with an initial password shall change it before normal access. |
| FR-03 | The system shall provide current-User retrieval and session-invalidating logout. |
| FR-04 | The backend shall enforce session, activation, role, ownership, and password-change rules. |
| FR-05 | The shell shall show the current User, role, Logout, and permitted navigation. |
| FR-06 | Requesters shall create Tickets using only their authenticated identity. |
| FR-07 | Requesters shall search, filter, sort, paginate, and open only their own Tickets. |
| FR-08 | Requesters shall manage permitted Attachments only on their own Tickets. |
| FR-09 | Requesters shall read and post Public Comments on their own Tickets. |
| FR-10 | Requesters shall indicate that an active Ticket appears resolved without changing its formal status. |
| FR-11 | The Requester selector, Change Requester action, client identity state, and `X-Requester-Id` shall be removed. |
| FR-12 | IT Staff shall use a shared searchable, filterable, sortable, paginated Ticket Queue. |
| FR-13 | IT Staff shall open operational Ticket Detail including existing Attachments. |
| FR-14 | IT Staff shall claim, assign, reassign, or unassign Tickets. |
| FR-15 | IT Staff shall update IT Priority without changing Requested Priority. |
| FR-16 | IT Staff shall perform only permitted Ticket status transitions. |
| FR-17 | IT Staff shall read and post Public Comments and Internal Notes. |
| FR-18 | Administrators shall list Users and search by name/email with an optional role filter. |
| FR-19 | Administrators shall create a User with one role and an initial password. |
| FR-20 | Administrators shall edit name, email, role, and activation state. |
| FR-21 | Administrators shall set a new initial password and revoke the User's sessions. |
| FR-22 | User Management shall prevent self-deactivation and removal of the last active Administrator. |
| FR-23 | Non-Administrators shall be denied User Management APIs and screens. |
| FR-24 | Public Comments shall be visible to the owning Requester, IT Staff, and Administrator. |
| FR-25 | Internal Notes shall be visible only to IT Staff and Administrator. |
| FR-26 | Meaningful screens shall show loading, validation, success, empty/no-results, forbidden, conflict, and safe failure states. |
| FR-27 | Lab 3 screens shall extend the Lab 2 Zen Green responsive and accessible design. |
| FR-28 | Migration shall preserve existing Users/Requesters, Tickets, Categories, Related Systems, and Attachments. |
| FR-29 | Seed data shall be idempotent and meet the required role and Ticket distribution. |
| FR-30 | Existing Lab 1 and Lab 2 behavior shall remain regression-tested. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | Only active Users with valid credentials may authenticate. |
| BR-02 | Email is trimmed, lowercased, valid, no longer than 254 characters, and unique case-insensitively. |
| BR-03 | Passwords use Argon2id and are never stored or returned in plaintext. |
| BR-04 | Password length is 12–128 characters, cannot be all whitespace, and a new password must differ from the current one. |
| BR-05 | Five failed logins for one email/IP pair in 15 minutes cause a temporary `429` response. |
| BR-06 | Sessions expire after 30 idle minutes or eight hours and are revoked on logout, password reset/change, or deactivation. |
| BR-07 | Unsafe authenticated requests require an allowed Origin and session-bound CSRF token. |
| BR-08 | A User requiring password change may call only current-User, change-password, and logout APIs. |
| BR-09 | Each User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. |
| BR-10 | Requester identity always comes from the session, never client input. |
| BR-11 | Missing and inaccessible Requester-owned resources return the same safe `404`. |
| BR-12 | Backend authorization is required even when the UI hides a control. |
| BR-13 | A new Ticket is `NEW`, unassigned, and copies Requested Priority to IT Priority. |
| BR-14 | Requested and IT Priority use `LOW`, `MEDIUM`, or `HIGH`; only Staff/Admin may change IT Priority. |
| BR-15 | A Ticket has zero or one active IT Staff/Administrator owner. |
| BR-16 | Claim succeeds only for an unassigned Ticket; competing claims return `409`. |
| BR-17 | Assignment rejects inactive, missing, or Requester Users. |
| BR-18 | Status changes must follow the transition table and reject stale state atomically. |
| BR-19 | `CLOSED` and `CANCELLED` require confirmation; `CANCELLED` is terminal. |
| BR-20 | `IN_PROGRESS` and `RESOLVED` require an active owner. |
| BR-21 | Requester resolution indication is idempotent, does not change status, and clears on reopen. |
| BR-22 | Public Comments and Internal Notes are append-only with backend author and time. |
| BR-23 | Comment/note content is trimmed plain text from 1–2000 characters. |
| BR-24 | Requesters cannot retrieve Internal Note content or existence details. |
| BR-25 | Lab 2 Ticket and Attachment validation remains unchanged. |
| BR-26 | New/reset initial passwords set `mustChangePassword=true` and are never echoed. |
| BR-27 | User names are trimmed and 1–100 characters; unknown or multiple roles are rejected. |
| BR-28 | Administrators cannot deactivate themselves. |
| BR-29 | Concurrent changes cannot leave the system without an active Administrator. |
| BR-30 | Deactivation revokes sessions; deactivation or change to Requester unassigns operationally owned Tickets. |
| BR-31 | Queue search covers Ticket Number, summary, and Requester name/email. |
| BR-32 | Queue filters cover status, both priorities, and owner; default sort is `updatedAt desc`, then `id desc`. |
| BR-33 | Queue page sizes are 10, 20, or 50; default is page 1 with 20 items. |
| BR-34 | Safe failures never expose hashes, tokens, SQL, paths, stack traces, or protected data. |
| BR-35 | Existing Lab 2 ownership and Attachment rules remain regression requirements. |

### Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Reference data | Allow | Allow | Allow |
| Create/My Tickets/Requester Detail | Own only | Deny | Deny |
| Attachment upload/remove | Own only | Deny | Deny |
| Attachment read/download | Own only | Allow | Allow |
| Public Comments | Own only | Allow | Allow |
| Resolution indication | Own only | Deny | Deny |
| Queue and operational Ticket Detail | Deny | Allow | Allow |
| Assignment, IT Priority, status | Deny | Allow | Allow |
| Internal Notes | Deny | Allow | Allow |
| User Management | Deny | Deny | Allow |

All allowed operations still require an active unrestricted session. Administrator Ticket access is an explicit Lab 3 decision for recovery and oversight.

### Ticket Status Transitions

| From | To | Allowed Role | Notes |
| --- | --- | --- | --- |
| `NEW` | `OPEN`, `CANCELLED` | IT Staff, Administrator | Cancellation requires confirmation. |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Progress/resolution requires owner. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Resolution requires owner. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Progress/resolution requires owner. |
| `RESOLVED` | `CLOSED`, `REOPENED` | IT Staff, Administrator | Closing requires confirmation. |
| `CLOSED` | `REOPENED` | IT Staff, Administrator | Reopen clears resolution indication. |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Progress/resolution requires owner. |
| `CANCELLED` | None | None | Terminal in Lab 3. |

## 6. UI Summary

| Screen | Role | Main Purpose |
| --- | --- | --- |
| Login | Public | Authenticate a User. |
| Change Password | Authenticated | Replace initial/current password. |
| My Tickets/Create Ticket | Requester | Continue Lab 2 Requester work. |
| Requester Ticket Detail | Requester | View own Ticket, Attachments, Public Comments, and resolution indication. |
| Ticket Queue | IT Staff, Administrator | Find and prioritize Tickets. |
| Operational Ticket Detail | IT Staff, Administrator | Manage owner, IT Priority, status, comments, and notes. |
| User Management | Administrator | List, create, edit, activate/deactivate, and reset Users. |

See [`ui-spec.md`](./ui-spec.md) for detailed screen and responsive rules.

## 7. Data Changes

| Area | Change |
| --- | --- |
| User | Rename/evolve `DevelopmentRequester`; add password hash, role, activation, and password-change state. |
| Session | Add hashed session/CSRF tokens, User relation, expiry, activity, and revocation fields. |
| Ticket | Add optional owner, owner timestamp, IT Priority, status enum, and resolution-indication time. |
| PublicComment | Add Ticket, author, content, and creation time. |
| InternalNote | Add Ticket, author, content, and creation time. |
| Existing data | Keep Category, Related System, Ticket, and Attachment identifiers and relations. |

Enums: `UserRole`, `Priority`, and `TicketStatus`. Index normalized email, session token/expiry, Ticket requester/owner/status/priority/update time, and Ticket/time for comments and notes.

### Lab 2 Migration

- Rename `DevelopmentRequester` to `User` so IDs stay unchanged.
- Convert existing Requesters to `REQUESTER` with a documented local initial password and required password change.
- Keep `Ticket.requesterId` and all Attachment relations/files unchanged.
- Backfill `itPriority=requestedPriority`; keep existing `NEW` status and null owner.
- Abort on duplicate normalized emails, invalid enum data, or broken relations.
- Remove `/api/requesters`, the selector UI/state, and `X-Requester-Id` trust.
- Update Lab 2 tests to authenticate without weakening their assertions.

## 8. API Contract

| API Group | Purpose |
| --- | --- |
| Authentication | Login, current User, password change, and logout. |
| Requester | Create/list/view own Tickets, Attachments, and resolution indication. |
| Staff Queue | Search/filter/sort/page all Tickets and retrieve eligible owners. |
| Staff Ticket | Claim/assign, set IT Priority, and change status. |
| Comments/Notes | Append/retrieve public or role-restricted entries. |
| Administrator | List/search/filter, create/edit Users, and set initial password. |

See [`api-spec.md`](./api-spec.md) for exact endpoints, payloads, validation, and statuses.

## 9. Acceptance Criteria

| ID | Acceptance Criterion |
| --- | --- |
| AC-01 | Valid active credentials create a safe authenticated session. |
| AC-02 | Invalid, inactive, and throttled login attempts return their safe contracted results. |
| AC-03 | Initial-password Users remain blocked until a valid password change succeeds. |
| AC-04 | Logout, expiry, password changes/resets, and deactivation revoke required sessions. |
| AC-05 | Each role sees only permitted navigation and backend operations. |
| AC-06 | Requester Ticket creation uses session identity and correct initial workflow values. |
| AC-07 | My Tickets, Ticket Detail, and Attachment operations enforce Requester ownership. |
| AC-08 | Migrated Lab 2 Tickets and Attachments retain correct ownership and data. |
| AC-09 | Development Requester selection and `X-Requester-Id` no longer grant identity. |
| AC-10 | Queue search, filters, sorting, pagination, and counts return correct results. |
| AC-11 | Staff/Admin operational Ticket Detail returns all permitted data. |
| AC-12 | Claim and assignment are atomic and accept only eligible owners. |
| AC-13 | IT Priority accepts only valid values and never changes Requested Priority. |
| AC-14 | Permitted status transitions succeed and invalid/stale/unconfirmed transitions do not mutate. |
| AC-15 | Requester resolution indication is idempotent, non-status-changing, and cleared on reopen. |
| AC-16 | Public Comments enforce access, validation, backend metadata, and plain-text display. |
| AC-17 | Internal Notes are append-only and unavailable to Requesters. |
| AC-18 | Administrator can list, search, and role-filter safe User data. |
| AC-19 | Administrator can create one-role Users; invalid or duplicate data is rejected. |
| AC-20 | Administrator can edit Users; deactivation preserves records and removes access. |
| AC-21 | New initial passwords revoke sessions and require change at next login. |
| AC-22 | Self-deactivation and removal of the last active Administrator are blocked atomically. |
| AC-23 | Non-Administrators cannot access User Management data or operations. |
| AC-24 | Required UI feedback states are clear and safe. |
| AC-25 | Major screens preserve Zen Green, accessibility, and responsive behavior. |
| AC-26 | Seed runs repeatedly without duplicates and meets required data distribution. |
| AC-27 | Lab 1/Lab 2 regression suites pass with authenticated identity. |

## 10. Definition of Done

- [x] Contract documents remain consistent and precede implementation.
- [x] Migration and seed preserve/produce the documented Users, Tickets, comments, and notes; repeat-seed verification passes.
- [x] Authentication, session, CSRF, role, and ownership rules are implemented server-side.
- [ ] Requester, Staff, and Administrator workflows satisfy AC-01–AC-27. Requester resolution indication (FR-10 / AC-15) remains open.
- [x] Development Requester selection and client-supplied identity are removed.
- [ ] All planned tests and production builds pass with no required skips. The executed suites/build pass; the open resolution, shared-feedback, and accessibility coverage remain required.
- [x] AC traceability and current test evidence are updated in [`tests.md`](./tests.md).
- [ ] Desktop, tablet, and mobile screenshots pass the full visual checklist. Current PNG evidence is recorded in [`ui-spec.md`](./ui-spec.md); additional screen, 320 px, zoom, and accessibility inspection is open.
- [x] No real secrets are committed. The development-only initial password is intentionally fictional and documented in [`development-credentials.md`](./development-credentials.md).

## 11. Assumptions and Decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Authentication | Opaque database session in `HttpOnly` cookie | Supports immediate revocation without exposing tokens to React. |
| CSRF | Origin check plus session-bound header token | Protects cookie-authenticated mutations. |
| Password hashing | Argon2id: 16-byte salt, 32-byte output, `m=19456`, `t=2`, `p=1` minimum | Secure course-stack baseline. |
| Login attempts | Five failures per email/IP in 15 minutes | Adds throttling without account-unlock scope. |
| Administrator Ticket access | Same Ticket operations as IT Staff | Supports recovery and matches Administrator visibility/owner eligibility. |
| IT Priority | `LOW`, `MEDIUM`, `HIGH` | Matches Requested Priority and minimizes migration risk. |
| Comments/notes | Plain text, 1–2000 characters, append-only | Clear validation and safe rendering. |
| Cancelled status | Terminal | Keeps Lab 3 workflow simple. |
| User role changes | Submitted Tickets remain historical; ineligible operational ownership is cleared | Preserves records without adding transfer/history features. |
| Login throttle storage | Process-local for the single-instance lab | Distributed infrastructure is outside Lab 3. |
