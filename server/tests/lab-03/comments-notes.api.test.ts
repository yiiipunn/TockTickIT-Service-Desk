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
let ticketId = 0;
let requesterId = 0;
let otherRequesterId = 0;
let staffId = 0;
let adminId = 0;
let restrictedId = 0;
let requester: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let otherRequester: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let staff: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let admin: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let restricted: ReturnType<typeof request.agent>;

const publicPath = () => `/api/tickets/${ticketId}/public-comments`;
const internalPath = () => `/api/staff/tickets/${ticketId}/internal-notes`;

describe("Public Comments and Internal Notes API", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const [category, system, requesterUser, otherUser, staffUser, adminUser, restrictedUser] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { name: "Account and Access" } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } }),
      prisma.user.create({ data: { name: "Comment Requester", email: `comment-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Other Requester", email: `other-comment-requester-${suffix}@example.com`, passwordHash, role: "REQUESTER", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Comment Staff", email: `comment-staff-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Comment Administrator", email: `comment-admin-${suffix}@example.com`, passwordHash, role: "ADMINISTRATOR", mustChangePassword: false } }),
      prisma.user.create({ data: { name: "Restricted Comment Staff", email: `comment-restricted-${suffix}@example.com`, passwordHash, role: "IT_STAFF", mustChangePassword: true } }),
    ]);
    requesterId = requesterUser.id;
    otherRequesterId = otherUser.id;
    staffId = staffUser.id;
    adminId = adminUser.id;
    restrictedId = restrictedUser.id;
    const ticket = await prisma.ticket.create({ data: {
      ticketNumber: `TKT-COMMENT-${suffix}`, requesterId, categoryId: category.id,
      relatedSystemId: system.id, summary: "Communication fixture",
      description: "Communication fixture description", requestedPriority: "MEDIUM",
      itPriority: "MEDIUM", status: "OPEN",
    } });
    ticketId = ticket.id;
    [requester, otherRequester, staff, admin] = await Promise.all([
      createAuthenticatedTestClient({ userId: requesterId }),
      createAuthenticatedTestClient({ userId: otherRequesterId }),
      createAuthenticatedTestClient({ userId: staffId }),
      createAuthenticatedTestClient({ userId: adminId }),
    ]);
    restricted = request.agent(app);
    expect((await restricted.post("/api/auth/login").send({ email: restrictedUser.email, password })).status).toBe(200);
  });

  beforeEach(async () => {
    await prisma.publicComment.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
  });

  afterAll(async () => {
    if (!ticketId) return;
    await prisma.publicComment.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
    await prisma.session.deleteMany({ where: { userId: { in: [requesterId, otherRequesterId, staffId, adminId, restrictedId] } } });
    await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.user.deleteMany({ where: { id: { in: [requesterId, otherRequesterId, staffId, adminId, restrictedId] } } });
  });

  it("lets the owning Requester create and retrieve a public comment with server author and time", async () => {
    const created = await requester.post(publicPath()).send({ content: "  Please check this update.  " });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      id: expect.any(Number), ticketId, content: "Please check this update.",
      author: { id: requesterId, name: "Comment Requester", role: "REQUESTER" },
      createdAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(created.body.data.createdAt))).toBe(false);
    expect(Object.keys(created.body.data.author).sort()).toEqual(["id", "name", "role"]);
    const stored = await prisma.publicComment.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(stored.authorId).toBe(requesterId);
    expect(stored.content).toBe("Please check this update.");
    const listed = await requester.get(publicPath());
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([created.body.data]);
  });

  it("lets Staff and Administrator append public comments on a permitted Ticket", async () => {
    const staffPost = await staff.post(publicPath()).send({ content: "Staff update" });
    const adminPost = await admin.post(publicPath()).send({ content: "Administrator update" });
    expect(staffPost.status).toBe(201);
    expect(adminPost.status).toBe(201);
    expect(staffPost.body.data.author).toEqual({ id: staffId, name: "Comment Staff", role: "IT_STAFF" });
    expect(adminPost.body.data.author).toEqual({ id: adminId, name: "Comment Administrator", role: "ADMINISTRATOR" });
    expect((await staff.get(publicPath())).body.items).toHaveLength(2);
    expect((await admin.get(publicPath())).body.items).toHaveLength(2);
  });

  it("returns safe 404 for another Requester and missing Tickets without revealing content", async () => {
    await prisma.publicComment.create({ data: { ticketId, authorId: requesterId, content: "PRIVATE PUBLIC CONTEXT" } });
    expect((await otherRequester.get(publicPath()).set("X-Requester-Id", String(requesterId))).status).toBe(404);
    const deniedPost = await otherRequester.post(publicPath()).set("X-Requester-Id", String(requesterId)).send({ content: "Spoofed" });
    expect(deniedPost.status).toBe(404);
    expect(JSON.stringify(deniedPost.body)).not.toContain("PRIVATE PUBLIC CONTEXT");
    expect((await requester.get("/api/tickets/999999999/public-comments")).status).toBe(404);
    expect((await staff.post("/api/tickets/999999999/public-comments").send({ content: "Missing" })).status).toBe(404);
  });

  it("rejects unauthenticated and password-change-required public requests", async () => {
    expect((await request(app).get(publicPath())).status).toBe(401);
    expect((await request(app).post(publicPath()).send({ content: "No session" })).status).toBe(401);
    expect((await restricted.get(publicPath())).status).toBe(403);
    expect((await restricted.post(publicPath()).send({ content: "Restricted" })).status).toBe(403);
  });

  it("rejects invalid public content, malformed JSON, and client identity or visibility fields", async () => {
    for (const body of [{ content: "" }, { content: " \n " }, { content: "x".repeat(2001) },
      { content: 12 }, {}, [], { content: "Allowed", authorId: staffId },
      { content: "Allowed", role: "IT_STAFF" }, { content: "Allowed", createdAt: "2000-01-01" },
      { content: "Allowed", requesterId }, { content: "Allowed", visibility: "internal" }]) {
      const response = await requester.post(publicPath()).send(body);
      expect(response.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    const malformed = await requester.post(publicPath()).set("Content-Type", "application/json").send('{"content":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.publicComment.count({ where: { ticketId } })).toBe(0);
    expect(await prisma.internalNote.count({ where: { ticketId } })).toBe(0);
  });

  it("accepts 2000 plain-text characters and returns HTML-like text without interpreting it", async () => {
    const content = `<script>alert("unsafe")</script> ${"x".repeat(1967)}`;
    expect(content.length).toBe(2000);
    const created = await requester.post(publicPath()).send({ content });
    expect(created.status).toBe(201);
    expect(created.body.data.content).toBe(content);
  });

  it("lists public comments oldest first with ID as the timestamp tie-breaker", async () => {
    const base = new Date("2026-09-01T00:00:00.000Z");
    const first = await prisma.publicComment.create({ data: { ticketId, authorId: requesterId, content: "First", createdAt: base } });
    const second = await prisma.publicComment.create({ data: { ticketId, authorId: staffId, content: "Second", createdAt: base } });
    const third = await prisma.publicComment.create({ data: { ticketId, authorId: staffId, content: "Third", createdAt: new Date(base.getTime() + 1000) } });
    const listed = await requester.get(publicPath());
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((entry: { id: number }) => entry.id)).toEqual([first.id, second.id, third.id]);
  });

  it("lets Staff and Administrator create and retrieve private notes with server author and time", async () => {
    const staffPost = await staff.post(internalPath()).send({ content: "  Private diagnosis  " });
    const adminPost = await admin.post(internalPath()).send({ content: "Administrative follow-up" });
    expect(staffPost.status).toBe(201);
    expect(adminPost.status).toBe(201);
    expect(staffPost.body.data).toMatchObject({
      ticketId, content: "Private diagnosis",
      author: { id: staffId, name: "Comment Staff", role: "IT_STAFF" },
      createdAt: expect.any(String),
    });
    expect(adminPost.body.data.author.role).toBe("ADMINISTRATOR");
    expect((await prisma.internalNote.findUniqueOrThrow({ where: { id: staffPost.body.data.id } })).authorId).toBe(staffId);
    expect((await staff.get(internalPath())).body.items.map((entry: { id: number }) => entry.id)).toEqual([staffPost.body.data.id, adminPost.body.data.id]);
    expect((await admin.get(internalPath())).body.items).toHaveLength(2);
  });

  it("denies Requesters before note or Ticket lookup, including spoofed roles and query parameters", async () => {
    await prisma.internalNote.create({ data: { ticketId, authorId: staffId, content: "SECRET NOTE CONTENT" } });
    for (const path of [internalPath(), "/api/staff/tickets/999999999/internal-notes", `${internalPath()}?role=IT_STAFF`]) {
      const response = await requester.get(path).set("X-Role", "IT_STAFF");
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain("SECRET NOTE CONTENT");
    }
    const deniedPost = await requester.post(internalPath()).set("X-Role", "IT_STAFF").send({ content: "Spoofed", role: "IT_STAFF", authorId: staffId });
    expect(deniedPost.status).toBe(403);
    expect(JSON.stringify(deniedPost.body)).not.toContain("SECRET NOTE CONTENT");
    expect(await prisma.internalNote.count({ where: { ticketId } })).toBe(1);
  });

  it("denies unauthenticated and password-change-required note requests", async () => {
    expect((await request(app).get(internalPath())).status).toBe(401);
    expect((await request(app).post(internalPath()).send({ content: "No session" })).status).toBe(401);
    expect((await restricted.get(internalPath())).status).toBe(403);
    expect((await restricted.post(internalPath()).send({ content: "Restricted" })).status).toBe(403);
  });

  it("rejects invalid note content, malformed JSON, and client identity fields", async () => {
    for (const body of [{ content: "" }, { content: "  " }, { content: "x".repeat(2001) },
      { content: null }, {}, [], { content: "Allowed", authorId: requesterId },
      { content: "Allowed", role: "ADMINISTRATOR" }, { content: "Allowed", createdAt: "2000-01-01" }]) {
      const response = await staff.post(internalPath()).send(body);
      expect(response.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    const malformed = await staff.post(internalPath()).set("Content-Type", "application/json").send('{"content":');
    expect(malformed.status).toBe(400);
    expect(await prisma.internalNote.count({ where: { ticketId } })).toBe(0);
  });

  it("lists internal notes oldest first with ID as the timestamp tie-breaker", async () => {
    const base = new Date("2026-09-01T00:00:00.000Z");
    const first = await prisma.internalNote.create({ data: { ticketId, authorId: staffId, content: "First note", createdAt: base } });
    const second = await prisma.internalNote.create({ data: { ticketId, authorId: adminId, content: "Second note", createdAt: base } });
    const listed = await staff.get(internalPath());
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((entry: { id: number }) => entry.id)).toEqual([first.id, second.id]);
    expect((await staff.get("/api/staff/tickets/999999999/internal-notes")).status).toBe(404);
  });

  it("keeps notes out of Requester detail and includes both histories only in Staff detail", async () => {
    await prisma.publicComment.create({ data: { ticketId, authorId: requesterId, content: "PUBLIC MARKER" } });
    await prisma.internalNote.create({ data: { ticketId, authorId: staffId, content: "SECRET NOTE CONTENT" } });
    const requesterDetail = await requester.get(`/api/tickets/${ticketId}`);
    expect(requesterDetail.status).toBe(200);
    expect(requesterDetail.body).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(requesterDetail.body)).not.toContain("SECRET NOTE CONTENT");
    const publicList = await requester.get(`${publicPath()}?include=internalNotes`);
    expect(publicList.status).toBe(200);
    expect(JSON.stringify(publicList.body)).not.toContain("SECRET NOTE CONTENT");
    const staffDetail = await staff.get(`/api/staff/tickets/${ticketId}`);
    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body.data.publicComments[0].content).toBe("PUBLIC MARKER");
    expect(staffDetail.body.data.internalNotes[0].content).toBe("SECRET NOTE CONTENT");
    expect(staffDetail.body.data.internalNotes[0].author).toEqual({ id: staffId, name: "Comment Staff", role: "IT_STAFF" });
  });

  it("revokes an inactive Staff session before either communication endpoint can return data", async () => {
    await prisma.internalNote.create({ data: { ticketId, authorId: adminId, content: "INACTIVE STAFF SECRET" } });
    await prisma.user.update({ where: { id: staffId }, data: { isActive: false } });
    try {
      const notes = await staff.get(internalPath());
      expect(notes.status).toBe(401);
      expect(JSON.stringify(notes.body)).not.toContain("INACTIVE STAFF SECRET");
      expect((await staff.get(publicPath())).status).toBe(401);
      expect((await staff.post(internalPath()).send({ content: "Inactive update" })).status).toBe(401);
    } finally {
      await prisma.user.update({ where: { id: staffId }, data: { isActive: true } });
    }
  });
});
