# Lab 4 Test Plan and Traceability

This Test DD plan precedes implementation. Every listed test is **Planned / Not Run**; no passing result, screenshot, reviewer approval, or implementation evidence is claimed by Issue #23.

## 1. Strategy

Use unit tests for deterministic validation/state/metric policy; Supertest with PostgreSQL/Prisma for authorization, persistence, transactions, and dashboard accuracy; React Testing Library for UI behavior; and Playwright for integrated role, responsive, keyboard, and regression workflows. Every mutation test checks response, current row, version, and event count so partial writes cannot appear successful.

Priority risks:

1. Requester/cross-role data leakage or spoofed creator/performer;
2. invalid assignee or Action/Ticket transition acceptance;
3. lost updates or current state without matching history;
4. incorrect dashboard ownership, time boundaries, or counts;
5. broken Lab 1–3 workflows;
6. inaccessible or clipped final UI.

## 2. Planned Test Files

### Handout minimum structure

The assignment's abbreviated `client/.../lab-04 tests/` location resolves to the repository's existing `client/tests/lab-04/` Vitest root. Its repository-root `e2e/lab-04/` path is retained exactly. `dashboards.spec.ts`, printed at the top of the following handout page, completes the minimum E2E list:

```text
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
```

### Supplementary planned test files

The complete contract needs coverage beyond the minimum example tree. These additional files stay under the same required Lab 4 directories:

```text
server/tests/lab-04/
  action-validation.unit.test.ts
  action-workflow.unit.test.ts
  ticket-workflow.unit.test.ts
  dashboard-policy.unit.test.ts
  migration.integration.test.ts
  seed.integration.test.ts
  performance.smoke.test.ts
client/tests/lab-04/
  ZenGreenStyle.test.tsx
e2e/lab-04/
  responsive-accessibility.spec.ts
```

All paths in this section are future paths. Issue #23 does not create them. Playwright currently discovers `client/e2e/lab-03`; Issue #31 must configure discovery for the required repository-root `e2e/lab-04/` directory without removing Lab 3 regression.

## 3. Traceability Matrix

