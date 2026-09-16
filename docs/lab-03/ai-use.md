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
| 6 | IT Staff workflow | TBD | TBD | TBD |
| 7 | User Management | TBD | TBD | TBD |
| 8 | Role authorization | Implement reusable backend role enforcement and migrate Requester Ticket/Attachment ownership from client requester context to authenticated session identity, without implementing later Staff/Admin workflows. | Added role and ownership guards, removed the Requester selector/header trust, migrated Lab 2 compatibility tests, and added direct spoof/cross-owner regression coverage. | Pending student review of the authorization matrix, safe failure behavior, and regression evidence. |
| 9 | UI/responsive review | Optional | Optional | Optional |
| 10 | Integration/review fixes | Optional | Optional | Optional |

## 3. Key Decisions Reviewed

| Area | AI Suggestion | Final Student Decision | Verification |
| --- | --- | --- | --- |
| Authentication/session | Use opaque 32-byte session and CSRF values, store only SHA-256 digests, enforce idle/absolute expiry, and revoke on logout. | Pending student review | API/unit tests and migration inspection |
| Password handling | Enforce the 12–128 character policy, verify the current Argon2id hash, atomically replace the hash and first-login flag, revoke prior sessions, and issue a replacement session. | Pending student review | Unit/API/UI tests and production builds |
| Role authorization | Use the authenticated session User for role and Requester ownership, return safe `403` role failures, apply ownership in database queries, and make client requester IDs non-authoritative. | Pending student review | Direct authorization, requester regression, and Lab 1/Lab 2 regression tests |
| Ticket workflow | TBD | TBD | Transition matrix/tests |
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

- [ ] AI output was checked against the Lab 3 sheet.
- [ ] Requirements were checked against `specification.md`.
- [ ] Endpoints were checked against `api-spec.md`.
- [ ] UI behavior was checked against `ui-spec.md`.
- [ ] Tests and AC traceability were checked against `tests.md`.
- [ ] Generated code was reviewed and understood by the student.
- [ ] Actual test/build results were recorded; none were assumed.
- [ ] No secrets or sensitive information were included in prompts or this file.
- [ ] Final reflection was written in the student's own words.

## 6. Responsibility Statement

AI is used as a development assistant. The student remains responsible for understanding the solution, reviewing changes, verifying requirements, running tests, correcting errors, and submitting the final work.
