import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LAB4_SEED_ACTION_DESCRIPTIONS,
  LAB4_SEED_TICKET_NUMBERS,
  runSeed,
} from "../../prisma/seed.js";
import { getPrisma } from "../../src/prisma.js";

const adminPrisma = getPrisma();
let fixturePrisma: PrismaClient;
const fixtureSchema = `lab4_seed_fixture_${randomUUID().replace(/-/g, "")}`;
const migrationPaths = [
  "../../prisma/migrations/20260812155934_init/migration.sql",
  "../../prisma/migrations/20260829063133_lab2_requester_ticketing/migration.sql",
  "../../prisma/migrations/20260902143000_attachment_updated_at/migration.sql",
  "../../prisma/migrations/20260915171500_lab3_user_migration/migration.sql",
  "../../prisma/migrations/20260915203000_authentication_sessions/migration.sql",
  "../../prisma/migrations/20261023120000_lab4_actions_data_model/migration.sql",
].map((path) => new URL(path, import.meta.url));

class RollbackSeedFixture extends Error {}

function splitMigrationStatements(sql: string) {
  const statements: string[] = [];
  let statement = "";
  let inDollarBlock = false;

  for (let index = 0; index < sql.length; index += 1) {
    if (sql.slice(index, index + 2) === "$$") {
      inDollarBlock = !inDollarBlock;
      statement += "$$";
      index += 1;
      continue;
    }
    if (sql[index] === ";" && !inDollarBlock) {
      if (statement.trim()) statements.push(statement);
      statement = "";
      continue;
    }
    statement += sql[index];
  }
  if (statement.trim()) statements.push(statement);
  return statements;
}

async function createMigratedFixtureSchema() {
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${fixtureSchema}"`);
  await adminPrisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`SET LOCAL search_path TO "${fixtureSchema}"`);
    for (const migrationPath of migrationPaths) {
      const migrationSql = await readFile(migrationPath, "utf8");
      for (const statement of splitMigrationStatements(migrationSql)) {
        await transaction.$executeRawUnsafe(statement);
      }
    }
  });
}

