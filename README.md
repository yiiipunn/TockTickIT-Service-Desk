# TokTickIT IT Service Desk

TokTickIT is a requester-facing IT service desk web application developed for CPE 334. Lab 2 builds on the Lab 1 system check with a complete ticketing MVP: requester selection, ticket creation, ticket discovery and detail views, attachment management, and responsive UI foundations.

> **Important:** Development Requester selection and the `X-Requester-Id` header exist only to support Lab 2 development and testing. They are not authentication or an authorization model for production use.

## Features

- Backend health and request-category checks
- Temporary Development Requester selection and switching
- Ticket creation with category, related system, priority, summary, description, and optional attachments
- Requester-scoped **My Tickets** search, filtering, sorting, and pagination
- Read-only Ticket Detail with backend-enforced requester ownership
- Attachment upload, download, metadata display, and soft removal
- Loading, empty, no-results, validation, and safe error states
- Responsive desktop, tablet, and mobile layouts using the Zen Green visual foundation

Attachment uploads support JPG/JPEG, PNG, WEBP, and PDF files. Each file may be up to 5 MB, and each ticket may have up to five active attachments. Removed attachments retain their metadata but can no longer be downloaded or previewed.

## Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Bootstrap 5 |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Testing | Vitest, Supertest, React Testing Library, Playwright |

## Getting Started

### Prerequisites

- Node.js (a current LTS release is recommended)
- npm
- PostgreSQL

Clone the repository and open its root directory. The backend and frontend have separate dependencies and must be installed independently.

### 1. Configure and run the backend

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env`, then update the connection string for your local PostgreSQL database:

```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/<database>?schema=public"
PORT=3000
```

The database named in `DATABASE_URL` must already exist. Local `.env` files and attachment storage are ignored by Git and must not be committed.

Apply the Prisma migrations and seed the reference data:

```bash
npm run prisma:migrate
npm run prisma:seed
```

The idempotent seed creates:

- Four request categories: Account and Access, Hardware, Software, and Network
- Six related systems
- Four active Development Requesters and one inactive test requester

Start the API:

```bash
npm run dev
```

The API is available at `http://localhost:3000`. Uploaded files are stored in `server/storage/attachments` by default. Set `ATTACHMENT_STORAGE_DIR` to override that location.

Optional database inspection:

```bash
npx prisma studio
```

### 2. Configure and run the frontend

In a second terminal:

```bash
cd client
npm install
```

Copy `client/.env.example` to `client/.env`. Its default value points to the local API:

```env
VITE_API_URL="http://localhost:3000"
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`, select a Development Requester, and choose **Create Ticket** or **My Tickets**.

## API Overview

Requester-scoped endpoints require the temporary header `X-Requester-Id: <id>`. Ownership is checked by the backend; missing tickets and tickets belonging to another requester both return `404` without exposing ticket data.

| Method | Endpoint | Purpose | Requester header |
|---|---|---|---|
| `GET` | `/api/health` | Check API availability | No |
| `GET` | `/api/categories` | List request categories | No |
| `GET` | `/api/requesters` | List active Development Requesters | No |
| `GET` | `/api/related-systems` | List related systems | No |
| `POST` | `/api/tickets` | Create a ticket | Yes |
| `GET` | `/api/tickets` | Search, filter, sort, and paginate owned tickets | Yes |
| `GET` | `/api/tickets/:id` | Get an owned ticket and its attachments | Yes |
| `POST` | `/api/tickets/:id/attachments` | Upload an attachment using multipart field `file` | Yes |
| `GET` | `/api/attachments/:id` | Get attachment metadata | Yes |
| `GET` | `/api/attachments/:id/download` | Download an active attachment | Yes |
| `DELETE` | `/api/attachments/:id` | Soft-remove an attachment with a removal reason | Yes |

`GET /api/tickets` supports `search`, `categoryId`, `relatedSystemId`, `priority`, `status`, `sort`, `order`, `page`, and `pageSize`. See the [Lab 2 API specification](docs/lab-02/api-spec.md) for complete request, response, validation, and error contracts.

Attachment removal expects a JSON body such as `{ "reason": "Uploaded the wrong file" }`; the trimmed reason must contain 1 to 250 characters.

## Testing

The backend tests require the PostgreSQL database configured in `server/.env`. Apply migrations before running them.

### Backend API and integration tests

```bash
cd server
npm test
```

The backend suite covers health and reference data, requester validation, ticket creation, ownership boundaries, My Tickets queries, Ticket Detail, the Lab 2 data model, and attachment rules.

### Frontend component tests

```bash
cd client
npm test
```

The frontend suite covers the Lab 1 system state plus Development Requester selection, Create Ticket, My Tickets, Ticket Detail, and attachment interactions.

### Browser end-to-end tests

Install Chromium once, then run the Playwright suite:

```bash
cd client
npx playwright install chromium
npm run test:e2e
```

Playwright starts the API and frontend, seeds the database, and verifies the requester workflow, attachment lifecycle, ownership isolation, visual tokens, and responsive layouts. Transient captures are written to the ignored `artifacts/lab-02/runtime-screenshots/` directory; reviewed evidence is committed under `artifacts/lab-02/screenshots/`.

### Production builds

```bash
cd server
npm run build

cd ../client
npm run build
```

The completed Lab 2 verification record reports 120 passing automated tests across 16 files, with no failures or skipped tests. See the [Lab 2 test plan and results](docs/lab-02/tests.md) for traceability and evidence.

## Project Structure

```text
TokTickIT-Service-Desk/
|-- client/
|   |-- e2e/                 # Playwright end-to-end tests
|   |-- src/                 # React application
|   `-- tests/               # Component tests
|-- server/
|   |-- prisma/              # Schema, migrations, and seed data
|   |-- src/                 # Express API
|   `-- tests/               # API and integration tests
|-- docs/
|   |-- lab-01/              # Lab 1 documentation
|   `-- lab-02/              # Lab 2 specifications and records
|-- artifacts/
|   `-- lab-02/screenshots/  # Reviewed UI evidence
|-- .gitignore
`-- README.md
```

## Lab 2 Documentation

- [Product specification](docs/lab-02/specification.md)
- [API specification](docs/lab-02/api-spec.md)
- [UI specification](docs/lab-02/ui-spec.md)
- [Test plan and results](docs/lab-02/tests.md)
- [Peer-review record](docs/lab-02/reviewer.md)
- [AI-use record](docs/lab-02/ai-use.md)

## Development Workflow

Lab work follows an issue-based Git workflow:

```text
Issue
  -> Feature branch
  -> Implementation and testing
  -> Pull request
  -> Peer review and approval
  -> Lab staging branch
  -> Final integration
  -> main
```
