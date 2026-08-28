# Lab 2 UI Specification

**Project:** TokTickIT Service Desk  
**Lab:** Lab 2 — Requester Ticketing MVP with UI Foundation  
**Theme:** Zen Green  
**Status:** Draft  
**Last Updated:** 2026/08/28

---

## 1. Design Goals

The Lab 2 Requester interface should provide a professional, clear, responsive, and reusable user experience.

The UI should:

- Support the complete Requester workflow from Requester selection to Ticket creation, My Tickets, Ticket Detail, and Attachment management.
- Maintain consistent visual and interaction patterns.
- Clearly distinguish editable and read-only information.
- Provide understandable loading, validation, success, warning, empty, no-results, and failure states.
- Support desktop, tablet, and mobile layouts.
- Support keyboard interaction and visible focus states.
- Establish reusable UI conventions that can continue into future labs.

---

## 2. Zen Green Design Tokens

### 2.1 Colors

| Token | Value | Usage |
|---|---|---|
| Primary Green | `#006B3C` | Main header, primary buttons, strong emphasis |
| Secondary Green | `#0B7A46` | Links, active navigation, focus accents, secondary emphasis |
| Pale Green | `#EAF6EF` | Selected states, success backgrounds, subtle emphasis |
| Page Background | `#F5F7F6` | Main application background |
| Surface | `#FFFFFF` | Cards, forms, content containers |
| Primary Text | Dark charcoal-green | Main readable text |
| Read-only Background | Gray-green or warm ivory | Read-only field distinction |
| Error | Dark red | Error text, borders, validation |
| Warning | Amber | Warning messages and warning states |
| Success | Green | Success messages and confirmation states |

### 2.2 Surface Style

Primary content areas should use white surfaces with:

- Subtle borders
- Light shadow where appropriate
- Clear spacing between sections
- Consistent border radius
- Strong visual separation from the page background

### 2.3 Typography

The interface should use a clean sans-serif font stack consistent with the existing project.

Typography hierarchy:

| Role | Usage |
|---|---|
| Page Title | Main page heading |
| Section Heading | Major form or detail sections |
| Card / Table Title | Reusable content sections |
| Body Text | Standard information |
| Label | Form controls and metadata |
| Helper Text | Supporting instructions |
| Validation Text | Field-level errors |
| Caption | Secondary metadata |

Text must remain readable at all supported viewport sizes.

### 2.4 Spacing

Spacing should follow a consistent scale across:

- Page padding
- Card padding
- Form field gaps
- Grid gaps
- Section spacing
- Button spacing
- Table and list spacing

The same spacing patterns should be reused throughout all Lab 2 screens.

---

## 3. Application Shell

After a Development Requester is selected, the Requester-facing application shell must be displayed.

### 3.1 Required Elements

The application shell includes:

- TokTickIT application identity
- My Tickets navigation
- Create Ticket navigation
- Current Development Requester display
- Change Requester action
- Active-page indication

### 3.2 Navigation Behavior

The active page must be visually distinguishable from inactive navigation items.

Required navigation:

- My Tickets
- Create Ticket

Navigation controls must:

- Be keyboard accessible
- Provide visible focus states
- Remain usable on smaller screens

### 3.3 Development Requester Display

The currently selected Development Requester must be clearly visible.

Example:

```text
Requester: Narin S.
Change Requester
```

The identity display must not imply that the Development Requester selector is a real authenticated login.

### 3.4 Responsive Navigation

On desktop, navigation may remain visible horizontally or in a fixed application shell.

On smaller viewports, navigation may:

- Collapse into a mobile-friendly navigation control
- Stack vertically
- Use a menu pattern

The required actions must remain accessible.

---

## 4. Development Requester Selection

The Development Requester Selection screen is shown before Requester-specific workflows are available.

### 4.1 Purpose

This screen provides a temporary development identity for Lab 2 testing.

It must clearly explain that:

- The user is selecting a Development Requester.
- This mechanism is for development and testing only.
- It is not a login system.
- Real authentication will be introduced in Lab 3.

### 4.2 Required Components

The screen must include:

- TokTickIT identity
- Page title
- Testing-only explanation
- Development Requester dropdown
- Continue button

### 4.3 Requester Dropdown

The dropdown must:

