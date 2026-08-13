# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** ChatGPT

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
### Issue1
| 1 | How should I set up the client and server for the TokTickIT project? | I used the guidance to understand the project structure and checked that the React + TypeScript + Vite frontend and Express + TypeScript backend could run successfully. |

| 2 | How do I connect PostgreSQL with Prisma, and what does the P1000 authentication error mean? | I used the explanation to troubleshoot the database connection, checked my PostgreSQL credentials, and tested the connection before continuing with Prisma. |

| 3 | What should I check before committing and pushing the project foundation branch? | I checked the staged files and `.gitignore` to make sure `.env`, `node_modules`, and other local files were not committed before pushing the branch. |
### Issue2
| 4 | How should I implement and test the `/api/health` endpoint for Issue 2? | I compared the implementation with the provided Supertest requirements, updated the endpoint to return status 200 with the expected JSON, and ran the test to confirm that it passed. |

| 5 | Does the `throw` in `client/src/api.ts` prevent `fetch()` from running, and is the old 501 response still present? | I checked the actual source code instead of changing it immediately. I used `git grep` to confirm that the old 501 response and placeholder throw were already removed. I kept the remaining throw because it only handles an unsuccessful response after `fetch()` runs. |

| 6 | How can I verify the Online and Offline states of the health check? | I tested the system with the backend running to verify the Online state, then stopped the backend and checked that the UI handled the connection failure as the Offline state. |

### Issue3
| 7 | How should I create and seed the `Category` model without creating duplicate records? | I added the `Category` model based on the Issue 3 requirements and used `upsert` for the seed. I ran the seed more than once and checked the database to confirm that it still contained only four categories. |

| 8 | How should I troubleshoot the Prisma migration and database permission errors? | I used the error messages to identify authentication and database permission problems, checked the PostgreSQL roles, fixed the local database user's permissions, and reran the migration to verify that it completed successfully. |

| 9 | Why did Prisma reject the existing datasource configuration even though the migration had worked before? | I checked the installed Prisma version and found that it did not match the starter project setup. I used the compatible Prisma version, regenerated Prisma Client, and ran the seed again to verify that it worked. |
## Reflection

_To be completed after finishing all Lab 1 issues._