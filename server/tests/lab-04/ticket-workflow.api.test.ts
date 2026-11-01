import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient, type TicketStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/password.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const envText = readFileSync(resolve(".env"), "utf8");
const databaseLine = envText.split(/\r?\n/).find((line) => line.trimStart().startsWith("DATABASE_URL="));
if (!databaseLine) throw new Error("DATABASE_URL is required for Lab 4 workflow API tests");
const rawDatabaseUrl = databaseLine.slice(databaseLine.indexOf("=") + 1).trim()
  .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
const fixtureSchema = `lab4_workflow_api_${randomUUID().replace(/-/g, "")}`;
if (!/^lab4_workflow_api_[a-f0-9]{32}$/.test(fixtureSchema)) throw new Error("Unsafe fixture schema name");
const fixtureUrl = new URL(rawDatabaseUrl);
fixtureUrl.searchParams.set("schema", fixtureSchema);
process.env.DATABASE_URL = fixtureUrl.toString();

const adminPrisma = new PrismaClient({ datasources: { db: { url: rawDatabaseUrl } } });
const prisma = getPrisma();
const password = "TokTickIT-Lab4!";
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
let ticketId = 0;
let otherTicketId = 0;

const statuses: TicketStatus[] = [
  "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER",
  "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
];
const matrix: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

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
    } else statement += sql[index];
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
      for (const statement of splitMigrationStatements(sql)) await fixtureAdmin.$executeRawUnsafe(statement);
    }
  } finally {
    await fixtureAdmin.$disconnect();
  }
}

async function resetTicket(options: {
  status?: TicketStatus;
  ownerId?: number | null;
  version?: number;
  indicated?: boolean;
} = {}) {
  await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId } });
  await prisma.actionTakenEvent.deleteMany({ where: { actionTaken: { ticketId } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId } });
  const status = options.status ?? "OPEN";
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      ownerId: options.ownerId === undefined ? staffId : options.ownerId,
      ownerAssignedAt: options.ownerId === null ? null : new Date("2026-10-01T00:00:00.000Z"),
      version: options.version ?? 1,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date("2026-10-02T00:00:00.000Z") : null,
      requesterResolutionIndicatedAt: options.indicated ? new Date("2026-10-03T00:00:00.000Z") : null,
      itPriority: "MEDIUM",
    },
  });
}

async function addAction(status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      actionAt: new Date("2026-10-04T01:00:00.000Z"),
      description: `${status} workflow fixture`,
      result: status === "COMPLETED" ? "Verified" : null,
      status,
      assigneeId: staffId,
      createdById: staffId,
      performedById: status === "COMPLETED" ? staffId : null,
      completedAt: status === "COMPLETED" ? new Date("2026-10-04T02:00:00.000Z") : null,
      cancelledAt: status === "CANCELLED" ? new Date("2026-10-04T02:00:00.000Z") : null,
      cancelledById: status === "CANCELLED" ? staffId : null,
      cancellationReason: status === "CANCELLED" ? "No longer required" : null,
      followUpRequired: false,
      version: 1,
    },
  });
}

function statusBody(currentStatus: TicketStatus, status: TicketStatus, expectedVersion = 1) {
  return { expectedVersion, currentStatus, status, confirmed: status === "CLOSED" || status === "CANCELLED" };
}

