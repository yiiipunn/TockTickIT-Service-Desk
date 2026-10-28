import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient, type ActionStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const envText = readFileSync(resolve(".env"), "utf8");
const databaseLine = envText
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith("DATABASE_URL="));
if (!databaseLine) throw new Error("DATABASE_URL is required for Lab 4 Action API tests");
const rawDatabaseUrl = databaseLine.slice(databaseLine.indexOf("=") + 1).trim()
  .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
const fixtureSchema = `lab4_actions_api_${randomUUID().replace(/-/g, "")}`;
if (!/^lab4_actions_api_[a-f0-9]{32}$/.test(fixtureSchema)) {
  throw new Error("Unsafe fixture schema name");
}
const fixtureUrl = new URL(rawDatabaseUrl);
fixtureUrl.searchParams.set("schema", fixtureSchema);
process.env.DATABASE_URL = fixtureUrl.toString();

const adminPrisma = new PrismaClient({ datasources: { db: { url: rawDatabaseUrl } } });
const prisma = getPrisma();
const password = "TokTickIT-Lab4!";
const origin = "http://localhost:5173";
const suffix = randomUUID();
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
let otherRequester: Client;
let staff: Client;
let otherStaff: Client;
let admin: Client;
let restrictedAgent: ReturnType<typeof request.agent>;
let requesterId = 0;
let otherRequesterId = 0;
let staffId = 0;
let otherStaffId = 0;
let adminId = 0;
let inactiveStaffId = 0;
let restrictedId = 0;
let ticketId = 0;
let otherTicketId = 0;
let terminalTicketId = 0;

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

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    actionAt: "2027-01-15T09:30:00.000Z",
    description: "Replace the expired wireless profile.",
    result: null,
    assigneeId: staffId,
    followUpRequired: true,
    followUpNote: "Confirm connection stability tomorrow.",
    attachmentNotes: "See the Ticket diagnostics attachment.",
    ...overrides,
  };
}

function editBody(version: number, overrides: Record<string, unknown> = {}) {
  return {
    expectedVersion: version,
    actionAt: "2027-01-16T10:00:00.000Z",
    description: "Replace and verify the wireless profile.",
    result: "Initial verification succeeded.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    ...overrides,
  };
}

function completeBody(version: number, overrides: Record<string, unknown> = {}) {
  return {
    expectedVersion: version,
    status: "COMPLETED",
    actionAt: "2026-01-15T09:30:00.000Z",
    result: "Connectivity verified on both networks.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: "Verification details are on the Ticket.",
    ...overrides,
  };
}

async function directAction(options: {
  ticket?: number;
  assignee?: number;
  status?: ActionStatus;
  actionAt?: Date;
  description?: string;
  version?: number;
} = {}) {
  const status = options.status ?? "PLANNED";
  const terminal = status === "COMPLETED" || status === "CANCELLED";
  return prisma.actionTaken.create({
    data: {
      ticketId: options.ticket ?? ticketId,
      actionAt: options.actionAt ?? new Date("2026-01-15T09:30:00.000Z"),
      description: options.description ?? `Action ${randomUUID()}`,
      result: status === "COMPLETED" ? "Completed result" : null,
      status,
      assigneeId: options.assignee ?? staffId,
      createdById: otherStaffId,
      performedById: status === "COMPLETED" ? staffId : null,
      completedAt: status === "COMPLETED" ? new Date("2026-01-15T10:00:00.000Z") : null,
      cancelledAt: status === "CANCELLED" ? new Date("2026-01-15T10:00:00.000Z") : null,
      cancelledById: status === "CANCELLED" ? otherStaffId : null,
      cancellationReason: status === "CANCELLED" ? "No longer required" : null,
      followUpRequired: false,
      followUpNote: null,
      version: options.version ?? (terminal ? 3 : 1),
    },
  });
}