async function createFixtureClient() {
  const envText = await readFile(resolve(".env"), "utf8");
  const databaseLine = envText
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith("DATABASE_URL="));
  if (!databaseLine) throw new Error("DATABASE_URL is required for Lab 4 seed tests");

  const rawValue = databaseLine.slice(databaseLine.indexOf("=") + 1).trim();
  const unquotedValue = rawValue.replace(/^(["'])(.*)\1$/, "$2");
  const fixtureUrl = new URL(unquotedValue);
  fixtureUrl.searchParams.set("schema", fixtureSchema);

  return new PrismaClient({
    datasources: { db: { url: fixtureUrl.toString() } },
  });
}

async function withSeedFixture<T>(
  assertion: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  const rollback = new RollbackSeedFixture();
  let result: T | undefined;

  try {
    await fixturePrisma.$transaction(async (transaction) => {
      await runSeed(transaction);
      result = await assertion(transaction);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }

  return result as T;
}

function stableActionSnapshot(actions: Array<{
  id: number;
  ticketId: number;
  actionAt: Date;
  description: string;
  result: string | null;
  status: string;
  assigneeId: number;
  createdById: number;
  performedById: number | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: number | null;
  cancellationReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>) {
  return actions.map((action) => ({
    ...action,
    actionAt: action.actionAt.toISOString(),
    completedAt: action.completedAt?.toISOString() ?? null,
    cancelledAt: action.cancelledAt?.toISOString() ?? null,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  }));
}

describe("Lab 4 Actions Taken seed data", () => {
  beforeAll(async () => {
    await adminPrisma.$connect();
    await createMigratedFixtureSchema();
    fixturePrisma = await createFixtureClient();
    await fixturePrisma.$connect();
  });

  afterAll(async () => {
    await fixturePrisma?.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await adminPrisma.$disconnect();
  });

  it("is idempotent for Lab 4 Tickets, Actions, and Action events", async () => {
    await withSeedFixture(async (transaction) => {
      const firstTickets = await transaction.ticket.findMany({
        where: { ticketNumber: { in: LAB4_SEED_TICKET_NUMBERS } },
        orderBy: { ticketNumber: "asc" },
      });
      const firstActions = await transaction.actionTaken.findMany({
        where: { description: { in: LAB4_SEED_ACTION_DESCRIPTIONS } },
        orderBy: { id: "asc" },
      });
      const firstEvents = await transaction.actionTakenEvent.findMany({
        where: { actionTaken: { description: { in: LAB4_SEED_ACTION_DESCRIPTIONS } } },
        orderBy: { id: "asc" },
      });

      await runSeed(transaction);

      const tickets = await transaction.ticket.findMany({
        where: { ticketNumber: { in: LAB4_SEED_TICKET_NUMBERS } },
        orderBy: { ticketNumber: "asc" },
      });
      const actions = await transaction.actionTaken.findMany({
        where: { description: { in: LAB4_SEED_ACTION_DESCRIPTIONS } },
        orderBy: { id: "asc" },
      });
      const events = await transaction.actionTakenEvent.findMany({
        where: { actionTaken: { description: { in: LAB4_SEED_ACTION_DESCRIPTIONS } } },
        orderBy: { id: "asc" },
      });

      expect(tickets).toEqual(firstTickets);
      expect(stableActionSnapshot(actions)).toEqual(stableActionSnapshot(firstActions));
      expect(events).toEqual(firstEvents);
      expect(actions).toHaveLength(8);
      expect(events).toHaveLength(17);
    });
  });

  it("covers all Ticket and Action statuses, priorities, and ownership cases", async () => {
    await withSeedFixture(async (transaction) => {
      const tickets = await transaction.ticket.findMany({
        where: { ticketNumber: { in: LAB4_SEED_TICKET_NUMBERS } },
        include: {
          requester: true,
          owner: true,
          actions: {
            where: { description: { in: LAB4_SEED_ACTION_DESCRIPTIONS } },
            include: {
              assignee: true,
              createdBy: true,
              performedBy: true,
              cancelledBy: true,
              events: true,
            },
          },
        },
      });

      expect(new Set(tickets.map((ticket) => ticket.status))).toEqual(new Set([
        "NEW",
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_REQUESTER",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
        "CANCELLED",
      ]));
      expect(new Set(tickets.map((ticket) => ticket.requestedPriority))).toEqual(
        new Set(["LOW", "MEDIUM", "HIGH"]),
      );
      expect(new Set(tickets.map((ticket) => ticket.itPriority))).toEqual(
        new Set(["LOW", "MEDIUM", "HIGH"]),
      );
      expect(tickets.some((ticket) => ticket.ownerId === null)).toBe(true);
      expect(tickets.some((ticket) => ticket.ownerId !== null)).toBe(true);

      const actionCounts = tickets.map((ticket) => ticket.actions.length);
      expect(actionCounts).toContain(0);
      expect(actionCounts).toContain(1);
      expect(actionCounts.some((count) => count >= 3)).toBe(true);

      const actions = tickets.flatMap((ticket) => ticket.actions);
      expect(new Set(actions.map((action) => action.status))).toEqual(
        new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      );
      expect(actions.every((action) => action.events.length >= 1)).toBe(true);
      expect(actions.some((action) => action.followUpRequired && action.followUpNote)).toBe(true);
      expect(actions.some((action) => !action.followUpRequired && action.followUpNote === null)).toBe(true);
      expect(actions.some((action) => action.attachmentNotes !== null)).toBe(true);
    });
  });

  it("keeps Ticket owner, Action creator, assignee, and performer independent", async () => {
    await withSeedFixture(async (transaction) => {
      const actions = await transaction.actionTaken.findMany({
        where: { description: { in: LAB4_SEED_ACTION_DESCRIPTIONS } },
        include: {
          ticket: { include: { owner: true } },
          assignee: true,
          createdBy: true,
          performedBy: true,
        },
      });

      const separated = actions.find((action) =>
        action.status === "COMPLETED" &&
        action.ticket.ownerId !== null &&
        action.ticket.ownerId !== action.assigneeId &&
        action.createdById !== action.assigneeId &&
        action.performedById !== null &&
        action.performedById !== action.assigneeId,
      );
      expect(separated).toBeDefined();

      const inactiveHistoricalAssignee = actions.find(
        (action) => !action.assignee.isActive,
      );
      expect(inactiveHistoricalAssignee).toMatchObject({ status: "COMPLETED" });
      expect(inactiveHistoricalAssignee?.performedBy?.isActive).toBe(true);
    });
  });

  it("provides zero and non-zero dashboard fixtures and resolution-gate cases", async () => {
    await withSeedFixture(async (transaction) => {
      const [ari, administrator] = await Promise.all([
        transaction.user.findUniqueOrThrow({ where: { email: "ari.staff@example.com" } }),
        transaction.user.findUniqueOrThrow({ where: { email: "anong.admin@example.com" } }),
      ]);
      const [ariActiveActions, adminActiveActions, ariCompletedActions] = await Promise.all([
        transaction.actionTaken.count({
          where: { assigneeId: ari.id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
        }),
        transaction.actionTaken.count({
          where: { assigneeId: administrator.id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
        }),
        transaction.actionTaken.count({
          where: { performedById: ari.id, status: "COMPLETED" },
        }),
      ]);

      expect(ariActiveActions).toBeGreaterThan(0);
      expect(adminActiveActions).toBe(0);
      expect(ariCompletedActions).toBeGreaterThan(0);

      const tickets = await transaction.ticket.findMany({
        where: { ticketNumber: { in: LAB4_SEED_TICKET_NUMBERS } },
        include: { actions: true },
      });
      expect(tickets.some((ticket) =>
        ticket.actions.filter((action) => action.status === "COMPLETED").length === 0,
      )).toBe(true);
      expect(tickets.some((ticket) =>
        ticket.actions.some((action) => action.status === "COMPLETED") &&
        ticket.actions.some((action) => ["PLANNED", "IN_PROGRESS"].includes(action.status)),
      )).toBe(true);
      expect(tickets.some((ticket) =>
        ticket.actions.some((action) => action.status === "COMPLETED") &&
        ticket.actions.every((action) => !["PLANNED", "IN_PROGRESS"].includes(action.status)),
      )).toBe(true);

      const resolved = tickets.find((ticket) => ticket.status === "RESOLVED");
      const closed = tickets.find((ticket) => ticket.status === "CLOSED");
      expect(resolved?.resolvedAt).toBeInstanceOf(Date);
      expect(closed?.resolvedAt).toBeInstanceOf(Date);
      expect(tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status))
        .every((ticket) => ticket.resolvedAt === null)).toBe(true);
      expect(tickets.every((ticket) => ticket.version === 1)).toBe(true);
    });
  });
});
