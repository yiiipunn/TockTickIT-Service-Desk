import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { getRequesterDashboardSnapshot } from "../../src/requester-dashboard.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const envText = readFileSync(resolve(".env"), "utf8");
const databaseLine = envText
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith("DATABASE_URL="));
if (!databaseLine) throw new Error("DATABASE_URL is required for Lab 4 Requester Dashboard API tests");
const rawDatabaseUrl = databaseLine.slice(databaseLine.indexOf("=") + 1).trim()
  .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
const fixtureSchema = `lab4_requester_dashboard_${randomUUID().replace(/-/g, "")}`;
if (!/^lab4_requester_dashboard_[a-f0-9]{32}$/.test(fixtureSchema)) {
  throw new Error("Unsafe fixture schema name");
}
const fixtureUrl = new URL(rawDatabaseUrl);
fixtureUrl.searchParams.set("schema", fixtureSchema);
process.env.DATABASE_URL = fixtureUrl.toString();

const adminPrisma = new PrismaClient({ datasources: { db: { url: rawDatabaseUrl } } });
const prisma = getPrisma();
const suffix = randomUUID();
const password = "TokTickIT-Lab4!";
const migrations = [
  "../../prisma/migrations/20260812155934_init/migration.sql",
  "../../prisma/migrations/20260829063133_lab2_requester_ticketing/migration.sql",
  "../../prisma/migrations/20260902143000_attachment_updated_at/migration.sql",
  "../../prisma/migrations/20260915171500_lab3_user_migration/migration.sql",
  "../../prisma/migrations/20260915203000_authentication_sessions/migration.sql",
  "../../prisma/migrations/20261023120000_lab4_actions_data_model/migration.sql",
].map((path) => new URL(path, import.meta.url));

type Client = Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let requester: Client;
let staff: Client;
let admin: Client;
let requesterId = 0;
let otherRequesterId = 0;
let categoryId = 0;
let relatedSystemId = 0;
let ticketIds: Record<string, number> = {};

function splitMigrationStatements(sql: string) {
  const statements: string[] = [];
  let statement = "";
  let inDollarBlock = false;
  for (let index = 0; index < sql.length; index += 1) {
    if (sql.slice(index, index + 2) === "$$") {
      inDollarBlock = !inDollarBlock;
      statement += "$$";
      index += 1;
    } else if (sql[index] === ";" && !inDollarBlock) {
      if (statement.trim()) statements.push(statement);
      statement = "";
    } else {
      statement += sql[index];
    }
  }
  if (statement.trim()) statements.push(statement);
  return statements;
}

async function migrateFixtureSchema() {
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${fixtureSchema}"`);
  const fixtureAdmin = new PrismaClient({ datasources: { db: { url: fixtureUrl.toString() } } });
  try {
    for (const migration of migrations) {
      const sql = await readFile(migration, "utf8");
      for (const statement of splitMigrationStatements(sql)) {
        await fixtureAdmin.$executeRawUnsafe(statement);
      }
    }
  } finally {
    await fixtureAdmin.$disconnect();
  }
}

function ago(now: Date, days: number, minutes = 0) {
  return new Date(now.getTime() - ((days * 24 * 60 + minutes) * 60 * 1000));
}

