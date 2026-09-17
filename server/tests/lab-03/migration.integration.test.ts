import { access, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const migrationPath = new URL(
  "../../prisma/migrations/20260915171500_lab3_user_migration/migration.sql",
  import.meta.url,
);
const fixtureSchema = `lab3_migration_fixture_${randomUUID().replace(/-/g, "")}`;

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

async function createTemporaryLab2Tables(transaction: Prisma.TransactionClient) {
  await transaction.$executeRawUnsafe('CREATE TEMP TABLE "DevelopmentRequester" ("id" INTEGER, "email" TEXT) ON COMMIT DROP');
  await transaction.$executeRawUnsafe('CREATE TEMP TABLE "Category" ("id" INTEGER) ON COMMIT DROP');
  await transaction.$executeRawUnsafe('CREATE TEMP TABLE "RelatedSystem" ("id" INTEGER) ON COMMIT DROP');
  await transaction.$executeRawUnsafe(`CREATE TEMP TABLE "Ticket" (
    "id" INTEGER, "requesterId" INTEGER, "categoryId" INTEGER,
    "relatedSystemId" INTEGER, "requestedPriority" TEXT, "status" TEXT
  ) ON COMMIT DROP`);
  await transaction.$executeRawUnsafe('CREATE TEMP TABLE "Attachment" ("id" INTEGER, "ticketId" INTEGER) ON COMMIT DROP');
}

async function createMigrationFixture() {
  const migrationSql = await readFile(migrationPath, "utf8");
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${fixtureSchema}"`);

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`SET LOCAL search_path TO "${fixtureSchema}"`);
    await transaction.$executeRawUnsafe(`CREATE TABLE "DevelopmentRequester" (
      "id" INTEGER NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DevelopmentRequester_pkey" PRIMARY KEY ("id")
    )`);
    await transaction.$executeRawUnsafe('CREATE UNIQUE INDEX "DevelopmentRequester_email_key" ON "DevelopmentRequester"("email")');
    await transaction.$executeRawUnsafe('CREATE INDEX "DevelopmentRequester_isActive_idx" ON "DevelopmentRequester"("isActive")');
    await transaction.$executeRawUnsafe('CREATE TABLE "Category" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL)');
    await transaction.$executeRawUnsafe('CREATE TABLE "RelatedSystem" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL)');
    await transaction.$executeRawUnsafe(`CREATE TABLE "Ticket" (
      "id" INTEGER PRIMARY KEY, "ticketNumber" TEXT NOT NULL, "requesterId" INTEGER NOT NULL,
      "categoryId" INTEGER NOT NULL, "relatedSystemId" INTEGER NOT NULL, "summary" TEXT NOT NULL,
      "requestedPriority" TEXT NOT NULL, "description" TEXT NOT NULL, "status" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await transaction.$executeRawUnsafe('CREATE TABLE "Attachment" ("id" INTEGER PRIMARY KEY, "ticketId" INTEGER NOT NULL, "storedFilename" TEXT NOT NULL)');

    await transaction.$executeRawUnsafe(`INSERT INTO "DevelopmentRequester" ("id", "name", "email", "isActive") VALUES
      (1, 'Narin S.', 'narin@example.com', true), (2, 'Ploy K.', 'ploy@example.com', true),
      (3, 'Beam T.', 'beam@example.com', true), (4, 'Mew A.', 'mew@example.com', true),
      (5, 'Inactive User', 'inactive@example.com', false)`);
    await transaction.$executeRawUnsafe(`INSERT INTO "Category" VALUES
      (1, 'Account and Access'), (2, 'Hardware'), (3, 'Network'), (4, 'Software')`);
    await transaction.$executeRawUnsafe(`INSERT INTO "RelatedSystem" VALUES
      (1, 'Email'), (2, 'Campus Wi-Fi'), (3, 'VPN'), (4, 'LEB2 App'),
      (5, 'Grade Submission App'), (6, 'Printer')`);
    await transaction.$executeRawUnsafe(`INSERT INTO "Ticket" (
      "id", "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "summary",
      "requestedPriority", "description", "status"
    ) VALUES (101, 'TKT-000101', 1, 1, 1, 'Fixture Ticket', 'MEDIUM', 'Migration fixture Ticket.', 'NEW')`);
    await transaction.$executeRawUnsafe("INSERT INTO \"Attachment\" VALUES (201, 101, 'migration-fixture.txt')");
    for (const statement of splitMigrationStatements(migrationSql)) {
      await transaction.$executeRawUnsafe(statement);
    }
  });
}

describe("Lab 2 to Lab 3 data migration", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await createMigrationFixture();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
    await prisma.$disconnect();
  });

  it("uses a guarded in-place requester rename without dropping Lab 2 tables", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('ALTER TABLE "DevelopmentRequester" RENAME TO "User"');
    expect(sql).toContain("duplicate normalized requester emails");
    expect(sql).toContain("invalid requested priority");
    expect(sql).toContain("invalid ticket status");
    expect(sql).toContain("broken Lab 2 relation");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/(?:DELETE\s+FROM|TRUNCATE)/i);
    expect(sql).not.toMatch(/UPDATE\s+"Ticket"\s+SET\s+"ticketNumber"/i);
  });

  it("executes migration guards that abort invalid Lab 2 source data", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const guardSql = sql.slice(0, sql.indexOf("-- Rename the requester table"));
    await expect(prisma.$transaction(async (transaction) => {
      await createTemporaryLab2Tables(transaction);
      await transaction.$executeRawUnsafe("INSERT INTO \"DevelopmentRequester\" (\"id\", \"email\") VALUES (1, ' duplicate@example.com '), (2, 'DUPLICATE@example.com')");
      await transaction.$executeRawUnsafe(guardSql);
    })).rejects.toThrow(/duplicate normalized requester emails/i);
    await expect(prisma.$transaction(async (transaction) => {
      await createTemporaryLab2Tables(transaction);
      await transaction.$executeRawUnsafe("INSERT INTO \"Ticket\" VALUES (1, 1, 1, 1, 'URGENT', 'NEW')");
      await transaction.$executeRawUnsafe(guardSql);
    })).rejects.toThrow(/invalid requested priority/i);
    await expect(prisma.$transaction(async (transaction) => {
      await createTemporaryLab2Tables(transaction);
      await transaction.$executeRawUnsafe("INSERT INTO \"Ticket\" VALUES (1, 1, 1, 1, 'LOW', 'BROKEN')");
      await transaction.$executeRawUnsafe(guardSql);
    })).rejects.toThrow(/invalid ticket status/i);
  });

  it("migrates a controlled requester fixture with stable IDs and initial-password state", async () => {
    const users = await prisma.$queryRawUnsafe<Array<{ id: number; email: string; role: string; mustChangePassword: boolean }>>(
      `SELECT "id", "email", "role"::text AS "role", "mustChangePassword" FROM ${fixtureTable("User")} ORDER BY "id"`,
    );
    expect(users).toEqual([
      { id: 1, email: "narin@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 2, email: "ploy@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 3, email: "beam@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 4, email: "mew@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 5, email: "inactive@example.com", role: "REQUESTER", mustChangePassword: true },
    ]);
  });

  it("backfills controlled Ticket workflow fields without changing requester ownership", async () => {
    const [ticket] = await prisma.$queryRawUnsafe<Array<{
      requesterId: number;
      requestedPriority: string;
      itPriority: string;
      ownerId: number | null;
      requesterResolutionIndicatedAt: Date | null;
    }>>(`SELECT "requesterId", "requestedPriority"::text AS "requestedPriority",
      "itPriority"::text AS "itPriority", "ownerId", "requesterResolutionIndicatedAt"
      FROM ${fixtureTable("Ticket")} WHERE "id" = 101`);
    expect(ticket).toMatchObject({
      requesterId: 1,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      ownerId: null,
      requesterResolutionIndicatedAt: null,
    });
  });

  it("preserves controlled Ticket, Attachment, Category, and Related System relations", async () => {
    const [ticket] = await prisma.$queryRawUnsafe<Array<{
      requesterId: number; requestedPriority: string; itPriority: string; ownerId: number | null;
      requesterResolutionIndicatedAt: Date | null; attachmentTicketId: number;
    }>>(`SELECT ticket."requesterId", ticket."requestedPriority"::text AS "requestedPriority",
      ticket."itPriority"::text AS "itPriority", ticket."ownerId", ticket."requesterResolutionIndicatedAt",
      attachment."ticketId" AS "attachmentTicketId"
      FROM ${fixtureTable("Ticket")} ticket
      JOIN ${fixtureTable("Attachment")} attachment ON attachment."ticketId" = ticket."id"`);
    expect(ticket).toMatchObject({
      requesterId: 1, requestedPriority: "MEDIUM", itPriority: "MEDIUM", ownerId: null,
      requesterResolutionIndicatedAt: null, attachmentTicketId: 101,
    });
    const categories = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`SELECT "name" FROM ${fixtureTable("Category")} ORDER BY "name"`);
    const relatedSystems = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`SELECT "name" FROM ${fixtureTable("RelatedSystem")} ORDER BY "id"`);
    expect(categories.map((category) => category.name)).toEqual(["Account and Access", "Hardware", "Network", "Software"]);
    expect(relatedSystems).toHaveLength(6);
    await expect(access(resolve("storage/attachments", "migration-fixture.txt"))).rejects.toThrow();
  });

  it("constrains the fixture User table to exactly one supported role", async () => {
    const roles = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT enum.enumlabel FROM pg_enum enum JOIN pg_type type ON type.oid = enum.enumtypid
       JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
       WHERE type.typname = 'UserRole' AND namespace.nspname = '${fixtureSchema}' ORDER BY enum.enumsortorder`,
    );
    expect(roles.map((role) => role.enumlabel)).toEqual(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]);
    await expect(prisma.$executeRawUnsafe(`INSERT INTO ${fixtureTable("User")}
      ("id", "name", "email", "isActive", "createdAt", "updatedAt", "passwordHash", "role", "mustChangePassword")
      VALUES (9, 'Invalid Role', 'invalid-role@example.com', true, NOW(), NOW(), 'not-a-password', 'AUDITOR', true)`)).rejects.toThrow();
  });
});
