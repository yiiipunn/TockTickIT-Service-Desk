# TokTickIT Service Desk

TokTickIT is an IT service desk web application for CPE 334. Lab 3 adds authenticated, role-based workflows to the Lab 2 ticketing foundation: Requesters manage their own tickets, IT Staff operate the queue, and Administrators manage user accounts.

## Main Features

- Authenticated login and logout with server-enforced session and role authorization
- Mandatory password change for initial-password accounts
- Requester ticket creation, My Tickets, Ticket Detail, and Lab 2 attachment continuity
- IT Staff Ticket Queue and operational Ticket Detail
- Ticket claim, assignment/reassignment, IT Priority, and status workflow
- Public Comments and role-restricted Internal Notes
- Administrator User Management for listing, filtering, creating, editing, activating/deactivating, and resetting user initial passwords
- Attachment upload, download, and soft removal: JPG/JPEG, PNG, WEBP, or PDF; up to 5 MB per file and five active files per ticket

## Roles

| Role | Access |
| --- | --- |
| Requester | Creates and manages only their own tickets, attachments, and Public Comments. |
| IT Staff | Uses the shared Ticket Queue and operational Ticket Detail, including ticket assignment, IT Priority, status changes, Public Comments, and Internal Notes. |
| Administrator | Uses User Management and the IT Staff ticket operations permitted by the Lab 3 authorization matrix. |

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

## Lab 3 Development Accounts

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
| User Management | List, create, edit, activate/deactivate, and reset Users | Administrator |

See the [Lab 3 API specification](docs/lab-03/api-spec.md) for exact endpoints, request bodies, validation, response shapes, and status codes.

## Testing

The server tests require the PostgreSQL database configured in `server/.env` and its migrations. Run each command from the shown directory.

| Suite | Directory | Command |
| --- | --- | --- |
| Server tests | `server/` | `npm test` |
| Client tests | `client/` | `npm test` |
| Browser E2E tests | `client/` | `npx playwright install chromium` (once), then `npm run test:e2e` |
| Server production build | `server/` | `npm run build` |
| Client production build | `client/` | `npm run build` |

The E2E configuration starts its own API on port 3100 and client on port 5174, then runs the Lab 3 Playwright suite.

## Lab 3 Documentation

- [Specification](docs/lab-03/specification.md)
- [Test plan and results](docs/lab-03/tests.md)
- [UI specification](docs/lab-03/ui-spec.md)
- [API specification](docs/lab-03/api-spec.md)
- [Reviewer evidence](docs/lab-03/reviewer.md)
- [AI-use record](docs/lab-03/ai-use.md)

## Repository Structure

```text
TokTickIT-Service-Desk/
|-- client/                 # React app, component tests, and Playwright E2E tests
|-- server/                 # Express API, Prisma schema/migrations/seed, and API tests
|-- docs/lab-03/            # Lab 3 specifications, evidence, and records
|-- artifacts/lab-03/       # Reviewed Lab 3 UI evidence
`-- README.md
```
