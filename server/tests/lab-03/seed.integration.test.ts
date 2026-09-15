import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LAB3_DEVELOPMENT_INITIAL_PASSWORD,
  LAB3_SEED_USER_EMAILS,
  runSeed,
} from "../../prisma/seed.js";
import { ARGON2_OPTIONS } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const seedTicketPrefix = "TKT-L3-";
let firstUserIds: number[] = [];
let firstUserHashes: string[] = [];
let firstTicketIds: number[] = [];
let firstCounts = { users: 0, tickets: 0, comments: 0, notes: 0 };

describe("Lab 3 seed data", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await runSeed();

    const firstUsers = await prisma.user.findMany({
      where: { email: { in: LAB3_SEED_USER_EMAILS } },
      orderBy: { id: "asc" },
    });
    const firstTickets = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: seedTicketPrefix } },
      orderBy: { id: "asc" },
    });
    firstUserIds = firstUsers.map((user) => user.id);
    firstUserHashes = firstUsers.map((user) => user.passwordHash);
    firstTicketIds = firstTickets.map((ticket) => ticket.id);
    firstCounts = {
      users: firstUsers.length,
      tickets: firstTickets.length,
      comments: await prisma.publicComment.count(),
      notes: await prisma.internalNote.count(),
    };

    await runSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the required active and inactive role distribution", async () => {
    const [activeRequesters, inactiveRequesters, activeStaff, inactiveStaff, activeAdmins] =
      await Promise.all([
        prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
        prisma.user.count({ where: { role: "REQUESTER", isActive: false } }),
        prisma.user.count({ where: { role: "IT_STAFF", isActive: true } }),
        prisma.user.count({ where: { role: "IT_STAFF", isActive: false } }),
        prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } }),
      ]);

    expect(activeRequesters).toBeGreaterThanOrEqual(4);
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
    expect(activeStaff).toBeGreaterThanOrEqual(3);
    expect(inactiveStaff).toBeGreaterThanOrEqual(1);
    expect(activeAdmins).toBeGreaterThanOrEqual(1);
  });

  it("stores only configured Argon2id hashes for seeded passwords", async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: LAB3_SEED_USER_EMAILS } },
    });

    for (const user of users) {
      expect(user.passwordHash).not.toBe(LAB3_DEVELOPMENT_INITIAL_PASSWORD);
      expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
      await expect(
        argon2.verify(user.passwordHash, LAB3_DEVELOPMENT_INITIAL_PASSWORD),
      ).resolves.toBe(true);
      expect(argon2.needsRehash(user.passwordHash, ARGON2_OPTIONS)).toBe(false);
    }
  });

  it("is idempotent for Users, password hashes, Tickets, comments, and notes", async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: LAB3_SEED_USER_EMAILS } },
      orderBy: { id: "asc" },
    });
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: seedTicketPrefix } },
      orderBy: { id: "asc" },
    });

    expect(users.map((user) => user.id)).toEqual(firstUserIds);
    expect(users.map((user) => user.passwordHash)).toEqual(firstUserHashes);
    expect(tickets.map((ticket) => ticket.id)).toEqual(firstTicketIds);
    expect({
      users: users.length,
      tickets: tickets.length,
      comments: await prisma.publicComment.count(),
      notes: await prisma.internalNote.count(),
    }).toEqual(firstCounts);
  });

  it("covers assigned and unassigned Tickets across priorities and statuses", async () => {
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: seedTicketPrefix } },
      include: { requester: true, owner: true },
    });

    expect(tickets).toHaveLength(8);
    expect(tickets.some((ticket) => ticket.ownerId === null)).toBe(true);
    expect(tickets.some((ticket) => ticket.ownerId !== null)).toBe(true);
    expect(new Set(tickets.map((ticket) => ticket.requestedPriority))).toEqual(
      new Set(["LOW", "MEDIUM", "HIGH"]),
    );
    expect(new Set(tickets.map((ticket) => ticket.itPriority))).toEqual(
      new Set(["LOW", "MEDIUM", "HIGH"]),
    );
    expect(new Set(tickets.map((ticket) => ticket.status))).toEqual(
      new Set([
        "NEW",
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_REQUESTER",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
        "CANCELLED",
      ]),
    );
    expect(tickets.every((ticket) => ticket.requester.role === "REQUESTER")).toBe(true);
    expect(
      tickets
        .filter((ticket) => ticket.owner !== null)
        .every((ticket) =>
          ["IT_STAFF", "ADMINISTRATOR"].includes(ticket.owner!.role),
        ),
    ).toBe(true);
  });

  it("links example Public Comments and Internal Notes to authors and a Ticket", async () => {
    const ticket = await prisma.ticket.findUniqueOrThrow({
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
