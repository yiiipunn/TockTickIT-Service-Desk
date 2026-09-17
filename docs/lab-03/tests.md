# Lab 3 Test Plan

## 1. Test Strategy

Write tests before or with implementation. Cover unit policy, API/integration, direct authorization, migration/Lab 2 regression, UI components/style, responsive/accessibility behavior, and end-to-end workflows. Issues 2–5 migration, seed, authentication, mandatory password-change, role-boundary, and authenticated Requester regression tests are implemented and executed; later-issue tests remain `Pending`.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-03–BR-04 / AC-03 | Password policy and Argon2id hashing | Boundaries validate; salted hashes verify safely | `server/tests/lab-03/password.unit.test.ts` | Passed |
| UNIT-02 | Unit | BR-06–BR-07 / AC-04 | Session and CSRF token helpers | Random raw tokens are never stored; digest checks work | `server/tests/lab-03/session.unit.test.ts` | Passed |
| UNIT-03 | Unit | BR-18–BR-21 / AC-14–AC-15 | Status transition policy | Only listed transitions and prerequisites pass | `server/tests/lab-03/ticket-workflow.unit.test.ts` | Passed |
| UNIT-04 | Unit | BR-31–BR-33 / AC-10 | Queue query parser | Defaults/allowed values pass; invalid values fail | `server/tests/lab-03/queue-query.unit.test.ts` | Passed |
| UNIT-05 | Unit | BR-02, BR-23, BR-27 / AC-16, AC-19 | User and entry validation | Trim, format, role, and length rules are exact | `server/tests/lab-03/validation.unit.test.ts` | Pending |
| UNIT-06 | Unit | BR-05 / AC-02 | Login throttle window | Fifth failure blocks temporarily; success/expiry clears | `server/tests/lab-03/login-throttle.unit.test.ts` | Passed |
| API-01 | API/Integration | FR-01, FR-03 / AC-01 | Valid login and current User | Cookie session and safe User/role/CSRF returned | `server/tests/lab-03/auth.api.test.ts` | Passed |
| API-02 | API/Integration | BR-01, BR-05 / AC-02 | Invalid, inactive, and throttled login | Safe `401`, `403`, and `429`; no profile leak | `server/tests/lab-03/auth.api.test.ts` | Passed |
| API-03 | API/Integration | FR-02, BR-08 / AC-03 | Initial-password restriction/change | Normal APIs blocked until valid change issues new session | `server/tests/lab-03/auth.api.test.ts` | Passed |
| API-04 | API/Integration | FR-03, BR-06 / AC-04 | Logout, expiry, and session replay | Revoked/expired sessions return `401` | `server/tests/lab-03/auth.api.test.ts` | Passed |
| API-05 | API/Integration | FR-06, BR-10, BR-13 / AC-06 | Authenticated Ticket creation | Session User owns `NEW` unassigned Ticket; priorities copy | `server/tests/lab-03/requester-regression.api.test.ts` | Passed |
| API-06 | API/Integration | FR-07 / AC-07 | My Tickets and Detail ownership | Queries return only the authenticated Requester's Tickets | `server/tests/lab-03/requester-regression.api.test.ts` | Passed |
| API-07 | API/Integration | FR-08, BR-25 / AC-07 | Attachment lifecycle and ownership | Lab 2 upload/download/remove rules remain protected | `server/tests/lab-03/requester-regression.api.test.ts` | Passed |
| API-08 | API/Integration | FR-10, BR-21 / AC-15 | Resolution indication | Active calls are idempotent; status unchanged; reopen clears | `server/tests/lab-03/requester-regression.api.test.ts` | Pending |
| API-09 | API/Integration | FR-12, BR-31–BR-32 / AC-10 | Queue defaults and search | Required fields/counts and all search fields are correct | `server/tests/lab-03/staff-queue.api.test.ts` | Passed |
| API-10 | API/Integration | FR-12, BR-32–BR-33 / AC-10 | Queue filters, sorting, pages, invalid query | Correct deterministic results or `400 INVALID_QUERY` | `server/tests/lab-03/staff-queue.api.test.ts` | Passed |
| API-11 | API/Integration | FR-13 / AC-11 | Operational Ticket Detail | All permitted Ticket, Attachment, comment/note data returned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-12 | API/Integration | FR-14, BR-15–BR-17 / AC-12 | Eligible owners and assignment | Claim/assign/reassign/unassign accept eligible Users only | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-13 | Concurrency/Integration | BR-16 / AC-12 | Concurrent claim | One claim succeeds; one gets `409`; one owner remains | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-14 | API/Integration | FR-15, BR-14 / AC-13 | IT Priority update | Valid values save; Requested Priority never changes | `server/tests/lab-03/staff-priority-status.api.test.ts` | Passed |
| API-15 | API/Integration | FR-16, BR-18–BR-20 / AC-14 | Permitted transitions | Every listed transition succeeds when prerequisites hold | `server/tests/lab-03/staff-priority-status.api.test.ts` | Passed |
| API-16 | API/Integration | BR-18–BR-20 / AC-14 | Invalid/stale/unconfirmed transitions | Request fails without mutation | `server/tests/lab-03/staff-priority-status.api.test.ts` | Passed |
| API-17 | API/Integration | FR-09, FR-17, BR-22 / AC-16 | Public Comment create/list | Permitted roles append/list with backend author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-18 | API/Integration | BR-23, BR-34 / AC-16 | Public Comment validation/safety | Boundaries enforced; markup remains plain text | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-19 | API/Integration | FR-17, BR-22–BR-23 / AC-17 | Internal Note create/list | Staff/Admin append/list; no edit/delete route | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-20 | API/Integration | FR-25, BR-24 / AC-17 | Requester Internal Note request | `403` before lookup; no content/existence leak | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-21 | API/Integration | FR-18 / AC-18 | User list, search, role filter | Safe required fields and correct matches returned | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-22 | API/Integration | FR-19, BR-26–BR-27 / AC-19 | User creation and validation | One-role User created; duplicates/invalid data rejected | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-23 | API/Integration | FR-20, BR-30 / AC-20 | User editing/deactivation | Fields update; sessions revoked; history preserved | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-24 | API/Integration | FR-21, BR-26 / AC-21 | Set initial password | Hash/change flag saved; sessions revoked; plaintext absent | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-25 | Concurrency/Integration | FR-22, BR-28–BR-29 / AC-22 | Administrator safety | Self/last-Admin changes fail atomically | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| AUTHZ-01 | Security/Authorization | FR-04 / AC-05 | Missing authentication | Every protected endpoint returns `401` | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/staff-queue.api.test.ts` | Partial (implemented auth/reference/Requester/Attachment and Staff Queue `401` boundaries passed; future endpoint matrix remains pending) |
| AUTHZ-02 | Security/Authorization | Authorization matrix / AC-05 | Direct cross-role API calls | Every denied matrix operation returns `403` | `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/staff-queue.api.test.ts` | Partial (implemented Requester/Attachment boundaries and Requester-denied Staff Queue passed; later Staff/Admin operations remain pending) |
| AUTHZ-03 | Security/Authorization | BR-10–BR-11 / AC-07, AC-09 | Forged Requester identity | Header/body ID cannot select another Requester | `server/tests/lab-03/authorization.api.test.ts` | Passed |
| AUTHZ-04 | Security/Authorization | FR-23, FR-25 / AC-17, AC-23 | Notes/Admin disclosure | Requester sees no notes; non-Admin sees no User data | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| AUTHZ-05 | Security/Authorization | BR-07, BR-34 / AC-05 | Origin, CSRF, and safe failures | Invalid security context cannot mutate or leak details | `server/tests/lab-03/auth.api.test.ts` | Partial (logout Origin/CSRF cases passed; later mutation matrices remain pending) |
| AUTHZ-06 | Security/Authorization | BR-06, BR-30 / AC-04, AC-20–AC-21 | Session invalidation matrix | Logout/change/reset/deactivate revoke required sessions | `server/tests/lab-03/security.integration.test.ts` | Partial (logout and password-change revocation passed in `auth.api.test.ts`; reset/deactivate remain later issues) |
| REG-01 | Migration/Regression | FR-28 / AC-08 | Requester-to-User migration | IDs, counts, roles, and Ticket requester links remain correct | `server/tests/lab-03/migration.integration.test.ts` | Passed |
| REG-02 | Migration/Regression | FR-28 / AC-08 | Attachment migration | Metadata, links, state, and stored bytes remain valid | `server/tests/lab-03/migration.integration.test.ts` | Passed (metadata/links; pre-existing missing test files noted) |
| REG-03 | Migration/Regression | FR-28 / AC-08 | Workflow backfill and migration guards | Priority/status backfill works; unsafe source data aborts | `server/tests/lab-03/migration.integration.test.ts` | Passed |
| REG-04 | Migration/Regression | FR-29 / AC-26 | Seed repeat and distribution | Two runs have no duplicates and meet required data counts | `server/tests/lab-03/seed.integration.test.ts` | Passed |
| REG-05 | Migration/Regression | FR-30 / AC-27 | Lab 1/Lab 2 server regression | Updated authenticated server suite passes unchanged behavior | `server/tests/lab-01/*.test.ts`, `server/tests/lab-02/*.test.ts` | Passed |
| REG-06 | Migration/Regression | FR-30 / AC-27 | Lab 2 client regression | Requester UI/Attachment suite passes with session identity | `client/tests/lab-02/*.test.tsx` | Passed |
| UI-01 | UI Component | FR-01–FR-03 / AC-01–AC-04, AC-24 | Login and Change Password modes | Validation, busy, inactive, failure, restriction, success render | `client/tests/lab-03/Authentication.test.tsx` | Passed |
| UI-02 | UI Component | FR-05 / AC-05 | Role shell and routes | Correct name/role/navigation; forbidden route blocked | `client/tests/lab-03/AppShell.test.tsx` | Partial (identity, role, logout, password restriction, Requester boundary, and Staff Queue navigation/handoff passed; later role workspaces remain pending) |
| UI-03 | UI Component | FR-09–FR-11 / AC-09, AC-15–AC-16 | Requester Ticket Detail additions | Comments/indication render; selector, notes, status control absent | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pending |
| UI-04 | UI Component | FR-12 / AC-10, AC-24 | Ticket Queue controls/states | Required queries, counts, results, empty/no-results/failure render | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Passed |
| UI-05 | UI Component | FR-13–FR-16 / AC-11–AC-14, AC-24 | Staff Ticket controls/conflicts | Read-only/editable fields and valid actions are clear | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Partial (Claim, assignment, IT Priority, and status controls passed; remaining Issue 7 test-plan coverage is pending) |
| UI-06 | UI Component | FR-17, FR-24–FR-25 / AC-16–AC-17 | Public/private communication | Distinct labels/composers and safe validation states render | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pending |
| UI-07 | UI Component | FR-18–FR-23 / AC-18–AC-23, AC-24 | User Management modes | Minimal list/create/edit/reset and safety feedback render | `client/tests/lab-03/UserManagement.test.tsx` | Pending |
| UI-08 | UI Component | FR-26 / AC-24 | Shared feedback states | Loading, validation, success, empty, forbidden, conflict, failure differ | `client/tests/lab-03/FeedbackStates.test.tsx` | Pending |
| UI-09 | UI Style/Accessibility | FR-27 / AC-25 | Zen Green tokens and accessible components | Colors, labels, focus, announcements, contrast rules hold | `client/tests/lab-03/accessibility.test.tsx` | Pending |
| RESP-01 | Responsive/E2E | FR-27 / AC-25 | Desktop major screens | Layout/actions fit at 1440×900 without overflow | `client/e2e/lab-03/visual-responsive.spec.ts` | Pending |
| RESP-02 | Responsive/E2E | FR-27 / AC-25 | Tablet major screens | Tables/cards/actions fit at 820×1180 | `client/e2e/lab-03/visual-responsive.spec.ts` | Pending |
| RESP-03 | Responsive/E2E | FR-27 / AC-25 | Mobile major screens | 390×844 and 320 px layouts have no clip/overlap/overflow | `client/e2e/lab-03/visual-responsive.spec.ts` | Pending |
| RESP-04 | Accessibility/E2E | FR-27 / AC-25 | Keyboard, focus, long content, 200% zoom | Core flows remain operable and reflow safely | `client/e2e/lab-03/visual-responsive.spec.ts` | Pending |
| E2E-01 | E2E | AC-01–AC-05 | Authentication lifecycle | Login, initial change, role shell, logout, direct block work | `client/e2e/lab-03/authentication.spec.ts` | Pending |
| E2E-02 | E2E/Regression | AC-06–AC-09, AC-15–AC-16, AC-27 | Requester workflow | Login through Ticket/Attachment/comment/indication succeeds | `client/e2e/lab-03/requester-regression.spec.ts` | Pending |
| E2E-03 | E2E | AC-10–AC-17 | IT Staff workflow | Queue through ownership/priority/status/comments/notes succeeds | `client/e2e/lab-03/staff-ticket-flow.spec.ts` | Pending |
| E2E-04 | E2E | AC-18–AC-23 | Administrator workflow | List/create/edit/reset/safety/forbidden behavior succeeds | `client/e2e/lab-03/user-administration.spec.ts` | Pending |
| E2E-05 | E2E/Visual | AC-24–AC-25 | Feedback and visual evidence | Required states and viewport screenshots pass checklist | `client/e2e/lab-03/visual-responsive.spec.ts` | Pending |

## 3. AC Traceability

| AC | Test IDs |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | UNIT-06, API-02, UI-01, E2E-01 |
| AC-03 | UNIT-01, API-03, UI-01, E2E-01 |
| AC-04 | UNIT-02, API-04, AUTHZ-06, E2E-01 |
| AC-05 | AUTHZ-01, AUTHZ-02, AUTHZ-05, UI-02, E2E-01 |
| AC-06 | API-05, E2E-02 |
| AC-07 | API-06, API-07, AUTHZ-03, E2E-02 |
| AC-08 | REG-01, REG-02, REG-03 |
| AC-09 | AUTHZ-03, UI-03, E2E-02 |
| AC-10 | UNIT-04, API-09, API-10, UI-04, E2E-03 |
| AC-11 | API-11, UI-05, E2E-03 |
| AC-12 | API-12, API-13, UI-05, E2E-03 |
| AC-13 | API-14, UI-05, E2E-03 |
| AC-14 | UNIT-03, API-15, API-16, UI-05, E2E-03 |
| AC-15 | UNIT-03, API-08, UI-03, E2E-02 |
| AC-16 | UNIT-05, API-17, API-18, UI-03, UI-06, E2E-02 |
| AC-17 | API-19, API-20, AUTHZ-04, UI-06, E2E-03 |
| AC-18 | API-21, UI-07, E2E-04 |
| AC-19 | UNIT-05, API-22, UI-07, E2E-04 |
| AC-20 | API-23, AUTHZ-06, UI-07, E2E-04 |
| AC-21 | API-24, AUTHZ-06, UI-07, E2E-04 |
| AC-22 | API-25, UI-07, E2E-04 |
| AC-23 | AUTHZ-04, UI-07, E2E-04 |
| AC-24 | AUTHZ-05, UI-01, UI-04, UI-05, UI-07, UI-08, E2E-05 |
| AC-25 | UI-09, RESP-01–RESP-04, E2E-05 |
| AC-26 | REG-04 |
| AC-27 | REG-05, REG-06, E2E-02 |

Traceability status: **27/27 ACs mapped**.

## 4. Final Verification

| Area | Command / Evidence | Result |
| --- | --- | --- |
| Server tests | `cd server; npm test` | Passed three consecutive full runs (22 files, 161 tests each) after correcting a parallel test fixture race. Focused Issue 7: 4 files, 15 tests; Lab 3: 14 files, 85 tests. Priority/status tests reuse seeded reference rows and clean up their own Users, sessions, and Ticket. |
| Client tests | `cd client; npm test` | Passed (10 files, 75 tests). Focused Staff Detail: 1 file, 16 tests; Lab 3: 4 files, 39 tests. |
| Server build | `cd server; npm run build` | Passed |
| Client build | `cd client; npm run build` | Passed |
| E2E/responsive | `cd client; npm run test:e2e` | Not Run |
| Visual review | [`ui-spec.md`](./ui-spec.md) checklist and screenshots | Not Run |

Planned tests: **61**. Passed: **26**. Partial: **6**. Failed: **0**. Pending: **29**. Full server and client regressions passed with zero failures.
