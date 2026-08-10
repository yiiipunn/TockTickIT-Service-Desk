# TokTickIT IT Service Desk

TokTickIT is an IT service desk web application developed for CPE 334.

For Lab 1, the goal is to set up the basic full-stack project structure and development environment.

## Tech Stack

- React + TypeScript + Vite
- Bootstrap
- Node.js + Express + TypeScript
- PostgreSQL
- Prisma
- Vitest
- Supertest

## Lab 1

In this lab, the application will have a simple system check that:

- checks if the backend is online
- loads the supported request categories from the database
- shows loading and error states when needed

## Getting Started

### Prerequisites

Make sure these are installed:

- Node.js
- npm
- PostgreSQL

### Frontend

Go to the client directory and install the dependencies:

```bash
cd client
npm install
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will run on:

```text
http://localhost:5173
```

### Backend

Go to the server directory and install the dependencies:

```bash
cd server
npm install
```

Create a `.env` file based on `.env.example` and update the database connection if needed.

```env
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/<database>?schema=public"
PORT=3000
```

Start the backend development server:

```bash
npm run dev
```

The backend will run on:

```text
http://localhost:3000
```

### Database

Make sure PostgreSQL is running and the database configuration in `server/.env` is correct.

Prisma is used by the backend to connect to PostgreSQL.

The local `.env` file should not be committed to the repository.

### Tests

Backend tests use Vitest and Supertest.

To run the tests:

```bash
cd server
npm test
```

Some tests may not pass until their corresponding Lab 1 issues are implemented.

## Project Structure

```text
TokTickIT-Service-Desk/
├── client/
├── server/
├── docs/
├── .gitignore
└── README.md
```