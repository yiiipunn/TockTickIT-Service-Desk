# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** ChatGPT

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | How should I set up the client and server for the TokTickIT project? | I used the guidance to understand the project structure and checked that the React + TypeScript + Vite frontend and Express + TypeScript backend could run successfully. |

| 2 | How do I connect PostgreSQL with Prisma, and what does the P1000 authentication error mean? | I used the explanation to troubleshoot the database connection, checked my PostgreSQL credentials, and tested the connection before continuing with Prisma. |

| 3 | What should I check before committing and pushing the project foundation branch? | I checked the staged files and `.gitignore` to make sure `.env`, `node_modules`, and other local files were not committed before pushing the branch. |

| 4 | How should I implement and test the `/api/health` endpoint for Issue 2? | I compared the implementation with the provided Supertest requirements, updated the endpoint to return status 200 with the expected JSON, and ran the test to confirm that it passed. |

| 5 | Does the `throw` in `client/src/api.ts` prevent `fetch()` from running, and is the old 501 response still present? | I checked the actual source code instead of changing it immediately. I used `git grep` to confirm that the old 501 response and placeholder throw were already removed. I kept the remaining throw because it only handles an unsuccessful response after `fetch()` runs. |

| 6 | How can I verify the Online and Offline states of the health check? | I tested the system with the backend running to verify the Online state, then stopped the backend and checked that the UI handled the connection failure as the Offline state. |

## Reflection

_To be completed after finishing all Lab 1 issues._