| Test ID | Test Type | Requirement / AC | What It Tests | Expected Result | Planned Automated Test File | Current Status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-04–BR-08 / AC-05 | Action date/text/follow-up/attachment boundary validation | Exact valid boundaries normalize; malformed/conditional-invalid values return field errors | `server/tests/lab-04/action-validation.unit.test.ts` | Planned / Not Run |
| UNIT-02 | Unit | BR-03, BR-09–BR-15 / AC-06–AC-09 | Action lifecycle, actor, assignee, completion, cancellation policy | Only listed transitions/roles pass; terminal states reject edits/transitions | `server/tests/lab-04/action-workflow.unit.test.ts` | Planned / Not Run |
| UNIT-03 | Unit | BR-18–BR-25 / AC-12–AC-14 | Ticket transition matrix, resolution gate, advisory feedback, version policy | Only permitted/gated transitions pass; feedback never resolves | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned / Not Run |
| UNIT-04 | Unit | BR-26–BR-37 / AC-15–AC-18 | Dashboard status scopes, UTC windows, lower boundaries, zero keys, ordering | Fixed-clock inputs yield exact documented metrics/lists | `server/tests/lab-04/dashboard-policy.unit.test.ts` | Planned / Not Run |
| UNIT-05 | Unit | BR-16 / AC-03 | Action page defaults, size values, same-time tie order | Defaults 1/20; only 10/20/50; `actionAt desc,id desc` | `server/tests/lab-04/action-validation.unit.test.ts` | Planned / Not Run |
| UNIT-06 | Unit | BR-25, BR-38–BR-41 / AC-25–AC-26 | Unknown fields, client identities, safe errors, compare-and-swap outcomes | Unsafe input rejected; stale/failed operations expose no internals and make no change | `server/tests/lab-04/action-validation.unit.test.ts` | Planned / Not Run |
| ACT-API-01 | API/Integration | FR-01–FR-02 / AC-01, AC-03 | Create valid assigned Action and list zero/one/multiple Actions | `201`; correct Ticket, authenticated creator, active assignee, `PLANNED`, version 1; ordered list totals | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-02 | API/Auth | FR-08, BR-40 / AC-04, AC-25 | Owner Requester read, cross-owner probe, Requester mutation/event-history attempts | Owner reads current Actions; cross-owner safe `404`; writes/history denied; no change | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-03 | API/Auth | BR-09, BR-38 / AC-01, AC-05, AC-25 | Submit creator/performer/audit/status/version and unknown create fields | `400`; session identity cannot be spoofed; no Action/event | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-04 | API/Validation | BR-04–BR-08 / AC-05 | Each invalid create/edit field and follow-up combination | Structured `400` field errors and zero partial mutation | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-05 | API/Integration | BR-10, BR-15, BR-17 / AC-05, AC-10 | Edit planned/in-progress versus completed/cancelled Actions | Non-terminal edit increments version/adds event; terminal edit `409` unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-06 | API/Auth | BR-03, BR-11 / AC-06 | Create/reassign to active Staff/Admin, inactive Staff, Requester, missing User | Eligible succeeds; invalid target `400 INELIGIBLE_ASSIGNEE`; state/event unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-07 | API/Workflow | BR-12–BR-14 / AC-07 | Parameterized Action transition matrix by assignee, other Staff, Admin | Only four listed transitions and authorized actors succeed | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-08 | API/Workflow | BR-04, BR-06–BR-09, BR-14 / AC-08, AC-11 | Complete with missing/future/valid data by current assignee/Admin | Valid completion atomically sets Result, performer, time, version/event; invalid cases unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-09 | API/Workflow | BR-14–BR-15 / AC-09 | Cancel without confirmation/reason and valid cancellation | Invalid `400`; valid terminal Action records actor/time/reason and remains readable | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-10 | API/Concurrency | BR-17, BR-25, BR-41 / AC-10, AC-26 | Two clients edit/reassign/transition one Action at same version | One winner/event/version; loser `409` with safe current state; no lost/partial update | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-11 | API/History | BR-02, BR-09, BR-15, BR-17 / AC-10–AC-11 | Owner differs from creator/assignee/performer; reassign/deactivate/complete sequence | Identities remain correct; ordered append-only events survive deactivation/status changes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-12 | API/Pagination | BR-16 / AC-03 | 55 Actions including equal timestamps across pages | 20/20/15 unique rows; stable order; invalid/repeated query rejected | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-13 | API/Security | FR-23, BR-39–BR-40 / AC-25 | Missing/expired/inactive/password-change session; bad Origin/CSRF | Exact safe `401/403`; no Action/event; no protected fields | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| ACT-API-14 | API/Atomicity | BR-17, BR-25 / AC-10, AC-26 | Force event insert/database failure after attempted Action mutation | Whole transaction rolls back; safe `500`; version/data/event unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Planned / Not Run |
| FLOW-API-01 | API/Workflow | BR-18–BR-22 / AC-12 | Full Ticket transition matrix by Staff/Admin with owner/confirmation variants | Every listed transition succeeds when gated; all other pairs fail atomically | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| FLOW-API-02 | API/Resolution | BR-20–BR-21 / AC-13 | Resolve with no owner, zero complete, active Actions, and valid completed-only set | First three `409`; valid enters `RESOLVED`, sets `resolvedAt`, event/version once | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| FLOW-API-03 | API/Feedback | BR-23 / AC-14 | Requester indication twice, Staff resolve, then reopen | Idempotent timestamp; status unchanged by Requester; reopen clears indication | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| FLOW-API-04 | API/Authorization | BR-19, BR-22 / AC-12, AC-25 | Requester status calls, inactive Staff, missing confirmation, Cancelled transition | Safe rejection and no Ticket/event mutation | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| FLOW-API-05 | API/Concurrency | BR-24–BR-25 / AC-26 | Competing claim/owner/priority/status operations | One atomic winner; loser `409`; one ordered workflow event | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned / Not Run |
| REQ-DASH-01 | API/Accuracy | BR-26–BR-30 / AC-02, AC-15 | Two Requesters with all statuses and recent/boundary/old records | Only caller-owned exact counts/lists; inclusive 30-day boundary and tie order | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned / Not Run |
| REQ-DASH-02 | API/Drill-down | FR-17 / AC-02, AC-15 | Follow open/waiting/recent drill-down as owner and other Requester | Equivalent owned rows/detail; another Requester cannot reuse access | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned / Not Run |
| REQ-DASH-03 | API/Failure | BR-37 / AC-18 | Empty Requester and forced calculation failure | Complete zero/empty shape; safe whole-response `500`, no partial metrics | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned / Not Run |
| STAFF-DASH-01 | API/Accuracy | BR-26, BR-31–BR-35 / AC-16 | Tickets across all statuses/owners/priorities; assigned/performed Actions | Exact global/my counts; all enum keys; correct 7-/30-day lists and orders | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned / Not Run |
| STAFF-DASH-02 | API/Admin | BR-36 / AC-17 | Same fixtures requested by Staff and Administrator | Global values equal; “my” values use each caller; no account metrics | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned / Not Run |
| STAFF-DASH-03 | API/Drill-down | FR-17 / AC-16–AC-17 | Follow owner/status/priority/Ticket/Action links | Destination filter/record matches source and enforces Staff/Admin role | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned / Not Run |
| STAFF-DASH-04 | API/Auth/Failure | BR-37, BR-40 / AC-18, AC-25 | Requester call, empty DB, forced query failure, response headers | `403`; complete zero shape for Staff; safe non-partial `500`; `no-store` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned / Not Run |
| DB-01 | Migration | FR-21 / AC-19 | Snapshot populated Lab 3 DB, apply migration, compare IDs/counts/relations/content | All earlier data preserved; versions/backfill/new constraints/indexes match contract | `server/tests/lab-04/migration.integration.test.ts` | Planned / Not Run |
| DB-02 | Migration/Recovery | FR-21 / AC-19 | Validate Restrict FKs, no fabricated history actor, documented backup/down boundary | Historical rows protected; backfill is deterministic; recovery procedure is executable | `server/tests/lab-04/migration.integration.test.ts` | Planned / Not Run |
| SEED-01 | Seed | FR-22 / AC-20 | Run seed twice and compare stable-key rows/content | Second run converges with no duplicate Users/Tickets/Actions/events | `server/tests/lab-04/seed.integration.test.ts` | Planned / Not Run |
| SEED-02 | Seed | FR-22 / AC-20 | Inspect required scenario matrix | Every Ticket/Action status/priority/owner/identity/gate/zero/non-zero case exists | `server/tests/lab-04/seed.integration.test.ts` | Planned / Not Run |
| UI-ACT-01 | UI Component | FR-01, FR-08 / AC-03–AC-04, AC-21 | Render zero/one/multiple Actions for Requester and Staff | Correct fields/order/states; Requester has no writes/audit; Staff controls match role/status | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned / Not Run |
| UI-ACT-02 | UI Component | FR-02–FR-07 / AC-05–AC-09, AC-21 | Create, conditional validation, assignment, start, complete, cancel interactions | Correct fields/messages/confirmations; separate Action/Ticket status; proper requests | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned / Not Run |
| UI-ACT-03 | UI Component | FR-19, FR-24 / AC-10, AC-22, AC-26 | Double click, validation/network/409, draft/latest comparison | One request; draft retained; conflict announced; no automatic overwrite/retry | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned / Not Run |
| UI-FLOW-01 | UI Component | FR-10–FR-12 / AC-12–AC-14, AC-21 | Allowed Ticket controls, gate feedback, advisory Requester action, refresh | Only allowed controls; precise gate help; advisory text; summary refresh after success | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned / Not Run |
| UI-REQ-01 | UI Component | FR-13, FR-17–FR-18 / AC-02, AC-15, AC-18, AC-21 | Requester loading/data/zero/forbidden/error and drill-down | Exact cards/lists/links; complete empty shape; one safe error without stale authority | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned / Not Run |
| UI-STAFF-01 | UI Component | FR-14–FR-18 / AC-16–AC-18, AC-21 | Staff/Admin metrics/lists, role label, empty/error, drill-down | Exact values/keys/current-user Actions; Admin reuse; correct destinations/feedback | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned / Not Run |
| UI-STYLE-01 | UI Style | FR-20 / AC-23–AC-24 | Zen Green token/classes, text-plus-color states, focus styles | Required design hooks/conventions present; no color-only state | `client/tests/lab-04/ZenGreenStyle.test.tsx` | Planned / Not Run |
| UI-A11Y-01 | UI Component/A11y | FR-20 / AC-24 | Labels, headings, table semantics, keyboard, announcements, dialogs | Logical keyboard/focus behavior and no configured automated accessibility violations | `client/tests/lab-04/ZenGreenStyle.test.tsx` | Planned / Not Run |
| E2E-01 | E2E | AC-01, AC-06–AC-11 | Staff creates/reassigns; assignee starts/completes; Admin edits/cancels another Action | Identities remain distinct; lifecycle/history survives reload; multiple Actions visible | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned / Not Run |
| E2E-02 | E2E/Auth | AC-04, AC-25 | Requester reads own Actions and probes/mutates another Ticket/Action | Own current Actions visible/read-only; cross-owner/writes/history safely denied | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned / Not Run |
| E2E-03 | E2E/Workflow | AC-12–AC-14 | Ticket cannot resolve with active/no-completed work; complete/cancel remaining; resolve/close/reopen | Gate enforced; formal/advisory states remain separate; history/order stable | `e2e/lab-04/ticket-resolution.spec.ts` | Planned / Not Run |
| E2E-04 | E2E/Concurrency | AC-10, AC-22, AC-26 | Two browser contexts edit/transition same Action/Ticket | First wins; second sees recoverable conflict and retained draft; no duplicate effect | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned / Not Run |
| E2E-05 | E2E/Dashboard | AC-02, AC-15–AC-18 | Requester/Staff/Admin dashboards and every representative drill-down | Role-scoped values match fixtures and destinations; empty/error states are accurate | `e2e/lab-04/dashboards.spec.ts` | Planned / Not Run |
| E2E-06 | Responsive | AC-23 | Major screens at 1440×900, 800×1024, 390×844, 320×800 and 200% zoom | No clipping, overlap, hidden action, obscured focus, or page-level horizontal scroll | `e2e/lab-04/responsive-accessibility.spec.ts` | Planned / Not Run |
| E2E-07 | Accessibility | AC-24 | Keyboard-only Action/Ticket/dashboard flows and dialog focus | All operations reachable; focus visible/trapped/returned; feedback readable | `e2e/lab-04/responsive-accessibility.spec.ts` | Planned / Not Run |
| HARDEN-01 | E2E/UI Audit | FR-26 / AC-29 | Crawl role navigation and inspect console/text/control state | No broken link, blocking console error, placeholder, unfinished/obsolete duplicate control | `e2e/lab-04/responsive-accessibility.spec.ts` | Planned / Not Run |
| REG-01 | Regression | FR-25 / AC-27 | Health, Categories, Related Systems | Existing API/UI behavior remains correct | Existing `server/tests/lab-01`, `client/tests/lab-01` | Planned / Not Run |
| REG-02 | Regression | FR-25 / AC-27 | Requester create, My Tickets, detail, search/filter/page | Session-owned Lab 2 behavior remains correct | Existing `server/tests/lab-02`, `client/tests/lab-02` | Planned / Not Run |
| REG-03 | Regression | FR-25 / AC-27 | Attachment upload/type/size/count/download/soft removal | Existing ownership and file safety remain correct | Existing Lab 2 Attachment tests | Planned / Not Run |
| REG-04 | Regression | FR-25 / AC-27 | Login, throttle, session, password change, CSRF, logout | Existing authentication restrictions remain correct | Existing Lab 3 auth/session tests | Planned / Not Run |
| REG-05 | Regression | FR-25 / AC-27 | Staff queue/detail/claim/owner/priority/status | Existing operations remain correct with deliberate version assertion updates | Existing Lab 3 Staff tests | Planned / Not Run |
| REG-06 | Regression | FR-25 / AC-27 | Public Comments/Internal Notes visibility and append behavior | Requester/shared/private access remains correct | Existing Lab 3 communication tests | Planned / Not Run |
| REG-07 | Regression | FR-25 / AC-27 | Admin user create/edit/deactivate/password reset/safety | Existing one-role and Administrator protections remain correct | Existing Lab 3 User Management tests | Planned / Not Run |
| REG-08 | Regression | FR-25 / AC-27 | Existing Lab 3 E2E and production builds | Representative earlier workflows/builds remain green with no required skip | Existing `client/e2e/lab-03` plus package builds | Planned / Not Run |
| PERF-01 | Performance Smoke | FR-16 / AC-28 | 1,000 Tickets/5,000 Actions; request dashboards 10 times after warm-up | p95 under 500 ms locally; bounded lists; no query count proportional to rows | `server/tests/lab-04/performance.smoke.test.ts` | Planned / Not Run |
| PERF-02 | Performance Smoke | FR-01 / AC-28 | Ticket with 500 Actions; pages 1/10/25 size 20 | Each under 300 ms locally; at most 20; stable indexed order; no N+1 performer query | `server/tests/lab-04/performance.smoke.test.ts` | Planned / Not Run |
| DOC-01 | Documentation Audit | FR-26 / AC-29 | README setup/migration/seed/test/demo commands and repository links after integration | Commands/links reproduce tested release; no placeholder or inaccurate evidence | Manual + Issue #32 documentation review | Planned / Not Run |

