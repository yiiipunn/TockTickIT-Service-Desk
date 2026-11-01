# TokTickIT Service Desk

TokTickIT is an IT service desk web application for CPE 334. Lab 4 completes the authenticated Lab 3 ticket workflow with role-specific dashboards and auditable Actions Taken, while preserving Requester ownership, IT Staff operations, and Administrator user management.

## Main Features

- Authenticated login and logout with server-enforced session and role authorization
- Mandatory password change for initial-password accounts
- Requester ticket creation, My Tickets, Ticket Detail, and Lab 2 attachment continuity
- IT Staff Ticket Queue and operational Ticket Detail
- Ticket claim, assignment/reassignment, IT Priority, and status workflow
- Requester and IT Staff operational dashboards with deterministic drill-downs
- Planned and Completed Actions Taken, including assignment, optimistic concurrency, and append-only Action history
- Public Comments and role-restricted Internal Notes
- Administrator User Management for listing, filtering, creating, editing, activating/deactivating, and resetting user initial passwords
- Attachment upload, download, and soft removal: JPG/JPEG, PNG, WEBP, or PDF; up to 5 MB per file and five active files per ticket

## Roles

| Role | Access |
| --- | --- |
| Requester | Uses a private dashboard and creates and manages only their own tickets, attachments, Public Comments, and read-only Action information. |
| IT Staff | Uses the operational dashboard, shared Ticket Queue, Ticket workflow, Internal Notes, and assigned Actions. |
| Administrator | Uses User Management and the IT Staff operations permitted by the authorization matrix. |

Authentication supplies the user identity. The server enforces roles, ownership, active-account status, session state, and password-change restrictions for every protected operation.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Bootstrap 5 |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Authentication | Opaque HTTP-only sessions with Argon2 password hashing |
| Testing | Vitest, Supertest, React Testing Library, Playwright |

## Prerequisites

- Git
- Node.js and npm
- PostgreSQL

Create a local PostgreSQL database before applying migrations. The backend and frontend have separate dependencies.

## Installation

From a fresh clone, install dependencies and create local environment files:

```powershell
git clone https://github.com/yiiipunn/TockTickIT-Service-Desk.git
cd TockTickIT-Service-Desk

cd server
npm install
Copy-Item .env.example .env

cd ..\client
npm install
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` in each directory instead of `Copy-Item`.

## Environment Setup

Use the copied template files and set values for your local environment. Do not commit either `.env` file.

`server/.env` requires:

```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/<database>?schema=public"
PORT=3000
```

The PostgreSQL database named in `DATABASE_URL` must already exist. `client/.env` requires the API base URL:

```env
VITE_API_URL="http://localhost:3000"
```

## Database Setup

Run these commands from `server/` after configuring `server/.env`:

```powershell
npm run prisma:migrate
npm run prisma:seed
```

`prisma:migrate` runs Prisma's development migration workflow. The seed is idempotent for its reference data, users, tickets, comments, and notes; it creates development data when it is missing.

## Running the Application

Start the API from `server/`:

```powershell
npm run dev
```

The API listens at <http://localhost:3000>.

In a second terminal, start the client from `client/`:

```powershell
npm run dev
```

Open <http://localhost:5173> in a browser.

## Development Accounts

The following are fictional, local development accounts created by the seed. Each uses the initial password `TokTickIT-Lab3!` on a freshly seeded database and must change that password on first login.

| Role | Example email | Initial password | Status |
| --- | --- | --- | --- |
| Requester | `narin@example.com` | `TokTickIT-Lab3!` | Active |
| Requester | `inactive@example.com` | `TokTickIT-Lab3!` | Inactive |
| IT Staff | `ari.staff@example.com` | `TokTickIT-Lab3!` | Active |
| IT Staff | `somchai.retired@example.com` | `TokTickIT-Lab3!` | Inactive |
| Administrator | `anong.admin@example.com` | `TokTickIT-Lab3!` | Active |

