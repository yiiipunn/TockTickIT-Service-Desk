# Lab 4 UI Specification

This is the implementation contract for Issues #26–#30. The assignment’s dashboard screenshots are illustrative, not pixel-exact requirements. Existing Lab 2–3 Zen Green components and the rules in [`specification.md`](./specification.md) remain authoritative.

## 1. Zen Green Application Shell

Reuse primary `#006B3C`, secondary `#0B7A46`, pale green `#EAF6EF`, page background `#F5F7F6`, white cards, restrained shadows, existing typography/spacing, Bootstrap form conventions, visible focus, and text-plus-color feedback.

| Role | Navigation |
| --- | --- |
| Requester | Dashboard, My Tickets, Create Ticket |
| IT Staff | Dashboard, Ticket Queue |
| Administrator | Dashboard, Ticket Queue, User Management |

- Retain current User name, role badge, Change Password, and Logout.
- Mark the active destination with `aria-current="page"` plus a non-color indicator.
- Missing/expired sessions return to Login; password-change-required sessions return to Change Password.
- Mobile navigation is keyboard operable and never hides Logout or the current location.
- Remove temporary, duplicate, obsolete, placeholder, or inconsistent Lab 1–3 UI during Issue #30 hardening; do not remove required functionality.

## 2. Role and Screen Access

| Screen/operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Requester Dashboard | Own data | Deny | Deny |
| Staff Dashboard | Deny | Allow | Allow/reuse |
| Requester Ticket Detail Actions | Own Ticket, read-only | Not this surface | Not this surface |
| Operational Ticket Detail Actions | Deny | Full contracted controls | Full controls/override |
| Action event history | Deny | Read | Read |
| Ticket workflow controls | Deny | Allow | Allow |
| User Management | Deny | Deny | Existing allow |

Direct navigation to a forbidden surface displays a safe forbidden state and no protected data. Hidden controls are never treated as authorization.

## 3. Actions Taken on Ticket Detail

### 3.1 Placement and list

Add Actions Taken to both Ticket Detail surfaces after the Ticket summary/workflow area and before communication history. The section heading includes the server total.

Each row/card shows:

- Action Date/Time with browser-local display and visible zone;
- Action Description and Result (`Not completed` while null);
- Action status using text plus badge;
- Assignee labelled `Assigned to`;
- creator labelled `Created by` in detail;
- performer labelled `Performed by`, or `Not completed`;
- Ticket Owner separately labelled `Ticket owner` where displayed;
- follow-up state/note and attachment notes indicator;
- updated indicator/version only where operationally useful;
- `View action` control.

Default ordering is `actionAt desc`, then `id desc`. Provide page sizes 10/20/50 and Previous/Next controls. Desktop uses a semantic table where comparison helps; mobile uses cards without hiding information or operations.

| State | Required presentation |
| --- | --- |
| Loading | Named status/skeleton, `aria-busy=true`, no stale rows presented as current. |
| Empty | “No Actions Taken have been recorded for this Ticket.” Staff/Admin also see `Plan action`. |
| Results | Total, deterministic rows/cards, page summary, accessible pagination. |
| Forbidden/not found | Safe message and permitted Back action; no existence leak. |
| Error | “Unable to load Actions Taken right now.” and Retry. |

### 3.2 Create mode

`Plan action` is Staff/Admin-only and opens:

| Field | Control | Validation/message |
| --- | --- | --- |
| Action Date/Time | Local date-time input with timezone help | Required valid instant: “Enter the planned action date and time.” |
| Action Description | Textarea | Required trimmed 1–2000: “Enter 1 to 2000 characters.” |
| Assigned to | Select from backend eligible owners | Required active Staff/Admin: “Choose an active IT Staff member or Administrator.” |
| Result | Textarea | Optional while planned; explain that completion requires it. |
| Follow-Up Required? | Checkbox/switch | Explicit Boolean. |
| Follow-up Note | Conditional textarea | Required trimmed 1–1000 when checked; disabled/null when unchecked. |
| Attachment Notes | Textarea | Optional, maximum 1000; explain that this identifies existing Ticket files and does not upload. |

Show signed-in User as read-only `Created by`. Do not show performer input. Submit label is `Plan action` / `Planning…`. Success announces `Action planned`, refreshes the list/dashboard data, and focuses the new row/detail. Validation and safe failures preserve entered values.

### 3.3 View and edit mode

Detail displays every field without truncation plus created/updated/completed/cancelled metadata. Staff/Admin also see ordered event history; Requesters never see event snapshots or internal actor/change metadata.

- `Edit action` is available only for `PLANNED`/`IN_PROGRESS`.
- Editable content matches create mode except assignee/status, which use dedicated controls.
- Creator and performer are always read-only.
- Saving carries `expectedVersion`; submit label is `Save changes` / `Saving…`.
- A dirty form requires discard confirmation before closing/navigation.
- No Action delete control exists.

