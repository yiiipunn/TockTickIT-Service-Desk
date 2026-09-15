import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const migrationPath = new URL(
  "../../prisma/migrations/20260915171500_lab3_user_migration/migration.sql",
  import.meta.url,
);

async function createTemporaryLab2Tables(transaction: Prisma.TransactionClient) {
  await transaction.$executeRawUnsafe(
    'CREATE TEMP TABLE "DevelopmentRequester" ("id" INTEGER, "email" TEXT) ON COMMIT DROP',
  );
  await transaction.$executeRawUnsafe(
    'CREATE TEMP TABLE "Category" ("id" INTEGER) ON COMMIT DROP',
  );
  await transaction.$executeRawUnsafe(
    'CREATE TEMP TABLE "RelatedSystem" ("id" INTEGER) ON COMMIT DROP',
  );
  await transaction.$executeRawUnsafe(`
    CREATE TEMP TABLE "Ticket" (
      "id" INTEGER,
      "requesterId" INTEGER,
      "categoryId" INTEGER,
      "relatedSystemId" INTEGER,
      "requestedPriority" TEXT,
      "status" TEXT
    ) ON COMMIT DROP
  `);
  await transaction.$executeRawUnsafe(
    'CREATE TEMP TABLE "Attachment" ("id" INTEGER, "ticketId" INTEGER) ON COMMIT DROP',
  );
}

describe("Lab 2 to Lab 3 data migration", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
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

    await expect(
      prisma.$transaction(async (transaction) => {
        await createTemporaryLab2Tables(transaction);
        await transaction.$executeRawUnsafe(`
          INSERT INTO "DevelopmentRequester" ("id", "email")
          VALUES (1, ' duplicate@example.com '), (2, 'DUPLICATE@example.com')
        `);
        await transaction.$executeRawUnsafe(guardSql);
      }),
    ).rejects.toThrow(/duplicate normalized requester emails/i);

    await expect(
      prisma.$transaction(async (transaction) => {
        await createTemporaryLab2Tables(transaction);
        await transaction.$executeRawUnsafe(
          `INSERT INTO "Ticket" VALUES (1, 1, 1, 1, 'URGENT', 'NEW')`,
        );
        await transaction.$executeRawUnsafe(guardSql);
      }),
    ).rejects.toThrow(/invalid requested priority/i);

    await expect(
      prisma.$transaction(async (transaction) => {
        await createTemporaryLab2Tables(transaction);
        await transaction.$executeRawUnsafe(
          `INSERT INTO "Ticket" VALUES (1, 1, 1, 1, 'LOW', 'BROKEN')`,
        );
        await transaction.$executeRawUnsafe(guardSql);
      }),
    ).rejects.toThrow(/invalid ticket status/i);

    await expect(
      prisma.$transaction(async (transaction) => {
        await createTemporaryLab2Tables(transaction);
        await transaction.$executeRawUnsafe('INSERT INTO "Category" VALUES (1)');
        await transaction.$executeRawUnsafe('INSERT INTO "RelatedSystem" VALUES (1)');
        await transaction.$executeRawUnsafe(
          `INSERT INTO "Ticket" VALUES (1, 999, 1, 1, 'LOW', 'NEW')`,
        );
        await transaction.$executeRawUnsafe(guardSql);
      }),
    ).rejects.toThrow(/broken Lab 2 relation/i);
  });

  it("keeps the known Lab 2 requester IDs and converts them to Requester users", async () => {
    const migratedUsers = await prisma.user.findMany({
      where: {
        email: {
          in: [
            "narin@example.com",
            "ploy@example.com",
            "beam@example.com",
            "mew@example.com",
            "inactive@example.com",
          ],
        },
      },
      select: { id: true, email: true, role: true, mustChangePassword: true },
      orderBy: { id: "asc" },
    });

    expect(migratedUsers).toEqual([
      { id: 1, email: "narin@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 2, email: "ploy@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 3, email: "beam@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 4, email: "mew@example.com", role: "REQUESTER", mustChangePassword: true },
      { id: 5, email: "inactive@example.com", role: "REQUESTER", mustChangePassword: true },
    ]);
  });

  it("preserves legacy Ticket ownership and initializes workflow fields", async () => {
    const legacyTickets = await prisma.ticket.findMany({
      where: { ticketNumber: { not: { startsWith: "TKT-L3-" } } },
      select: {
        ticketNumber: true,
        requestedPriority: true,
        itPriority: true,
        ownerId: true,
        requesterResolutionIndicatedAt: true,
        requester: { select: { role: true } },
      },
    });

    expect(legacyTickets.length).toBeGreaterThan(0);
    for (const ticket of legacyTickets) {
      expect(ticket.requester.role).toBe("REQUESTER");
      expect(ticket.itPriority).toBe(ticket.requestedPriority);
      expect(ticket.ownerId).toBeNull();
      expect(ticket.requesterResolutionIndicatedAt).toBeNull();
    }
  });

  it("preserves Attachment, Category, and Related System relations", async () => {
    const [attachments, categories, relatedSystems] = await Promise.all([
      prisma.attachment.findMany({
        select: {
          id: true,
          storedFilename: true,
          ticket: { select: { id: true, requesterId: true } },
        },
      }),
      prisma.category.findMany({ include: { tickets: { select: { id: true } } } }),
      prisma.relatedSystem.findMany({ include: { tickets: { select: { id: true } } } }),
    ]);

    expect(attachments.length).toBeGreaterThan(0);
    expect(attachments.every((attachment) => attachment.ticket.id > 0)).toBe(true);
    const storedFileChecks = await Promise.allSettled(
      attachments.map((attachment) =>
        access(resolve("storage/attachments", attachment.storedFilename)),
      ),
    );
    expect(storedFileChecks.some((check) => check.status === "fulfilled")).toBe(true);
    expect(categories.map((category) => category.name).sort()).toEqual([
      "Account and Access",
      "Hardware",
      "Network",
      "Software",
    ]);
    expect(relatedSystems.length).toBeGreaterThanOrEqual(6);

    const ticketNumbers = await prisma.ticket.findMany({ select: { ticketNumber: true } });
    expect(new Set(ticketNumbers.map((ticket) => ticket.ticketNumber)).size).toBe(
      ticketNumbers.length,
    );
  });

  it("constrains every User to exactly one supported role", async () => {
    const enumRows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'UserRole'
      ORDER BY pg_enum.enumsortorder
    `;

    expect(enumRows.map((row) => row.enumlabel)).toEqual([
      "REQUESTER",
      "IT_STAFF",
      "ADMINISTRATOR",
    ]);

    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "User"
          ("name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
        VALUES
          ('Invalid Role', 'invalid-role@example.com', 'not-a-password', 'AUDITOR', true, true, NOW(), NOW())
      `),
    ).rejects.toThrow();
  });
});