- Load active Development Requesters from PostgreSQL through the backend API.
- Exclude inactive Development Requesters.
- Have a clear label.
- Support keyboard operation.
- Show an appropriate placeholder before selection.

Example placeholder:

```text
Select a Development Requester
```

### 4.4 Continue Button

The Continue button must:

- Remain disabled until a valid Development Requester is selected.
- Show a clear enabled state after selection.
- Navigate to the Requester application after successful selection.

### 4.5 Screen States

#### Loading

While Requesters are being retrieved:

- The selection control should not allow interaction.
- A visible loading indicator or loading message should be displayed.

#### Ready

When active Requesters are available:

- The dropdown is enabled.
- The user can select a Requester.

#### Empty

If no active Development Requesters exist:

- Display a clear empty-state message.
- Disable the Continue button.
- Do not show inactive Requesters as alternatives.

#### API Failure

If the Requester list cannot be retrieved:

- Display a safe error message.
- Provide a Retry action where appropriate.
- Do not expose stack traces or backend details.

---

## 5. Create Ticket

The Create Ticket page allows the selected Development Requester to submit a support request.

### 5.1 Page Structure

The page should contain:

1. Page heading
2. Requester and Ticket information
3. Ticket details form
4. Attachment section
5. Submission actions
6. Feedback area

### 5.2 Required Fields

| Field | Editable | Required | UI Type |
|---|---|---|---|
| Ticket Number | No | — | Read-only field |
| Ticket Date | No | — | Read-only field |
| Requester | No | — | Read-only field |
| Category | Yes | Yes | Select |
| Related System | Yes | Yes | Select |
| Ticket Summary | Yes | Yes | Text input |
| Requested Priority | Yes | Yes | Select |
| Description | Yes | Yes | Textarea |
| Attachments | Yes | No | File upload |

### 5.3 Read-only Fields

Read-only fields must be visually different from editable fields.

Examples:

- Slightly tinted gray-green or warm ivory background
- No editable cursor behavior
- Clear label
- Consistent layout with other form controls

Ticket Number may display a placeholder before creation, such as:

```text
Generated after submission
```

### 5.4 Editable Fields

Editable fields should:

- Use a white background
- Provide visible focus states
- Provide clear labels above controls
- Use consistent heights and spacing
- Display helper text only when needed

### 5.5 Required Field Indicators

Required fields must:

- Use a visible red asterisk
- Still provide an actual validation message when invalid

Example:

```text
Ticket Summary *
```

### 5.6 Ticket Summary

The Ticket Summary input should:

- Accept plain text
- Display validation close to the field
- Respect the approved character limit
- Preserve entered text when backend submission fails

### 5.7 Requested Priority

Supported visual values:

- Low
- Medium
- High

The UI must use the values defined by the API contract.

Priority may be represented with text badges where appropriate, but meaning must not depend only on color.

### 5.8 Description

Description should use a textarea with enough visible space for multiple lines.

The textarea should:

- Be clearly labeled
- Support keyboard input
- Display validation close to the field
- Respect the approved character limit

### 5.9 Attachment Input

The Attachment section should support:

- Selecting permitted files
- Showing selected filename
- Showing file size where useful
- Showing upload or validation state
- Removing a file from the pending selection before submission where applicable

Permitted types:

- JPG / JPEG
- PNG
- WEBP
- PDF

Maximum size:

- 5 MB per file

Maximum active Attachments:

- 5 per Ticket

### 5.10 Submission Actions

The primary action should be:

```text
Create Ticket
```

The submit action must:

- Use primary Zen Green styling
- Be clearly distinguishable from secondary actions
- Enter a disabled or busy state during submission
- Prevent accidental repeated activation while processing

### 5.11 Validation State

Validation errors should:

- Appear near the affected field
- Use clear text
- Use dark red visual emphasis
- Not rely only on color

Example:

```text
Ticket Summary is required.
```

### 5.12 Submitting State

During submission:

- Disable the primary action.
- Display a progress or busy indicator.
- Prevent accidental duplicate submission.
- Preserve current form values.

Example button text:

```text
Creating Ticket...
```

### 5.13 Success State

After successful Ticket creation:

- Clearly show a success confirmation.
- Display the official backend-generated Ticket Number.
- Provide an appropriate next action.

Possible next actions:

- View Ticket
- Go to My Tickets
- Create Another Ticket

### 5.14 API Failure State

