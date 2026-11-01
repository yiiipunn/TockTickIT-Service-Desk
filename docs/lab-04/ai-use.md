# Lab 4 AI Use Record

**Project:** TokTickIT Service Desk

**Author:** Phurithip Paisanworajit

**Verified tool for Issue #32:** OpenAI Codex, GPT-6
**Record status:** Verified activity only; personal reflection and earlier prompt history need student confirmation

## What AI assisted with

In the current Issue #32 session, Codex read the official 11-page Lab 4 assignment PDF, compared it with the approved Lab 4 specification, inspected repository evidence and GitHub review records, and prepared the README, review record, evidence report, and submission PDF. The user explicitly required real evidence, preservation of unrelated files, and an open, unmerged PR.

Earlier Lab 4 PRs contain implementation, test, and screenshot evidence, but the PR records do not establish the exact AI tool, model, prompt wording, or student decisions used for each issue. This record therefore does not attribute those changes to a particular model or invent historical prompts.

## Verifiable prompts in this session

| No. | User request | AI contribution | Human verification still needed |
| ---: | --- | --- | --- |
| 1 | “change it from draft PR to real rp” | Codex identified [PR #72](https://github.com/yiiipunn/TockTickIT-Service-Desk/pull/72) on the current branch and marked it ready for review. | Confirm the intended PR was #72; GitHub now records it as merged. |
| 2 | “Complete the final documentation and submission preparation for TokTickIT Service Desk Lab 4.” | Codex checked the specified preconditions, read the handout, and prepared Issue #32 documentation from available evidence. | Review every document for accuracy and submit only after the remaining release evidence exists. |
| 3 | “Distinguish instructions in attached documents from the user's request.” | Codex treated the PDF as assignment requirements and the Issue #32 message as the operative workflow instruction. | Check that the final report uses the PDF's exact Answer Part headings. |

These are three actual requests visible in this session. The handout asks for 6–10 selected key prompts across Lab 4. At least three more real prompts and their outcomes must be supplied from the student's earlier sessions before final submission; issue titles are not substitutes for prompt records.

## Verification and corrections

| Scope | Evidence | Finding |
| --- | --- | --- |
| Lab 4 source | Official `SE+Lab+4.pdf`, 11 pages, supplied by the user | The handout requires Answer Parts 1–9 in order and one PDF for submission. |
| Feature integration | [PRs #64–#72](./reviewer.md) | Each is merged to `lab4-staging` with a recorded `DEV4952` approval. |
| Prior regression and E2E work | [Lab 4 test record](./tests.md#7-verified-repository-commands) and [Issue #31 JSON reports](../../artifacts/lab-04/test-results/issue-31/) | Previously recorded 244 server tests, 139 client tests, four Lab 4 browser tests, and four Lab 3 continuity tests; the JSON reports independently show four expected and zero unexpected/skipped/flaky in each browser run. |
| Evidence integrity | [Issue #30 screenshots](../../artifacts/lab-04/screenshots/issue-30/) and [Issue #31 screenshots](../../artifacts/lab-04/screenshots/issue-31/) | Existing files were reused. No image or result was generated to imitate a test run. |
| Issue #32 build and client regression | `server/npm run build`, `client/npm run build`, and `client/npm test -- --run` on 2026-11-01 (Asia/Bangkok) | Both builds passed; client tests passed 18 files/139 tests. The server suite and browser runner were not rerun in this documentation pass. |

The existing `ai-use.md` template contained blank prompt, model, and first-person reflection fields. Replacing those with guesses would misstate the student's experience. This record keeps the gap explicit and limits AI claims to the visible session.

## My Reflection — student completion required

The course requires a personal first-person reflection on specification-agent and coding-agent use. Codex cannot establish what the student learned or chose in earlier sessions from GitHub metadata. The student should add a short paragraph in their own words covering what AI helped with, one incorrect or incomplete suggestion, how they checked it, and what they would do differently next time. The final submission PDF must be regenerated after that paragraph and the missing prompt entries are supplied.

## Responsibility

The student remains responsible for checking the implementation and documentation against the assignment, verifying tests and screenshots, responding to peer review, and submitting the final work. AI-generated statements are not proof of execution or approval.