See [Lab 3 development credentials](docs/lab-03/development-credentials.md) for the complete local account list. Passwords changed during local use are account-specific and are not recorded in the repository.

## API Overview

The API base path is `http://localhost:3000/api`. Protected requests use the authenticated session cookie; unsafe requests also use the session-bound CSRF token returned by `GET /api/auth/me`. The server derives the current user from the session and enforces role and ownership rules.

| API group | Purpose | Permitted roles |
| --- | --- | --- |
| Authentication | Login, current user, password change, and logout | Public / authenticated user, as applicable |
| Reference data | Categories and related systems | Authenticated users |
| Requester tickets | Create, list, and view owned tickets; attachment operations | Requester, with ticket ownership |
| Ticket Queue | Search, filter, sort, and page operational tickets | IT Staff, Administrator |
| Ticket operations | Claim, assign/reassign, set IT Priority, and change status | IT Staff, Administrator |
| Comments and notes | Public Comments; role-restricted Internal Notes | Per authorization matrix |
| Dashboards | Role-specific metrics and deterministic operational lists | Requester dashboard or Staff/Admin dashboard |
| Actions Taken | List, view, create, edit, assign, complete, and audit Actions | Per Lab 4 authorization matrix |
| User Management | List, create, edit, activate/deactivate, and reset Users | Administrator |

See the [Lab 4 API specification](docs/lab-04/api-spec.md) for the current endpoints, request bodies, validation, response shapes, and status codes. The Lab 3 API specification remains the source for preserved authentication, Ticket workflow, comments, notes, and User Management contracts.

## Testing

The server tests require the PostgreSQL database configured in `server/.env` and its migrations. Run each command from the shown directory.

| Suite | Directory | Command |
| --- | --- | --- |
| Server tests | `server/` | `npm test` |
| Client tests | `client/` | `npm test` |
| Browser E2E tests | `client/` | `npx playwright install chromium` (once), then `npm run test:e2e` |
| Lab 4 isolated E2E and Lab 3 continuity | `server/` | `npm run test:e2e:lab4` |
| Server production build | `server/` | `npm run build` |
| Client production build | `client/` | `npm run build` |

The default E2E configuration starts an API on port 3100 and a client on port 5174, then runs the Lab 3 Playwright continuity suite. It seeds the database configured in `server/.env`; point it only at a disposable local test database or isolated schema, never a shared database. Issue #30 adds `playwright.issue30.config.ts` for responsive and accessibility regression checks against an already-running isolated test environment.

For the Lab 4 release check, install Chromium once from `client/` with `npx playwright install chromium`, then run `npm run test:e2e:lab4` from `server/`. The runner requires `server/.env` to point to local PostgreSQL with `schema=public`; it creates a random isolated schema, deploys migrations, seeds twice and checks row-count idempotence, starts the API and client on ports 3100 and 5174, runs the Lab 4 scenarios and four Lab 3 continuity scenarios, and drops the schema afterward. Both ports must be free. Screenshots are saved under `artifacts/lab-04/screenshots/issue-31/`; passing JSON reports are copied to `artifacts/lab-04/test-results/issue-31/`. If the runner is interrupted before cleanup, `node scripts/cleanup-issue31-e2e.mjs <generated-schema-name>` removes only the named local Issue #31 schema.

## Lab 4 Documentation

- [Specification](docs/lab-04/specification.md)
- [Test plan](docs/lab-04/tests.md)
- [UI specification](docs/lab-04/ui-spec.md)
- [API specification](docs/lab-04/api-spec.md)

Lab 1–3 documentation remains under the corresponding `docs/lab-0X/` directories for continuity and regression reference.

## Repository Structure

```text
TokTickIT-Service-Desk/
|-- client/                 # React app, component tests, and Playwright E2E tests
|-- server/                 # Express API, Prisma schema/migrations/seed, and API tests
|-- docs/lab-01..04/        # Versioned specifications, tests, and records
|-- artifacts/lab-01..04/   # Reviewed UI and verification evidence
`-- README.md
```