## 4. Acceptance-Criterion Coverage

| AC | Planned tests |
| --- | --- |
| AC-01 | ACT-API-01, ACT-API-03, E2E-01 |
| AC-02 | REQ-DASH-01, REQ-DASH-02, UI-REQ-01, E2E-05 |
| AC-03 | UNIT-05, ACT-API-01, ACT-API-12, UI-ACT-01 |
| AC-04 | ACT-API-02, UI-ACT-01, E2E-02 |
| AC-05 | UNIT-01, ACT-API-03–ACT-API-05, UI-ACT-02 |
| AC-06 | UNIT-02, ACT-API-06, UI-ACT-02, E2E-01 |
| AC-07 | UNIT-02, ACT-API-07, UI-ACT-02, E2E-01 |
| AC-08 | ACT-API-08, UI-ACT-02, E2E-01 |
| AC-09 | ACT-API-09, UI-ACT-02, E2E-01 |
| AC-10 | ACT-API-05, ACT-API-10–ACT-API-11, UI-ACT-03, E2E-04 |
| AC-11 | ACT-API-08, ACT-API-11, E2E-01 |
| AC-12 | UNIT-03, FLOW-API-01, FLOW-API-04, UI-FLOW-01, E2E-03 |
| AC-13 | UNIT-03, FLOW-API-02, UI-FLOW-01, E2E-03 |
| AC-14 | UNIT-03, FLOW-API-03, UI-FLOW-01, E2E-03 |
| AC-15 | UNIT-04, REQ-DASH-01–REQ-DASH-03, UI-REQ-01, E2E-05 |
| AC-16 | UNIT-04, STAFF-DASH-01, STAFF-DASH-03, UI-STAFF-01, E2E-05 |
| AC-17 | STAFF-DASH-02–STAFF-DASH-03, UI-STAFF-01, E2E-05 |
| AC-18 | REQ-DASH-03, STAFF-DASH-04, UI-REQ-01, UI-STAFF-01, E2E-05 |
| AC-19 | DB-01, DB-02 |
| AC-20 | SEED-01, SEED-02 |
| AC-21 | UI-ACT-01–UI-ACT-03, UI-FLOW-01, UI-REQ-01, UI-STAFF-01 |
| AC-22 | UI-ACT-03, E2E-04 |
| AC-23 | UI-STYLE-01, E2E-06 |
| AC-24 | UI-A11Y-01, E2E-07 |
| AC-25 | UNIT-06, ACT-API-02–ACT-API-03, ACT-API-13, FLOW-API-04, STAFF-DASH-04, E2E-02 |
| AC-26 | UNIT-06, ACT-API-10, ACT-API-14, FLOW-API-05, E2E-04 |
| AC-27 | REG-01–REG-08 |
| AC-28 | PERF-01, PERF-02 |
| AC-29 | HARDEN-01, DOC-01 |

