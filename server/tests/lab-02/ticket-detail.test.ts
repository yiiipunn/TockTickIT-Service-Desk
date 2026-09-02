import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 2 - Requester Ticket Detail API", () => {
  const prisma = getPrisma();

  let requesterAId: number;
  let requesterBId: number;
  let categoryId: number;
  let relatedSystemId: number;

  let requesterATicketId: number;
  let requesterBTicketId: number;

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
        "Ticket Detail tests require at least 2 active Development Requesters",
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
        "Ticket Detail tests require at least 1 Category",
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
        "Ticket Detail tests require at least 1 Related System",
      );
    }

    relatedSystemId = relatedSystem.id;

    const uniquePrefix = `DETAIL-${Date.now()}`;

    const requesterATicket =
      await prisma.ticket.create({
        data: {
          ticketNumber: `${uniquePrefix}-A`,
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "Requester A detail test ticket",
          requestedPriority: "MEDIUM",
          description:
            "Ticket used to verify requester-owned ticket detail.",
          status: "NEW",
        },
      });

    requesterATicketId = requesterATicket.id;

    const requesterBTicket =
      await prisma.ticket.create({
        data: {
          ticketNumber: `${uniquePrefix}-B`,
          requesterId: requesterBId,
          categoryId,
          relatedSystemId,
          summary: "Requester B detail test ticket",
          requestedPriority: "LOW",
          description:
            "Ticket used to verify cross-requester access.",
          status: "NEW",
        },
      });

    requesterBTicketId = requesterBTicket.id;

    await prisma.attachment.createMany({
      data: [
        {
          ticketId: requesterATicketId,
          originalFilename: "active-evidence.png",
          storedFilename: `${uniquePrefix}-active.png`,
          mimeType: "image/png",
          sizeBytes: 2048,
          isRemoved: false,
        },
        {
          ticketId: requesterATicketId,
          originalFilename: "removed-evidence.pdf",
          storedFilename: `${uniquePrefix}-removed.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 4096,
          isRemoved: true,
          removedAt: new Date(),
          removalReason: "No longer needed",
        },
      ],
    });
  });

  it("returns an owned Ticket", async () => {
    const response = await request(app)
      .get(`/api/tickets/${requesterATicketId}`)
      .set(
        "X-Requester-Id",
        String(requesterAId),
      );

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      id: requesterATicketId,
      requesterId: requesterAId,
      summary:
        "Requester A detail test ticket",
      requestedPriority: "MEDIUM",
      description:
        "Ticket used to verify requester-owned ticket detail.",
      status: "NEW",
    });

    expect(response.body.ticketNumber).toBeTruthy();
    expect(response.body.createdAt).toBeTruthy();
    expect(response.body.updatedAt).toBeTruthy();
  });

  it("includes Category and Related System", async () => {
    const response = await request(app)
      .get(`/api/tickets/${requesterATicketId}`)
      .set(
        "X-Requester-Id",
        String(requesterAId),
      );

    expect(response.status).toBe(200);

    expect(response.body.category).toMatchObject({
      id: categoryId,
    });

    expect(
      response.body.category.name,
    ).toEqual(expect.any(String));

    expect(
      response.body.relatedSystem,
    ).toMatchObject({
      id: relatedSystemId,
    });

    expect(
      response.body.relatedSystem.name,
    ).toEqual(expect.any(String));
  });

  it("includes active Attachments", async () => {
    const response = await request(app)
      .get(`/api/tickets/${requesterATicketId}`)
      .set(
        "X-Requester-Id",
        String(requesterAId),
      );

    expect(response.status).toBe(200);

    expect(
      response.body.attachments,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originalFilename:
            "active-evidence.png",
          mimeType: "image/png",
          sizeBytes: 2048,
        }),
      ]),
    );
  });

  it("excludes soft-removed Attachments", async () => {
    const response = await request(app)
      .get(`/api/tickets/${requesterATicketId}`)
      .set(
        "X-Requester-Id",
        String(requesterAId),
      );

    expect(response.status).toBe(200);

    const filenames =
      response.body.attachments.map(
        (attachment: {
          originalFilename: string;
        }) => attachment.originalFilename,
      );

    expect(filenames).toContain(
      "active-evidence.png",
    );

    expect(filenames).not.toContain(
      "removed-evidence.pdf",
    );
  });

  it("rejects missing requester context", async () => {
    const response = await request(app).get(
      `/api/tickets/${requesterATicketId}`,
    );

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error:
        "Development Requester is required",
    });
  });

  it("rejects invalid requester context", async () => {
    const response = await request(app)
      .get(`/api/tickets/${requesterATicketId}`)
      .set("X-Requester-Id", "invalid");

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: "Invalid Development Requester",
    });
  });

  it("returns 404 when the Ticket does not exist", async () => {
    const response = await request(app)
      .get("/api/tickets/999999999")
      .set(
        "X-Requester-Id",
        String(requesterAId),
      );

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "Ticket not found",
    });
  });

  it("returns 404 when accessing another Requester's Ticket", async () => {
    const response = await request(app)
      .get(`/api/tickets/${requesterBTicketId}`)
      .set(
        "X-Requester-Id",
        String(requesterAId),
      );

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "Ticket not found",
    });
  });
});