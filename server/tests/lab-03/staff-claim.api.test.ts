import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const requesterEmail = "staff-claim-requester@example.com";
let ticketId = 0;
let requesterId = 0;
let staff: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let requester: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;

describe("IT Staff Ticket Claim API", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("TokTickIT-Lab3!");
    const [category, relatedSystem, user] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { name: "Account and Access" } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } }),
      prisma.user.upsert({
        where: { email: requesterEmail },
        update: { name: "Staff Claim Requester", passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false },
        create: { name: "Staff Claim Requester", email: requesterEmail, passwordHash, role: "REQUESTER", isActive: true, mustChangePassword: false },
      }),
    ]);
    requesterId = user.id;
    staff = await createAuthenticatedTestClient({ role: "IT_STAFF" });
    requester = await createAuthenticatedTestClient({ userId: user.id });
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: "TKT-CLAIM-TEST" },
      update: { requesterId, ownerId: null, ownerAssignedAt: null, categoryId: category.id, relatedSystemId: relatedSystem.id, status: "NEW", requestedPriority: "MEDIUM", itPriority: "MEDIUM", summary: "Claim fixture", description: "Claim fixture description" },
      create: { ticketNumber: "TKT-CLAIM-TEST", requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id, status: "NEW", requestedPriority: "MEDIUM", itPriority: "MEDIUM", summary: "Claim fixture", description: "Claim fixture description" },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { user: { email: requesterEmail } } });
    await prisma.ticket.deleteMany({ where: { ticketNumber: "TKT-CLAIM-TEST" } });
    await prisma.user.deleteMany({ where: { email: requesterEmail } });
  });

  beforeEach(async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { ownerId: null, ownerAssignedAt: null },
    });
  });

  it("returns unassigned detail, then atomically assigns the authenticated Staff claimant", async () => {
    const detail = await staff.get(`/api/staff/tickets/${ticketId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.owner).toBeNull();
    expect(detail.body.data.requestedPriority).toBe("MEDIUM");
    expect(detail.body.data.itPriority).toBe("MEDIUM");

    const claim = await staff.post(`/api/staff/tickets/${ticketId}/claim`).send({});
    expect(claim.status).toBe(200);
    expect(claim.body.data.owner).toEqual({ id: staff.user.id, name: staff.user.name });
    expect(claim.body.data.ownerAssignedAt).toEqual(expect.any(String));
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(stored.ownerId).toBe(staff.user.id);
    expect((await staff.get(`/api/staff/tickets/${ticketId}`)).body.data.owner.id).toBe(staff.user.id);
  });

  it("rejects a second claim and Requester access without trusting spoofed roles", async () => {
    expect((await staff.post(`/api/staff/tickets/${ticketId}/claim`).send({})).status).toBe(200);
    const conflict = await staff.post(`/api/staff/tickets/${ticketId}/claim`).send({});
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("OWNER_CONFLICT");
    const forbiddenDetail = await requester.get(`/api/staff/tickets/${ticketId}`).set("X-Role", "IT_STAFF");
    const forbiddenClaim = await requester.post(`/api/staff/tickets/${ticketId}/claim`).set("X-Role", "IT_STAFF").send({});
    expect(forbiddenDetail.status).toBe(403);
    expect(forbiddenClaim.status).toBe(403);
  });

  it("rejects missing authentication", async () => {
    expect((await request(app).post(`/api/staff/tickets/${ticketId}/claim`).send({})).status).toBe(401);
  });
});
