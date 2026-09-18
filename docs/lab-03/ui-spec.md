# Lab 3 UI Specification

## 1. Zen Green Continuity

Reuse the Lab 2 design system: primary `#006B3C`, secondary `#0B7A46`, pale green `#EAF6EF`, page background `#F5F7F6`, white cards, Bootstrap form spacing, visible focus, text-plus-color feedback, and existing responsive breakpoints. New screens must look like the same application.

## 2. Application Shell

| Role | Navigation |
| --- | --- |
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | User Management, Ticket Queue |

- Show current User name, role badge, Change Password, and Logout.
- Mark the active destination with `aria-current` and a non-color indicator.
- Remove Development Requester selection and Change Requester.
- Missing sessions return to Login; password-change-required sessions return to Change Password.
- Mobile uses a keyboard-accessible menu without hiding Logout.

## 3. Screens

### Login

| Item | Specification |
| --- | --- |
| Purpose | Authenticate a User. |
| Role | Public. |
| Main controls | Email, Password, show/hide password, Sign in. |
| Read-only data | Short sign-in guidance. |
| Editable data | Email and Password. |
| Important states | Initial, validation, signing in, invalid credentials, inactive, throttled, failure. |
| Mobile behavior | One full-width card with stacked controls. |

Keep email after failure, clear/focus Password, and never show registration, social login, or password-reset email.

### Change Password

| Item | Specification |
| --- | --- |
| Purpose | Replace an initial or current password. |
| Role | Any authenticated User. |
| Main controls | Current, New, Confirm, show/hide, Change Password, Logout. |
| Read-only data | 12–128 character rule and first-login explanation. |
| Editable data | Password fields only. |
| Important states | Initial, validation, saving, success, expired session, failure. |
| Mobile behavior | Stacked fields/actions; normal navigation hidden when mandatory. |

Mandatory mode cannot be skipped. Voluntary mode also provides Cancel/back.

### Requester Ticket Detail

| Item | Specification |
| --- | --- |
| Purpose | Continue Lab 2 detail and add Requester communication. |
| Role | Owning Requester. |
| Main controls | Attachment actions, Public Comment composer, Problem Appears Resolved. |
| Read-only data | Existing Ticket fields, status, Attachments, comment history, indication time. |
| Editable data | New Public Comment and Attachment removal reason. |
| Important states | Loading, not found, no comments, posting, indicated, conflict, failure. |
| Mobile behavior | Existing Lab 2 stacked detail; full-width comment/action controls. |

Do not show Internal Notes, owner controls, IT Priority editing, or formal status controls.

> **Implementation status:** Public Comments and the restricted Requester view are implemented and tested. The `Problem Appears Resolved` control and its indication state remain open until the approved resolution-indication API and coverage exist.

### IT Staff Ticket Queue

| Item | Specification |
| --- | --- |
| Purpose | Find and prioritize operational work. |
| Role | IT Staff and Administrator. |
| Main controls | Search; status, Requested Priority, IT Priority, owner filters; sort; page size; pagination; Clear. |
| Read-only data | Matching/unassigned counts and Ticket results. |
| Editable data | Query controls only. |
| Important states | Loading, results, empty queue, no results, forbidden, invalid query, failure. |
| Mobile behavior | Filter disclosure and Ticket cards; Open Ticket remains visible. |

Desktop uses six compact columns:

1. Ticket Number / Updated
2. Summary / Requester
3. Status
4. Requested / IT Priority
5. Owner
6. Open

This avoids a wide mega-grid while retaining required information.

### IT Staff Ticket Detail

| Item | Specification |
| --- | --- |
| Purpose | Operate one Ticket. |
| Role | IT Staff and Administrator. |
| Main controls | Claim/assign/unassign, IT Priority, next status, Public Comment, Internal Note. |
| Read-only data | Requester request, Requested Priority, timestamps, Attachments, histories. |
| Editable data | Owner, IT Priority, permitted status, new comment/note. |
| Important states | Loading, not found, saving, success, validation, claim/status conflict, forbidden, failure. |
| Mobile behavior | Stack workflow before communication; no hidden actions. |

- Confirm `CLOSED`, `CANCELLED`, and unassignment.
- Refresh affected data after a conflict.
- Show Public Comments in a white/green section labelled “Visible to Requester and IT”.
- Show Internal Notes in an amber section labelled “Private to IT Staff and Administrators”.
- Use different submit labels: `Post Public Comment` and `Add Internal Note`.

### User Management

| Item | Specification |
| --- | --- |
| Purpose | Manage the minimum account data required by Lab 3. |
| Role | Administrator only. |
| Main controls | Search, role filter, Create User, Edit, activation, Set Initial Password. |
| Read-only data | Name, email, role, status. |
| Editable data | Name, email, one role, active state, initial password. |
| Important states | Loading, empty/no results, validation, saving, success, duplicate, safety conflict, forbidden, failure. |
| Mobile behavior | User cards with full-width Edit; editor fields/actions stack. |

