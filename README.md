# TokTickIT IT Service Desk

TokTickIT is an IT service desk web application developed for CPE 334.

For Lab 1, the goal is to build a basic full-stack system where the frontend can check the backend status and load supported IT request categories from a PostgreSQL database.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Bootstrap

### Backend
- Node.js
- Express
- TypeScript

### Database
- PostgreSQL
- Prisma ORM

### Testing
- Vitest
- Supertest
- React Testing Library

## Lab 1 Features

The Lab 1 application provides a simple system check that:

- checks whether the backend API is online
- loads supported IT request categories from PostgreSQL
- displays the categories returned by the API
- shows loading, Online, and Offline states
- handles API errors without exposing internal details

The four supported request categories are:

1. Account and Access
2. Hardware
3. Software
4. Network

---

## Getting Started

### Prerequisites

Make sure these are installed:

- Node.js
- npm
- PostgreSQL

---

## Backend Setup

Go to the server directory:

```bash
cd server
```

Install the dependencies:

```bash
npm install
```

Create a `.env` file based on `.env.example`.

```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/<database>?schema=public"
PORT=3000
```

Make sure PostgreSQL is running and the database in `DATABASE_URL` exists.

> Do not commit the local `.env` file to the repository.

### Prisma

Prisma is used to connect the Express backend to PostgreSQL.

Apply the database migrations:

```bash
npx prisma migrate dev
```

Seed the four supported request categories:

```bash
npm run prisma:seed
```

The seed uses `upsert`, so it can be run multiple times without creating duplicate categories.

Optional: inspect the database using Prisma Studio.

```bash
npx prisma studio
```

### Start the Backend

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:3000
```

---

## API Endpoints

### Health Check

```http
GET /api/health
```

Successful response:

```json
{
  "status": "ok",
  "service": "TokTickIT API"
}
```

### Request Categories

```http
GET /api/categories
```

Returns the supported request categories from PostgreSQL in ID order.

Example response:

```json
[
  {
    "id": 1,
    "name": "Account and Access"
  },
  {
    "id": 2,
    "name": "Hardware"
  },
  {
    "id": 3,
    "name": "Software"
  },
  {
    "id": 4,
    "name": "Network"
  }
]
```

---

## Frontend Setup

Open another terminal and go to the client directory:

```bash
cd client
```

Install the dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

Click **Check System** to check the backend and load the supported request categories.

When the system is available, the application displays:

- Backend status: Online
- Account and Access
- Hardware
- Software
- Network

If the backend or API is unavailable, the application displays an Offline error state.

---

## Testing

### Backend Tests

Backend tests use Vitest and Supertest.

```bash
cd server
npm test
```

The backend tests cover:

- `GET /api/health`
- `GET /api/categories`

### Frontend Tests

Frontend tests use Vitest and React Testing Library.

```bash
cd client
npm test
```

The frontend tests cover:

- TokTickIT heading rendering
- Online state and category list
- Offline error state

---

## Project Structure

```text
TokTickIT-Service-Desk/
├── client/
│   ├── src/
│   └── tests/
│
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   └── tests/
│
├── docs/
│   └── lab-01/
│
├── .gitignore
└── README.md
```

## Lab 1 Workflow

Development for Lab 1 follows an issue-based Git workflow:

```text
Issue
  ↓
Feature Branch
  ↓
Implementation & Testing
  ↓
Pull Request
  ↓
Peer Review & Approval
  ↓
lab1-staging
  ↓
Final Integration
  ↓
main
```