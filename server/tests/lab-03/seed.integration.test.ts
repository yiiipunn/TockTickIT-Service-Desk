import argon2 from "argon2";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LAB3_DEVELOPMENT_INITIAL_PASSWORD,
  LAB3_SEED_USER_EMAILS,
  runSeed,
} from "../../prisma/seed.js";
import { ARGON2_OPTIONS, hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const seedTicketPrefix = "TKT-L3-";

class RollbackSeedFixture extends Error {}

async function withSeedFixture<T>(
  assertion: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  const rollback = new RollbackSeedFixture();
  let result: T | undefined;

  try {
    await prisma.$transaction(async (transaction) => {
      // Establish the documented initial-credential state only inside a
      // transaction. Rolling it back preserves manual development changes.
      await runSeed(transaction);
      await transaction.user.updateMany({
        where: { email: { in: LAB3_SEED_USER_EMAILS } },
        data: {
          passwordHash: await hashPassword(LAB3_DEVELOPMENT_INITIAL_PASSWORD),
          mustChangePassword: true,
        },
      });
      await runSeed(transaction);
      result = await assertion(transaction);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }

  return result as T;
}

describe("Lab 3 seed data", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the required active and inactive role distribution", async () => {
    await withSeedFixture(async (transaction) => {
      const [activeRequesters, inactiveRequesters, activeStaff, inactiveStaff, activeAdmins] =
        await Promise.all([
          transaction.user.count({ where: { role: "REQUESTER", isActive: true } }),
          transaction.user.count({ where: { role: "REQUESTER", isActive: false } }),
          transaction.user.count({ where: { role: "IT_STAFF", isActive: true } }),
          transaction.user.count({ where: { role: "IT_STAFF", isActive: false } }),
          transaction.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }),
        ]);

      expect(activeRequesters).toBeGreaterThanOrEqual(4);
      expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
      expect(activeStaff).toBeGreaterThanOrEqual(3);
      expect(inactiveStaff).toBeGreaterThanOrEqual(1);
      expect(activeAdmins).toBeGreaterThanOrEqual(1);
    });
  });

  it("stores only configured Argon2id hashes for documented initial passwords", async () => {
    await withSeedFixture(async (transaction) => {
      const users = await transaction.user.findMany({
        where: { email: { in: LAB3_SEED_USER_EMAILS } },
      });

      for (const user of users) {
        expect(user.passwordHash).not.toBe(LAB3_DEVELOPMENT_INITIAL_PASSWORD);
        expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
        await expect(
          argon2.verify(user.passwordHash, LAB3_DEVELOPMENT_INITIAL_PASSWORD),
        ).resolves.toBe(true);
        expect(argon2.needsRehash(user.passwordHash, ARGON2_OPTIONS)).toBe(false);
        expect(user.mustChangePassword).toBe(true);
      }
    });
  });

  it("is idempotent for Users, credentials, Tickets, comments, and notes", async () => {
    await withSeedFixture(async (transaction) => {
      const firstUsers = await transaction.user.findMany({
        where: { email: { in: LAB3_SEED_USER_EMAILS } },
        orderBy: { id: "asc" },
      });
      const firstTickets = await transaction.ticket.findMany({
        where: { ticketNumber: { startsWith: seedTicketPrefix } },
        orderBy: { id: "asc" },
      });
      const firstCounts = {
        users: firstUsers.length,
        tickets: firstTickets.length,
        comments: await transaction.publicComment.count(),
        notes: await transaction.internalNote.count(),
      };

      await runSeed(transaction);

      const users = await transaction.user.findMany({
        where: { email: { in: LAB3_SEED_USER_EMAILS } },
        orderBy: { id: "asc" },
      });
      const tickets = await transaction.ticket.findMany({
        where: { ticketNumber: { startsWith: seedTicketPrefix } },
        orderBy: { id: "asc" },
      });

      expect(users.map((user) => user.id)).toEqual(firstUsers.map((user) => user.id));
      expect(users.map((user) => user.passwordHash)).toEqual(firstUsers.map((user) => user.passwordHash));
      expect(users.map((user) => user.mustChangePassword)).toEqual(firstUsers.map((user) => user.mustChangePassword));
      expect(tickets.map((ticket) => ticket.id)).toEqual(firstTickets.map((ticket) => ticket.id));
      expect({
        users: users.length,
        tickets: tickets.length,
        comments: await transaction.publicComment.count(),
        notes: await transaction.internalNote.count(),
      }).toEqual(firstCounts);
    });
  });

  it("covers assigned and unassigned Tickets across priorities and statuses", async () => {
    await withSeedFixture(async (transaction) => {
      const tickets = await transaction.ticket.findMany({
        where: { ticketNumber: { startsWith: seedTicketPrefix } },
        include: { requester: true, owner: true },
      });

      expect(tickets).toHaveLength(8);
      expect(tickets.some((ticket) => ticket.ownerId === null)).toBe(true);
      expect(tickets.some((ticket) => ticket.ownerId !== null)).toBe(true);
      expect(new Set(tickets.map((ticket) => ticket.requestedPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
      expect(new Set(tickets.map((ticket) => ticket.itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
      expect(new Set(tickets.map((ticket) => ticket.status))).toEqual(new Set([
        "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER",
        "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
      ]));
      expect(tickets.every((ticket) => ticket.requester.role === "REQUESTER")).toBe(true);
      expect(tickets.filter((ticket) => ticket.owner !== null).every((ticket) =>
        ["IT_STAFF", "ADMINISTRATOR"].includes(ticket.owner!.role),
      )).toBe(true);
    });
  });

  it("links example Public Comments and Internal Notes to authors and a Ticket", async () => {
    await withSeedFixture(async (transaction) => {
      const ticket = await transaction.ticket.findUniqueOrThrow({
        where: { ticketNumber: "TKT-L3-000005" },
        include: {
          publicComments: { include: { author: true } },
          internalNotes: { include: { author: true } },
        },
      });

      expect(ticket.publicComments).toHaveLength(1);
      expect(ticket.publicComments[0].author.role).toBe("REQUESTER");
      expect(ticket.internalNotes).toHaveLength(1);
      expect(ticket.internalNotes[0].author.role).toBe("IT_STAFF");
      expect(ticket.publicComments[0].createdAt).toBeInstanceOf(Date);
      expect(ticket.internalNotes[0].createdAt).toBeInstanceOf(Date);
    });
  });
});