## 5. Test Data and Expected Boundaries

Use stable fictional data and an injected/frozen clock:

- two active Requesters plus another/inactive Requester;
- two active Staff, one inactive former Staff, one Administrator;
- at least one Ticket in each Ticket status and all priorities;
- active Tickets unassigned, owned by current User, other Staff, and Administrator;
- Tickets with zero, one, three, and 500 Actions;
- Actions in all four states with owner/creator/assignee/performer same and different;
- valid and inactive historical assignees;
- follow-up true/note and false/null; attachment notes null/non-null;
- Action/Ticket timestamps one millisecond before, exactly at, and one millisecond after 7-/30-day boundaries, plus tied times;
- resolution gates with zero completed, completed plus active, only cancelled, and completed-only work;
- two clients holding identical Action/Ticket versions.

Tests create isolated stable-key fixtures and clean only their own rows. Do not depend on developer seed passwords or live wall-clock time.

## 6. Migration, Regression, and Performance Execution

- Migration tests compare before/after counts, IDs, representative scalar data, relations, foreign keys, indexes, version backfill, `resolvedAt` proxy, and absence of fabricated actors/events.
- Seed verification executes twice and compares stable keys/counts/content.
- Existing Lab 1–3 suites run in full; assertions change only where approved Lab 4 version fields intentionally extend responses.
- Performance thresholds are provisional lab-machine smoke gates, not production capacity claims. Record hardware, PostgreSQL version, fixture size, samples, timings, and query plans before assigning final status.
- The known Lab 3 gap—no registered resolution-indication route—must be implemented/tested before AC-14 can pass.

