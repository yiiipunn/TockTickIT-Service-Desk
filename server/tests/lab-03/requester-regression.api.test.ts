import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";
import {
  createAuthenticatedTestClient,
  type AuthenticatedTestClient,
} from "../helpers/authenticated-client.js";

const prisma = getPrisma();
const fixtureKey = randomUUID();
const storageRoot = resolve(process.cwd(), "storage");
const storageDir = resolve(storageRoot, `issue5-requester-${fixtureKey}`);
const previousStorageDir = process.env.ATTACHMENT_STORAGE_DIR;
const PNG_FILE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("Issue 5 requester attachment"),
]);

let requesterAApi: AuthenticatedTestClient;
let requesterBApi: AuthenticatedTestClient;
let requesterAId: number;
let requesterBId: number;
let categoryId: number;
let relatedSystemId: number;
let requesterATicketId: number;
let requesterBTicketId: number;

describe("Lab 3 authenticated Requester regression", () => {
  beforeAll(async () => {
    if (!storageDir.startsWith(`${storageRoot}${sep}`)) {
      throw new Error("Unsafe requester regression storage path");
    }
    process.env.ATTACHMENT_STORAGE_DIR = storageDir;
    await fs.mkdir(storageDir, { recursive: true });

    const passwordHash = await hashPassword("TokTickIT-Lab3!");
    const [requesterA, requesterB] = await Promise.all([
      prisma.user.create({
        data: {
          name: "Issue 5 Requester A",
          email: `issue5-a-${fixtureKey}@example.com`,
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
        },
      }),
      prisma.user.create({
        data: {
          name: "Issue 5 Requester B",
          email: `issue5-b-${fixtureKey}@example.com`,
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ]);
    requesterAId = requesterA.id;
    requesterBId = requesterB.id;

    const category = await prisma.category.findFirstOrThrow({ orderBy: { id: "asc" } });
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ orderBy: { id: "asc" } });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const [ticketA, ticketB] = await Promise.all([
      prisma.ticket.create({
        data: {
          ticketNumber: `REQ-A-${fixtureKey}`,
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "Requester A existing ticket",
          requestedPriority: "HIGH",
          itPriority: "HIGH",
          description: "Existing data owned by requester A",
          status: "NEW",
        },
      }),
      prisma.ticket.create({
        data: {
          ticketNumber: `REQ-B-${fixtureKey}`,
          requesterId: requesterBId,
          categoryId,
          relatedSystemId,
          summary: "Requester B private ticket",
          requestedPriority: "LOW",
          itPriority: "LOW",
          description: "Existing data owned by requester B",
          status: "NEW",
        },
      }),
    ]);
    requesterATicketId = ticketA.id;
    requesterBTicketId = ticketB.id;

    [requesterAApi, requesterBApi] = await Promise.all([
      createAuthenticatedTestClient({ userId: requesterAId }),
      createAuthenticatedTestClient({ userId: requesterBId }),
    ]);
  });

  afterAll(async () => {
    const userIds = [requesterAId, requesterBId].filter(Boolean);
    const ticketIds = await prisma.ticket.findMany({
      where: { requesterId: { in: userIds } },
      select: { id: true },
    });
    const ids = ticketIds.map(({ id }) => id);
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await fs.rm(storageDir, { recursive: true, force: true });
    if (previousStorageDir === undefined) {
      delete process.env.ATTACHMENT_STORAGE_DIR;
    } else {
      process.env.ATTACHMENT_STORAGE_DIR = previousStorageDir;
    }
  });

  it("creates a Ticket from session identity and ignores supplied requester identity", async () => {
    const response = await requesterAApi
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterBId))
      .set("X-User-Role", "ADMINISTRATOR")
      .send({
        requesterId: requesterBId,
        categoryId,
        relatedSystemId,
        summary: "Session-owned ticket",
        requestedPriority: "MEDIUM",
        description: "Client-supplied identity must be ignored.",
      });

    expect(response.status).toBe(201);
    expect(response.body.requesterId).toBe(requesterAId);
    expect(response.body.requesterId).not.toBe(requesterBId);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(stored).toMatchObject({
      requesterId: requesterAId,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      ownerId: null,
      status: "NEW",
    });
  });

  it("returns only the authenticated Requester's Tickets despite spoofed input", async () => {
    const response = await requesterAApi
      .get(`/api/tickets?requesterId=${requesterBId}&pageSize=50`)
      .set("X-Requester-Id", String(requesterBId));
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.every(
      (ticket: { requesterId: number }) => ticket.requesterId === requesterAId,
    )).toBe(true);
    expect(response.body.items.some(
      (ticket: { id: number }) => ticket.id === requesterBTicketId,
    )).toBe(false);
  });

  it("allows owned Ticket Detail and gives the same safe 404 for cross-owner and missing Tickets", async () => {
    const own = await requesterAApi.get(`/api/tickets/${requesterATicketId}`);
    const crossOwner = await requesterAApi
      .get(`/api/tickets/${requesterBTicketId}`)
      .set("X-Requester-Id", String(requesterBId));
    const missing = await requesterAApi.get("/api/tickets/999999999");
    expect(own.status).toBe(200);
    expect(own.body.requesterId).toBe(requesterAId);
    expect(crossOwner.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(crossOwner.body).toEqual(missing.body);
    expect(crossOwner.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("enforces ownership across attachment upload, read, download, and removal", async () => {
    const upload = await requesterAApi
      .post(`/api/tickets/${requesterATicketId}/attachments`)
      .attach("file", PNG_FILE, {
        filename: "requester-a.png",
        contentType: "image/png",
      });
    expect(upload.status).toBe(201);
    const attachmentId = upload.body.data.id as number;

    const [ownMetadata, ownDownload, crossUpload, crossMetadata, crossDownload, crossRemove] =
      await Promise.all([
        requesterAApi.get(`/api/attachments/${attachmentId}`),
        requesterAApi.get(`/api/attachments/${attachmentId}/download`),
        requesterBApi
          .post(`/api/tickets/${requesterATicketId}/attachments`)
          .attach("file", PNG_FILE, {
            filename: "cross-owner.png",
            contentType: "image/png",
          }),
        requesterBApi.get(`/api/attachments/${attachmentId}`),
        requesterBApi.get(`/api/attachments/${attachmentId}/download`),
        requesterBApi
          .delete(`/api/attachments/${attachmentId}`)
          .send({ reason: "Not my attachment" }),
      ]);

    expect(ownMetadata.status).toBe(200);
    expect(ownDownload.status).toBe(200);
    expect(crossUpload.status).toBe(404);
    expect(crossUpload.body.error.code).toBe("TICKET_NOT_FOUND");
    for (const response of [crossMetadata, crossDownload, crossRemove]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ATTACHMENT_NOT_FOUND");
    }

    const remove = await requesterAApi
      .delete(`/api/attachments/${attachmentId}`)
      .send({ reason: "No longer needed" });
    expect(remove.status).toBe(200);
    expect(remove.body.data).toMatchObject({
      id: attachmentId,
      isRemoved: true,
      removalReason: "No longer needed",
    });
  });

  it("keeps the Development Requester selector endpoint removed", async () => {
    const response = await requesterAApi
      .get("/api/requesters")
      .set("X-Requester-Id", String(requesterBId));
    expect(response.status).toBe(404);
  });
});
