import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";

const prisma = getPrisma();
const suffix = randomUUID();
const password = "TokTickIT-Admin!";
const origin = "http://localhost:5173";
let administratorId = 0;
let secondAdministratorId = 0;
let requesterId = 0;
let staffId = 0;
let restrictedAdministratorId = 0;
let administrator: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let requester: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let staff: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let restricted: ReturnType<typeof request.agent>;
const createdUserIds: number[] = [];
const createdTicketIds: number[] = [];

const usersPath = "/api/admin/users";
const makeEmail = (label: string) => `${label}-${suffix}@example.com`;

async function createUser(data: Partial<{ name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean }> = {}) {
  const response = await administrator.post(usersPath).send({
    name: data.name ?? "Managed User",
    email: data.email ?? makeEmail(`managed-${createdUserIds.length}`),
    role: data.role ?? "REQUESTER",
    isActive: data.isActive ?? true,
    initialPassword: password,
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.data.id);
  return response.body.data as { id: number; email: string };
}

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const users = await Promise.all([
    prisma.user.create({ data: { name: "Admin Manager", email: makeEmail("admin"), passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Second Admin", email: makeEmail("second-admin"), passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Managed Requester", email: makeEmail("requester"), passwordHash, role: "REQUESTER", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Managed Staff", email: makeEmail("staff"), passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
    prisma.user.create({ data: { name: "Restricted Admin", email: makeEmail("restricted"), passwordHash, role: "ADMINISTRATOR", mustChangePassword: true } }),
  ]);
  [administratorId, secondAdministratorId, requesterId, staffId, restrictedAdministratorId] = users.map((user) => user.id);
  [administrator, requester, staff] = await Promise.all([
    createAuthenticatedTestClient({ userId: administratorId }),
    createAuthenticatedTestClient({ userId: requesterId }),
    createAuthenticatedTestClient({ userId: staffId }),
  ]);
  restricted = request.agent(app);
  expect((await restricted.post("/api/auth/login").send({ email: makeEmail("restricted"), password })).status).toBe(200);
});

beforeEach(async () => {
  const ids = createdUserIds.splice(0);
  if (ids.length) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds.splice(0) } } });
    await prisma.ticket.deleteMany({ where: { requesterId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

afterAll(async () => {
  const ids = [administratorId, secondAdministratorId, requesterId, staffId, restrictedAdministratorId, ...createdUserIds];
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { requesterId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("Administrator User Management API", () => {
  it("lists safe Users with search and one role filter", async () => {
    const listed = await administrator.get(`${usersPath}?search=managed%20staff&role=IT_STAFF`);
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: staffId, name: "Managed Staff", role: "IT_STAFF" })]));
    expect(JSON.stringify(listed.body)).not.toContain("passwordHash");
    expect(JSON.stringify(listed.body)).not.toContain("csrfToken");
    expect((await administrator.get(`${usersPath}?role=INVALID`)).status).toBe(400);
    expect((await administrator.get(`${usersPath}?page=2`)).status).toBe(400);
  });

  it("enforces Administrator access and the password-change boundary before listing", async () => {
    expect((await request(app).get(usersPath)).status).toBe(401);
    expect((await requester.get(usersPath)).status).toBe(403);
    expect((await staff.get(usersPath)).status).toBe(403);
    expect((await restricted.get(usersPath)).status).toBe(403);
  });

  it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const)("creates a %s with a hashed initial password", async (role) => {
    const email = makeEmail(`new-${role.toLowerCase()}`);
    const response = await administrator.post(usersPath).send({ name: `New ${role}`, email: `  ${email.toUpperCase()} `, role, isActive: true, initialPassword: password });
    expect(response.status).toBe(201);
    createdUserIds.push(response.body.data.id);
    expect(response.body.data).toMatchObject({ name: `New ${role}`, email, role, isActive: true, mustChangePassword: true });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(await verifyPassword(stored.passwordHash, password)).toBe(true);
  });

  it("rejects duplicate, malformed, invalid-role, and invalid-password creation without mass assignment", async () => {
    const duplicate = await administrator.post(usersPath).send({ name: "Duplicate", email: makeEmail("staff"), role: "REQUESTER", isActive: true, initialPassword: password });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_EMAIL");
    for (const body of [
      { name: "", email: "bad", role: "MULTI", isActive: "yes", initialPassword: "short" },
      { name: "Okay", email: makeEmail("unknown"), role: "REQUESTER", isActive: true, initialPassword: password, passwordHash: "forged" },
      { name: "Okay", email: makeEmail("missing"), role: ["REQUESTER", "IT_STAFF"], isActive: true, initialPassword: password },
    ]) {
      const response = await administrator.post(usersPath).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("edits permitted User fields, normalizes email, and rejects duplicate or unknown fields", async () => {
    const target = await createUser({ name: "Before Edit", role: "REQUESTER" });
    const update = await administrator.patch(`${usersPath}/${target.id}`).send({ name: "  After Edit  ", email: ` ${makeEmail("edited").toUpperCase()} `, role: "IT_STAFF", isActive: true });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ id: target.id, name: "After Edit", email: makeEmail("edited"), role: "IT_STAFF", isActive: true });
    const duplicate = await administrator.patch(`${usersPath}/${target.id}`).send({ email: makeEmail("staff") });
    expect(duplicate.status).toBe(409);
    expect((await administrator.patch(`${usersPath}/${target.id}`).send({ role: "REQUESTER", ownerId: administratorId })).status).toBe(400);
    expect((await administrator.patch(`${usersPath}/999999999`).send({ name: "Missing" })).status).toBe(404);
  });

  it("deactivates a User without deleting their Ticket history and revokes sessions", async () => {
    const target = await createUser({ role: "IT_STAFF" });
    const category = await prisma.category.findUniqueOrThrow({ where: { name: "Account and Access" } });
    const system = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } });
    const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-ADMIN-${suffix}`, requesterId, ownerId: target.id, ownerAssignedAt: new Date(), categoryId: category.id, relatedSystemId: system.id, summary: "Keep this history", description: "Test", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "OPEN" } });
    createdTicketIds.push(ticket.id);
    const targetAgent = request.agent(app);
    expect((await targetAgent.post("/api/auth/login").send({ email: target.email, password })).status).toBe(200);
    const deactivate = await administrator.patch(`${usersPath}/${target.id}`).send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBeNull();
    expect((await targetAgent.get("/api/auth/me")).status).toBe(401);
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
  });

  it("rejects self-deactivation server-side", async () => {
    const response = await administrator.patch(`${usersPath}/${administratorId}`).send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SELF_DEACTIVATION");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: administratorId } })).isActive).toBe(true);
  });

  it("allows an Admin role change when another active Administrator remains", async () => {
    const response = await administrator.patch(`${usersPath}/${secondAdministratorId}`).send({ role: "IT_STAFF" });
    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe("IT_STAFF");
    await prisma.user.update({ where: { id: secondAdministratorId }, data: { role: "ADMINISTRATOR" } });
  });

  it("sets a new initial password, revokes prior sessions, and forces password change at next sign-in", async () => {
    const target = await createUser();
    const initial = await administrator.post(`${usersPath}/${target.id}/initial-password`).send({ initialPassword: "NewInitialPassword!" });
    expect(initial.status).toBe(200);
    expect(initial.body.data).toEqual({ userId: target.id, mustChangePassword: true });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(await verifyPassword(stored.passwordHash, "NewInitialPassword!")).toBe(true);
    const login = await request(app).post("/api/auth/login").send({ email: target.email, password: "NewInitialPassword!" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
    expect((await request(app).post("/api/auth/login").send({ email: target.email, password })).status).toBe(401);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: target.email, password: "NewInitialPassword!" });
    expect((await agent.get(usersPath)).status).toBe(403);
    expect((await administrator.post(`${usersPath}/${target.id}/initial-password`).send({ initialPassword: "short" })).status).toBe(400);
  });
});