If Ticket creation fails:

- Display a safe error message.
- Preserve entered form values where practical.
- Allow the Requester to retry.
- Do not clear the form automatically.

---

## 6. My Tickets

The My Tickets page allows the selected Development Requester to browse and locate their own Tickets.

### 6.1 Page Structure

The page should contain:

1. Page title
2. Create Ticket action
3. Search controls
4. Filter controls
5. Sorting controls
6. Ticket results
7. Pagination

### 6.2 Search

The search input should:

- Have a visible label or accessible name
- Search the fields defined in the API specification
- Support keyboard submission or automatic search behavior
- Preserve filters where appropriate

Example placeholder:

```text
Search by Ticket Number or Summary
```

### 6.3 Filters

Supported filters should match the API contract.

Possible filters include:

- Category
- Related System
- Requested Priority
- Current Status

Filter controls must:

- Be clearly labeled
- Show current selections
- Work together with search and pagination

### 6.4 Clear Filters

A Clear Filters action should:

- Reset active filters
- Reset search where appropriate
- Return the list to the default state

### 6.5 Sorting

The UI should provide supported sorting options such as:

- Recently Updated
- Oldest / Newest
- Ticket Number

The exact sort options must map to values defined in the API contract.

### 6.6 Desktop Ticket Representation

Desktop may use a table.

Suggested columns:

| Column |
|---|
| Ticket Number |
| Ticket Summary |
| Category |
| Requested Priority |
| Current Status |
| Last Updated |

Each row should provide a clear way to open Ticket Detail.

### 6.7 Mobile Ticket Representation

On smaller screens, a card-based representation may be used.

Each Ticket card should show enough information to identify the Ticket, such as:

- Ticket Number
- Summary
- Category
- Priority
- Status
- Last Updated

Cards must remain easy to scan and tap.

### 6.8 Loading State

While Ticket results are loading:

- Display a loading indicator, skeleton, or clear loading message.
- Do not display stale results as if they were current.

### 6.9 Empty State

If the Requester owns no Tickets:

- Display a clear empty-state message.
- Provide a Create Ticket action.

Example:

```text
You do not have any tickets yet.
```

### 6.10 No-results State

If Tickets exist but search or filters match nothing:

- Display a separate no-results state.
- Provide an action to clear search or filters.

Example:

```text
No tickets match your current search or filters.
```

### 6.11 Failure State

If Ticket results cannot be loaded:

- Display a safe error message.
- Provide a retry action where appropriate.

### 6.12 Pagination

Pagination controls must:

- Clearly indicate the current page.
- Provide Previous and Next controls where applicable.
- Disable unavailable navigation actions.
- Remain usable on mobile.

---

## 7. Requester Ticket Detail

The Ticket Detail page displays one Ticket owned by the selected Development Requester.

### 7.1 Page Structure

The page should include:

1. Ticket identifier and status
2. Requester information
3. Ticket details
4. Attachment section
5. Navigation action back to My Tickets

### 7.2 Ticket Information

The page may display:

- Ticket Number
- Ticket Date
- Requester
- Category
- Related System
- Ticket Summary
- Requested Priority
- Description
- Current Status
- Created time
- Last updated time

### 7.3 Read-only Presentation

Ticket information displayed on Ticket Detail must be read-only for the Lab 2 Requester experience.

Read-only content may use:

- Definition lists
- Structured cards
- Read-only field styling

It must not appear editable.

### 7.4 Out-of-Scope Controls

The Ticket Detail page must not expose:

- Public Comments
- Internal Notes
- Actions Taken
- IT Staff assignment controls
- IT Priority editing
- Ticket status workflow controls

---

## 8. Attachment Section

The Ticket Detail page includes Attachment management for owned Tickets.

### 8.1 Active Attachment

An active Attachment should display:

- Original filename
- File type
- File size
- Upload timestamp
- Download action
- Remove action

### 8.2 Removed Attachment

A removed Attachment should remain visible as metadata.

The UI should clearly indicate:

```text
Removed
```

A removed Attachment must not show an active Download or Preview action.

It may display:

- Original filename
- Removed state
- Removal timestamp
- Removal reason

### 8.3 Upload Attachment

The Attachment section should allow the Requester to add another Attachment when fewer than 5 active Attachments exist.

Upload behavior must:

