import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve, sep } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import {
  createAuthenticatedTestClient,
  type AuthenticatedTestClient,
} from "../helpers/authenticated-client.js";

const prisma = getPrisma();
const password = "TokTickIT-Lab3!";
const fixtureKey = randomUUID();
const storageRoot = resolve(process.cwd(), "storage");
const storageDir = resolve(storageRoot, `issue5-authz-${fixtureKey}`);
const previousStorageDir = process.env.ATTACHMENT_STORAGE_DIR;

let requesterApi: AuthenticatedTestClient;
let staffApi: AuthenticatedTestClient;
let administratorApi: AuthenticatedTestClient;
let requesterId: number;
let staffId: number;
let administratorId: number;
let restrictedId: number;
let ticketId: number;
let attachmentId: number;

describe("Lab 3 role authorization foundation", () => {
  beforeAll(async () => {
    if (!storageDir.startsWith(`${storageRoot}${sep}`)) {
      throw new Error("Unsafe authorization test storage path");
    }
    process.env.ATTACHMENT_STORAGE_DIR = storageDir;
    await fs.mkdir(storageDir, { recursive: true });

    const passwordHash = await hashPassword(password);
    const [requesterUser, staffUser, administratorUser, restrictedUser] =
      await Promise.all([
        prisma.user.create({
          data: {
            name: "Issue 5 Requester",
            email: `issue5-requester-${fixtureKey}@example.com`,
            passwordHash,
            role: "REQUESTER",
            isActive: true,
            mustChangePassword: false,
          },
        }),
        prisma.user.create({
          data: {
            name: "Issue 5 IT Staff",
            email: `issue5-staff-${fixtureKey}@example.com`,
            passwordHash,
            role: "IT_STAFF",
            isActive: true,
            mustChangePassword: false,
          },
        }),
        prisma.user.create({
          data: {
            name: "Issue 5 Administrator",
            email: `issue5-admin-${fixtureKey}@example.com`,
            passwordHash,
            role: "ADMINISTRATOR",
            isActive: true,
            mustChangePassword: false,
          },
        }),
        prisma.user.create({
          data: {
            name: "Issue 5 Restricted",
            email: `issue5-restricted-${fixtureKey}@example.com`,
            passwordHash,
            role: "REQUESTER",
            isActive: true,
            mustChangePassword: true,
          },
        }),
      ]);
    requesterId = requesterUser.id;
    staffId = staffUser.id;
    administratorId = administratorUser.id;
    restrictedId = restrictedUser.id;

    const category = await prisma.category.findFirstOrThrow({ orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ orderBy: { id: "asc" } });
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `AUTHZ-${fixtureKey}`,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Authorization fixture",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        description: "Issue 5 authorization fixture",
        status: "NEW",
      },
    });
    ticketId = ticket.id;

    const storedFilename = `${fixtureKey}.pdf`;
    const bytes = Buffer.from("%PDF-1.7\nIssue 5 authorization fixture");
    await fs.writeFile(resolve(storageDir, storedFilename), bytes);
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: "authorization.pdf",
        storedFilename,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
      },
    });
    attachmentId = attachment.id;

    [requesterApi, staffApi, administratorApi] = await Promise.all([
      createAuthenticatedTestClient({ userId: requesterId }),
      createAuthenticatedTestClient({ userId: staffId }),
      createAuthenticatedTestClient({ userId: administratorId }),
    ]);
  });

  afterAll(async () => {
    const userIds = [requesterId, staffId, administratorId, restrictedId].filter(Boolean);
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    if (ticketId) {
      await prisma.attachment.deleteMany({ where: { ticketId } });
      await prisma.ticket.deleteMany({ where: { id: ticketId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await fs.rm(storageDir, { recursive: true, force: true });
    if (previousStorageDir === undefined) {
      delete process.env.ATTACHMENT_STORAGE_DIR;
    } else {
      process.env.ATTACHMENT_STORAGE_DIR = previousStorageDir;
    }
  });

  it("rejects unauthenticated protected requests", async () => {
    for (const path of ["/api/categories", "/api/tickets", `/api/attachments/${attachmentId}`]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("allows reference data for every authenticated role", async () => {
    for (const api of [requesterApi, staffApi, administratorApi]) {
      const [categories, systems] = await Promise.all([
        api.get("/api/categories"),
        api.get("/api/related-systems"),
      ]);
      expect(categories.status).toBe(200);
      expect(systems.status).toBe(200);
    }
  });

  it("allows Requester operations and safely denies Staff/Admin Requester operations", async () => {
    expect((await requesterApi.get("/api/tickets")).status).toBe(200);
    expect((await requesterApi.get(`/api/tickets/${ticketId}`)).status).toBe(200);

    for (const api of [staffApi, administratorApi]) {
      const list = await api.get("/api/tickets");
      const existingDetail = await api.get(`/api/tickets/${ticketId}`);
      const missingDetail = await api.get("/api/tickets/999999999");
      const create = await api.post("/api/tickets").send({});
      const upload = await api
        .post(`/api/tickets/${ticketId}/attachments`)
        .attach("file", Buffer.from("%PDF-1.7\nforbidden"), {
          filename: "forbidden.pdf",
          contentType: "application/pdf",
        });
      const remove = await api
        .delete(`/api/attachments/${attachmentId}`)
        .send({ reason: "Forbidden role" });

      for (const response of [list, existingDetail, missingDetail, create, upload, remove]) {
        expect(response.status).toBe(403);
        expect(response.body.error).toEqual({
          code: "FORBIDDEN",
          message: "You do not have permission to perform this operation.",
        });
      }
      expect(existingDetail.body).toEqual(missingDetail.body);
    }
  });

  it("allows Staff/Admin attachment reads without granting mutation access", async () => {
    for (const api of [staffApi, administratorApi]) {
      const metadata = await api.get(`/api/attachments/${attachmentId}`);
      const download = await api.get(`/api/attachments/${attachmentId}/download`);
      expect(metadata.status).toBe(200);
      expect(metadata.body.data.originalFilename).toBe("authorization.pdf");
      expect(download.status).toBe(200);
      expect(download.headers["content-type"]).toMatch(/application\/pdf/);
    }
  });

  it("ignores spoofed role and requester headers", async () => {
    const response = await staffApi
      .get("/api/tickets")
      .set("X-User-Role", "REQUESTER")
      .set("X-Requester-Id", String(requesterId));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("preserves the mandatory password-change boundary before role checks", async () => {
    const restricted = await prisma.user.findUniqueOrThrow({ where: { id: restrictedId } });
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({
      email: restricted.email,
      password,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
    const response = await agent
      .get("/api/tickets")
      .set("X-User-Role", "REQUESTER");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
});
