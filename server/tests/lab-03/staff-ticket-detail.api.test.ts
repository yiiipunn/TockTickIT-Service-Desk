import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";

const prisma = getPrisma();
const suffix = randomUUID();
const password = "TokTickIT-Lab3!";
let ticketId: number;
let staffId: number;
let requesterId: number;
let adminId: number;
let restrictedId: number;
let staff: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let requester: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let admin: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let restricted: ReturnType<typeof request.agent>;

const priorityPath = () => `/api/staff/tickets/${ticketId}/it-priority`;
const statusPath = () => `/api/staff/tickets/${ticketId}/status`;
const transition = (currentStatus: string, status: string, confirmed?: boolean) =>
  ({ currentStatus, status, ...(confirmed === undefined ? {} : { confirmed }) });

describe("Staff Ticket priority and status operations", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    // Reference data is read-only: Lab 1 tests assert the exact seeded Category set.
    const [category, system, staffUser, requesterUser, adminUser, restrictedUser] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { name: "Account and Access" } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } }),
      prisma.user.create({ data: { name: "Workflow Staff", email: `workflow-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Workflow Requester", email: `workflow-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Workflow Admin", email: `workflow-admin-${suffix}@example.com`, passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Restricted Staff", email: `workflow-restricted-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: true } }),
    ]);
    staffId = staffUser.id;
    requesterId = requesterUser.id;
    adminId = adminUser.id;
    restrictedId = restrictedUser.id;
    const ticket = await prisma.ticket.create({ data: {
      ticketNumber: `TKT-WORKFLOW-${suffix}`, requesterId, ownerId: staffId,
      ownerAssignedAt: new Date(), categoryId: category.id, relatedSystemId: system.id,
      summary: "Workflow fixture", description: "Workflow fixture description",
      requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "NEW",
    } });
    ticketId = ticket.id;
    [staff, requester, admin] = await Promise.all([
      createAuthenticatedTestClient({ userId: staffId }),
      createAuthenticatedTestClient({ userId: requesterId }),
      createAuthenticatedTestClient({ userId: adminId }),
    ]);
    restricted = request.agent(app);
    expect((await restricted.post("/api/auth/login").send({ email: restrictedUser.email, password })).status).toBe(200);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: [staffId, requesterId, adminId, restrictedId] } } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.user.deleteMany({ where: { id: { in: [staffId, requesterId, adminId, restrictedId] } } });
  });

  beforeEach(async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: {
      status: "NEW", ownerId: staffId, ownerAssignedAt: new Date(),
      requestedPriority: "MEDIUM", itPriority: "MEDIUM", requesterResolutionIndicatedAt: null,
    } });
  });

  it("updates and persists IT Priority while preserving Requested Priority", async () => {
    const response = await staff.patch(priorityPath()).send({ itPriority: "HIGH" });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ requestedPriority: "MEDIUM", itPriority: "HIGH", updatedAt: expect.any(String) });
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { requestedPriority: true, itPriority: true } })).toEqual({ requestedPriority: "MEDIUM", itPriority: "HIGH" });
    expect((await staff.get(`/api/staff/tickets/${ticketId}`)).body.data.itPriority).toBe("HIGH");
    const adminUpdate = await admin.patch(priorityPath()).send({ itPriority: "LOW" });
    expect(adminUpdate.status).toBe(200);
    expect(adminUpdate.body.data.requestedPriority).toBe("MEDIUM");
  });

  it("rejects invalid priority, extra fields, missing resources, and unauthorized actors", async () => {
    for (const body of [{ itPriority: "URGENT" }, { itPriority: null }, { itPriority: "HIGH", requestedPriority: "HIGH" }, {}]) {
      const response = await staff.patch(priorityPath()).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await staff.patch("/api/staff/tickets/999999999/it-priority").send({ itPriority: "HIGH" })).status).toBe(404);
    const malformed = await staff.patch(priorityPath()).set("Content-Type", "application/json").send('{"itPriority":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
    expect((await requester.patch(priorityPath()).set("X-Role", "IT_STAFF").send({ itPriority: "HIGH" })).status).toBe(403);
    expect((await request(app).patch(priorityPath()).send({ itPriority: "HIGH" })).status).toBe(401);
    expect((await restricted.patch(statusPath()).send(transition("NEW", "OPEN"))).status).toBe(403);
    expect((await restricted.patch(priorityPath()).send({ itPriority: "HIGH" })).status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).itPriority).toBe("MEDIUM");
  });

  it("allows every approved transition with an active owner and returns permitted next states", async () => {
    const cases = [
      ["NEW", "OPEN"], ["NEW", "CANCELLED"],
      ["OPEN", "IN_PROGRESS"], ["OPEN", "WAITING_FOR_REQUESTER"], ["OPEN", "RESOLVED"], ["OPEN", "CANCELLED"],
      ["IN_PROGRESS", "WAITING_FOR_REQUESTER"], ["IN_PROGRESS", "RESOLVED"], ["IN_PROGRESS", "CANCELLED"],
      ["WAITING_FOR_REQUESTER", "IN_PROGRESS"], ["WAITING_FOR_REQUESTER", "RESOLVED"], ["WAITING_FOR_REQUESTER", "CANCELLED"],
      ["RESOLVED", "CLOSED"], ["RESOLVED", "REOPENED"], ["CLOSED", "REOPENED"],
      ["REOPENED", "IN_PROGRESS"], ["REOPENED", "WAITING_FOR_REQUESTER"], ["REOPENED", "RESOLVED"], ["REOPENED", "CANCELLED"],
    ] as const;
    for (const [currentStatus, nextStatus] of cases) {
      await prisma.ticket.update({ where: { id: ticketId }, data: { status: currentStatus } });
      const response = await staff.patch(statusPath()).send(transition(currentStatus, nextStatus, ["CLOSED", "CANCELLED"].includes(nextStatus) ? true : undefined));
      expect(response.status, `${currentStatus} -> ${nextStatus}`).toBe(200);
      expect(response.body.data.status).toBe(nextStatus);
      expect(response.body.data.updatedAt).toEqual(expect.any(String));
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe(nextStatus);
    }
    const detail = await staff.get(`/api/staff/tickets/${ticketId}`);
    expect(detail.body.data.allowedTransitions).toEqual([]);
  });

  it("rejects stale, unlisted, terminal, unsupported, unconfirmed, and malformed transitions", async () => {
    expect((await staff.patch(statusPath()).send(transition("OPEN", "RESOLVED"))).status).toBe(409);
    expect((await staff.patch(statusPath()).send(transition("NEW", "RESOLVED"))).status).toBe(409);
    for (const body of [transition("NEW", "BOGUS"), transition("BOGUS", "OPEN"), { status: "OPEN" }, { currentStatus: "NEW", status: "OPEN", role: "ADMINISTRATOR" }, []]) {
      const response = await staff.patch(statusPath()).send(body);
      expect(response.status).toBe(400);
    }
    const malformed = await staff.patch(statusPath()).set("Content-Type", "application/json").send('{"status":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
    expect((await staff.patch(statusPath()).send(transition("NEW", "CANCELLED"))).status).toBe(400);
    expect((await staff.patch(statusPath()).send(transition("NEW", "CLOSED"))).status).toBe(409);
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "RESOLVED" } });
    expect((await staff.patch(statusPath()).send(transition("RESOLVED", "CLOSED"))).status).toBe(400);
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "NEW" } });
    expect((await staff.patch(statusPath()).send(transition("NEW", "CANCELLED", true))).status).toBe(200);
    expect((await staff.patch(statusPath()).send(transition("CANCELLED", "OPEN"))).status).toBe(409);
    expect((await staff.patch("/api/staff/tickets/999999999/status").send(transition("NEW", "OPEN"))).status).toBe(404);
    expect((await staff.patch("/api/staff/tickets/999999999/status").send(transition("NEW", "CANCELLED"))).status).toBe(404);
  });

  it("requires an active owner for progress or resolution and clears indication on reopen", async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "OPEN", ownerId: null, ownerAssignedAt: null } });
    expect((await staff.get(`/api/staff/tickets/${ticketId}`)).body.data.allowedTransitions).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect((await staff.patch(statusPath()).send(transition("OPEN", "IN_PROGRESS"))).status).toBe(409);
    expect((await staff.patch(statusPath()).send(transition("OPEN", "RESOLVED"))).status).toBe(409);
    await prisma.user.update({ where: { id: restrictedId }, data: { isActive: false } });
    await prisma.ticket.update({ where: { id: ticketId }, data: { ownerId: restrictedId } });
    expect((await admin.patch(statusPath()).send(transition("OPEN", "IN_PROGRESS"))).status).toBe(409);
    await prisma.user.update({ where: { id: restrictedId }, data: { isActive: true } });
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED", ownerId: staffId, requesterResolutionIndicatedAt: new Date() } });
    const reopened = await admin.patch(statusPath()).send(transition("CLOSED", "REOPENED"));
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.requesterResolutionIndicatedAt).toBeNull();
    const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(persisted.status).toBe("REOPENED");
    expect(persisted.requesterResolutionIndicatedAt).toBeNull();
  });

  it("enforces role, authentication, and password-change boundaries for status", async () => {
    expect((await requester.patch(statusPath()).set("X-Role", "IT_STAFF").send(transition("NEW", "OPEN"))).status).toBe(403);
    expect((await request(app).patch(statusPath()).send(transition("NEW", "OPEN"))).status).toBe(401);
    expect((await restricted.patch(statusPath()).send(transition("NEW", "OPEN"))).status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe("NEW");
  });

  it("allows only one of two competing transitions from the same current status", async () => {
    const results = await Promise.all([
      staff.patch(statusPath()).send(transition("NEW", "OPEN")),
      admin.patch(statusPath()).send(transition("NEW", "CANCELLED", true)),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(["OPEN", "CANCELLED"]).toContain((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status);
  });
});
