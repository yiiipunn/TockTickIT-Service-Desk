import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { getStaffDashboardSnapshot } from "../../src/staff-dashboard.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const envText = readFileSync(resolve(".env"), "utf8");
const databaseLine = envText
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith("DATABASE_URL="));
if (!databaseLine) throw new Error("DATABASE_URL is required for Lab 4 Staff Dashboard API tests");
const rawDatabaseUrl = databaseLine.slice(databaseLine.indexOf("=") + 1).trim()
  .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
const fixtureSchema = `lab4_staff_dashboard_${randomUUID().replace(/-/g, "")}`;
if (!/^lab4_staff_dashboard_[a-f0-9]{32}$/.test(fixtureSchema)) {
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
let staff: Client;
let admin: Client;
let requester: Client;
let staffId = 0;
let otherStaffId = 0;
let adminId = 0;
let requesterId = 0;
let categoryId = 0;
let relatedSystemId = 0;
let ticketIds: Record<string, number> = {};
let actionIds: Record<string, number> = {};

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

function ago(now: Date, days: number, hours = 0) {
  return new Date(now.getTime() - ((days * 24 + hours) * 60 * 60 * 1000));
}

async function createTicket(options: {
  key: string;
  status: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  ownerId?: number | null;
  updatedAt: Date;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-DASH-${options.key}-${suffix}`,
      requesterId,
      ownerId: options.ownerId ?? null,
      categoryId,
      relatedSystemId,
      summary: `${options.key} dashboard Ticket`,
      description: `Dashboard fixture for ${options.key}`,
      requestedPriority: "MEDIUM",
      itPriority: options.priority,
      status: options.status,
      resolvedAt: options.status === "RESOLVED" || options.status === "CLOSED"
        ? options.updatedAt
        : null,
      createdAt: ago(options.updatedAt, 10),
      updatedAt: options.updatedAt,
    },
  });
  ticketIds[options.key] = ticket.id;
  return ticket;
}

async function createAction(options: {
  key: string;
  ticketId: number;
  assigneeId: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  actionAt: Date;
  performedById?: number;
  completedAt?: Date;
}) {
  const action = await prisma.actionTaken.create({
    data: {
      ticketId: options.ticketId,
      actionAt: options.actionAt,
      description: `${options.key} dashboard Action`,
      result: options.status === "COMPLETED" ? "Dashboard work completed." : null,
      status: options.status,
      assigneeId: options.assigneeId,
      createdById: otherStaffId,
      performedById: options.performedById ?? null,
      completedAt: options.completedAt ?? null,
      followUpRequired: false,
      version: options.status === "COMPLETED" ? 2 : 1,
    },
  });
  actionIds[options.key] = action.id;
  return action;
}

async function resetDashboardFixtures() {
  await prisma.actionTakenEvent.deleteMany();
  await prisma.actionTaken.deleteMany();
  await prisma.ticketWorkflowEvent.deleteMany();
  await prisma.ticket.deleteMany();
  ticketIds = {};
  actionIds = {};

  const now = new Date();
  const urgentTie = ago(now, 2);
  await createTicket({ key: "new", status: "NEW", priority: "HIGH", updatedAt: urgentTie });
  await createTicket({ key: "open", status: "OPEN", priority: "MEDIUM", ownerId: staffId, updatedAt: ago(now, 1) });
  await createTicket({ key: "progress", status: "IN_PROGRESS", priority: "HIGH", ownerId: otherStaffId, updatedAt: urgentTie });
  await createTicket({ key: "waiting", status: "WAITING_FOR_REQUESTER", priority: "LOW", ownerId: adminId, updatedAt: ago(now, 3) });
  await createTicket({ key: "resolved", status: "RESOLVED", priority: "HIGH", ownerId: otherStaffId, updatedAt: ago(now, 1) });
  await createTicket({ key: "closed", status: "CLOSED", priority: "MEDIUM", ownerId: otherStaffId, updatedAt: ago(now, 1) });
  await createTicket({ key: "reopened", status: "REOPENED", priority: "LOW", updatedAt: ago(now, 8) });
  await createTicket({ key: "cancelled", status: "CANCELLED", priority: "LOW", updatedAt: ago(now, 1) });

  await createAction({ key: "staff-in-progress", ticketId: ticketIds.progress, assigneeId: staffId, status: "IN_PROGRESS", actionAt: ago(now, 0, 1) });
  await createAction({ key: "staff-planned", ticketId: ticketIds.open, assigneeId: staffId, status: "PLANNED", actionAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
  await createAction({ key: "other-planned", ticketId: ticketIds.open, assigneeId: otherStaffId, status: "PLANNED", actionAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) });
  await createAction({ key: "staff-completed", ticketId: ticketIds.open, assigneeId: staffId, status: "COMPLETED", actionAt: ago(now, 2), performedById: staffId, completedAt: ago(now, 1) });
  await createAction({ key: "staff-completed-old", ticketId: ticketIds.open, assigneeId: staffId, status: "COMPLETED", actionAt: ago(now, 35), performedById: staffId, completedAt: ago(now, 31) });
  await createAction({ key: "admin-planned", ticketId: ticketIds.waiting, assigneeId: adminId, status: "PLANNED", actionAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) });
  await createAction({ key: "admin-completed", ticketId: ticketIds.waiting, assigneeId: adminId, status: "COMPLETED", actionAt: ago(now, 3), performedById: adminId, completedAt: ago(now, 2) });
}

describe("Lab 4 Staff Dashboard API", () => {
  beforeAll(async () => {
    await adminPrisma.$connect();
    await migrateFixtureSchema();
    await prisma.$connect();
    const schemaRows = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
    if (schemaRows[0]?.schema !== fixtureSchema) {
      throw new Error("Staff Dashboard tests are not connected to the isolated fixture schema");
    }

    const passwordHash = await hashPassword(password);
    const [category, system] = await Promise.all([
      prisma.category.create({ data: { name: `Dashboard Category ${suffix}` } }),
      prisma.relatedSystem.create({ data: { name: `Dashboard System ${suffix}` } }),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    const users = await Promise.all([
      prisma.user.create({ data: { name: "Dashboard Staff", email: `dashboard-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Dashboard Staff", email: `dashboard-other-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Dashboard Admin", email: `dashboard-admin-${suffix}@example.com`, passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Dashboard Requester", email: `dashboard-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
    ]);
    [staffId, otherStaffId, adminId, requesterId] = users.map((user) => user.id);

    [staff, admin, requester] = await Promise.all([
      createAuthenticatedTestClient({ userId: staffId }),
      createAuthenticatedTestClient({ userId: adminId }),
      createAuthenticatedTestClient({ userId: requesterId }),
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

  it("[STAFF-DASH-01 / AC-16] returns exact Ticket metrics, bounded lists, and deterministic ordering", async () => {
    const response = await staff.get("/api/dashboards/staff");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data.timezone).toBe("UTC");
    expect(Number.isNaN(Date.parse(response.body.data.asOf))).toBe(false);
    expect(response.body.data.metrics).toEqual({
      unassignedOpenCount: 2,
      myOpenTicketCount: 1,
      myActiveActionsCount: 2,
      countsByStatus: {
        NEW: 1,
        OPEN: 1,
        IN_PROGRESS: 1,
        WAITING_FOR_REQUESTER: 1,
        RESOLVED: 1,
        CLOSED: 1,
        REOPENED: 1,
        CANCELLED: 1,
      },
      countsByItPriority: { LOW: 2, MEDIUM: 1, HIGH: 2 },
    });
    expect(response.body.data.urgentTickets.map((ticket: { id: number }) => ticket.id))
      .toEqual([ticketIds.progress, ticketIds.new]);
    expect(response.body.data.recentlyUpdated.map((ticket: { id: number }) => ticket.id))
      .toEqual([ticketIds.open, ticketIds.progress, ticketIds.new, ticketIds.waiting]);
    expect(response.body.data.myActiveActions.map((action: { id: number }) => action.id))
      .toEqual([actionIds["staff-in-progress"], actionIds["staff-planned"]]);
    expect(response.body.data.myRecentCompletedActions.map((action: { id: number }) => action.id))
      .toEqual([actionIds["staff-completed"]]);
    expect(response.body.data.urgentTickets).toHaveLength(2);
    expect(response.body.data.myActiveActions).toHaveLength(2);
    expect(response.body.data.links).toEqual({
      unassigned: "/api/staff/tickets?owner=unassigned&scope=open&page=1&pageSize=20",
      mine: "/api/staff/tickets?owner=me&scope=open&page=1&pageSize=20",
      urgent: "/api/staff/tickets?itPriority=HIGH&scope=open&page=1&pageSize=20",
    });
  });

  it("[STAFF-DASH-01 / AC-16] includes exact 7-day and 30-day lower boundaries", async () => {
    const asOf = new Date("2026-10-29T12:00:00.000Z");
    await prisma.ticket.update({
      where: { id: ticketIds.reopened },
      data: { updatedAt: ago(asOf, 7) },
    });
    await prisma.actionTaken.update({
      where: { id: actionIds["staff-completed-old"] },
      data: { completedAt: ago(asOf, 30) },
    });
    const snapshot = await getStaffDashboardSnapshot(prisma, staffId, asOf);
    expect(snapshot.recentlyUpdated.map((ticket) => ticket.id)).toContain(ticketIds.reopened);
    expect(snapshot.myRecentCompletedActions.map((action) => action.id))
      .toContain(actionIds["staff-completed-old"]);
  });

  it("[STAFF-DASH-01 / AC-16, AC-18] caps every operational list at 10 while preserving contract order", async () => {
    const now = new Date();
    for (let index = 0; index < 12; index += 1) {
      const ticket = await createTicket({
        key: `limit-${index}`,
        status: "OPEN",
        priority: "HIGH",
        ownerId: otherStaffId,
        updatedAt: new Date(now.getTime() - index * 60_000),
      });
      await createAction({
        key: `limit-${index}`,
        ticketId: ticket.id,
        assigneeId: staffId,
        status: "PLANNED",
        actionAt: new Date(now.getTime() + index * 60_000),
      });
    }

    const response = await staff.get("/api/dashboards/staff");
    expect(response.status).toBe(200);
    expect(response.body.data.urgentTickets).toHaveLength(10);
    expect(response.body.data.recentlyUpdated).toHaveLength(10);
    expect(response.body.data.myActiveActions).toHaveLength(10);
    const urgentTimes = response.body.data.urgentTickets.map((ticket: { updatedAt: string }) => Date.parse(ticket.updatedAt));
    expect(urgentTimes).toEqual([...urgentTimes].sort((left, right) => right - left));
    const actionTimes = response.body.data.myActiveActions.map((action: { actionAt: string }) => Date.parse(action.actionAt));
    expect(actionTimes).toEqual([...actionTimes].sort((left, right) => left - right));
  });

  it("[STAFF-DASH-02 / AC-17] reuses global data for Admin while scoping every my metric to Admin", async () => {
    const [staffResponse, adminResponse] = await Promise.all([
      staff.get("/api/dashboards/staff"),
      admin.get("/api/dashboards/staff"),
    ]);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.metrics.countsByStatus)
      .toEqual(staffResponse.body.data.metrics.countsByStatus);
    expect(adminResponse.body.data.metrics.countsByItPriority)
      .toEqual(staffResponse.body.data.metrics.countsByItPriority);
    expect(adminResponse.body.data.urgentTickets).toEqual(staffResponse.body.data.urgentTickets);
    expect(adminResponse.body.data.metrics).toMatchObject({
      unassignedOpenCount: 2,
      myOpenTicketCount: 1,
      myActiveActionsCount: 1,
    });
    expect(adminResponse.body.data.myActiveActions.map((action: { id: number }) => action.id))
      .toEqual([actionIds["admin-planned"]]);
    expect(adminResponse.body.data.myRecentCompletedActions.map((action: { id: number }) => action.id))
      .toEqual([actionIds["admin-completed"]]);
    expect(adminResponse.body.data.metrics).not.toHaveProperty("userCount");
  });

  it("[STAFF-DASH-03 / AC-16, AC-17] keeps count and queue drill-down filters equivalent", async () => {
    const unassigned = await staff.get("/api/staff/tickets?owner=unassigned&scope=open&page=1&pageSize=20");
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.items.map((ticket: { id: number }) => ticket.id).sort((a: number, b: number) => a - b))
      .toEqual([ticketIds.new, ticketIds.reopened].sort((a, b) => a - b));

    const high = await staff.get("/api/staff/tickets?itPriority=HIGH&scope=open&page=1&pageSize=20");
    expect(high.status).toBe(200);
    expect(high.body.items.map((ticket: { id: number }) => ticket.id).sort((a: number, b: number) => a - b))
      .toEqual([ticketIds.new, ticketIds.progress].sort((a, b) => a - b));

    const invalid = await staff.get("/api/staff/tickets?scope=open&status=RESOLVED");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUERY");
  });

  it("[STAFF-DASH-04 / AC-18, AC-25] denies Requesters and rejects dashboard query parameters", async () => {
    const denied = await requester.get("/api/dashboards/staff");
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ error: {
      code: "FORBIDDEN",
      message: "You do not have permission to perform this operation.",
    } });
    expect(denied.body).not.toHaveProperty("data");

    const invalid = await staff.get("/api/dashboards/staff?owner=me");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUERY");
  });

  it("[STAFF-DASH-04 / AC-18] returns the complete zero shape for an empty Ticket and Action dataset", async () => {
    await prisma.actionTaken.deleteMany();
    await prisma.ticket.deleteMany();
    const response = await staff.get("/api/dashboards/staff");
    expect(response.status).toBe(200);
    expect(response.body.data.metrics).toEqual({
      unassignedOpenCount: 0,
      myOpenTicketCount: 0,
      myActiveActionsCount: 0,
      countsByStatus: {
        NEW: 0,
        OPEN: 0,
        IN_PROGRESS: 0,
        WAITING_FOR_REQUESTER: 0,
        RESOLVED: 0,
        CLOSED: 0,
        REOPENED: 0,
        CANCELLED: 0,
      },
      countsByItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    });
    expect(response.body.data).toMatchObject({
      urgentTickets: [],
      recentlyUpdated: [],
      myActiveActions: [],
      myRecentCompletedActions: [],
    });
  });

  it("[STAFF-DASH-04 / AC-18] returns one safe failure without partial dashboard data", async () => {
    vi.spyOn(prisma.ticket, "count").mockRejectedValueOnce(new Error("forced dashboard failure"));
    const response = await staff.get("/api/dashboards/staff");
    expect(response.status).toBe(500);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ error: {
      code: "INTERNAL_ERROR",
      message: "Unable to load the Staff Dashboard right now.",
    } });
    expect(response.body).not.toHaveProperty("data");
    expect(JSON.stringify(response.body)).not.toContain("forced dashboard failure");
  });
});
