import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { cpus, release, totalmem } from "node:os";
import {
  ActionStatus,
  PrismaClient,
  Priority,
  TicketStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import {
  createAuthenticatedTestClient,
  type AuthenticatedTestClient,
} from "../helpers/authenticated-client.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
const envText = readFileSync(resolve(".env"), "utf8");
const databaseLine = envText
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith("DATABASE_URL="));
if (!databaseLine) throw new Error("DATABASE_URL is required for Lab 4 performance smoke tests");
const rawDatabaseUrl = databaseLine.slice(databaseLine.indexOf("=") + 1).trim()
  .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
const fixtureSchema = `lab4_performance_${randomUUID().replace(/-/g, "")}`;
if (!/^lab4_performance_[a-f0-9]{32}$/.test(fixtureSchema)) {
  throw new Error("Unsafe performance fixture schema name");
}
const fixtureUrl = new URL(rawDatabaseUrl);
fixtureUrl.searchParams.set("schema", fixtureSchema);
process.env.DATABASE_URL = fixtureUrl.toString();

const adminPrisma = new PrismaClient({ datasources: { db: { url: rawDatabaseUrl } } });
const prisma = getPrisma();
const suffix = randomUUID().replace(/-/g, "");
const migrations = [
  "../../prisma/migrations/20260812155934_init/migration.sql",
  "../../prisma/migrations/20260829063133_lab2_requester_ticketing/migration.sql",
  "../../prisma/migrations/20260902143000_attachment_updated_at/migration.sql",
  "../../prisma/migrations/20260915171500_lab3_user_migration/migration.sql",
  "../../prisma/migrations/20260915203000_authentication_sessions/migration.sql",
  "../../prisma/migrations/20261023120000_lab4_actions_data_model/migration.sql",
].map((path) => new URL(path, import.meta.url));

let staff: AuthenticatedTestClient;
let requester: AuthenticatedTestClient;
let staffId = 0;
let requesterId = 0;
let largeTicketId = 0;
let databaseVersion = "Unknown PostgreSQL version";

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
  const fixtureAdmin = new PrismaClient({
    datasources: { db: { url: fixtureUrl.toString() } },
  });
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

function percentile95(samples: number[]) {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)];
}

function planSummary(rows: Array<Record<string, unknown>>) {
  const rawPlan = rows[0]?.["QUERY PLAN"];
  const report = Array.isArray(rawPlan) ? rawPlan[0] as Record<string, unknown> : {};
  const nodeTypes: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record["Node Type"] === "string") nodeTypes.push(record["Node Type"]);
    if (Array.isArray(record.Plans)) record.Plans.forEach(visit);
  };
  visit(report.Plan);
  return {
    nodeTypes,
    planningMs: Number(report["Planning Time"] ?? 0),
    executionMs: Number(report["Execution Time"] ?? 0),
  };
}

async function measuredGet(client: AuthenticatedTestClient, path: string) {
  const startedAt = performance.now();
  const response = await client.get(path);
  return { response, durationMs: performance.now() - startedAt };
}

