# Lab 2 Peer Review Record

**Project:** TokTickIT Service Desk  
**Lab:** Lab 2 — Requester Ticketing MVP with UI Foundation  
**Author:** Phurithip Paisanworajit  67070503437
**Reviewer:** TBD  
**Status:** Prior implementation PRs merged; final integration review pending

---

## 1. Review Purpose

This document records peer-review evidence for Lab 2.

The review process is used to verify that:

- The implementation matches the approved specification.
- The implementation follows the API and UI contracts.
- Acceptance Criteria are covered by tests.
- Major defects or inconsistencies are identified before merge.
- Review feedback is addressed before work is considered complete.

---

## 2. Review Workflow

Lab 2 work follows the repository workflow:

```text
Issue
  ↓
Feature Branch
  ↓
Implementation / Documentation
  ↓
Pull Request
  ↓
Peer Review
  ↓
Fixing if required
  ↓
Approved
  ↓
Merge to lab2-staging
```

Feature work must not be developed directly on `main` or `lab2-staging`.

The reviewer checks the Pull Request before it is merged.

---

## 3. Reviewer Information

| Item | Details |
|---|---|
| Reviewer Name | Sorawit Chaithong 67070503442 |
| GitHub Username | @DEV4952 |
| Relationship | Peer reviewer |
| Repository | TokTickIT Service Desk |
| Target Branch | `lab2-staging` |

---

## 4. Pull Request Review Record

This section will be updated as Lab 2 Pull Requests are created and reviewed.

| PR | Issue | Branch | Reviewer | Review Result | Merge Status |
|---|---|---|---|---|---|
| #21 | #1 Specification & Test Plan | `feature/lab2-specification` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| #23 | #2 Development Requester Context | `feature/development-requester-context` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| #22 | #3 Ticket Data Model & Reference Data | `feature/ticket-data-model` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| #24 | #4 Create Ticket | `feature/create-ticket` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| #25 | #5 My Tickets | `feature/my-tickets` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| #26 | #6 Requester Ticket Detail | `feature/ticket-detail` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| #27 | #7 / #11 Attachment Management | `feature/attachment-management` | No reviewer recorded | No recorded review | Merged to `lab2-staging` |
| Pending | #20 / Issue #12 E2E, Responsive & Release Integration | `feature/lab2-integration` | @DEV4952 (peer reviewer) | Pending | Pending |

---

## 5. Review Checklist

The peer reviewer should verify the following where applicable.

### 5.1 Specification

- [ ] Implementation matches `specification.md`.
- [ ] Functional Requirements are followed.
- [ ] Business Rules are enforced.
- [ ] Acceptance Criteria are addressed.
- [ ] Assumptions and implementation decisions are documented.

### 5.2 Data and API

- [ ] Prisma schema matches the documented data model.
- [ ] Required migrations are included.
- [ ] Seed data is idempotent.
- [ ] API implementation matches `api-spec.md`.
- [ ] Backend validation is implemented.
- [ ] Ownership checks are performed on the backend.
- [ ] Safe error responses are used.

### 5.3 UI

- [ ] UI follows `ui-spec.md`.
- [ ] Zen Green design rules are followed.
- [ ] Required loading, empty, failure, and success states exist.
- [ ] Responsive behavior works as specified.
- [ ] Accessibility requirements are considered.

### 5.4 Tests

- [ ] Planned tests are implemented where required.
- [ ] Acceptance Criteria map to tests.
- [ ] Happy paths are covered.
- [ ] Validation and boundary cases are covered.
- [ ] Ownership cases are covered.
- [ ] Failure states are covered.
- [ ] Required tests pass.
- [ ] No required tests are skipped.

### 5.5 Code Quality

- [ ] Code is understandable and reasonably organized.
- [ ] Naming is consistent.
- [ ] Unnecessary duplicate code is avoided.
- [ ] Debugging code or temporary files are not accidentally included.
- [ ] No sensitive or environment-specific information is committed.

---

## 6. Review Feedback

Review feedback will be recorded here after each Pull Request review.

### PR: TBD

**Issue:** TBD  
**Reviewer:** TBD  
**Review Date:** TBD

#### Comments

- TBD

#### Required Changes

- TBD

#### Author Response

- TBD

#### Final Result

- [ ] Approved
- [ ] Changes Requested
- [ ] Re-review Required

---

## 7. Review Fix Record

If changes are requested, record how each major review comment was addressed.

| Review Comment | Action Taken | Commit / Evidence | Status |
|---|---|---|---|
| TBD | TBD | TBD | Pending |

---

## 8. Final Review Summary

To be completed before the final Lab 2 release.

```text
Total Pull Requests Reviewed:
Approved Pull Requests:
Pull Requests Requiring Fixes:
Outstanding Review Issues:
```

Final condition:

- All required Pull Requests have been reviewed.
- Required review feedback has been addressed.
- No unresolved blocking review comments remain.
- Feature work has been merged through the approved Lab 2 workflow.
