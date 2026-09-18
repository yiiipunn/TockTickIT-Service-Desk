# Lab 3 AI Use Record

**Project:** TokTickIT Service Desk  
**Lab:** Lab 3 — Users, Roles, IT Staff Ticketing, and Administrator User Management  
**Author:** Phurithip Paisanworajit 67070503437  
**Status:** Done

## 1. Purpose

This record describes how AI assisted with Lab 3 work. It records the requests made, the suggestions or implementation produced, and the checks used before accepting changes.

## 2. AI Tool

| Item | Details |
| --- | --- |
| Tool / model | OpenAI Codex (GPT-5) |
| Main uses | Specification and test planning, scoped implementation, code review, debugging, release evidence, and documentation |
| Review approach | AI-assisted and student-reviewed |
| Current phase | Lab 3 implementation verification and release evidence preparation |

## 3. AI Usage Record

| No. | Task | Prompt / Request | AI Contribution | Student Review / Decision |
| ---: | --- | --- | --- | --- |
| 1 | Engineering contract | Convert the Lab 3 requirements into implementation, API, UI, and test specifications before feature work starts. | Helped maintain the Lab 3 contract documents and trace requirements to feature issues. | I compared the documents with the Lab 3 sheet and used them as the scope boundary. |
| 2 | Lab 2 migration | Preserve Lab 2 records while evolving requesters into role-based Users and adding seed foundations. | Proposed a guarded in-place migration, Argon2id seed hashing, and migration and seed regression tests. | I reviewed the migration and seed behavior to preserve IDs, relationships, and existing data. |
| 3 | Authentication | Implement only the Authentication Foundation: login, database sessions, current User, logout, CSRF, throttling, Login UI, and authenticated shell while deferring later role and ownership features. | Helped implement contract-aligned authentication tests and the authenticated shell while retaining Lab 2 compatibility. | I checked the security choices, scope, and test evidence against the specification. |
| 4 | Mandatory password change | Implement the first-login password-change workflow, including policy validation, session rotation, required routing, UI states, and regression tests. | Helped implement the password-change API, UI, and tests while retaining authentication compatibility boundaries. | I reviewed the password policy, session invalidation, scope, and test evidence. |
| 5 | Role authorization | Implement reusable backend role enforcement and migrate Requester Ticket and Attachment ownership from client requester context to authenticated session identity. | Helped add role and ownership guards, remove client requester identity as an authority source, and add spoofing and cross-owner regression coverage. | I checked the authorization matrix, safe failure behavior, and requester regressions. |
| 6 | IT Staff Ticket Queue | Implement the documented Staff and Administrator Ticket Queue with search, filters, sorting, pagination, role boundaries, responsive states, and detail navigation. | Helped add the queue API, query parsing, accessible responsive UI, and contract coverage. | I reviewed query semantics, authorization, responsive behavior, and scope boundaries. |
| 7 | Staff Ticket Detail | Complete the approved ticket priority and status operations in the Staff Ticket Detail before Issue 8. | Helped add contract-aligned priority and atomic status APIs and UI, then corrected a parallel test fixture race. | I reviewed transition rules, UI confirmation, and the related regression tests. |
| 8 | Public Comments and Internal Notes | Implement append-only public comments and private ticket notes with role and ownership boundaries, safe text handling, UI states, and regression tests. | Helped add separate API routes and Requester and Staff communication sections with server-side author, time, and privacy rules. | I checked API privacy, responsive layouts, and test evidence. |
| 9 | Administrator User Management | Implement Issue 9: protected User listing, search and role filter, create and edit, activation safety, and new initial passwords while preserving Issues 1–8. | Helped add Administrator-only APIs and UI, server-derived safety checks, password hashing and session revocation, and regression coverage. | I reviewed account-safety rules, password and session behavior, and role-specific navigation. |
| 10 | Release evidence and audit | Audit the Lab 3 file structure, reviewer evidence, tests, screenshots, and unresolved requirements before final integration. | Helped organize Lab 3 test files and E2E screenshots, record reviewer evidence from verifiable PR history, diagnose seed idempotence, and identify remaining release work. | I checked repository evidence and recorded unresolved items instead of marking them complete. |

## 4. Key Decisions Reviewed