async function createScaleFixtures() {
  const passwordHash = await hashPassword("TokTickIT-Lab4!");
  const [category, relatedSystem, staffUser, requesterUser] = await Promise.all([
    prisma.category.create({ data: { name: `Performance Category ${suffix}` } }),
    prisma.relatedSystem.create({ data: { name: `Performance System ${suffix}` } }),
    prisma.user.create({
      data: {
        name: "Performance Staff",
        email: `performance-staff-${suffix}@example.com`,
        passwordHash,
        role: "IT_STAFF",
        mustChangePassword: false,
      },
    }),
    prisma.user.create({
      data: {
        name: "Performance Requester",
        email: `performance-requester-${suffix}@example.com`,
        passwordHash,
        role: "REQUESTER",
        mustChangePassword: false,
      },
    }),
  ]);
  staffId = staffUser.id;
  requesterId = requesterUser.id;

  const now = new Date();
  const statuses = [
    TicketStatus.NEW,
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_REQUESTER,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
    TicketStatus.REOPENED,
    TicketStatus.CANCELLED,
  ];
  const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];
  await prisma.ticket.createMany({
    data: Array.from({ length: 1_000 }, (_, index) => {
      const status = statuses[index % statuses.length];
      const updatedAt = new Date(now.getTime() - index * 60_000);
      return {
        ticketNumber: `TKT-PERF-${suffix}-${String(index).padStart(4, "0")}`,
        requesterId,
        ownerId: index % 3 === 0 ? staffId : null,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: `Performance Ticket ${index}`,
        requestedPriority: priorities[index % priorities.length],
        itPriority: priorities[(index + 1) % priorities.length],
        description: `Scale fixture ${index}`,
        status,
        ownerAssignedAt: index % 3 === 0 ? updatedAt : null,
        resolvedAt: status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED
          ? updatedAt
          : null,
        createdAt: new Date(updatedAt.getTime() - 86_400_000),
        updatedAt,
      };
    }),
  });

  const tickets = await prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: `TKT-PERF-${suffix}-` } },
    select: { id: true },
    orderBy: { ticketNumber: "asc" },
  });
  expect(tickets).toHaveLength(1_000);
  largeTicketId = tickets[0].id;
  const tiedActionAt = new Date(now.getTime() - 3_600_000);
  await prisma.actionTaken.createMany({
    data: Array.from({ length: 5_000 }, (_, index) => {
      const status = [
        ActionStatus.PLANNED,
        ActionStatus.IN_PROGRESS,
        ActionStatus.COMPLETED,
      ][index % 3];
      const ticketId = index < 500
        ? largeTicketId
        : tickets[1 + ((index - 500) % (tickets.length - 1))].id;
      const completed = status === ActionStatus.COMPLETED;
      return {
        ticketId,
        actionAt: index < 500
          ? tiedActionAt
          : new Date(now.getTime() - index * 1_000),
        description: `Performance Action ${index}`,
        result: completed ? `Completed result ${index}` : null,
        status,
        assigneeId: staffId,
        createdById: staffId,
        performedById: completed ? staffId : null,
        completedAt: completed ? new Date(now.getTime() - index * 1_000) : null,
        followUpRequired: false,
        version: completed ? 2 : 1,
      };
    }),
  });

  [staff, requester] = await Promise.all([
    createAuthenticatedTestClient({ userId: staffId }),
    createAuthenticatedTestClient({ userId: requesterId }),
  ]);
}