- Create uses Name, Email, one Role, Active, Initial Password, and confirmation.
- Edit never shows stored passwords or Delete.
- Initial-password reset is a separate confirmation dialog.
- Explain that reset ends existing sessions and requires change at next login.
- Disable self-deactivation in the UI, while keeping the backend authoritative.
- Do not add pagination, bulk actions, import/export, or role history.

## 4. Shared Feedback States

| State | UI Behavior |
| --- | --- |
| Loading | Named status/skeleton; do not show stale data as current. |
| Saving | Disable repeated action and show action-specific progress text. |
| Validation | Place text next to the field and connect with `aria-describedby`. |
| Success | Show concise confirmation without exposing passwords or tokens. |
| Empty | Explain that the collection has no records and show a relevant action. |
| No results | Explain filters found no matches and offer Clear. |
| Forbidden | Show no protected data and provide a safe return action. |
| Not found | Use the same safe view for missing/inaccessible Requester resources. |
| Conflict | Explain that data changed, refresh it, and require a new decision. |
| Failure | Show a safe message and Retry where useful; preserve entered data. |

## 5. Responsive Rules

| Viewport | Behavior |
| --- | --- |
| Desktop `>=992 px` | Horizontal shell, compact tables, two-column Staff Detail where useful. |
| Tablet `768–991 px` | Wrapped shell; compact table or cards after inspection; stacked editors as needed. |
| Mobile `<768 px` | Menu navigation, result cards, single-column screens, full-width primary actions. |

- Support at least 320 px width.
- No page-level horizontal overflow, clipping, overlap, or hidden required action.
- Long names, emails, summaries, filenames, comments, and notes wrap safely.
- At 200% zoom, reading and action order remains usable.

## 6. Accessibility

- [ ] Semantic headings, landmarks, links, buttons, and table headers across every screen.
- [ ] Programmatic labels, required state, help, and validation associations across every workflow.
- [ ] Keyboard access for every workflow and visible focus for every control.
- [ ] Dialog focus trap, Escape handling, and focus return.
- [ ] Status/error announcements without excessive focus movement.
- [ ] WCAG 2.1 AA contrast and no color-only meaning.
- [ ] Approximately 44×44 px mobile touch targets where practical.
- [x] Plain-text rendering for comments and notes is covered by component tests.

## 7. Visual Inspection Checklist

Checked items have automated component or browser evidence. Unchecked items require additional manual visual or accessibility verification and must remain open until that evidence exists.

- [ ] Zen Green tokens, spacing, cards, typography, forms, and focus match Lab 2.
- [x] Current User/role and role-specific navigation are correct.
- [x] Development Requester controls are absent.
- [x] Login and Change Password states are clear.
- [x] Status, priority, role, account, and owner badges include text.
- [x] Queue remains readable without a mega-grid.
- [x] Editable and read-only Ticket data are distinct.
- [x] Public Comments and Internal Notes cannot be confused.
- [x] User Management contains only required controls.
- [x] Feature-level feedback states are distinct and safe.
- [ ] Keyboard/focus/dialog behavior works.
- [ ] Labels, announcements, contrast, and headings are accessible.
- [ ] Desktop, tablet, mobile, 320 px, and 200% zoom have no clipping/overflow.
- [ ] Long content wraps safely.
- [x] PNG screenshots exist for implemented major Lab 3 screens and named visible states at desktop, tablet, and mobile viewports.

### Current Screenshot Evidence

| Screen / state group | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Authentication: login initial, login validation, mandatory password change, password-change validation | [`desktop`](../../artifacts/lab-03/screenshots/authentication/login-initial/desktop.png) | [`tablet`](../../artifacts/lab-03/screenshots/authentication/login-initial/tablet.png) | [`mobile`](../../artifacts/lab-03/screenshots/authentication/login-initial/mobile.png) |
| Requester: My Tickets, Create Ticket, Ticket Detail, public-comment success | [`desktop`](../../artifacts/lab-03/screenshots/requester/my-tickets/desktop.png) | [`tablet`](../../artifacts/lab-03/screenshots/requester/my-tickets/tablet.png) | [`mobile`](../../artifacts/lab-03/screenshots/requester/my-tickets/mobile.png) |
| IT Staff: Ticket Queue and Ticket Detail | [`desktop`](../../artifacts/lab-03/screenshots/staff-queue/ready/desktop.png) | [`tablet`](../../artifacts/lab-03/screenshots/staff-queue/ready/tablet.png) | [`mobile`](../../artifacts/lab-03/screenshots/staff-queue/ready/mobile.png) |
| Administrator: list, create, create validation, edit, set-initial-password, validation, success | [`desktop`](../../artifacts/lab-03/screenshots/user-management/list/desktop.png) | [`tablet`](../../artifacts/lab-03/screenshots/user-management/list/tablet.png) | [`mobile`](../../artifacts/lab-03/screenshots/user-management/list/mobile.png) |

Each named state group has a `desktop.png`, `tablet.png`, and `mobile.png` file in its artifact subdirectory. All files under `artifacts/lab-03/screenshots/` are PNG images.
