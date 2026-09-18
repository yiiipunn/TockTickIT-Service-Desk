import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const requesterEmail = "staff-assignment-requester@example.com";
const eligibleEmail = "staff-assignment-eligible@example.com";
const inactiveEmail = "staff-assignment-inactive@example.com";
let ticketId = 0;
let requesterId = 0;
let eligibleOwnerId = 0;
let inactiveOwnerId = 0;
let actor: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let requester: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;

describe("IT Staff Ticket owner assignment API", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("TokTickIT-Lab3!");
    const [category, relatedSystem, requesterUser, eligibleOwner, inactiveOwner] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { name: "Account and Access" } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } }),
      prisma.user.upsert({
        where: { email: requesterEmail },
        update: { name: "Assignment Requester", passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false },
        create: { name: "Assignment Requester", email: requesterEmail, passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false },
      }),
      prisma.user.upsert({
        where: { email: eligibleEmail },
        update: { name: "Eligible Assignment Staff", passwordHash, role: "IT_STAFF", isActive: true, mustChangePassword: false },
        create: { name: "Eligible Assignment Staff", email: eligibleEmail, passwordHash, role: "IT_STAFF", isActive: true, mustChangePassword: false },
      }),
      prisma.user.upsert({
        where: { email: inactiveEmail },
        update: { name: "Inactive Assignment Staff", passwordHash, role: "IT_STAFF", isActive: false, mustChangePassword: false },
        create: { name: "Inactive Assignment Staff", email: inactiveEmail, passwordHash, role: "IT_STAFF", isActive: false, mustChangePassword: false },
      }),
    ]);
    requesterId = requesterUser.id;
    eligibleOwnerId = eligibleOwner.id;
    inactiveOwnerId = inactiveOwner.id;
    actor = await createAuthenticatedTestClient({ role: "IT_STAFF" });
    requester = await createAuthenticatedTestClient({ userId: requesterId });
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: "TKT-ASSIGNMENT-TEST" },
      update: { requesterId, ownerId: actor.user.id, ownerAssignedAt: new Date(), categoryId: category.id, relatedSystemId: relatedSystem.id, status: "NEW", requestedPriority: "MEDIUM", itPriority: "MEDIUM", summary: "Assignment fixture", description: "Assignment fixture description" },
      create: { ticketNumber: "TKT-ASSIGNMENT-TEST", requesterId, ownerId: actor.user.id, ownerAssignedAt: new Date(), categoryId: category.id, relatedSystemId: relatedSystem.id, status: "NEW", requestedPriority: "MEDIUM", itPriority: "MEDIUM", summary: "Assignment fixture", description: "Assignment fixture description" },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email: { in: [requesterEmail, eligibleEmail, inactiveEmail] } } } });
    await prisma.ticket.deleteMany({ where: { ticketNumber: "TKT-ASSIGNMENT-TEST" } });
    await prisma.user.deleteMany({ where: { email: { in: [requesterEmail, eligibleEmail, inactiveEmail] } } });
  });

  beforeEach(async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { ownerId: actor.user.id, ownerAssignedAt: new Date() },
    });
  });

  it("lists only active Staff/Admin owners and persists reassignment", async () => {
    const owners = await actor.get("/api/staff/eligible-owners");
    expect(owners.status).toBe(200);
    expect(owners.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: actor.user.id, role: "IT_STAFF" }),
      expect.objectContaining({ id: eligibleOwnerId, role: "IT_STAFF" }),
    ]));
    expect(owners.body.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: inactiveOwnerId }),
      expect.objectContaining({ id: requesterId }),
    ]));

    const reassigned = await actor.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ownerId: eligibleOwnerId });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.data.owner).toEqual({ id: eligibleOwnerId, name: "Eligible Assignment Staff" });
    expect(reassigned.body.data.ownerAssignedAt).toEqual(expect.any(String));
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).ownerId).toBe(eligibleOwnerId);
    expect((await actor.get(`/api/staff/tickets/${ticketId}`)).body.data.owner).toEqual({ id: eligibleOwnerId, name: "Eligible Assignment Staff" });
  });

  it("rejects inactive, Requester, and nonexistent assignees without changing ownership", async () => {
    const inactive = await actor.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ownerId: inactiveOwnerId });
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe("VALIDATION_ERROR");

    const requesterAssignee = await actor.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ownerId: requesterId });
    expect(requesterAssignee.status).toBe(400);
    expect(requesterAssignee.body.error.code).toBe("VALIDATION_ERROR");

    const nonexistent = await actor.patch(`/api/staff/tickets/${ticketId}/owner`).send({ ownerId: 999_999_999 });
    expect(nonexistent.status).toBe(404);
    expect(nonexistent.body.error.code).toBe("USER_NOT_FOUND");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).ownerId).toBe(actor.user.id);
  });

  it("rejects a Requester actor even if client headers claim a Staff role", async () => {
    const result = await requester.patch(`/api/staff/tickets/${ticketId}/owner`).set("X-Role", "IT_STAFF").send({ ownerId: eligibleOwnerId });
    expect(result.status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).ownerId).toBe(actor.user.id);
  });
});