## 7. Verified Repository Commands

These script names were confirmed from the current packages/README. They are commands, not results.

| Purpose | Directory | Command | Current status |
| --- | --- | --- | --- |
| Server tests | `server/` | `npm test` | Planned / Not Run |
| Client component tests | `client/` | `npm test` | Planned / Not Run |
| Browser E2E | `client/` | `npm run test:e2e` | Planned / Not Run |
| Server build | `server/` | `npm run build` | Planned / Not Run |
| Client build | `client/` | `npm run build` | Planned / Not Run |
| Development migration | `server/` | `npm run prisma:migrate` | Planned / Not Run |
| Idempotent seed | `server/` | `npm run prisma:seed` | Planned / Not Run |

## 8. Issue, Branch, and Evidence Plan

| Course issue | GitHub issue | Verification responsibility |
| --- | --- | --- |
| #23 | #54 | Contract, planned tests, consistency/audit only. |
| #24 | #55 | Migration/backfill/seed evidence: DB-01–DB-02, SEED-01–SEED-02. |
| #25 | #56 | Action unit/API/auth/concurrency evidence. |
| #26 | #57 | Action component/responsive behavior. |
| #27 | #58 | Ticket workflow/resolution/history evidence. |
| #28 | #59 | Staff/Admin dashboard calculation/API/UI evidence. |
| #29 | #60 | Requester dashboard calculation/ownership/API/UI evidence. |
| #30 | #61 | Regression/security/style/responsive/accessibility hardening. |
| #31 | #62 | Integrated E2E/build/release and genuine screenshot/test output. |
| #32 | #63 | README, reviewer/AI-use docs, evidence audit, final Answer Part 1–9 report. |