On `409`, retain the draft, show the latest authorized server values beside it, and announce: “This action changed after you opened it. Review the latest version before trying again.” The User may `Use latest values` or retain the draft for a later explicit retry; never auto-overwrite.

### 3.4 Assignment

- Show eligible active Staff/Admin Users only; still display an inactive historical assignee with an `Inactive` label if already assigned.
- Reassign is available only in `PLANNED`/`IN_PROGRESS` and carries `expectedVersion`.
- Confirm reassignment by naming the old/new assignee.
- Missing/inactive/Requester/stale targets show specific safe feedback and leave the current display unchanged until refreshed.
- Assignment never changes Ticket Owner, creator, or performer.

### 3.5 Action lifecycle controls

Action status is visually and semantically separate from Ticket status.

| Current Action status | Control | Role/gate |
| --- | --- | --- |
| `PLANNED` | `Start action` | Current assignee or Administrator. |
| `PLANNED` | `Cancel action` | Staff/Admin; confirmation and reason. |
| `IN_PROGRESS` | `Complete action` | Current assignee or Administrator; valid non-future Action Date/Time and Result required. |
| `IN_PROGRESS` | `Cancel action` | Staff/Admin; confirmation and reason. |
| `COMPLETED` | None | Read-only terminal. |
| `CANCELLED` | None | Read-only terminal. |

`Complete action` confirmation summarizes Result, follow-up, assignee, and the automatically recorded performer. `Cancel action` dialog names the Action/Ticket, requires 1–500 characters, traps focus, supports Escape before submission, and returns focus to the invoking control. Successful transition refreshes Action detail/list and any dashboard values.

## 4. Ticket Workflow and Resolution Feedback

Keep the existing workflow panel separate from Actions Taken.

- Show only `allowedTransitions` returned by the backend, but handle server rejection safely.
- Claim/assign/unassign, IT Priority, and status changes carry Ticket `expectedVersion`.
- Eligible Ticket owners are active Staff/Admin only; an inactive current owner remains visibly labelled until reassigned.
- Label transition to `RESOLVED` as `Resolve ticket`, not Action completion.
- Before resolution, explain the gate: active Ticket Owner, at least one completed Action, and no planned/in-progress Actions.
- Gate failure links/focuses Actions Taken and lists only missing conditions.
- `Close ticket` and `Cancel ticket` require a dialog naming Ticket Number/destination.
- Reopen is distinct and clears Requester advisory feedback after backend success.
- Requester `Problem Appears Resolved` text states: “This notifies IT; it does not change the Ticket status.”
- Every successful mutation refreshes Ticket summary, permitted transitions, Actions, and affected dashboard state.
- On conflict, preserve the last confirmed display/draft, fetch current safe state, explain the change, and require a new choice.

