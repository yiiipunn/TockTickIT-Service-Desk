# Lab 2 — Peer Review Record

**Author:** Phurithip Paisanworajit — 67070503437 — GitHub: @yiiipunn
**Peer reviewer:** Sorawit Chaithong — 67070503442 — GitHub: @DEV4952
**Status:** Lab 2 : feature PRs reviewed and merged to `lab2-staging`; final release PR to `main` is pending.

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

This section records the available GitHub PR history and the current integration-review state. A merged PR is not treated as proof of peer approval unless a review is recorded.

| PR | Issue | Branch | Reviewer | Review Result | Merge Status |
|---|---|---|---|---|---|
| [#21](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/21) | #1 Specification & Test Plan | `feature/lab2-specification` | @DEV4952 | Approved | Merged to `lab2-staging` |
| [#23](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/23) | #2 Development Requester Context | `feature/development-requester-context` | @DEV4952 | Approved | Merged to `lab2-staging` |
| [#22](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/22) | #3 Ticket Data Model & Reference Data | `feature/ticket-data-model` | @DEV4952 | Approved | Merged to `lab2-staging` |
| [#24](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/24) | #4 Create Ticket | `feature/create-ticket` | @DEV4952 | Approved | Merged to `lab2-staging` |
| [#25](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/25) | #5 My Tickets | `feature/my-tickets` | @DEV4952 | Approved | Merged to `lab2-staging` |
| [#26](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/26) | #6 Requester Ticket Detail | `feature/ticket-detail` | @DEV4952 | Change requested, fixed, then approved | Merged to `lab2-staging` |
| [#27](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/27) | #7 Attachment Management | `feature/attachment-management` | @DEV4952 | Approved | Merged to `lab2-staging` |
| [#28](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/28) | #8 E2E, Responsive & Release Integration | `feature/lab2-integration` | @DEV4952 | Approved | Merged to `lab2-staging` |

## Pull Requests I reviewed for my partner

| Partner PR | Review role |
|---|---|
| [#13](https://github.com/DEV4952/TocktickIT/pull/13) | Reviewed by me |
| [#15](https://github.com/DEV4952/TocktickIT/pull/15) | Reviewed by me |
| [#23](https://github.com/DEV4952/TocktickIT/pull/23) | Reviewed by me |
| [#25](https://github.com/DEV4952/TocktickIT/pull/25) | Reviewed by me |
| [#26](https://github.com/DEV4952/TocktickIT/pull/26) | Reviewed by me |
| [#27](https://github.com/DEV4952/TocktickIT/pull/27) | Reviewed by me |
| [#28](https://github.com/DEV4952/TocktickIT/pull/28) | Reviewed by me |
| [#29](https://github.com/DEV4952/TocktickIT/pull/29) | Reviewed by me |
| [#30](https://github.com/DEV4952/TocktickIT/pull/30) | Reviewed by me |
| [#31](https://github.com/DEV4952/TocktickIT/pull/31) | Reviewed by me |
| [#32](https://github.com/DEV4952/TocktickIT/pull/32) | Reviewed by me |
| [#33](https://github.com/DEV4952/TocktickIT/pull/33) | Reviewed by me |
| [#34](https://github.com/DEV4952/TocktickIT/pull/34) | Reviewed by me |

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

### PR #21 — Issue #1 Specification & Test Plan

**Reviewer comment I received:** “After that read everything you have all markdown that should have. Everything all set good job kub.”

**How I responded:** “Okay thx naka!”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

### PR #22 — Issue #3 Ticket Data Model & Reference Data

**Reviewer comment I received:** “Great work! The data model, migration, seed data, and automated tests are well organized and clearly aligned with the Lab 2 requirements. Nice job keeping the seed process idempotent as well.”

**How I responded:** “Thank you so much ka!”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

### PR #23 — Issue #2 Development Requester Context

**Reviewer comment I received:** “After i check this PR everything look good to me, I think you can do next feature.”

**How I responded:** “Arigato ka!”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

### PR #24 — Issue #4 Create Ticket

**Reviewer comment I received:** “after i review everything it look good, good job”

**How I responded:** “khobkunkaa”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

### PR #25 — Issue #5 My Tickets

**Reviewer comment I received:** “Reviewed the implementation and code changes. Everything looks consistent and well-structured. Approved.”

**How I responded:** “Okay ka!”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

### PR #26 — Issue #6 Requester Ticket Detail

**Reviewer comment I received:** “can you change UI new ticket to next page. Please thank you”

**How I responded:** “Dai kaa!” followed by “Already Fixed ka!”

**Final result:** @DEV4952 re-reviewed the fix and approved the PR; it was merged to `lab2-staging`.

### PR #27 — Issue #7 Attachment Management

**Reviewer comment I received:** “The changes align with the requirements and acceptance criteria. No blocking issues found. Approved.”

**How I responded:** “Okayyy jra”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

### PR #28 — Issue #8 E2E, Responsive & Release Integration

**Reviewer comment I received:** “Looks good to me! The implementation is clear and meets the requirements. Approved.”

**How I responded:** “khobkunkaa”

**Final result:** Approved by @DEV4952 and merged to `lab2-staging`.

---

## 7. My Review Records for My Partner

| Partner PR | My review comment | Partner response | Verdict |
|---|---|---|---|
| [#13](https://github.com/DEV4952/TocktickIT/pull/13) | “Everything looks great to me. Please invite me to your collaboration, then I will merge this PR for you.” | Added me as a collaborator and thanked me for the review. | Approved |
| [#15](https://github.com/DEV4952/TocktickIT/pull/15) | “Everything looks good. The requester selection and switching flow are handled properly, including loading/error states and filtering out inactive requesters. Tests are also included.” | “Thank you kubbbbbbbb.” | Approved |
| [#23](https://github.com/DEV4952/TocktickIT/pull/23) | “Looks good and appropriately scoped for the Lab 2 Ticketing MVP.” | “Thank you kub.” | Approved |
| [#28](https://github.com/DEV4952/TocktickIT/pull/28) | “Looks good overall. Could you confirm that all client and server tests pass and that the additional file changes are intentional?” | “Ofc sure.” | Approved |
| [#29](https://github.com/DEV4952/TocktickIT/pull/29) | “Nice work! The implementation matches the expected flow and everything looks good on my end.” | No response recorded in the retrieved timeline. | Approved |
| [#30](https://github.com/DEV4952/TocktickIT/pull/30) | “Reviewed the changes and everything looks good. No issues found. Approved.” | No response recorded in the retrieved timeline. | Approved |
| [#31](https://github.com/DEV4952/TocktickIT/pull/31) | “Nice work! The changes look solid and everything seems to be working as expected.” | No response recorded in the retrieved timeline. | Approved |
| [#32](https://github.com/DEV4952/TocktickIT/pull/32) | “Reviewed the changes and everything looks good. No issues found. Merge dai loeyyy.” | No response recorded in the retrieved timeline. | Approved |
| [#33](https://github.com/DEV4952/TocktickIT/pull/33) | “Reviewed the implementation and code changes. Everything looks consistent and well-structured.” | “Thank you kub.” | Approved |
| [#34](https://github.com/DEV4952/TocktickIT/pull/34) | “Looks good to me. Approved.” | “Thank you kub.” | Approved |

---

## 8. Review Fix Record

If changes are requested, record how each major review comment was addressed.

| Review Comment | Action Taken | Commit / Evidence | Status |
|---|---|---|---|
| PR #26: show Create Ticket on its own page | Updated the UI flow and requested re-review | [PR #26](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/26) | Fixed and approved |

---

## 9. Final Review Summary

To be completed before the final Lab 2 release.

```text
Lab 2 PRs authored and reviewed by partner: 8
Partner PRs reviewed by me: 13
Approved PRs directly confirmed from GitHub: #21–#28
Final release status: all Lab 2 feature PRs are merged to `lab2-staging`; release PR to `main` remains pending
```

Final condition:

- All required Pull Requests have been reviewed.
- Required review feedback has been addressed.
- No unresolved blocking review comments remain.
- Feature work has been merged through the approved Lab 2 workflow.