describe("Lab 4 performance smoke", () => {
  beforeAll(async () => {
    await adminPrisma.$connect();
    await migrateFixtureSchema();
    await prisma.$connect();
    const schemaRows = await prisma.$queryRaw<Array<{ schema: string }>>`
      SELECT current_schema() AS schema
    `;
    if (schemaRows[0]?.schema !== fixtureSchema) {
      throw new Error("Performance tests are not connected to the isolated fixture schema");
    }
    const versionRows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    databaseVersion = versionRows[0]?.version ?? databaseVersion;
    await createScaleFixtures();
  }, 60_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await adminPrisma.$disconnect();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }, 30_000);

  it("[PERF-01 / AC-28] keeps 1,000-Ticket and 5,000-Action dashboards bounded without evident N+1 calls", async () => {
    expect((await staff.get("/api/dashboards/staff")).status).toBe(200);
    expect((await requester.get("/api/dashboards/requester")).status).toBe(200);

    const ticketFindMany = vi.spyOn(prisma.ticket, "findMany");
    const ticketCount = vi.spyOn(prisma.ticket, "count");
    const ticketGroupBy = vi.spyOn(prisma.ticket, "groupBy");
    const actionFindMany = vi.spyOn(prisma.actionTaken, "findMany");
    const actionCount = vi.spyOn(prisma.actionTaken, "count");
    const queryShape = await staff.get("/api/dashboards/staff");
    expect(queryShape.status).toBe(200);
    expect(ticketFindMany).toHaveBeenCalledTimes(2);
    expect(ticketCount).toHaveBeenCalledTimes(2);
    expect(ticketGroupBy).toHaveBeenCalledTimes(2);
    expect(actionFindMany).toHaveBeenCalledTimes(2);
    expect(actionCount).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();

    const samples: number[] = [];
    for (let run = 0; run < 10; run += 1) {
      for (const [client, path] of [
        [staff, "/api/dashboards/staff"],
        [requester, "/api/dashboards/requester"],
      ] as const) {
        const measured = await measuredGet(client, path);
        expect(measured.response.status).toBe(200);
        const data = measured.response.body.data;
        for (const listName of [
          "urgentTickets",
          "recentlyUpdated",
          "myActiveActions",
          "myRecentCompletedActions",
          "attentionRequired",
          "recentlyResolved",
        ]) {
          if (Array.isArray(data[listName])) expect(data[listName].length).toBeLessThanOrEqual(10);
        }
        samples.push(measured.durationMs);
      }
    }
    const dashboardP95 = percentile95(samples);
    const ticketPlan = planSummary(await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id", "updatedAt"
      FROM "Ticket"
      WHERE "status" IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED')
        AND "itPriority" = 'HIGH'
      ORDER BY "updatedAt" DESC, "id" DESC
      LIMIT 10
    `));
    const cpu = cpus();
    console.info(
      `[PERF-ENV] Windows ${release()} | ${cpu[0]?.model ?? "Unknown CPU"} x${cpu.length}`
      + ` | ${(totalmem() / 1024 ** 3).toFixed(1)} GiB RAM | ${databaseVersion}`,
    );
    console.info(
      `[PERF-01] samples=${samples.length} p95=${dashboardP95.toFixed(1)} ms`
      + ` | plan=${ticketPlan.nodeTypes.join(" > ")}`
      + ` | planTime=${ticketPlan.planningMs.toFixed(3)} ms`
      + ` executionTime=${ticketPlan.executionMs.toFixed(3)} ms`,
    );
    expect(dashboardP95, `dashboard p95 was ${dashboardP95.toFixed(1)} ms`)
      .toBeLessThan(500);
  }, 30_000);

  it("[PERF-02 / AC-28] pages 500 tied-time Actions predictably without N+1 delegate calls", async () => {
    const path = (page: number) => `/api/tickets/${largeTicketId}/actions?page=${page}&pageSize=20`;
    expect((await requester.get(path(1))).status).toBe(200);

    const findMany = vi.spyOn(prisma.actionTaken, "findMany");
    const count = vi.spyOn(prisma.actionTaken, "count");
    const queryShape = await requester.get(path(1));
    expect(queryShape.status).toBe(200);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();

    const samples: number[] = [];
    const pageIds = new Map<number, number[]>();
    for (const page of [1, 10, 25]) {
      const measured = await measuredGet(requester, path(page));
      expect(measured.response.status).toBe(200);
      expect(measured.response.body.items).toHaveLength(20);
      expect(measured.response.body.pagination).toMatchObject({
        page,
        pageSize: 20,
        totalItems: 500,
        totalPages: 25,
      });
      const ids = measured.response.body.items.map((item: { id: number }) => item.id);
      expect(ids).toEqual([...ids].sort((left, right) => right - left));
      pageIds.set(page, ids);
      samples.push(measured.durationMs);
    }
    const repeated = await measuredGet(requester, path(10));
    expect(repeated.response.body.items.map((item: { id: number }) => item.id))
      .toEqual(pageIds.get(10));
    samples.push(repeated.durationMs);
    const actionP95 = percentile95(samples);
    const actionPlan = planSummary(await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id", "actionAt"
      FROM "ActionTaken"
      WHERE "ticketId" = $1
      ORDER BY "actionAt" DESC, "id" DESC
      LIMIT 20 OFFSET 480
    `, largeTicketId));
    console.info(
      `[PERF-02] samples=${samples.length} p95=${actionP95.toFixed(1)} ms`
      + ` | plan=${actionPlan.nodeTypes.join(" > ")}`
      + ` | planTime=${actionPlan.planningMs.toFixed(3)} ms`
      + ` executionTime=${actionPlan.executionMs.toFixed(3)} ms`,
    );
    expect(actionPlan.nodeTypes.some((node) => node.includes("Index"))).toBe(true);
    expect(actionP95, `Action page p95 was ${actionP95.toFixed(1)} ms`)
      .toBeLessThan(300);
  }, 30_000);
});
