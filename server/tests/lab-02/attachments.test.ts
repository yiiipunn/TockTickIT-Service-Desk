import request from "supertest";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_FILE = Buffer.concat([PNG_SIGNATURE, Buffer.from("test png")]);
const PDF_FILE = Buffer.from("%PDF-1.7\nattachment test");
const JPEG_FILE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_FILE = Buffer.from("RIFF\x04\x00\x00\x00WEBP", "binary");

describe("Lab 2 - Attachment Management API", () => {
  const prisma = getPrisma();

  let requesterAId: number;
  let requesterBId: number;
  let categoryId: number;
  let relatedSystemId: number;

  let uploadTicketId: number;
  let limitTicketId: number;
  let concurrentLimitTicketId: number;
  let requesterBTicketId: number;
  let removeTicketId: number;
  let uploadedPdfAttachmentId: number;

  const uniquePrefix = `ATTACH-${Date.now()}`;

  beforeAll(async () => {
    const requesters =
      await prisma.developmentRequester.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          id: "asc",
        },
        take: 2,
      });

    if (requesters.length < 2) {
      throw new Error(
        "Attachment tests require at least 2 active Development Requesters",
      );
    }

    requesterAId = requesters[0].id;
    requesterBId = requesters[1].id;

    const category = await prisma.category.findFirst({
      orderBy: {
        id: "asc",
      },
    });

    if (!category) {
      throw new Error(
        "Attachment tests require at least 1 Category",
      );
    }

    categoryId = category.id;

    const relatedSystem =
      await prisma.relatedSystem.findFirst({
        orderBy: {
          id: "asc",
        },
      });

    if (!relatedSystem) {
      throw new Error(
        "Attachment tests require at least 1 Related System",
      );
    }

    relatedSystemId = relatedSystem.id;

    const createTicket = async (
      requesterId: number,
      suffix: string,
    ) =>
      prisma.ticket.create({
        data: {
          ticketNumber: `${uniquePrefix}-${suffix}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: `Attachment test ${suffix}`,
          requestedPriority: "MEDIUM",
          description:
            "Ticket used for Lab 2 attachment management tests.",
          status: "NEW",
        },
      });

    const uploadTicket = await createTicket(
      requesterAId,
      "UPLOAD",
    );
    uploadTicketId = uploadTicket.id;

    const limitTicket = await createTicket(
      requesterAId,
      "LIMIT",
    );
    limitTicketId = limitTicket.id;

    const concurrentLimitTicket = await createTicket(
      requesterAId,
      "CONCURRENT-LIMIT",
    );
    concurrentLimitTicketId = concurrentLimitTicket.id;

    const requesterBTicket = await createTicket(
      requesterBId,
      "OWNER-B",
    );
    requesterBTicketId = requesterBTicket.id;

    const removeTicket = await createTicket(
      requesterAId,
      "REMOVE",
    );
    removeTicketId = removeTicket.id;

    await prisma.attachment.createMany({
      data: [
        ...Array.from({ length: 5 }, (_, index) => ({
          ticketId: limitTicketId,
          originalFilename: `existing-${index + 1}.png`,
          storedFilename: `${uniquePrefix}-limit-${index + 1}.png`,
          mimeType: "image/png",
          sizeBytes: 1024,
          isRemoved: false,
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          ticketId: concurrentLimitTicketId,
          originalFilename: `concurrent-existing-${index + 1}.png`,
          storedFilename: `${uniquePrefix}-concurrent-${index + 1}.png`,
          mimeType: "image/png",
          sizeBytes: 1024,
          isRemoved: false,
        })),
      ],
    });
  });

  afterAll(async () => {
    const tickets = await prisma.ticket.findMany({
      where: {
        ticketNumber: {
          startsWith: uniquePrefix,
        },
      },
      select: {
        id: true,
        attachments: {
          select: {
            storedFilename: true,
          },
        },
      },
    });

    const ticketIds = tickets.map((ticket) => ticket.id);

    for (const ticket of tickets) {
      for (const attachment of ticket.attachments) {
        await fs.rm(
          resolve("storage", "attachments", attachment.storedFilename),
          { force: true },
        );
      }
    }

    if (ticketIds.length > 0) {
      await prisma.attachment.deleteMany({
        where: {
          ticketId: {
            in: ticketIds,
          },
        },
      });

      await prisma.ticket.deleteMany({
        where: {
          id: {
            in: ticketIds,
          },
        },
      });
    }
  });

  it("uploads an allowed attachment to an owned Ticket", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach(
        "file",
        PNG_FILE,
        {
          filename: "evidence.png",
          contentType: "image/png",
        },
      );

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      originalFilename: "evidence.png",
      mimeType: "image/png",
    });

    expect(response.body.data.id).toEqual(expect.any(Number));
    expect(response.body.data.sizeBytes).toBeGreaterThan(0);
    expect(response.body.data.createdAt).toBeTruthy();
    expect(response.body.data).not.toHaveProperty("storedFilename");

    const stored = await prisma.attachment.findUnique({
      where: {
        id: response.body.data.id,
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.ticketId).toBe(uploadTicketId);
    expect(stored?.isRemoved).toBe(false);
    expect(stored?.storedFilename).toBeTruthy();
    expect(stored?.storedFilename).not.toContain("evidence.png");

    const file = await fs.readFile(
      resolve("storage", "attachments", stored!.storedFilename),
    );
    expect(file).toEqual(PNG_FILE);
  });

  it("accepts PDF attachments", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach(
        "file",
        PDF_FILE,
        {
          filename: "evidence.pdf",
          contentType: "application/pdf",
        },
      );

    expect(response.status).toBe(201);
    expect(response.body.data.mimeType).toBe(
      "application/pdf",
    );
    uploadedPdfAttachmentId = response.body.data.id;
  });

  it.each([
    ["evidence.jpg", "image/jpeg", JPEG_FILE],
    ["evidence.webp", "image/webp", WEBP_FILE],
  ])("accepts %s attachments", async (filename, contentType, file) => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach("file", file, { filename, contentType });

    expect(response.status).toBe(201);
    expect(response.body.data.mimeType).toBe(contentType);
  });

  it("downloads the persisted content of an owned active attachment", async () => {
    const response = await request(app)
      .get(`/api/attachments/${uploadedPdfAttachmentId}/download`)
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("evidence.pdf");
    expect(response.body).toEqual(PDF_FILE);
  });

  it("returns owned active attachment metadata", async () => {
    const response = await request(app)
      .get(`/api/attachments/${uploadedPdfAttachmentId}`)
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: uploadedPdfAttachmentId,
      originalFilename: "evidence.pdf",
      isRemoved: false,
      removedAt: null,
      removalReason: null,
    });
  });

  it("rejects an unsupported attachment type", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach(
        "file",
        Buffer.from("plain text"),
        {
          filename: "notes.txt",
          contentType: "text/plain",
        },
      );

    expect(response.status).toBe(415);
    expect(response.body.error).toMatchObject({
      code: "UNSUPPORTED_ATTACHMENT_TYPE",
      message: "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.",
    });
  });

  it("rejects content that does not match its claimed allowed MIME type", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach("file", Buffer.from("not a png"), {
        filename: "fake.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(415);
    expect(response.body.error).toMatchObject({
      code: "UNSUPPORTED_ATTACHMENT_TYPE",
      message: expect.stringContaining("content does not match"),
    });
  });

  it("accepts an attachment exactly 5 MB", async () => {
    const file = Buffer.alloc(5 * 1024 * 1024);
    PNG_SIGNATURE.copy(file);

    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach("file", file, {
        filename: "boundary.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.sizeBytes).toBe(5 * 1024 * 1024);
  });

  it("rejects an attachment larger than 5 MB", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach(
        "file",
        Buffer.concat([
          PNG_SIGNATURE,
          Buffer.alloc(5 * 1024 * 1024 + 1 - PNG_SIGNATURE.length),
        ]),
        {
          filename: "too-large.png",
          contentType: "image/png",
        },
      );

    expect(response.status).toBe(413);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_TOO_LARGE",
      message: "The attachment must not exceed 5 MB.",
    });
  });

  it("rejects upload when no file is provided", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      fields: { file: "Attachment file is required." },
    });
  });

  it("rejects a sixth active attachment", async () => {
    const response = await request(app)
      .post(`/api/tickets/${limitTicketId}/attachments`)
      .set("X-Requester-Id", String(requesterAId))
      .attach(
        "file",
        PNG_FILE,
        {
          filename: "sixth.png",
          contentType: "image/png",
        },
      );

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_LIMIT_REACHED",
      message: "This ticket already has the maximum of 5 active attachments.",
    });
  });

  it("requires Development Requester context for upload", async () => {
    const response = await request(app)
      .post(`/api/tickets/${uploadTicketId}/attachments`)
      .attach(
        "file",
        WEBP_FILE,
        {
          filename: "evidence.webp",
          contentType: "image/webp",
        },
      );

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: "REQUESTER_REQUIRED",
      message: "Development Requester is required.",
    });
  });

  it("does not allow a Requester to upload to another Requester's Ticket", async () => {
    const response = await request(app)
      .post(
        `/api/tickets/${requesterBTicketId}/attachments`,
      )
      .set("X-Requester-Id", String(requesterAId))
      .attach(
        "file",
        PNG_FILE,
        {
          filename: "cross-owner.png",
          contentType: "image/png",
        },
      );

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "TICKET_NOT_FOUND",
      message: "Ticket not found.",
    });
  });

  it("soft-removes an owned active attachment", async () => {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: removeTicketId,
        originalFilename: "remove-me.png",
        storedFilename: `${uniquePrefix}-remove-me.png`,
        mimeType: "image/png",
        sizeBytes: 2048,
        isRemoved: false,
      },
    });

    const response = await request(app)
      .delete(
        `/api/attachments/${attachment.id}`,
      )
      .set("X-Requester-Id", String(requesterAId))
      .send({ reason: "Uploaded the wrong file" });

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(attachment.id);
    expect(response.body.data.isRemoved).toBe(true);
    expect(response.body.data.removedAt).toBeTruthy();
    expect(response.body.data).not.toHaveProperty("storedFilename");

    const stored = await prisma.attachment.findUnique({
      where: {
        id: attachment.id,
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.isRemoved).toBe(true);
    expect(stored?.removedAt).not.toBeNull();
    expect(stored?.removalReason).toBe("Uploaded the wrong file");
  });

  it("retains soft-removed attachment metadata in Ticket Detail", async () => {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: removeTicketId,
        originalFilename: "detail-remove.pdf",
        storedFilename: `${uniquePrefix}-detail-remove.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 4096,
        isRemoved: false,
      },
    });

    const removeResponse = await request(app)
      .delete(
        `/api/attachments/${attachment.id}`,
      )
      .set("X-Requester-Id", String(requesterAId))
      .send({ reason: "No longer needed" });

    expect(removeResponse.status).toBe(200);

    const detailResponse = await request(app)
      .get(`/api/tickets/${removeTicketId}`)
      .set("X-Requester-Id", String(requesterAId));

    expect(detailResponse.status).toBe(200);

    expect(detailResponse.body.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: attachment.id,
          isRemoved: true,
          removalReason: "No longer needed",
        }),
      ]),
    );

    const metadataResponse = await request(app)
      .get(`/api/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requesterAId));

    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.body.data).toMatchObject({
      id: attachment.id,
      isRemoved: true,
      removalReason: "No longer needed",
    });

    const downloadResponse = await request(app)
      .get(`/api/attachments/${attachment.id}/download`)
      .set("X-Requester-Id", String(requesterAId));

    expect(downloadResponse.status).toBe(404);
  });

  it("does not allow a Requester to remove another Requester's attachment", async () => {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: requesterBTicketId,
        originalFilename: "owner-b.png",
        storedFilename: `${uniquePrefix}-owner-b.png`,
        mimeType: "image/png",
        sizeBytes: 1024,
        isRemoved: false,
      },
    });

    const response = await request(app)
      .delete(
        `/api/attachments/${attachment.id}`,
      )
      .set("X-Requester-Id", String(requesterAId))
      .send({ reason: "Not my file" });

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_NOT_FOUND",
      message: "Attachment not found.",
    });

    const stored = await prisma.attachment.findUnique({
      where: {
        id: attachment.id,
      },
    });

    expect(stored?.isRemoved).toBe(false);
  });

  it.each([
    ["metadata", (attachmentId: number) =>
      request(app).get(`/api/attachments/${attachmentId}`)],
    ["download", (attachmentId: number) =>
      request(app).get(`/api/attachments/${attachmentId}/download`)],
  ])("does not expose another Requester's attachment through %s", async (
    _operation,
    makeRequest,
  ) => {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: requesterBTicketId,
        originalFilename: "owner-b-private.pdf",
        storedFilename: `${uniquePrefix}-owner-b-${randomUUID()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024,
      },
    });

    const response = await makeRequest(attachment.id)
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_NOT_FOUND",
      message: "Attachment not found.",
    });
  });

  it("atomically enforces the active limit for concurrent uploads", async () => {
    const responses = await Promise.all([
      request(app)
        .post(`/api/tickets/${concurrentLimitTicketId}/attachments`)
        .set("X-Requester-Id", String(requesterAId))
        .attach("file", PNG_FILE, {
          filename: "concurrent-a.png",
          contentType: "image/png",
        }),
      request(app)
        .post(`/api/tickets/${concurrentLimitTicketId}/attachments`)
        .set("X-Requester-Id", String(requesterAId))
        .attach("file", PNG_FILE, {
          filename: "concurrent-b.png",
          contentType: "image/png",
        }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201,
      409,
    ]);
    expect(await prisma.attachment.count({
      where: { ticketId: concurrentLimitTicketId, isRemoved: false },
    })).toBe(5);
  });

  it("returns 409 when removing an already removed attachment", async () => {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: removeTicketId,
        originalFilename: "already-removed.webp",
        storedFilename: `${uniquePrefix}-already-removed.webp`,
        mimeType: "image/webp",
        sizeBytes: 1024,
        isRemoved: true,
        removedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete(
        `/api/attachments/${attachment.id}`,
      )
      .set("X-Requester-Id", String(requesterAId))
      .send({ reason: "Remove again" });

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_ALREADY_REMOVED",
      message: "This attachment has already been removed.",
    });
  });

  it.each([
    ["missing", {}],
    ["whitespace-only", { reason: "   " }],
    ["overlong", { reason: "x".repeat(251) }],
  ])("rejects a %s removal reason", async (_label, body) => {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: removeTicketId,
        originalFilename: "reason-test.png",
        storedFilename: `${uniquePrefix}-reason-${randomUUID()}.png`,
        mimeType: "image/png",
        sizeBytes: 100,
      },
    });

    const response = await request(app)
      .delete(`/api/attachments/${attachment.id}`)
      .set("X-Requester-Id", String(requesterAId))
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      fields: {
        reason: "Removal reason must contain 1 to 250 characters.",
      },
    });
    expect((await prisma.attachment.findUniqueOrThrow({
      where: { id: attachment.id },
    })).isRemoved).toBe(false);
  });
});