- Validate type and size
- Show upload progress or busy state
- Show clear validation errors
- Refresh the Attachment list after success

### 8.4 Remove Attachment

Removing an active Attachment should require explicit confirmation.

The UI should request a removal reason according to the approved business rule.

Example:

```text
Reason for removal *
```

The confirmation must clearly state that the file will become unavailable for download or preview.

### 8.5 Attachment Limit

When a Ticket already has 5 active Attachments:

- Disable or hide the upload action appropriately.
- Clearly explain why additional files cannot be added.

---

## 9. Component Rules

### 9.1 Form Labels

Labels should:

- Appear above form controls
- Remain visible
- Clearly identify the purpose of the field
- Use required indicators where applicable

### 9.2 Input States

| State | Expected Behavior |
|---|---|
| Default | Standard editable appearance |
| Focused | Visible focus indicator |
| Invalid | Error border plus validation message |
| Disabled | Clearly inactive and not interactive |
| Read-only | Distinct background and non-editable behavior |

### 9.3 Button Types

#### Primary

Used for the most important action on a screen.

Examples:

- Continue
- Create Ticket
- Upload Attachment

#### Secondary

Used for supporting actions.

Examples:

- Change Requester
- Retry
- Back to My Tickets

#### Destructive

Used for removal.

Example:

- Remove Attachment

Destructive actions should not visually compete with the main primary action.

### 9.4 Button States

Buttons may have:

- Default
- Hover
- Focus
- Disabled
- Busy / Loading

Disabled buttons:

- Must not be clickable
- Must remain understandable
- Must not rely solely on reduced opacity if that harms readability

### 9.5 Icon Controls

If icon-only controls are used:

- Provide an accessible name.
- Provide tooltip text where useful.
- Maintain visible focus.

### 9.6 Status and Priority Badges

Badges may be used for:

- Current Status
- Requested Priority

Badges must include readable text.

Color alone must not communicate meaning.

---

## 10. Feedback States

### 10.1 Success

Success states should use:

- Green visual emphasis
- Clear success text
- Relevant next action

### 10.2 Warning

Warnings should use:

- Amber visual emphasis
- Supporting text explaining the concern

### 10.3 Error

Errors should use:

- Dark red visual emphasis
- Clear readable message
- Recovery action where appropriate

### 10.4 Loading

Loading feedback should be shown for:

- Development Requester retrieval
- Ticket list retrieval
- Ticket Detail retrieval
- Ticket creation
- Attachment upload
- Attachment removal

---

## 11. Responsive Rules

The application must support three viewport ranges.

### 11.1 Desktop

**Width:** `≥ 992 px`

Expected behavior:

- Use a centered content area with a sensible maximum width.
- Multi-column form layout may be used.
- My Tickets may use a full table.
- Navigation remains easily accessible.
- Forms must not stretch excessively on very wide screens.

### 11.2 Tablet

**Width:** `768–991 px`

Expected behavior:

- Use two columns where practical.
- Allow wide controls such as Description and Ticket Summary to span available width.
- Ticket results may remain tabular if readable.
- Controls must not become cramped.

### 11.3 Mobile

**Width:** `< 768 px`

Expected behavior:

- Stack form fields vertically.
- Use touch-friendly controls.
- Ticket lists may switch to card representation.
- Search and filter controls may stack.
- Pagination must remain usable.
- Attachment filenames must wrap safely.

### 11.4 All Viewports

At every supported width:

- No clipped labels
- No overlapping controls
- No hidden required actions
- No unreadable Attachment names
- No unintended horizontal page scrolling
- No validation message overlap
- No button text clipping

---

## 12. Accessibility

### 12.1 Keyboard Support

All required interactive controls must be keyboard accessible.

This includes:

- Navigation
- Select controls
- Form fields
- Buttons
- Ticket links
- Attachment controls
- Pagination controls

### 12.2 Focus

Keyboard focus must:

- Remain visible
- Be visually distinguishable
- Follow a logical navigation order

### 12.3 Form Accessibility

Form fields should:

- Have associated labels
- Provide accessible validation messages
- Use required indicators
- Avoid placeholder-only labeling

### 12.4 Error Communication

Errors must not rely only on color.

An error should include:

- Visual emphasis
- Text description

### 12.5 Icon Accessibility

Icon-only controls require:

- Accessible labels
- Tooltips where useful

### 12.6 Touch Targets

