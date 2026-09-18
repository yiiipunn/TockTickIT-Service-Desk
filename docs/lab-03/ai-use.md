# Lab 3 AI Use Record

**Project:** TokTickIT Service Desk  
**Author:** Phurithip Paisanworajit 67070503437  
**Status:** In Progress

## 1. AI Tool

| Item | Details |
| --- | --- |
| Tool / model | TBD |
| Main uses | Specification, test planning, implementation, review, and debugging |
| Review approach | AI-assisted and student-reviewed |

## 2. Selected AI Prompts

Record 6–10 important prompts. Summarize long prompts without changing their meaning, and do not include passwords, tokens, or personal data.

| No. | Task | Prompt / Request | AI Contribution | Student Review / Decision |
| ---: | --- | --- | --- | --- |
| 1 | Engineering contract | TBD | TBD | TBD |
| 2 | Test planning | TBD | TBD | TBD |
| 3 | Authentication | Implement only the Authentication Foundation: login, database sessions, current User, logout, CSRF, throttling, Login UI, and authenticated shell while deferring later role/ownership features. | Added contract-aligned auth tests and implementation, preserved Lab 2 workflows through an authenticated compatibility layer, and recorded executed verification. | Pending student review of security choices, scope, and test evidence. |
| 4 | Mandatory password change | Implement only the first-login password-change workflow, including policy validation, session rotation, required routing, UI states, and regression tests. | Added the contract-aligned password-change API/UI and tests while retaining the existing authentication and Lab 2 compatibility boundaries. | Pending student review of password policy, session invalidation, scope, and test evidence. |
| 5 | Lab 2 migration | Preserve Lab 2 records while evolving requesters into role-based Users and adding seed foundations. | Proposed guarded in-place migration, Argon2id seed hashing, and migration/seed regression tests. | Pending student review of migration SQL and executed evidence. |
| 6 | IT Staff Ticket Queue | Implement only the shared Staff/Admin Ticket Queue with documented search, filters, sorting, pagination, safe role boundaries, responsive queue states, and a detail-navigation handoff; defer operational Ticket actions. | Added contract tests, a server-side query parser/queue endpoint, and an accessible responsive queue UI while leaving claim, assignment, priority, status, comments, notes, and full Staff Detail for later issues. | Pending student review of query semantics, authorization, responsive behavior, scope boundaries, and test evidence. |
| 7 | Administrator User Management | Implement only Issue 9: protected User listing, search/filter, create/edit, activation safety, and new initial passwords while preserving Issues 1–8. | Added Administrator-only APIs and UI, server-derived safety checks, password hashing/session revocation, responsive list/cards, and focused regression coverage. | Pending student review of account safety rules, password/session behavior, and executed test evidence. |
| 8 | Role authorization | Implement reusable backend role enforcement and migrate Requester Ticket/Attachment ownership from client requester context to authenticated session identity, without implementing later Staff/Admin workflows. | Added role and ownership guards, removed the Requester selector/header trust, migrated Lab 2 compatibility tests, and added direct spoof/cross-owner regression coverage. | Pending student review of the authorization matrix, safe failure behavior, and regression evidence. |
| 9 | Public Comments and Internal Notes | Implement only Issue 8 on the completed Issues 1–7 baseline: append-only public and private Ticket communication with role/ownership boundaries, safe text, UI states, and regression tests. | Added separate API routes and Requester/Staff communication sections, verified author/time and privacy server-side, and corrected the seed test to count only seeded communication records during parallel tests. | Pending student review of API privacy, responsive layouts, and test evidence. |
| 10 | Issue 7 audit repair | Audit found the approved IT Priority and Ticket Status operations missing from the merged Staff Ticket Detail; complete only those operations before Issue 8. | Added contract-aligned priority and atomic status APIs and UI, then corrected a parallel test fixture race by reusing seeded reference rows. | Pending student review of the transition rules, UI confirmation, and test evidence. |

## 3. Key Decisions Reviewed

| Area | AI Suggestion | Final Student Decision | Verification |
| --- | --- | --- | --- |
| Authentication/session | Use opaque 32-byte session and CSRF values, store only SHA-256 digests, enforce idle/absolute expiry, and revoke on logout. | Pending student review | API/unit tests and migration inspection |
| Password handling | Enforce the 12–128 character policy, verify the current Argon2id hash, atomically replace the hash and first-login flag, revoke prior sessions, and issue a replacement session. | Pending student review | Unit/API/UI tests and production builds |
| Role authorization | Use the authenticated session User for role and Requester ownership, return safe `403` role failures, apply ownership in database queries, and make client requester IDs non-authoritative. | Pending student review | Direct authorization, requester regression, and Lab 1/Lab 2 regression tests |
| Ticket Queue | Parse only documented Queue query values server-side, constrain owner IDs to active eligible Staff/Admin Users, and add an IT Staff/Admin workspace without operational mutations. | Pending student review | Queue parser/API/UI tests and server/client regressions |
| Ticket communication | Derive author and time on the server, validate trimmed plain text, enforce Requester ownership and Staff/Admin note access, and render distinct communication sections. | Pending student review | Issue 8 API/UI tests, Lab 3 suites, full regressions, and builds |
| User Management | Restrict User APIs to Administrators, select safe User fields, validate one role and normalized email, and protect self/last-active-Administrator state server-side. | Pending student review | Issue 9 API/unit/UI tests, Lab 3 suites, full regressions, and builds |
| Lab 2 migration | Rename the requester table in place, preserve IDs/relations, and guard enum/email data before casts. | Pending student review | Migration/regression tests |
| UI/responsive behavior | TBD | TBD | UI spec, E2E screenshots |

## 4. My Reflection

| Topic | Reflection |
| --- | --- |
| What AI helped with most | TBD |
| What I learned | TBD |
| AI limitation or incorrect suggestion | TBD |
| How I verified AI output | TBD |
| What I changed after review | TBD |
| How I would use AI differently next time | TBD |

## 5. Verification Checklist

- [x] Earlier AI output was checked against the Lab 3 sheet.
- [ ] Issue 8 output was checked against the Lab 3 sheet (attachment path pending).
- [x] Requirements were checked against `specification.md`.
- [x] Endpoints were checked against `api-spec.md`.
- [x] UI behavior was checked against `ui-spec.md`.
- [x] Tests and AC traceability were checked against `tests.md`.
- [ ] Generated code was reviewed and understood by the student.
- [x] Actual test/build results were recorded; none were assumed.
- [ ] No secrets or sensitive information were included in prompts or this file.
- [ ] Final reflection was written in the student's own words.

## 6. Responsibility Statement

AI is used as a development assistant. The student remains responsible for understanding the solution, reviewing changes, verifying requirements, running tests, correcting errors, and submitting the final work.
