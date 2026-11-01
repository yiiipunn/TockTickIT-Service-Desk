# TokTickIT Service Desk — Lab 4 Submission Report

**Source:** Official CPE 334 Lab 4 handout, `SE+Lab+4.pdf` (11 pages), supplied for Issue #32.

**Repository:** [yiiipunn/TockTickIT-Service-Desk](https://github.com/yiiipunn/TockTickIT-Service-Desk)
**Report state:** Staging evidence assembled on 2026-11-01 (Asia/Bangkok). The release to `main` and final submission remain pending.

This report follows the handout's required nine-part order. It links to the repository source of truth and uses existing screenshots and test reports. Where final-main evidence or personal student input is unavailable, the gap is stated explicitly.

## Answer Part 1

### Git Use with Engineering Workflow

The Lab 4 engineering contract was proposed in [PR #64](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/64), followed by implementation and verification PRs [#65](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/65), [#66](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/66), [#67](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/67), [#68](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/68), [#69](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/69), [#70](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/70), [#71](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/71), and [#72](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/72). GitHub records show these nine PRs merged into `lab4-staging`. The [peer-review record](./reviewer.md) links each recorded approval by `DEV4952`, plus available author acknowledgements. It does not infer unrecorded review fixes.

The [README](../../README.md) provides setup, role, API, and test instructions. The [`.gitignore`](../../.gitignore) excludes dependencies, local environment files, build output, attachment storage, and transient test results. The repository contains the [Lab 4 contract and records](./), [server tests](../../server/tests/lab-04/), [client tests](../../client/tests/lab-04/), [E2E tests](../../e2e/lab-04/), and [screenshots](../../artifacts/lab-04/screenshots/).

**Still needed for final submission:** a reviewed Issue #32 PR, the final `lab4-staging` → `main` PR and merge, final GitHub Project/Kanban evidence showing all issues Done, and final `main` commit history. These are not claimed here.

## Answer Part 2

### Spec DD

The rendered [engineering contract](./specification.md) contains numbered FR-01–FR-26, BR-01–BR-41, and AC-01–AC-29; a full Ticket transition matrix; Action lifecycle and resolution rules; dashboard calculations; data and migration decisions; API summary; and Product Definition of Done. The detailed [UI specification](./ui-spec.md) and [API specification](./api-spec.md) refine those contracts. [PR #64](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/64) is the pre-implementation specification PR; later implementation PRs begin with #65.

The data increment normalizes `ActionTaken` and append-only Action/Ticket events, keeps separate Ticket owner, Action creator, assignee, and performer identities, and uses integer versions for stale-write conflicts. The additive migration preserves earlier Users, Tickets, Attachments, Comments, and Notes. Legacy Tickets start with zero Actions; historic Resolved/Closed Tickets receive a documented `resolvedAt` proxy, without invented historic actors. Repeated seed runs are designed to converge on stable keys. Recovery after Lab 4 writes uses backup/forward repair rather than dropping history tables. See [data decisions](./specification.md#7-data-changes).

## Answer Part 3

### Test DD and Traceability

The [test plan and AC traceability matrix](./tests.md) maps AC-01–AC-29 to unit, API/integration, component, style, authorization, workflow, migration, seed, performance-smoke, regression, and browser tests. Actual test paths are in its matrix and in the repository. Its initial `Planned / Not Run` entries record the planning state; [execution records in §7](./tests.md#7-verified-repository-commands) and this report describe later runs. Planned standalone unit files for Action validation/workflow and dashboard policy are absent; their behavior has varying API/component coverage. The responsive/accessibility browser suite was implemented at [`client/e2e/lab-04/responsive-accessibility.spec.ts`](../../client/e2e/lab-04/responsive-accessibility.spec.ts), rather than the planned root `e2e/lab-04/` path.

The Issue #30 record reports 33 server files/244 tests, 18 client files/139 tests, successful production builds, six Lab 3 browser continuity tests, two responsive/accessibility browser tests, and two local performance-smoke tests. The Issue #31 record reports the same server/client totals and builds, six fresh migrations, a twice-run count-stable seed in an isolated schema, four Lab 4 browser tests, and four Lab 3 continuity tests. The checked-in [Lab 4 JSON report](../../artifacts/lab-04/test-results/issue-31/issue31-playwright-results.json) and [Lab 3 JSON report](../../artifacts/lab-04/test-results/issue-31/issue31-regression-results.json) each record four expected, zero unexpected, zero skipped, and zero flaky results.

The genuine [server test screenshot](../../artifacts/lab-04/screenshots/issue-30/backend-regression-tests.png), [client test screenshot](../../artifacts/lab-04/screenshots/issue-30/frontend-regression-tests.png), and [performance smoke screenshot](../../artifacts/lab-04/screenshots/issue-30/performance-smoke.png) supplement the text record. On the Issue #32 branch, both production builds passed and the client suite passed 18 files/139 tests on 2026-11-01. Server tests were not rerun because the full suite uses the configured PostgreSQL database; this documentation pass did not modify a shared database. The handout's complete passing output from final `main` is still required after release.

## Answer Part 4

### AI Use with Reflection

The [AI-use record](./ai-use.md) names OpenAI Codex/GPT-6 for the verified Issue #32 session, gives three actual user requests visible in this session, explains how AI-assisted documentation was checked, and records the limits of the available prompt history. It does not assign an unverified model or invented prompt to earlier PRs.

**Submission gap:** The handout asks for 6–10 selected prompts across Lab 4 and a brief first-person “My Reflection” about specification-agent and coding-agent use. Earlier prompt transcripts and the student's own reflection are not available in the repository or GitHub reviews. The student must add them to `ai-use.md` and regenerate this PDF before submission.

## Answer Part 5

### Working IT Staff Dashboard UI

The [Staff Dashboard screenshot](../../artifacts/lab-04/screenshots/issue-31/staff-dashboard.png) shows unassigned open Tickets, my open Tickets, my active Actions, counts by status and IT Priority, urgent and recently updated Tickets, assigned Actions, and the empty recently-completed list. The [contract](./specification.md#dashboard-calculations) specifies active status membership, current-user scopes, UTC windows, tie ordering, bounded lists, and zero-key behavior. Cards and rows lead to Ticket Queue, Ticket Detail, or Action Detail.

The [Staff Dashboard API tests](../../server/tests/lab-04/staff-dashboard.api.test.ts) use fixture data to compare authoritative counts, scopes, order, empty states, Admin reuse, and safe failures. The Issue #31 E2E scenario compares selected rendered metrics with the dashboard API response and follows representative drill-downs. The [Issue #28 API-test screenshot](../../artifacts/lab-04/screenshots/issue-28/staff-dashboard-api-tests.png) is an additional genuine test artifact. No independent SQL-query screenshot is present, so the final handout's selected metric-to-database-query demonstration remains to be captured.

## Answer Part 6

### Working Actions Taken UI

The [Actions Taken flow screenshot](../../artifacts/lab-04/screenshots/issue-31/actions-taken-flow.png) shows two Actions on one Ticket, including a completed Action with creator, assignee, performer, Ticket owner, follow-up, attachment notes, and ordered Action history. The [cancellation screenshot](../../artifacts/lab-04/screenshots/issue-31/action-cancellation.png) supplies a separate terminal-state example. The Action model requires date/time and description, validates a conditional follow-up note, and requires a Result on completion. Assignment accepts active Staff/Admin users; Requesters see current Actions on owned Tickets read-only.

The [Action API tests](../../server/tests/lab-04/actions-taken.api.test.ts), [component tests](../../client/tests/lab-04/ActionsTaken.test.tsx), and [browser flow](../../e2e/lab-04/actions-taken-flow.spec.ts) cover creation, editing, reassignment, transitions, validation, inactive-assignee rejection, role/ownership protection, stale-write conflicts, retained draft, and safe errors. The [UI specification](./ui-spec.md#3-actions-taken-on-ticket-detail) describes loading, empty, validation, conflict, and terminal read-only behavior. The browser evidence is representative, not an exhaustive visual capture of each negative state.

## Answer Part 7

### Working Ticket Workflow

The [transition matrix](./specification.md#ticket-transition-matrix) defines permitted moves among New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled. Backend resolution requires an active Ticket owner, at least one completed Action, and no planned or in-progress Actions. A Requester's “problem appears resolved” indication is advisory. Ticket owner/status mutations append workflow events and use `expectedVersion`; stale writes return a conflict without overwriting the winner.

The [Ticket resolution screenshot](../../artifacts/lab-04/screenshots/issue-31/ticket-resolution.png), [workflow API tests](../../server/tests/lab-04/ticket-workflow.api.test.ts), [component tests](../../client/tests/lab-04/TicketWorkflow.test.tsx), and [browser scenario](../../e2e/lab-04/ticket-resolution.spec.ts) show the gate, formal resolution, close/reopen path, and role-appropriate history. Cancellation of remaining work is covered by Action API/component tests rather than that browser scenario.

## Answer Part 8

### Working Requester Dashboard and Final Regression UI

The [Requester Dashboard screenshot](../../artifacts/lab-04/screenshots/issue-31/requester-dashboard.png) shows owned open/waiting counts, attention-required Tickets, recently updated Tickets, and recently resolved Tickets. The [dashboard contract](./specification.md#dashboard-calculations) limits all Requester queries to the authenticated owner, uses inclusive 30-day UTC windows, and defines empty keys and deterministic ordering. The [Requester API tests](../../server/tests/lab-04/requester-dashboard.api.test.ts) check counts and cross-owner denial; the [component tests](../../client/tests/lab-04/RequesterDashboard.test.tsx) check states and drill-down. The Issue #31 browser scenario checks selected metrics and links.

Lab 1–3 regression evidence is the Issue #30 full server/client runs and the Issue #31 four-scenario Lab 3 browser continuation. The suite includes health/reference data, authentication/session and password change, Requester creation/My Tickets/Detail, attachments, Public Comments, Staff queue/claim/assignment/priority/status, Internal Notes, and Administrator User Management. See the [test execution record](./tests.md#71-issue-30-execution-record), [server test screenshot](../../artifacts/lab-04/screenshots/issue-30/backend-regression-tests.png), and [client test screenshot](../../artifacts/lab-04/screenshots/issue-30/frontend-regression-tests.png). This is representative automated regression, not proof that every earlier manual screen was revisited.

## Answer Part 9

### Zen Green UI, Responsive, Accessibility, and Final Polish

The rendered [UI specification](./ui-spec.md) defines the shared Zen Green shell, role navigation, status/private-content cues, loading and failure feedback, responsive layouts, and accessibility checklist. Genuine [desktop](../../artifacts/lab-04/screenshots/issue-30/desktop-responsive.png), [tablet](../../artifacts/lab-04/screenshots/issue-30/tablet-responsive.png), [mobile](../../artifacts/lab-04/screenshots/issue-30/mobile-responsive.png), [320 px reflow](../../artifacts/lab-04/screenshots/issue-30/mobile-320-reflow.png), [200% zoom](../../artifacts/lab-04/screenshots/issue-30/zoom-200-reflow.png), and [keyboard focus](../../artifacts/lab-04/screenshots/issue-30/accessibility-check.png) artifacts come from the Issue #30 browser inspection. The Issue #31 [mobile screenshot](../../artifacts/lab-04/screenshots/issue-31/responsive-mobile.png) adds integrated Lab 4 evidence.

The visual/accessibility checklist remains in [`ui-spec.md` §10–11](./ui-spec.md#10-accessibility-checklist). Evidence supports automated/component checks, keyboard focus, viewport reflow, and screenshot review; a complete screen-reader audit and every manual checklist item are not documented. Avoid marking those unchecked items complete. Review the final PDF at normal zoom and refresh screenshots only from a running app if any are replaced.

### Outstanding submission items

1. Finish Issue #32 peer review, then release `lab4-staging` to `main` through a separate reviewed PR.
2. Run the complete suites on final `main`; capture readable output and record commit, environment, and results.
3. Add the student's 6–10 actual AI prompts and first-person reflection; add verified reviewer name/student ID if required.
4. Record final Kanban Done state, main-branch commit chain, and selected dashboard metric-to-database query comparison.
5. Regenerate and submit exactly one final PDF after those items are complete.