Mobile controls should remain easy to activate without accidental taps.

---

## 13. Required Screen States

The UI implementation must verify the following states.

### Development Requester Selection

- [ ] Loading
- [ ] Ready
- [ ] Empty
- [ ] API Failure
- [ ] Selected

### Create Ticket

- [ ] Initial
- [ ] Validation Error
- [ ] Submitting
- [ ] Success
- [ ] API Failure
- [ ] Invalid Attachment

### My Tickets

- [ ] Loading
- [ ] Loaded
- [ ] Empty
- [ ] No Results
- [ ] API Failure

### Ticket Detail

- [ ] Loading
- [ ] Loaded
- [ ] Missing Ticket
- [ ] Ownership Failure
- [ ] API Failure

### Attachments

- [ ] Active
- [ ] Uploading
- [ ] Invalid
- [ ] Removed
- [ ] Unavailable

---

## 14. Responsive and Visual Inspection Checklist

### 14.1 Zen Green

- [ ] Primary Green `#006B3C` is used consistently.
- [ ] Secondary Green `#0B7A46` is used consistently.
- [ ] Pale Green `#EAF6EF` is used appropriately.
- [ ] Page background uses `#F5F7F6`.
- [ ] Content surfaces are visually distinct.

### 14.2 Forms

- [ ] Editable and read-only controls are distinguishable.
- [ ] Labels appear consistently.
- [ ] Required indicators are visible.
- [ ] Validation messages appear close to fields.
- [ ] Focus states are visible.

### 14.3 Buttons

- [ ] Primary action hierarchy is clear.
- [ ] Secondary actions are consistent.
- [ ] Destructive actions are visually appropriate.
- [ ] Disabled buttons are clearly disabled.
- [ ] Busy states are understandable.

### 14.4 My Tickets

- [ ] Search is usable.
- [ ] Filters are usable.
- [ ] Sorting is usable.
- [ ] Clear Filters is usable.
- [ ] Pagination is usable.
- [ ] Empty and no-results states are visually different.
- [ ] Ticket results remain readable.

### 14.5 Ticket Detail and Attachments

- [ ] Ticket information is clearly read-only.
- [ ] Active Attachments are identifiable.
- [ ] Removed Attachments are clearly marked.
- [ ] Removed files do not offer active download or preview.
- [ ] Long filenames remain readable.

### 14.6 Responsive

- [ ] Desktop layout verified.
- [ ] Tablet layout verified.
- [ ] Mobile layout verified.
- [ ] No clipped content.
- [ ] No overlapping content.
- [ ] No hidden required actions.
- [ ] No unintended horizontal overflow.

### 14.7 Accessibility

- [ ] Keyboard navigation works.
- [ ] Visible focus states exist.
- [ ] Form labels are associated correctly.
- [ ] Icon-only controls have accessible names.
- [ ] Error meaning is not communicated only through color.

---

## 15. Screenshot Evidence

The final Lab 2 evidence should include screenshots for the required Requester workflows and responsive layouts.

Recommended structure:

```text
artifacts/
└── lab-02/
    └── screenshots/
        ├── create-ticket/
        │   ├── desktop.png
        │   ├── tablet.png
        │   ├── mobile.png
        │   ├── validation.png
        │   ├── submitting.png
        │   └── success.png
        │
        ├── my-tickets/
        │   ├── desktop.png
        │   ├── tablet.png
        │   ├── mobile.png
        │   ├── empty.png
        │   └── no-results.png
        │
        └── ticket-detail/
            ├── desktop.png
            ├── mobile.png
            ├── active-attachment.png
            └── removed-attachment.png
```

Exact screenshot filenames may change during implementation, but the final evidence paths must be documented and remain easy to identify.

---

## 16. UI Implementation Notes

The UI specification defines required behavior and visual conventions rather than requiring one specific frontend component structure.

Implementation may introduce reusable components such as:

- `AppShell`
- `RequesterSelector`
- `PageHeader`
- `FormField`
- `StatusBadge`
- `PriorityBadge`
- `LoadingState`
- `EmptyState`
- `ErrorState`
- `TicketList`
- `TicketCard`
- `Pagination`
- `AttachmentSection`

Any implementation choice must preserve the behavior defined in this document.

If the final implementation changes an approved UI rule, this document must be updated before Lab 2 is considered complete.