async function createTicket(options: {
  key: string;
  requesterId?: number;
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  updatedAt: Date;
  resolvedAt?: Date | null;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-REQ-DASH-${options.key}-${suffix}`,
      requesterId: options.requesterId ?? requesterId,
      categoryId,
      relatedSystemId,
      summary: `${options.key} requester dashboard Ticket`,
      description: `Requester dashboard fixture for ${options.key}`,
      requestedPriority: options.key.includes("waiting") ? "HIGH" : "MEDIUM",
      itPriority: "MEDIUM",
      status: options.status,
      resolvedAt: options.resolvedAt ?? null,
      createdAt: ago(options.updatedAt, 2),
      updatedAt: options.updatedAt,
    },
  });
  ticketIds[options.key] = ticket.id;
  return ticket;
}

async function resetDashboardFixtures() {
  await prisma.ticketWorkflowEvent.deleteMany();
  await prisma.ticket.deleteMany();
  ticketIds = {};
  const now = new Date();
  const waitingTie = ago(now, 1);
  await createTicket({ key: "new", status: "NEW", updatedAt: ago(now, 0, 1) });
  await createTicket({ key: "waiting-a", status: "WAITING_FOR_REQUESTER", updatedAt: waitingTie });
  await createTicket({ key: "waiting-b", status: "WAITING_FOR_REQUESTER", updatedAt: waitingTie });
  await createTicket({ key: "resolved", status: "RESOLVED", updatedAt: ago(now, 2), resolvedAt: ago(now, 2) });
  await createTicket({ key: "closed", status: "CLOSED", updatedAt: ago(now, 3), resolvedAt: ago(now, 3) });
  await createTicket({ key: "cancelled-old", status: "CANCELLED", updatedAt: ago(now, 31) });
  await createTicket({ key: "other-waiting", requesterId: otherRequesterId, status: "WAITING_FOR_REQUESTER", updatedAt: ago(now, 0, 2) });
  await createTicket({ key: "other-open", requesterId: otherRequesterId, status: "OPEN", updatedAt: ago(now, 0, 3) });
}

describe("Lab 4 Requester Dashboard API", () => {
  beforeAll(async () => {
    await adminPrisma.$connect();
    await migrateFixtureSchema();
    await prisma.$connect();
    const schemaRows = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
    if (schemaRows[0]?.schema !== fixtureSchema) {
      throw new Error("Requester Dashboard tests are not connected to the isolated fixture schema");
    }

    const passwordHash = await hashPassword(password);
    const [category, system] = await Promise.all([
      prisma.category.create({ data: { name: `Requester Dashboard Category ${suffix}` } }),
      prisma.relatedSystem.create({ data: { name: `Requester Dashboard System ${suffix}` } }),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    const users = await Promise.all([
      prisma.user.create({ data: { name: "Dashboard Requester", email: `req-dashboard-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Requester", email: `req-dashboard-other-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Dashboard Staff", email: `req-dashboard-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Dashboard Admin", email: `req-dashboard-admin-${suffix}@example.com`, passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
    ]);
    [requesterId, otherRequesterId] = users.map((user) => user.id);
    [requester, staff, admin] = await Promise.all([
      createAuthenticatedTestClient({ userId: users[0].id }),
      createAuthenticatedTestClient({ userId: users[2].id }),
      createAuthenticatedTestClient({ userId: users[3].id }),
    ]);
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDashboardFixtures();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await adminPrisma.$disconnect();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("[REQ-DASH-01 / AC-02, AC-18, AC-25] returns only the current Requester's exact metrics and deterministic lists", async () => {
    const response = await requester.get("/api/dashboards/requester");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data.timezone).toBe("UTC");
    expect(Number.isNaN(Date.parse(response.body.data.asOf))).toBe(false);
    expect(response.body.data.metrics).toEqual({ openCount: 3, waitingForRequesterCount: 2 });
    expect(response.body.data.attentionRequired.map((ticket: { id: number }) => ticket.id))
      .toEqual([ticketIds["waiting-b"], ticketIds["waiting-a"]]);
    expect(response.body.data.recentlyUpdated.map((ticket: { id: number }) => ticket.id))
      .toEqual([ticketIds.new, ticketIds["waiting-b"], ticketIds["waiting-a"], ticketIds.resolved, ticketIds.closed]);
    expect(response.body.data.recentlyResolved.map((ticket: { id: number }) => ticket.id))
      .toEqual([ticketIds.resolved, ticketIds.closed]);
    expect(JSON.stringify(response.body.data)).not.toContain("other requester dashboard");
    expect(response.body.data.links).toEqual({
      open: "/api/tickets?scope=open&page=1&pageSize=10",
      waitingForRequester: "/api/tickets?status=WAITING_FOR_REQUESTER&page=1&pageSize=10",
    });
  });

  it("[REQ-DASH-01 / AC-18] includes exact inclusive 30-day boundaries", async () => {
    const asOf = new Date("2026-10-29T12:00:00.000Z");
    const boundary = ago(asOf, 30);
    await prisma.ticket.update({
      where: { id: ticketIds["cancelled-old"] },
      data: { updatedAt: boundary, resolvedAt: boundary },
    });
    const snapshot = await getRequesterDashboardSnapshot(prisma, requesterId, asOf);
    expect(snapshot.recentlyUpdated.map((ticket) => ticket.id)).toContain(ticketIds["cancelled-old"]);
    expect(snapshot.recentlyResolved.map((ticket) => ticket.id)).toContain(ticketIds["cancelled-old"]);
  });

  it("[REQ-DASH-01 / AC-18] caps all operational lists at 10 and preserves contract ordering", async () => {
    const now = new Date();
    for (let index = 0; index < 12; index += 1) {
      await createTicket({
        key: `limit-waiting-${index}`,
        status: "WAITING_FOR_REQUESTER",
        updatedAt: new Date(now.getTime() - index * 60_000),
        resolvedAt: new Date(now.getTime() - index * 60_000),
      });
    }
    const response = await requester.get("/api/dashboards/requester");
    expect(response.status).toBe(200);
    expect(response.body.data.attentionRequired).toHaveLength(10);
    expect(response.body.data.recentlyUpdated).toHaveLength(10);
    expect(response.body.data.recentlyResolved).toHaveLength(10);
    const updatedTimes = response.body.data.recentlyUpdated.map((ticket: { updatedAt: string }) => Date.parse(ticket.updatedAt));
    expect(updatedTimes).toEqual([...updatedTimes].sort((left, right) => right - left));
    const resolvedTimes = response.body.data.recentlyResolved.map((ticket: { resolvedAt: string }) => Date.parse(ticket.resolvedAt));
    expect(resolvedTimes).toEqual([...resolvedTimes].sort((left, right) => right - left));
  });

  it("[REQ-DASH-02 / AC-15, AC-18] denies Staff and Admin and rejects dashboard query parameters", async () => {
    for (const client of [staff, admin]) {
      const denied = await client.get("/api/dashboards/requester");
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe("FORBIDDEN");
      expect(denied.body).not.toHaveProperty("data");
    }
    const invalid = await requester.get("/api/dashboards/requester?requesterId=1");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUERY");
  });

  it("[REQ-DASH-03 / AC-02, AC-18] keeps metric and My Tickets drill-down filters equivalent", async () => {
    const [open, waiting] = await Promise.all([
      requester.get("/api/tickets?scope=open&page=1&pageSize=10"),
      requester.get("/api/tickets?status=WAITING_FOR_REQUESTER&page=1&pageSize=10"),
    ]);
    expect(open.status).toBe(200);
    expect(open.body.pagination.totalItems).toBe(3);
    expect(open.body.items.every((ticket: { requesterId: number }) => ticket.requesterId === requesterId)).toBe(true);
    expect(waiting.status).toBe(200);
    expect(waiting.body.pagination.totalItems).toBe(2);
    expect(waiting.body.items.every((ticket: { status: string }) => ticket.status === "WAITING_FOR_REQUESTER")).toBe(true);

    const invalid = await requester.get("/api/tickets?scope=open&status=RESOLVED");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUERY");
  });

  it("[REQ-DASH-01 / AC-18] returns complete empty and safe whole-response failure shapes", async () => {
    await prisma.ticket.deleteMany();
    const empty = await requester.get("/api/dashboards/requester");
    expect(empty.status).toBe(200);
    expect(empty.body.data).toMatchObject({
      metrics: { openCount: 0, waitingForRequesterCount: 0 },
      attentionRequired: [],
      recentlyUpdated: [],
      recentlyResolved: [],
    });

    vi.spyOn(prisma.ticket, "count").mockRejectedValueOnce(new Error("forced requester dashboard failure"));
    const failed = await requester.get("/api/dashboards/requester");
    expect(failed.status).toBe(500);
    expect(failed.headers["cache-control"]).toBe("no-store");
    expect(failed.body).toEqual({ error: {
      code: "INTERNAL_ERROR",
      message: "Unable to load your Dashboard right now.",
    } });
    expect(failed.body).not.toHaveProperty("data");
    expect(JSON.stringify(failed.body)).not.toContain("forced requester dashboard failure");
  });
});
