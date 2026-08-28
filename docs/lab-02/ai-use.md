# Lab 2 AI Use Record

**Project:** TokTickIT Service Desk  
**Lab:** Lab 2 — Requester Ticketing MVP with UI Foundation  
**Author:** Phurithip Paisanworajit 67070503437
**Status:** In Progress

---

## 1. Purpose

This document records how AI tools were used during Lab 2. AI was used to support planning, requirement interpretation, specification writing, test planning, and implementation assistance.

All AI-generated suggestions were reviewed before being accepted. Final decisions, implementation, testing, and submitted work remain the responsibility of the student.

---

## 2. AI Tool

| Item | Details |
|---|---|
| **AI Tool** | ChatGPT |
| **Main Purpose** | Planning, specification, test planning, and implementation support |
| **Usage Approach** | AI-assisted, student-reviewed |
| **Current Phase** | Planning and Specification |

---

## 3. AI Usage Record

| No. | Task | Prompt / Request | AI Contribution | Student Review / Decision |
|---:|---|---|---|---|
| **1** | GitHub Issue Planning | Help break Lab 2 into suitable GitHub Issues based on the assignment requirements and dependencies. | Suggested 8 Issues covering specification, requester context, data model, Create Ticket, My Tickets, Ticket Detail, attachments, and E2E/release integration. | I reviewed the structure and used it because it separates the work into manageable features with clear dependencies. |
| **2** | Git Workflow | Help plan the Git workflow for Lab 2, including the staging branch, feature branches, Pull Requests, and peer review. | Suggested creating `lab2-staging` from `main`, then using one feature branch and peer-reviewed PR per Issue. | I accepted the workflow because it supports isolated development and peer review before merging. |
| **3** | Specification | Help draft `docs/lab-02/specification.md` based on the Lab 2 requirements. | Helped organize Sprint Goal, Scope, FRs, BRs, UI Summary, Data Changes, API Contract, ACs, DoD, and design decisions. | I reviewed each section and kept the content that matched the assignment and intended TokTickIT behavior. |
| **4** | Functional Requirements & Business Rules | Help define detailed Functional Requirements and Business Rules for the Requester-facing MVP. | Identified rules for requester selection, ticket creation, My Tickets, Ticket Detail, attachments, ownership, validation, and UI states. | I separated functionality into `FR-xx` and system/business constraints into `BR-xx` for clearer traceability. |
| **5** | API Contract | Help define the Lab 2 API contract, including endpoints, requester context, validation, ownership, pagination, sorting, and attachment behavior. | Helped draft endpoints, `X-Requester-Id`, validation rules, pagination, sorting, ownership behavior, HTTP status codes, and attachment operations. | I reviewed the choices against the specification. `X-Requester-Id` is treated only as a temporary Lab 2 mechanism, not real authentication. |
| **6** | UI Specification | Help create `ui-spec.md` for the Zen Green Requester experience. | Helped define design tokens, application shell, Requester Selection, Create Ticket, My Tickets, Ticket Detail, attachments, responsive rules, and accessibility. | I kept the specification as the planned UI contract and will update it if implementation requires justified changes. |
| **7** | Test Planning | Help create `tests.md` and map the Acceptance Criteria to planned automated tests before implementation. | Helped plan API, UI component, responsive, boundary, ownership, failure-state, attachment, and E2E tests. | I kept test results as planned/not run because implementation has not started. Actual results will only be recorded after execution. |
| **8** | Peer Review Documentation | Help prepare `reviewer.md` before implementation and Pull Request review begins. | Created a structure for reviewer information, PR records, feedback, required changes, author responses, and approval status. | I kept unknown review information as `TBD` or `Pending` until the actual peer review occurs. |

---

## 4. Key Decisions and Verification

| Area | AI Suggestion / Discussion | Final Student Decision |
|---|---|---|
| **Requester Context** | Use a temporary requester identifier for API requests. | Use `X-Requester-Id` during Lab 2 only. It is not authentication. |
| **Ticket Number** | Example Ticket Number formats were discussed. | Exact format remains TBD. It must be unique and backend-generated. |
| **Summary Length** | Define a clear validation boundary. | Use 1–120 trimmed characters. |
| **Description Length** | Define a clear validation boundary. | Use 1–2000 trimmed characters. |
| **Priority** | Define supported values. | Use `LOW`, `MEDIUM`, and `HIGH`. |
| **Default Sorting** | Define predictable My Tickets ordering. | Use `updatedAt DESC` with internal ID descending as secondary sort. |
| **Pagination** | Define default and supported page sizes. | Default to 10; support 10, 20, and 50. |
| **Attachment Removal** | Keep historical Attachment information. | Use soft removal and retain metadata. |
| **Test Results** | Prepare planned tests before implementation. | Keep results as `Not Run` until tests are actually executed. |
| **Peer Review Evidence** | Prepare the review document early. | Keep PR numbers, reviewer results, and evidence as `TBD` until they actually exist. |

---

## 5. AI Output Verification

AI-generated output is verified against the following sources before being accepted:

| Verification Source | How It Is Used |
|---|---|
| **Lab 2 Assignment** | Check fixed requirements and required deliverables. |
| **Existing Project Structure** | Ensure suggestions can work with the current TokTickIT codebase. |
| **`specification.md`** | Check Functional Requirements, Business Rules, and Acceptance Criteria. |
| **`api-spec.md`** | Check endpoint and backend behavior consistency. |
| **`ui-spec.md`** | Check UI behavior and responsive requirements. |
| **`tests.md`** | Ensure planned behavior is testable and traceable. |
| **Actual Implementation** | Verify AI suggestions against real application behavior after coding begins. |
| **Automated Tests** | Confirm implemented behavior rather than assuming generated code is correct. |

---

## 6. Reflection

| Topic | Reflection |
|---|---|
| **What AI helped with most** | AI was most useful for organizing the large number of connected Lab 2 requirements into smaller Issues, specifications, business rules, Acceptance Criteria, and planned tests. |
| **What I learned** | I learned that specification and test planning can be used as an engineering contract before implementation rather than being written only after the code is complete. |
| **Limitation of AI** | AI suggestions cannot automatically be treated as assignment requirements. Some requirements are fixed by the handout, while other details require my own design decisions. |
| **Example** | Attachment type, size, and active-count limits are fixed requirements, while API parameter names and the exact Ticket Number format require implementation decisions. |
| **How I verify AI work** | I review suggestions against the assignment and project documents, inspect generated code, run tests, and update documentation when implementation decisions change. |
| **Future approach** | I will continue using AI for small and clearly scoped implementation tasks while reviewing code and test results myself. |

---

## 7. Future AI Usage

This document is still **In Progress**. Additional significant AI interactions will be added as implementation continues.

| Future Area | Status |
|---|---|
| Prisma schema and migrations | Not Started |
| Seed data implementation | Not Started |
| API implementation | Not Started |
| React component implementation | Not Started |
| Automated test implementation | Not Started |
| Debugging | Not Started |
| E2E testing | Not Started |
| Responsive UI fixes | Not Started |
| Pull Request review fixes | Not Started |

---

## 8. Responsibility Statement

| Responsibility | Owner |
|---|---|
| Review AI-generated output | Student |
| Understand the implemented solution | Student |
| Verify assignment requirements | Student |
| Run and inspect tests | Student |
| Review code changes | Student |
| Correct implementation errors | Student |
| Maintain documentation consistency | Student |
| Submit final work | Student |

AI is used as a development assistant and does not replace student review, understanding, testing, or verification.