describe("Lab 4 Ticket workflow API", () => {
  beforeAll(async () => {
    await adminPrisma.$connect();
    await migrateFixtureSchema();
    await prisma.$connect();
    const schemaRows = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
    if (schemaRows[0]?.schema !== fixtureSchema) throw new Error("Workflow tests are not connected to their isolated fixture schema");

    const passwordHash = await hashPassword(password);
    const [category, system] = await Promise.all([
      prisma.category.create({ data: { name: `Workflow Category ${suffix}` } }),
      prisma.relatedSystem.create({ data: { name: `Workflow System ${suffix}` } }),
    ]);
    const users = await Promise.all([
      prisma.user.create({ data: { name: "Workflow Requester", email: `workflow-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Workflow Requester", email: `workflow-other-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Workflow Staff", email: `workflow-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Workflow Staff", email: `workflow-other-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Workflow Admin", email: `workflow-admin-${suffix}@example.com`, passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Inactive Workflow Staff", email: `workflow-inactive-${suffix}@example.com`, passwordHash, role: "IT_STAFF", isActive: false, mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Restricted Workflow Staff", email: `workflow-restricted-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: true } }),
    ]);
    [requesterId, otherRequesterId, staffId, otherStaffId, adminId, inactiveStaffId] = users.map((user) => user.id);
    const tickets = await Promise.all([
      prisma.ticket.create({ data: { ticketNumber: `TKT-WORKFLOW-${suffix}`, requesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Workflow fixture", description: "Primary workflow Ticket", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "OPEN" } }),
      prisma.ticket.create({ data: { ticketNumber: `TKT-WORKFLOW-OTHER-${suffix}`, requesterId: otherRequesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Other workflow fixture", description: "Private Ticket", requestedPriority: "LOW", itPriority: "LOW", status: "OPEN" } }),
    ]);
    [ticketId, otherTicketId] = tickets.map((ticket) => ticket.id);
    [requester, otherRequester, staff, otherStaff, admin] = await Promise.all([
      createAuthenticatedTestClient({ userId: requesterId }),
      createAuthenticatedTestClient({ userId: otherRequesterId }),
      createAuthenticatedTestClient({ userId: staffId }),
      createAuthenticatedTestClient({ userId: otherStaffId }),
      createAuthenticatedTestClient({ userId: adminId }),
    ]);
    restrictedAgent = request.agent(app);
    expect((await restrictedAgent.post("/api/auth/login").send({ email: users[6].email, password })).status).toBe(200);
  });

  beforeEach(async () => { await resetTicket(); });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await adminPrisma.$disconnect();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("[FLOW-API-01 / AC-12, AC-13] enforces every allowed and forbidden status pair", async () => {
    for (const from of statuses) {
      for (const to of statuses) {
        await resetTicket({ status: from, indicated: from === "RESOLVED" || from === "CLOSED" });
        if (to === "RESOLVED") await addAction("COMPLETED");
        const response = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody(from, to));
        const allowed = matrix[from].includes(to);
        expect(response.status, `${from} -> ${to}`).toBe(allowed ? 200 : 409);
        const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
        if (allowed) {
          expect(stored).toMatchObject({ status: to, version: 2 });
          expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId, eventType: "STATUS_CHANGED" } })).toBe(1);
        } else {
          expect(stored).toMatchObject({ status: from, version: 1 });
          expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId } })).toBe(0);
        }
      }
    }
  });

  it("[FLOW-API-02 / AC-14] enforces all resolution gates and timestamp semantics", async () => {
    await resetTicket({ ownerId: null });
    await addAction("COMPLETED");
    let response = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "RESOLVED"));
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "RESOLUTION_GATE_FAILED", fields: { owner: expect.any(String) } });

    await resetTicket();
    response = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "RESOLVED"));
    expect(response.body.error.fields).toMatchObject({ completedActions: expect.any(String) });

    await resetTicket();
    await addAction("COMPLETED");
    await addAction("PLANNED");
    response = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "RESOLVED"));
    expect(response.body.error.fields).toMatchObject({ activeActions: expect.any(String) });

    await resetTicket();
    await addAction("CANCELLED");
    response = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "RESOLVED"));
    expect(response.status).toBe(409);

    await resetTicket();
    await addAction("COMPLETED");
    response = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "RESOLVED"));
    expect(response.status).toBe(200);
    expect(response.body.data.resolvedAt).toEqual(expect.any(String));
    const resolvedAt = response.body.data.resolvedAt;
    const closed = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("RESOLVED", "CLOSED", 2));
    expect(closed.status).toBe(200);
    expect(closed.body.data.resolvedAt).toBe(resolvedAt);

    await resetTicket({ status: "RESOLVED", indicated: true });
    const reopened = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("RESOLVED", "REOPENED"));
    expect(reopened.status).toBe(200);
    expect(reopened.body.data).toMatchObject({ resolvedAt: null, requesterResolutionIndicatedAt: null });
  });

  it("[FLOW-API-03 / AC-21, AC-22] keeps Requester resolution indication advisory, scoped, active-only, and idempotent", async () => {
    await resetTicket({ ownerId: null });
    const first = await requester.post(`/api/tickets/${ticketId}/resolution-indication`).send({});
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ ticketId, status: "OPEN" });
    const firstAt = first.body.data.requesterResolutionIndicatedAt;
    const second = await requester.post(`/api/tickets/${ticketId}/resolution-indication`).send({});
    expect(second.status).toBe(200);
    expect(second.body.data.requesterResolutionIndicatedAt).toBe(firstAt);
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: "OPEN", version: 1 });
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId } })).toBe(0);
    expect((await otherRequester.post(`/api/tickets/${ticketId}/resolution-indication`).send({})).status).toBe(404);
    expect((await requester.post(`/api/tickets/${otherTicketId}/resolution-indication`).send({})).status).toBe(404);
    await resetTicket({ status: "CLOSED" });
    const terminal = await requester.post(`/api/tickets/${ticketId}/resolution-indication`).send({});
    expect(terminal.status).toBe(409);
    expect(terminal.body.error.code).toBe("TICKET_STATE_CONFLICT");
  });

  it("[FLOW-API-04 / AC-12, AC-25] enforces confirmations, ownership rules, authentication, and validation", async () => {
    await resetTicket({ status: "RESOLVED" });
    const noCloseConfirmation = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send({
      ...statusBody("RESOLVED", "CLOSED"), confirmed: false,
    });
    expect(noCloseConfirmation.body.error.code).toBe("CONFIRMATION_REQUIRED");
    await resetTicket({ status: "OPEN" });
    const noCancelConfirmation = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send({
      ...statusBody("OPEN", "CANCELLED"), confirmed: false,
    });
    expect(noCancelConfirmation.body.error.code).toBe("CONFIRMATION_REQUIRED");

    await resetTicket({ ownerId: null });
    const noOwner = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "IN_PROGRESS"));
    expect(noOwner.body.error.code).toBe("OWNER_CONFLICT");
    await resetTicket({ status: "IN_PROGRESS" });
    const unassign = await staff.patch(`/api/staff/tickets/${ticketId}/owner`).send({ expectedVersion: 1, ownerId: null });
    expect(unassign.body.error.code).toBe("OWNER_CONFLICT");
    const inactive = await staff.patch(`/api/staff/tickets/${ticketId}/owner`).send({ expectedVersion: 1, ownerId: inactiveStaffId });
    expect(inactive.body.error.code).toBe("INELIGIBLE_OWNER");

    expect((await requester.patch(`/api/staff/tickets/${ticketId}/it-priority`).send({ expectedVersion: 1, itPriority: "HIGH" })).status).toBe(403);
    expect((await request(app).patch(`/api/staff/tickets/${ticketId}/it-priority`).send({ expectedVersion: 1, itPriority: "HIGH" })).status).toBe(401);
    expect((await restrictedAgent.patch(`/api/staff/tickets/${ticketId}/it-priority`).send({ expectedVersion: 1, itPriority: "HIGH" })).status).toBe(403);
    const badCsrf = await staff.patch(`/api/staff/tickets/${ticketId}/it-priority`)
      .set("X-CSRF-Token", "invalid-token")
      .send({ expectedVersion: 1, itPriority: "HIGH" });
    expect(badCsrf.status).toBe(403);
    expect(badCsrf.body.error.code).toBe("CSRF_INVALID");
    const malformed = await staff.patch(`/api/staff/tickets/${ticketId}/status`)
      .set("Content-Type", "application/json")
      .send('{"status":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
    for (const body of [
      { currentStatus: "OPEN", status: "CANCELLED", confirmed: true },
      { expectedVersion: 1, currentStatus: "OPEN", status: "BOGUS" },
      { expectedVersion: 1, currentStatus: "OPEN", status: "CANCELLED", extra: true },
      [],
    ]) {
      const invalid = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(body);
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await staff.patch("/api/staff/tickets/999999999/status").send(statusBody("OPEN", "CANCELLED"))).status).toBe(404);
    expect((await staff.patch("/api/staff/tickets/not-a-number/status").send(statusBody("OPEN", "CANCELLED"))).status).toBe(404);
  });

  it("[FLOW-API-05 / AC-25, AC-26] gives one winner to stale Ticket mutations and reports authoritative state", async () => {
    await resetTicket({ ownerId: null });
    const claimed = await staff.post(`/api/staff/tickets/${ticketId}/claim`).send({ expectedVersion: 1 });
    expect(claimed.status).toBe(200);
    expect(claimed.body.data).toMatchObject({ version: 2, owner: { id: staffId } });
    const staleClaim = await otherStaff.post(`/api/staff/tickets/${ticketId}/claim`).send({ expectedVersion: 1 });
    expect(staleClaim.status).toBe(409);
    expect(staleClaim.body.error).toMatchObject({ code: "TICKET_VERSION_CONFLICT", current: { version: 2, ownerId: staffId } });

    const priority = await admin.patch(`/api/staff/tickets/${ticketId}/it-priority`).send({ expectedVersion: 2, itPriority: "HIGH" });
    expect(priority.status).toBe(200);
    const staleStatus = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "CANCELLED", 2));
    expect(staleStatus.status).toBe(409);
    expect(staleStatus.body.error).toMatchObject({ code: "TICKET_VERSION_CONFLICT", current: { version: 3 } });
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId } })).toBe(2);
  });

  it("[FLOW-API-05 / AC-25, AC-26] versions owner/priority/status changes and exposes ordered actor history", async () => {
    const owner = await admin.patch(`/api/staff/tickets/${ticketId}/owner`).send({ expectedVersion: 1, ownerId: otherStaffId });
    expect(owner.body.data.version).toBe(2);
    const priority = await staff.patch(`/api/staff/tickets/${ticketId}/it-priority`).send({ expectedVersion: 2, itPriority: "HIGH" });
    expect(priority.body.data.version).toBe(3);
    const status = await staff.patch(`/api/staff/tickets/${ticketId}/status`).send(statusBody("OPEN", "WAITING_FOR_REQUESTER", 3));
    expect(status.body.data.version).toBe(4);
    const detail = await admin.get(`/api/staff/tickets/${ticketId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.workflowEvents.map((event: { eventType: string }) => event.eventType)).toEqual([
      "OWNER_CHANGED", "PRIORITY_CHANGED", "STATUS_CHANGED",
    ]);
    expect(detail.body.data.workflowEvents.map((event: { actor: { id: number } }) => event.actor.id)).toEqual([
      adminId, staffId, staffId,
    ]);
    expect(detail.body.data.workflowEvents[2]).toMatchObject({ fromStatus: "OPEN", toStatus: "WAITING_FOR_REQUESTER" });
  });

  it("[FLOW-API-05 / AC-26] rolls back a Ticket mutation if workflow audit insertion fails", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${fixtureSchema}"."reject_workflow_event"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced workflow audit failure';
      END;
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "reject_workflow_event_insert"
      BEFORE INSERT ON "${fixtureSchema}"."TicketWorkflowEvent"
      FOR EACH ROW EXECUTE FUNCTION "${fixtureSchema}"."reject_workflow_event"()
    `);
    try {
      const response = await staff.patch(`/api/staff/tickets/${ticketId}/it-priority`).send({ expectedVersion: 1, itPriority: "HIGH" });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Unable to update IT Priority right now." } });
      expect(JSON.stringify(response.body)).not.toContain("forced workflow audit failure");
      expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ itPriority: "MEDIUM", version: 1 });
      expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "reject_workflow_event_insert" ON "${fixtureSchema}"."TicketWorkflowEvent"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fixtureSchema}"."reject_workflow_event"()`);
    }
  });
});
