import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const migrationPath = new URL(
  "../../prisma/migrations/20261023120000_lab4_actions_data_model/migration.sql",
  import.meta.url,
);
const fixtureSchema = `lab4_migration_fixture_${randomUUID().replace(/-/g, "")}`;

function fixtureTable(name: string) {
  return `"${fixtureSchema}"."${name}"`;
}

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

async function createLab3Fixture() {
  const migrationSql = await readFile(migrationPath, "utf8");
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${fixtureSchema}"`);

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`SET LOCAL search_path TO "${fixtureSchema}"`);
    await transaction.$executeRawUnsafe(
      'CREATE TYPE "UserRole" AS ENUM (\'REQUESTER\', \'IT_STAFF\', \'ADMINISTRATOR\')',
    );
    await transaction.$executeRawUnsafe(
      'CREATE TYPE "Priority" AS ENUM (\'LOW\', \'MEDIUM\', \'HIGH\')',
    );
    await transaction.$executeRawUnsafe(
      `CREATE TYPE "TicketStatus" AS ENUM (
        'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER',
        'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'
      )`,
    );
    await transaction.$executeRawUnsafe(`CREATE TABLE "User" (
      "id" INTEGER PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" "UserRole" NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await transaction.$executeRawUnsafe(`CREATE TABLE "Ticket" (
      "id" INTEGER PRIMARY KEY,
      "ticketNumber" TEXT NOT NULL,
      "requesterId" INTEGER NOT NULL,
      "ownerId" INTEGER,
      "categoryId" INTEGER NOT NULL,
      "relatedSystemId" INTEGER NOT NULL,
      "summary" TEXT NOT NULL,
      "requestedPriority" "Priority" NOT NULL,
      "itPriority" "Priority" NOT NULL,
      "description" TEXT NOT NULL,
      "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
      "ownerAssignedAt" TIMESTAMP(3),
      "requesterResolutionIndicatedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`);
    await transaction.$executeRawUnsafe(`CREATE TABLE "Attachment" (
      "id" INTEGER PRIMARY KEY, "ticketId" INTEGER NOT NULL,
      "originalFilename" TEXT NOT NULL, "storedFilename" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
      "isRemoved" BOOLEAN NOT NULL DEFAULT false, "removedAt" TIMESTAMP(3),
      "removalReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await transaction.$executeRawUnsafe(`CREATE TABLE "PublicComment" (
      "id" INTEGER PRIMARY KEY, "ticketId" INTEGER NOT NULL,
      "authorId" INTEGER NOT NULL, "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await transaction.$executeRawUnsafe(`CREATE TABLE "InternalNote" (
      "id" INTEGER PRIMARY KEY, "ticketId" INTEGER NOT NULL,
      "authorId" INTEGER NOT NULL, "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    await transaction.$executeRawUnsafe(`INSERT INTO "User"
      ("id", "name", "email", "passwordHash", "role", "isActive") VALUES
      (1, 'Fixture Requester', 'fixture.requester@example.com', 'fixture-hash', 'REQUESTER', true),
      (2, 'Fixture Staff', 'fixture.staff@example.com', 'fixture-hash', 'IT_STAFF', true),
      (3, 'Fixture Administrator', 'fixture.admin@example.com', 'fixture-hash', 'ADMINISTRATOR', true),
      (4, 'Former Staff', 'former.staff@example.com', 'fixture-hash', 'IT_STAFF', false)`);
    await transaction.$executeRawUnsafe(`INSERT INTO "Ticket"
      ("id", "ticketNumber", "requesterId", "ownerId", "categoryId", "relatedSystemId",
       "summary", "requestedPriority", "itPriority", "description", "status", "updatedAt") VALUES
      (101, 'TKT-L4-FIXTURE-OPEN', 1, 2, 1, 1, 'Open fixture', 'MEDIUM', 'HIGH',
       'Existing open Ticket.', 'OPEN', '2026-10-20T01:00:00.000Z'),
      (102, 'TKT-L4-FIXTURE-RESOLVED', 1, 2, 1, 1, 'Resolved fixture', 'LOW', 'MEDIUM',
       'Existing resolved Ticket.', 'RESOLVED', '2026-10-19T02:00:00.000Z'),
      (103, 'TKT-L4-FIXTURE-CLOSED', 1, 3, 1, 1, 'Closed fixture', 'HIGH', 'HIGH',
       'Existing closed Ticket.', 'CLOSED', '2026-10-18T03:00:00.000Z')`);
    await transaction.$executeRawUnsafe(`INSERT INTO "Attachment"
      ("id", "ticketId", "originalFilename", "storedFilename", "mimeType", "sizeBytes")
      VALUES (201, 101, 'fixture.txt', 'fixture-stored.txt', 'text/plain', 12)`);
    await transaction.$executeRawUnsafe(`INSERT INTO "PublicComment"
      ("id", "ticketId", "authorId", "content")
      VALUES (301, 101, 1, 'Existing public comment.')`);
    await transaction.$executeRawUnsafe(`INSERT INTO "InternalNote"
      ("id", "ticketId", "authorId", "content")
      VALUES (401, 101, 2, 'Existing internal note.')`);

    for (const statement of splitMigrationStatements(migrationSql)) {
      await transaction.$executeRawUnsafe(statement);
    }
  });
}

describe("Lab 3 to Lab 4 Actions Taken migration", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await createLab3Fixture();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await prisma.$disconnect();
  });

  it("is additive and contains the approved deterministic backfill", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain('ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1');
    expect(sql).toContain('ADD COLUMN "resolvedAt" TIMESTAMP(3)');
    expect(sql).toContain('SET "resolvedAt" = "updatedAt"');
    expect(sql).toContain("WHERE \"status\" IN ('RESOLVED', 'CLOSED')");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(sql).not.toMatch(/(?:DELETE\s+FROM|TRUNCATE)/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"(?:User|Ticket|Attachment|PublicComment|InternalNote)"\s+RENAME/i);
  });

  it("preserves legacy rows, IDs, relations, and scalar content", async () => {
    const tickets = await prisma.$queryRawUnsafe<Array<{
      id: number;
      ticketNumber: string;
      status: string;
      version: number;
      updatedAt: Date;
      resolvedAt: Date | null;
    }>>(`SELECT "id", "ticketNumber", "status"::text AS "status", "version",
      "updatedAt", "resolvedAt" FROM ${fixtureTable("Ticket")} ORDER BY "id"`);

    expect(tickets).toHaveLength(3);
    expect(tickets.map((ticket) => ticket.id)).toEqual([101, 102, 103]);
    expect(tickets.every((ticket) => ticket.version === 1)).toBe(true);
    expect(tickets[0].resolvedAt).toBeNull();
    expect(tickets[1].resolvedAt).toEqual(tickets[1].updatedAt);
    expect(tickets[2].resolvedAt).toEqual(tickets[2].updatedAt);

    const counts = await prisma.$queryRawUnsafe<Array<{
      attachments: bigint;
      comments: bigint;
      notes: bigint;
      actions: bigint;
      actionEvents: bigint;
      workflowEvents: bigint;
    }>>(`SELECT
      (SELECT count(*) FROM ${fixtureTable("Attachment")}) AS attachments,
      (SELECT count(*) FROM ${fixtureTable("PublicComment")}) AS comments,
      (SELECT count(*) FROM ${fixtureTable("InternalNote")}) AS notes,
      (SELECT count(*) FROM ${fixtureTable("ActionTaken")}) AS actions,
      (SELECT count(*) FROM ${fixtureTable("ActionTakenEvent")}) AS "actionEvents",
      (SELECT count(*) FROM ${fixtureTable("TicketWorkflowEvent")}) AS "workflowEvents"`);

    expect(counts[0]).toEqual({
      attachments: 1n,
      comments: 1n,
      notes: 1n,
      actions: 0n,
      actionEvents: 0n,
      workflowEvents: 0n,
    });
  });

  it("creates the contracted enums and query indexes", async () => {
    const actionStatuses = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT enum.enumlabel FROM pg_enum enum
       JOIN pg_type type ON type.oid = enum.enumtypid
       JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
       WHERE type.typname = 'ActionStatus' AND namespace.nspname = '${fixtureSchema}'
       ORDER BY enum.enumsortorder`,
    );
    expect(actionStatuses.map((row) => row.enumlabel)).toEqual([
      "PLANNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ]);

    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = '${fixtureSchema}'`,
    );
    const names = new Set(indexes.map((index) => index.indexname));
    for (const expectedName of [
      "ActionTaken_ticketId_actionAt_id_idx",
      "ActionTaken_assigneeId_status_actionAt_id_idx",
      "ActionTaken_performedById_completedAt_id_idx",
      "ActionTakenEvent_actionTakenId_createdAt_id_idx",
      "TicketWorkflowEvent_ticketId_createdAt_id_idx",
    ]) {
      expect(names.has(expectedName)).toBe(true);
    }
  });

  it("enforces required fields, defaults, follow-up rules, and terminal metadata", async () => {
    const [action] = await prisma.$queryRawUnsafe<Array<{
      id: number;
      status: string;
      version: number;
      followUpRequired: boolean;
    }>>(`INSERT INTO ${fixtureTable("ActionTaken")}
      ("ticketId", "actionAt", "description", "assigneeId", "createdById", "updatedAt")
      VALUES (101, '2026-10-24T02:00:00.000Z', 'Inspect the fixture Ticket.', 2, 3, NOW())
      RETURNING "id", "status"::text AS "status", "version", "followUpRequired"`);

    expect(action).toMatchObject({ status: "PLANNED", version: 1, followUpRequired: false });

    await expect(prisma.$executeRawUnsafe(`INSERT INTO ${fixtureTable("ActionTaken")}
      ("ticketId", "actionAt", "description", "assigneeId", "createdById",
       "followUpRequired", "updatedAt")
      VALUES (101, NOW(), 'Missing follow-up note.', 2, 2, true, NOW())`)).rejects.toThrow();

    await expect(prisma.$executeRawUnsafe(`INSERT INTO ${fixtureTable("ActionTaken")}
      ("ticketId", "actionAt", "description", "status", "assigneeId", "createdById",
       "updatedAt")
      VALUES (101, NOW(), 'Invalid completion.', 'COMPLETED', 2, 2, NOW())`)).rejects.toThrow();

    await expect(prisma.$executeRawUnsafe(`INSERT INTO ${fixtureTable("ActionTaken")}
      ("ticketId", "actionAt", "description", "assigneeId", "createdById", "updatedAt")
      VALUES (9999, NOW(), 'Broken parent.', 2, 2, NOW())`)).rejects.toThrow();

    await prisma.$executeRawUnsafe(`INSERT INTO ${fixtureTable("ActionTakenEvent")}
      ("actionTakenId", "actorId", "eventType", "toStatus", "toAssigneeId", "snapshot")
      VALUES (${action.id}, 3, 'CREATED', 'PLANNED', 2, '{"source":"fixture"}'::jsonb)`);
    await prisma.$executeRawUnsafe(`INSERT INTO ${fixtureTable("TicketWorkflowEvent")}
      ("ticketId", "actorId", "eventType", "fromOwnerId", "toOwnerId")
      VALUES (101, 3, 'OWNER_CHANGED', NULL, 2)`);

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM ${fixtureTable("ActionTaken")} WHERE "id" = ${action.id}`),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM ${fixtureTable("User")} WHERE "id" = 2`),
    ).rejects.toThrow();
  });
});