| Area | AI Suggestion | Final Student Decision | Verification |
| --- | --- | --- | --- |
| Authentication/session | Use opaque session and CSRF values, store digests, enforce expiry, and revoke sessions on logout. | Retained after reviewing the documented authentication requirements. | API, unit, integration, and client tests |
| Password handling | Enforce the documented password policy, replace the Argon2id hash atomically, clear the first-login flag, revoke prior sessions, and issue a replacement session. | Retained after reviewing password-change and session requirements. | Unit, API, UI, regression tests, and client build |
| Role authorization | Derive role and Requester ownership from the authenticated session, enforce role checks server-side, and keep client identity non-authoritative. | Retained after checking the approved authorization matrix. | Direct authorization and Requester regression tests |
| Ticket Queue | Parse documented query values server-side and show Ticket Queue only for the roles permitted by the matrix. | Retained. Administrator ticket operations were limited to the approved matrix. | Queue parser, API, UI, and regression tests |
| User Management | Restrict User APIs to Administrators, validate one role and normalized email, and protect self-deactivation and last-active-Administrator state server-side. | Retained. Navigation visibility supplements, but does not replace, server authorization. | Issue 9 API, unit, UI, and navigation tests |
| Seed idempotence | Preserve an existing seed User password hash instead of generating a new salted Argon2id hash on every seed run. | Retained after the idempotence failure showed password hashes changing between runs. | Lab 3 seed integration test |
| Responsive evidence | Capture real browser screenshots for key Lab 3 flows and keep the evidence in the Lab 3 artifacts directory. | Retained. PNG screenshots were captured through the Lab 3 E2E suite. | Playwright E2E run and artifact inspection |
| Remaining requirement | Do not report Requester ticket resolution as complete until its endpoint, UI, and tests exist. | Kept open for final Lab 3 work. | Comparison of specification, API/UI documents, source, and tests |

## 5. AI Output Verification

| Verification Activity | How I Verified It |
| --- | --- |
| Requirements | Compared implementation and documentation with the Lab 3 sheet, specification.md, api-spec.md, ui-spec.md, and tests.md. |
| Source changes | Read the affected server and client code and checked that feature changes stayed within the assigned issue scope. |
| Authorization | Checked that server-side role and ownership checks remain in place and that navigation visibility is not treated as authorization. |
| Automated tests | Ran the full Lab 3 server suite: 25 files and 188 tests passed; full client suite: 13 files and 93 tests passed. |
| Browser tests | Ran the Lab 3 Playwright suite: 5 tests passed, including screenshot capture. |
| Build | Ran the client production build successfully with npm run build. |
| Documentation and evidence | Checked reviewer evidence against available repository and PR information; unverified review evidence remains marked as TODO. |

## 6. My Reflection

| Topic | Reflection |
| --- | --- |
| What AI helped with most | AI helped me break a large Lab 3 specification into smaller issues, trace requirements to tests, and find regressions across the client, server, seeds, and documentation. |
| What I learned | I learned that role-based UI is only a convenience layer. The server must still derive identity from the session and enforce role and ownership checks for every protected operation. |
| AI limitation or incorrect suggestion | AI output can look complete while repository evidence shows a gap. The seed idempotence failure showed that recreating salted password hashes breaks a valid repeatability requirement. The final audit also showed that Requester ticket resolution still needs implementation and tests. |
| How I verified AI output | I read the relevant specifications and source code, inspected diffs, ran focused tests, the complete server and client suites, Playwright E2E tests, and the client build. I also checked that screenshots and reviewer entries were based on real evidence. |
| What I changed after review | I corrected seed behavior so repeat runs retain existing seed password hashes, organized Lab 3 test and screenshot evidence, and kept incomplete release requirements visible instead of documenting them as finished. |
| How I would use AI differently next time | I will ask AI for smaller, traceable changes, review the diff after each step, compare every claimed feature with the acceptance criteria, and run the full verification set before calling a feature complete. |

## 7. Future AI Usage

For the remaining Lab 3 work, I will use AI to help trace unresolved requirements to source and tests, but I will verify each change against the specification and real execution results. Before final integration, I will complete the remaining Requester ticket-resolution work, update final evidence, and record the actual lab3-staging to main review and merge history.

## 8. Responsibility Statement

AI was used as a development assistant. I remain responsible for understanding the solution, reviewing changes, verifying requirements, running tests, correcting errors, and submitting the final work.