The complete matrix is in [`specification.md`](./specification.md#ticket-transition-matrix).

## 5. Requester Dashboard

### Layout

1. `Your Dashboard` heading and own-data explanation.
2. Metric cards: `Open Tickets`, `Waiting for You`.
3. `Attention Required`: up to 10 waiting-for-requester Tickets.
4. `Recently Updated`: up to 10 owned Tickets in the previous 30 days.
5. `Recently Resolved`: up to 10 owned Tickets resolved in the previous 30 days.
6. Existing quick actions: `Create Ticket`, `View My Tickets`.

Cards show exact integer values including zero and concise scope help. Lists show Ticket Number, summary, status, priority, and relevant timestamp.

| Source | Drill-down |
| --- | --- |
| Open Tickets | My Tickets with `scope=open`. |
| Waiting for You / Attention Required | My Tickets with `status=WAITING_FOR_REQUESTER`. |
| Recent row | Owned Requester Ticket Detail. |

The dashboard never duplicates the full My Tickets result set and never trusts client-side ownership filtering.

## 6. IT Staff and Administrator Dashboard

Administrator reuses this screen; the workspace label reflects the current role.

### Layout

1. Metric cards: `Unassigned Open`, `My Open Tickets`, `My Active Actions`.
2. `Tickets by Status`: all eight statuses, including zero.
3. `Active Tickets by IT Priority`: Low/Medium/High, including zero.
4. `Urgent Tickets`: active/open High IT Priority, maximum 10.
5. `Recently Updated`: active/open and updated within 7 days, maximum 10.
6. `My Active Actions`: assigned to current User and planned/in progress, maximum 10, earliest Action Date/Time first.
7. `Recently Completed by Me`: performed by current User within 30 days, maximum 10.

Use exact textual counts. A chart is optional only when equivalent accessible text remains. Do not add optional Administrator account metrics in Lab 4.

| Source | Drill-down |
| --- | --- |
| Unassigned Open | Ticket Queue `owner=unassigned&scope=open`. |
| My Open Tickets | Ticket Queue `owner=me&scope=open`. |
| Status/priority count | Ticket Queue with equivalent filter/scope. |
| Urgent/recent Ticket | Operational Ticket Detail. |
| My Active Action / completed row | Operational Ticket Detail with Action focused or Action Detail with Back-to-Ticket. |

Destination screens reload authorized server data; dashboard data passed through navigation is not trusted.

## 7. Shared Feedback and Failure States

| State | UI contract |
| --- | --- |
| Loading | Identify resource; keep layout stable; disable dependent controls. |
| Empty | Explain the empty collection and show only role-permitted next steps. |
| Success | Concise `role=status` message and refreshed authoritative state. |
| Validation | Error summary plus field text associated with `aria-describedby`; preserve values. |
| Forbidden | Remove protected content, explain access, offer a permitted destination. |
| Not found | Same safe language for missing/inaccessible owned resources. |
| Conflict | Explain stale state, preserve draft, display/refetch latest safe state, require explicit retry. |
| Network/server | Safe message and Retry; no raw HTML, stack, SQL, path, or token. |
| Dashboard empty | All metrics render zero and lists render explanatory empty states. |
| Dashboard failure | Replace the snapshot with one non-authoritative error; never mix stale/fresh values as current. |

## 8. Duplicate-Action and Form-Preservation Rules

- Disable the initiating mutation immediately and ignore repeated activation until it settles.
- Use action-specific progress text: `Planning…`, `Saving…`, `Assigning…`, `Starting…`, `Completing…`, `Cancelling…`, `Resolving…`.
- Never automatically retry a mutation; server version/state predicates remain the backstop for network retries.
- Preserve non-secret values after `400`, `403`, `409`, `429`, network, or `5xx` errors when safe.
- Do not show success before a successful server response. Refetch failures after a successful mutation must say the change succeeded but refresh failed, rather than resubmitting.
- Leaving any dirty important form requires discard confirmation.

## 9. Responsive Requirements

| Viewport | Contract |
| --- | --- |
| Desktop `>=992 px` | Horizontal shell, 2–4 metric-card grid, two-column detail/workflow where useful, semantic Action table. |
| Tablet `768–991 px` | Wrapped shell, two-column metrics, compact table/cards, stacked forms as needed. |
| Mobile `<768 px` | Keyboard-accessible menu, one-column cards, full-width primary controls, workflow before communication. |

- Verify at 1440×900, 800×1024, 390×844, and 320×800 plus 200% zoom.
- No page-level horizontal scrolling, clipping, overlap, obscured focus, or hidden required operation.
- Any remaining wide table uses a labelled scroll region; prefer cards where column comparison is unnecessary.
- Touch targets are approximately 44×44 CSS px where practical.

## 10. Accessibility Checklist

- [ ] One descriptive `h1`; logical headings and landmarks.
- [ ] Semantic buttons, links, lists, dialogs, table headers/scopes, and form controls.
- [ ] Programmatic labels, required state, help, and associated validation for every field.
- [ ] Complete keyboard operation in logical order with visible, unobscured focus.
- [ ] Dialog focus trap, safe Escape, and focus return.
- [ ] `aria-busy` loading, concise status announcements, assertive errors without announcement loops.
- [ ] Focus reaches page heading after navigation, error summary/invalid field after validation, and new/updated content after success.
- [ ] Status, priority, assignment, and follow-up never rely on color alone.
- [ ] WCAG 2.1 AA text/component/focus contrast.
- [ ] Localized dates retain zone context and readable names.
- [ ] 320 px reflow and 200% zoom retain content/operations.
- [ ] Automated checks are supplemented by keyboard, zoom, screen-reader spot checks, and screenshot review.

## 11. Final Visual and Product-Hardening Checklist

- [ ] Existing shell, typography, spacing, radii, button hierarchy, cards, forms, tables, badges, loading, empty, and error conventions are reused.
- [ ] Ticket status, Action status, priorities, Public Comments, Internal Notes, and Actions Taken are visually distinguishable with accurate access labels.
- [ ] Action editable/read-only fields and lifecycle controls match status/role.
- [ ] Dashboard values have labels and accessible drill-down actions.
- [ ] Validation appears next to fields and in a useful summary.
- [ ] All earlier permitted screens/navigation remain available.
- [ ] No broken link, blocking console error, placeholder, unfinished control, duplicate obsolete element, clipping, overlap, or horizontal overflow remains.
- [ ] Genuine desktop/tablet/mobile screenshots for Staff Dashboard, Requester Dashboard, and Actions Taken are captured under the future Issue #31/#32 artifact structure only after implementation.
- [ ] This checklist is not marked complete and no screenshot evidence is claimed by Issue #23.