The user-managed branch flow is feature branch → `lab4-staging` → `main`. Each implementation PR requires peer review before staged integration. This plan does not perform or claim those Git/PR actions.

## 9. Required Future Repository/Evidence Structure

The minimum structure is listed in [`specification.md`](./specification.md#required-future-repository-structure). The four contract files plus user-requested `reviewer.md` and `ai-use.md` templates now exist. The templates claim no completed review or AI evidence; later issues must replace placeholders with genuine evidence. Tests, E2E files, screenshot folders, README changes, and the final PDF remain later deliverables.

## 10. Handout Sections 4–14 Coverage Audit

| Handout Section | Mandatory requirement | Document and section covering it | Status |
| --- | --- | --- | --- |
| §4 Engineering Contract | Action fields, complete Ticket matrix, resolution gate, dashboard rules, security/concurrency/regression, AC/DoD | `specification.md` §§4–10; `api-spec.md` §§2–8 | Covered |
| §4.3–4.4 Roles/Action rules | Requester read-only, Staff/Admin writes, backend enforcement, mandatory BR-01/BR-02 | `specification.md` §5 Actions/authorization | Covered |
| §5 Database | One-to-many model, types/FKs/indexes/timestamps/version, preservation, two decisions | `specification.md` §7 | Covered |
| §5.2 Migration/backfill | Legacy zero Actions, resolved-time treatment, rollback/recovery tests | `specification.md` §7; DB-01–DB-02 | Covered |
| §5.3 Seed | Idempotence; status/priority/ownership; zero/one/multiple Actions; dashboard data | `specification.md` §7; SEED-01–SEED-02 | Covered |
| §6 REST API | Exact Action/dashboard/workflow routes, shapes, validation, auth, status/errors/conflicts | `api-spec.md` §§1–8 | Covered |
| §7 Zen Green shell | Navigation, coherent components, private/shared cues, focus/keyboard/no overflow | `ui-spec.md` §§1, 9–11 | Covered |
| §8.1 Staff Dashboard | Metrics, recent/urgent/current-user Actions, drill-down and states | `ui-spec.md` §6; `api-spec.md` §4.2 | Covered |
| §8.2 Requester Dashboard | Own attention/recent/resolved metrics, ownership and drill-down | `ui-spec.md` §5; `api-spec.md` §4.1 | Covered |
| §8.3 Actions UI | List/create/assign/edit/transition/complete/cancel/validation/inactive assignee/roles | `ui-spec.md` §3; `api-spec.md` §3 | Covered |
| §8.4 Ticket workflow | Guided allowed transitions, backend authority, refresh, advisory feedback | `ui-spec.md` §4; `specification.md` §5 | Covered |
| §8.5–8.6 Hardening | Regression, consistent states, duplicate prevention, form retention, responsive/accessibility | `ui-spec.md` §§7–11; trace tests UI/E2E/REG/HARDEN | Covered |
| §9 Spec DD | Exactly 11 required sections with numbered FR/BR/AC and supporting UI/API docs | `specification.md` §§1–11 | Covered |
| §10 Test DD/TDD | Seven-column planned traceability; all required test types; no fabricated passes | `tests.md` §§1–7 | Covered |
| §11 Workflow | Issues #23–#32, peer review, feature → staging → main, AI/coding separation | `specification.md` §11; `tests.md` §8 | Covered |
| §12 Repository | Required docs/server/client/E2E/screenshot structure; evidence files remain truthful | `specification.md` §11; `tests.md` §9; template `reviewer.md`; template `ai-use.md` | Covered |
| §13 Product DoD | Functionality, authorization, migration, tests, responsive/a11y, regression/review/integration | `specification.md` §10 | Covered |
| §14 Final submission | Nine-part evidence support; final PDF deferred; no fabricated evidence | Grading map below; `specification.md` §§10–11 | Covered |

### Nine-part grading evidence map

| Report part | Planned support | Current Issue #23 state |
| --- | --- | --- |
| 1. Git Use with Engineering Workflow | Issues #23–#32, feature → `lab4-staging` → `main`, `reviewer.md` template, README/tree evidence | Template present; no Git/review evidence claimed |
| 2. Spec DD | Four contract documents, numbered requirements/rules/criteria, pre-implementation history | Covered as specification deliverable |
| 3. Test DD and Traceability | This matrix, actual future paths/status, later main-branch outputs | Covered as plan; all tests Not Run |
| 4. AI Use with Reflection | `docs/lab-04/ai-use.md` template for 6–10 real prompts, decisions, verification, and reflection | Template present; real entries planned for Issue #32 |
| 5. Working Staff Dashboard | STAFF-DASH/UI-STAFF/E2E-05 plus DB query comparison/screenshots | Planned for Issues #28/#31 |
| 6. Working Actions Taken UI | ACT-API/UI-ACT/E2E-01–04 including multiple Actions | Planned for Issues #24–#26/#31 |
| 7. Working Ticket Workflow | UNIT-03/FLOW-API/UI-FLOW/E2E-03 with ordered append-only history | Planned for Issue #27/#31 |
| 8. Requester Dashboard/Regression | REQ-DASH/UI-REQ/E2E-05 and REG-01–08 | Planned for Issues #29–#31 |
| 9. Zen Green/Responsive/A11y/Polish | UI-STYLE/UI-A11Y/E2E-06–07/HARDEN plus genuine screenshots/checklist | Planned for Issues #30–#32 |

## 11. Evidence Rules

- Replace `Planned / Not Run` only after executing the exact implemented test and recording command, date/time, environment, branch/commit reference, pass/fail counts, and required skips.
- API mocks are not dashboard accuracy evidence; compare selected results to PostgreSQL fixture queries.
- Component tests are not responsive visual evidence; inspect all required viewports/zoom and retain genuine screenshots.
- Automated accessibility checks do not replace keyboard, focus, zoom, contrast, dialog, and screen-reader spot checks.
- Do not weaken a Lab 1–3 assertion merely to pass after Lab 4; document intentional contract changes.
- Do not claim PR approval, reviewer feedback, screenshots, main-branch results, or final PDF completion until those artifacts exist.