describe("Lab 4 Actions Taken API", () => {
  beforeAll(async () => {
    await adminPrisma.$connect();
    await migrateFixtureSchema();
    await prisma.$connect();
    const schemaRows = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
    if (schemaRows[0]?.schema !== fixtureSchema) {
      throw new Error("Action API tests are not connected to the isolated fixture schema");
    }

    const passwordHash = await hashPassword(password);
    const [category, system] = await Promise.all([
      prisma.category.create({ data: { name: `Action Category ${suffix}` } }),
      prisma.relatedSystem.create({ data: { name: `Action System ${suffix}` } }),
    ]);
    const users = await Promise.all([
      prisma.user.create({ data: { name: "Action Requester", email: `action-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Action Requester", email: `action-other-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Action Staff", email: `action-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Action Staff", email: `action-other-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Action Administrator", email: `action-admin-${suffix}@example.com`, passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Inactive Action Staff", email: `action-inactive-${suffix}@example.com`, passwordHash, role: "IT_STAFF", isActive: false, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Restricted Action Staff", email: `action-restricted-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: true } }),
    ]);
    [requesterId, otherRequesterId, staffId, otherStaffId, adminId, inactiveStaffId, restrictedId] = users.map((user) => user.id);

    const tickets = await Promise.all([
      prisma.ticket.create({ data: { ticketNumber: `TKT-ACTION-${suffix}`, requesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Action API fixture", description: "Owned active Ticket", requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN" } }),
      prisma.ticket.create({ data: { ticketNumber: `TKT-ACTION-OTHER-${suffix}`, requesterId: otherRequesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Other Action fixture", description: "Other Requester Ticket", requestedPriority: "LOW", itPriority: "LOW", status: "OPEN" } }),
      prisma.ticket.create({ data: { ticketNumber: `TKT-ACTION-TERMINAL-${suffix}`, requesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Terminal Ticket fixture", description: "Resolved Ticket", requestedPriority: "LOW", itPriority: "LOW", status: "RESOLVED", resolvedAt: new Date() } }),
    ]);
    [ticketId, otherTicketId, terminalTicketId] = tickets.map((ticket) => ticket.id);

    [requester, otherRequester, staff, otherStaff, admin] = await Promise.all([
      createAuthenticatedTestClient({ userId: requesterId }),
      createAuthenticatedTestClient({ userId: otherRequesterId }),
      createAuthenticatedTestClient({ userId: staffId }),
      createAuthenticatedTestClient({ userId: otherStaffId }),
      createAuthenticatedTestClient({ userId: adminId }),
    ]);
    restrictedAgent = request.agent(app);
    const restrictedLogin = await restrictedAgent.post("/api/auth/login").send({
      email: users[6].email,
      password,
    });
    expect(restrictedLogin.status).toBe(200);
  });

  beforeEach(async () => {
    await prisma.actionTakenEvent.deleteMany();
    await prisma.actionTaken.deleteMany();
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await adminPrisma.$disconnect();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("[ACT-API-01 / AC-01, AC-10] lets Staff create a planned Action with server identity and one event", async () => {
    const response = await staff.post(`/api/staff/tickets/${ticketId}/actions`).send(createBody({
      createdById: otherStaffId,
    }));
    expect(response.status).toBe(400);
    expect(await prisma.actionTaken.count()).toBe(0);

    const created = await staff.post(`/api/staff/tickets/${ticketId}/actions`).send(createBody());
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      ticketId,
      status: "PLANNED",
      version: 1,
      assignee: { id: staffId, role: "IT_STAFF", isActive: true },
      createdBy: { id: staffId, role: "IT_STAFF" },
      performedBy: null,
    });
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(stored.createdById).toBe(staffId);
    expect(stored.performedById).toBeNull();
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: stored.id, eventType: "CREATED" } })).toBe(1);
  });

  it("[ACT-API-02 / AC-03, AC-04] scopes Requester reads and returns deterministic pagination", async () => {
    const empty = await requester.get(`/api/tickets/${ticketId}/actions`);
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    const later = new Date("2026-02-01T10:00:00.000Z");
    const first = await directAction({ actionAt: later, description: "First tied Action" });
    const second = await directAction({ actionAt: later, description: "Second tied Action" });
    await directAction({ actionAt: new Date("2026-01-01T10:00:00.000Z"), description: "Older Action" });
    const foreign = await directAction({ ticket: otherTicketId, description: "Foreign private Action" });

    const ownList = await requester.get(`/api/tickets/${ticketId}/actions?page=1&pageSize=10`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.items.map((item: { id: number }) => item.id)).toEqual([second.id, first.id, expect.any(Number)]);
    expect(ownList.body.pagination).toEqual({ page: 1, pageSize: 10, totalItems: 3, totalPages: 1 });
    expect((await requester.get(`/api/actions/${first.id}`)).status).toBe(200);
    expect((await requester.get(`/api/tickets/${otherTicketId}/actions`)).status).toBe(404);
    expect((await requester.get(`/api/actions/${foreign.id}`)).status).toBe(404);
    expect(JSON.stringify((await requester.get(`/api/actions/${foreign.id}`)).body)).not.toContain("Foreign private Action");
    expect((await otherRequester.get(`/api/tickets/${ticketId}/actions`)).status).toBe(404);
  });

  it("[ACT-API-02, ACT-API-13 / AC-04, AC-25] denies Requester writes/history and enforces session restrictions", async () => {
    const action = await directAction();
    const denied = await Promise.all([
      requester.post(`/api/staff/tickets/${ticketId}/actions`).send(createBody()),
      requester.patch(`/api/staff/actions/${action.id}`).send(editBody(1)),
      requester.patch(`/api/staff/actions/${action.id}/assignee`).send({ expectedVersion: 1, assigneeId: otherStaffId }),
      requester.patch(`/api/staff/actions/${action.id}/status`).send({ expectedVersion: 1, status: "IN_PROGRESS" }),
      requester.get(`/api/staff/actions/${action.id}/events`),
    ]);
    expect(denied.map((response) => response.status)).toEqual([403, 403, 403, 403, 403]);
    expect((await request(app).get(`/api/actions/${action.id}`)).status).toBe(401);
    expect((await restrictedAgent.get(`/api/actions/${action.id}`)).status).toBe(403);
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).version).toBe(1);
  });

  it("[ACT-API-04 / AC-05] validates required fields, ISO dates, text limits, follow-up rules, and unknown fields", async () => {
    const invalidBodies = [
      createBody({ description: " " }),
      createBody({ description: "x".repeat(2001) }),
      createBody({ actionAt: "2026-10-24" }),
      createBody({ followUpRequired: true, followUpNote: null }),
      createBody({ followUpRequired: false, followUpNote: "must be null" }),
      createBody({ attachmentNotes: "x".repeat(1001) }),
      createBody({ status: "COMPLETED" }),
      { description: "Missing required values" },
      [],
    ];
    for (const body of invalidBodies) {
      const response = await staff.post(`/api/staff/tickets/${ticketId}/actions`).send(body);
      expect(response.status, JSON.stringify(body).slice(0, 100)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await prisma.actionTaken.count()).toBe(0);
    expect(await prisma.actionTakenEvent.count()).toBe(0);
  });

  it("[ACT-API-05 / AC-05, AC-10] edits only non-terminal Actions and records the before snapshot", async () => {
    const action = await directAction({ status: "IN_PROGRESS" });
    const edited = await otherStaff.patch(`/api/staff/actions/${action.id}`).send(editBody(1));
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({
      description: "Replace and verify the wireless profile.",
      result: "Initial verification succeeded.",
      version: 2,
    });
    const event = await prisma.actionTakenEvent.findFirstOrThrow({ where: { actionTakenId: action.id } });
    expect(event.eventType).toBe("UPDATED");
    expect(event.actorId).toBe(otherStaffId);
    expect(event.snapshot).toMatchObject({ description: action.description });

    const terminal = await directAction({ status: "COMPLETED" });
    const denied = await staff.patch(`/api/staff/actions/${terminal.id}`).send(editBody(terminal.version));
    expect(denied.status).toBe(409);
    expect(denied.body.error.code).toBe("ACTION_STATUS_CONFLICT");
  });

  it("[ACT-API-06 / AC-06] accepts eligible reassignment and rejects inactive, Requester, and missing assignees", async () => {
    const action = await directAction();
    const reassigned = await staff.patch(`/api/staff/actions/${action.id}/assignee`).send({
      expectedVersion: 1,
      assigneeId: adminId,
    });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.data.assignee.id).toBe(adminId);
    expect(reassigned.body.data.version).toBe(2);
    const event = await prisma.actionTakenEvent.findFirstOrThrow({ where: { actionTakenId: action.id } });
    expect(event).toMatchObject({ eventType: "ASSIGNEE_CHANGED", fromAssigneeId: staffId, toAssigneeId: adminId });

    for (const assigneeId of [inactiveStaffId, requesterId, 999999999]) {
      const response = await staff.patch(`/api/staff/actions/${action.id}/assignee`).send({ expectedVersion: 2, assigneeId });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INELIGIBLE_ASSIGNEE");
    }
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).version).toBe(2);
  });

  it("[ACT-API-07, ACT-API-08 / AC-07, AC-08, AC-11] enforces assignee transitions and server performer identity", async () => {
    const action = await directAction({ assignee: staffId });
    const forbidden = await otherStaff.patch(`/api/staff/actions/${action.id}/status`).send({ expectedVersion: 1, status: "IN_PROGRESS" });
    expect(forbidden.status).toBe(403);

    const started = await staff.patch(`/api/staff/actions/${action.id}/status`).send({ expectedVersion: 1, status: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    expect(started.body.data.version).toBe(2);

    const spoofed = await staff.patch(`/api/staff/actions/${action.id}/status`).send(completeBody(2, { performedById: otherStaffId }));
    expect(spoofed.status).toBe(400);
    const completed = await staff.patch(`/api/staff/actions/${action.id}/status`).send(completeBody(2));
    expect(completed.status).toBe(200);
    expect(completed.body.data).toMatchObject({ status: "COMPLETED", version: 3, performedBy: { id: staffId } });
    expect(completed.body.data.completedAt).toEqual(expect.any(String));
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.performedById).toBe(staffId);
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: action.id, eventType: "STATUS_CHANGED" } })).toBe(2);
  });

  it("[ACT-API-07, ACT-API-08 / AC-07, AC-08] rejects invalid and future completion transitions without mutation", async () => {
    const planned = await directAction();
    const invalid = await staff.patch(`/api/staff/actions/${planned.id}/status`).send(completeBody(1));
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("ACTION_STATUS_CONFLICT");

    const active = await directAction({ status: "IN_PROGRESS" });
    for (const body of [
      completeBody(1, { result: " " }),
      completeBody(1, { actionAt: "2099-01-01T00:00:00.000Z" }),
      completeBody(1, { followUpRequired: true, followUpNote: null }),
    ]) {
      const response = await staff.patch(`/api/staff/actions/${active.id}/status`).send(body);
      expect(response.status).toBe(400);
    }
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: active.id } })).status).toBe("IN_PROGRESS");
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: active.id } })).toBe(0);
  });

  it("[ACT-API-09 / AC-09] requires cancellation confirmation/reason and records the authenticated actor", async () => {
    const action = await directAction({ assignee: staffId });
    const noConfirmation = await otherStaff.patch(`/api/staff/actions/${action.id}/status`).send({
      expectedVersion: 1,
      status: "CANCELLED",
      confirmed: false,
      cancellationReason: "Duplicate",
    });
    expect(noConfirmation.status).toBe(400);
    expect(noConfirmation.body.error.code).toBe("CONFIRMATION_REQUIRED");
    const cancelled = await otherStaff.patch(`/api/staff/actions/${action.id}/status`).send({
      expectedVersion: 1,
      status: "CANCELLED",
      confirmed: true,
      cancellationReason: "  Duplicate planned work.  ",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data).toMatchObject({
      status: "CANCELLED",
      cancellationReason: "Duplicate planned work.",
      cancelledBy: { id: otherStaffId },
      version: 2,
    });
    expect((await staff.get(`/api/actions/${action.id}`)).status).toBe(200);
  });

  it("[ACT-API-07 / AC-07] allows Administrator lifecycle override while keeping owner, creator, assignee, and performer distinct", async () => {
    const action = await directAction({ assignee: staffId });
    expect((await admin.patch(`/api/staff/actions/${action.id}/status`).send({ expectedVersion: 1, status: "IN_PROGRESS" })).status).toBe(200);
    const completed = await admin.patch(`/api/staff/actions/${action.id}/status`).send(completeBody(2));
    expect(completed.status).toBe(200);
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect({
      ticketRequesterId: (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).requesterId,
      creatorId: stored.createdById,
      assigneeId: stored.assigneeId,
      performerId: stored.performedById,
    }).toEqual({ ticketRequesterId: requesterId, creatorId: otherStaffId, assigneeId: staffId, performerId: adminId });
  });

  it("[ACT-API-10 / AC-10, AC-26] gives one winner for stale writes and appends only one event", async () => {
    const action = await directAction();
    const first = await staff.patch(`/api/staff/actions/${action.id}`).send(editBody(1, { description: "Winning edit" }));
    const stale = await otherStaff.patch(`/api/staff/actions/${action.id}`).send(editBody(1, { description: "Stale edit" }));
    expect(first.status).toBe(200);
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({
      code: "ACTION_VERSION_CONFLICT",
      current: { id: action.id, status: "PLANNED", version: 2 },
    });
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.description).toBe("Winning edit");
    expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: action.id } })).toBe(1);
  });

  it("[ACT-API-14 / AC-10, AC-26] rolls back the Action when audit insertion fails", async () => {
    const action = await directAction({ description: "Atomicity original" });
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${fixtureSchema}"."reject_action_event"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced audit failure';
      END;
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "reject_action_event_insert"
      BEFORE INSERT ON "${fixtureSchema}"."ActionTakenEvent"
      FOR EACH ROW EXECUTE FUNCTION "${fixtureSchema}"."reject_action_event"()
    `);
    try {
      const response = await staff.patch(`/api/staff/actions/${action.id}`).send(
        editBody(1, { description: "Must roll back" }),
      );
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "Unable to update the Action." },
      });
      expect(JSON.stringify(response.body)).not.toContain("forced audit failure");
      const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
      expect(stored).toMatchObject({ description: "Atomicity original", version: 1 });
      expect(await prisma.actionTakenEvent.count({ where: { actionTakenId: action.id } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "reject_action_event_insert" ON "${fixtureSchema}"."ActionTakenEvent"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fixtureSchema}"."reject_action_event"()`);
    }
  });

  it("[ACT-API-11 / AC-10, AC-11] returns ordered Staff/Admin event history but never snapshots", async () => {
    const created = await staff.post(`/api/staff/tickets/${ticketId}/actions`).send(createBody());
    const actionId = created.body.data.id as number;
    await staff.patch(`/api/staff/actions/${actionId}/assignee`).send({ expectedVersion: 1, assigneeId: otherStaffId });
    const history = await admin.get(`/api/staff/actions/${actionId}/events`);
    expect(history.status).toBe(200);
    expect(history.body.items.map((event: { type: string }) => event.type)).toEqual(["CREATED", "ASSIGNEE_CHANGED"]);
    expect(history.body.items[0]).toMatchObject({ actor: { id: staffId }, fromStatus: null, toStatus: "PLANNED" });
    expect(JSON.stringify(history.body)).not.toContain("snapshot");
  });

  it("[ACT-API-01, ACT-API-05 / AC-01, AC-05] rejects terminal parent Tickets and missing resources safely", async () => {
    const terminal = await staff.post(`/api/staff/tickets/${terminalTicketId}/actions`).send(createBody());
    expect(terminal.status).toBe(409);
    expect(terminal.body.error.code).toBe("TICKET_STATE_CONFLICT");
    expect((await staff.post("/api/staff/tickets/999999999/actions").send(createBody())).status).toBe(404);
    expect((await staff.get("/api/actions/999999999")).status).toBe(404);
    expect((await staff.patch("/api/staff/actions/999999999").send(editBody(1))).status).toBe(404);
    expect((await staff.get("/api/tickets/not-a-number/actions")).status).toBe(404);
  });

  it("[ACT-API-12 / AC-03, AC-25] rejects malformed, repeated, and unknown list queries", async () => {
    for (const query of ["?page=0", "?pageSize=11", "?page=x", "?page=1&page=2", "?status=PLANNED"]) {
      const response = await staff.get(`/api/tickets/${ticketId}/actions${query}`);
      expect(response.status, query).toBe(400);
      expect(response.body.error.code).toBe("INVALID_QUERY");
    }
  });

  it("[ACT-API-12 / AC-03] paginates 55 tied Actions without duplicates or gaps", async () => {
    const tiedAt = new Date("2026-03-01T10:00:00.000Z");
    await prisma.actionTaken.createMany({
      data: Array.from({ length: 55 }, (_, index) => ({
        ticketId,
        actionAt: tiedAt,
        description: `Tied pagination Action ${String(index + 1).padStart(2, "0")}`,
        status: "PLANNED" as const,
        assigneeId: staffId,
        createdById: otherStaffId,
        followUpRequired: false,
        version: 1,
      })),
    });
    const responses = await Promise.all([1, 2, 3].map((page) =>
      staff.get(`/api/tickets/${ticketId}/actions?page=${page}&pageSize=20`),
    ));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(responses.map((response) => response.body.items.length)).toEqual([20, 20, 15]);
    const ids = responses.flatMap((response) =>
      response.body.items.map((item: { id: number }) => item.id),
    );
    expect(new Set(ids).size).toBe(55);
    expect(ids).toEqual([...ids].sort((left, right) => right - left));
    expect(responses[2].body.pagination).toEqual({
      page: 3,
      pageSize: 20,
      totalItems: 55,
      totalPages: 3,
    });
  });

  it("[ACT-API-03, ACT-API-13 / AC-25] safely handles malformed JSON, bad CSRF, and client audit fields", async () => {
    const malformed = await staff.post(`/api/staff/tickets/${ticketId}/actions`)
      .set("Content-Type", "application/json")
      .send('{"description":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");

    const badCsrf = await staff.post(`/api/staff/tickets/${ticketId}/actions`)
      .set("X-CSRF-Token", "invalid-token")
      .send(createBody());
    expect(badCsrf.status).toBe(403);
    expect(badCsrf.body.error.code).toBe("CSRF_INVALID");

    const spoof = await staff.post(`/api/staff/tickets/${ticketId}/actions`).send(createBody({
      performedById: adminId,
      cancelledAt: new Date().toISOString(),
      version: 99,
    }));
    expect(spoof.status).toBe(400);
    expect(await prisma.actionTaken.count()).toBe(0);
  });
});
