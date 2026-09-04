import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

let requesterAId: number;
let requesterBId: number;
let categoryAId: number;
let categoryBId: number;
let systemAId: number;
let systemBId: number;

beforeAll(async () => {
  const requesters = await prisma.developmentRequester.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      id: "asc",
    },
    take: 2,
  });

  if (requesters.length < 2) {
    throw new Error("At least 2 active Development Requesters are required");
  }

  requesterAId = requesters[0].id;
  requesterBId = requesters[1].id;

  const categories = await prisma.category.findMany({
    orderBy: {
      id: "asc",
    },
    take: 2,
  });

  if (categories.length < 2) {
    throw new Error("At least 2 Categories are required");
  }

  categoryAId = categories[0].id;
  categoryBId = categories[1].id;

  const systems = await prisma.relatedSystem.findMany({
    orderBy: {
      id: "asc",
    },
    take: 2,
  });

  if (systems.length < 2) {
    throw new Error("At least 2 Related Systems are required");
  }

  systemAId = systems[0].id;
  systemBId = systems[1].id;

  const uniquePrefix = `MYTICKETS-${Date.now()}`;

  await prisma.ticket.createMany({
    data: [
      {
        ticketNumber: `${uniquePrefix}-001`,
        requesterId: requesterAId,
        categoryId: categoryAId,
        relatedSystemId: systemAId,
        summary: "VPN connection problem",
        requestedPriority: "HIGH",
        description: "Cannot connect to VPN",
        status: "NEW",
      },
      {
        ticketNumber: `${uniquePrefix}-002`,
        requesterId: requesterAId,
        categoryId: categoryBId,
        relatedSystemId: systemBId,
        summary: "Printer is not working",
        requestedPriority: "LOW",
        description: "Printer does not respond",
        status: "NEW",
      },
      {
        ticketNumber: `${uniquePrefix}-003`,
        requesterId: requesterAId,
        categoryId: categoryAId,
        relatedSystemId: systemBId,
        summary: "Campus Wi-Fi connection issue",
        requestedPriority: "MEDIUM",
        description: "Wi-Fi disconnects frequently",
        status: "NEW",
      },
      {
        ticketNumber: `${uniquePrefix}-004`,
        requesterId: requesterBId,
        categoryId: categoryAId,
        relatedSystemId: systemAId,
        summary: "Other requester private ticket",
        requestedPriority: "HIGH",
        description: "This ticket belongs to another requester",
        status: "NEW",
      },
    ],
  });
});

describe("GET /api/tickets - My Tickets", () => {
  it("returns tickets for the selected requester", async () => {
    const response = await request(app)
      .get("/api/tickets?pageSize=50")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);

    expect(
      response.body.items.every(
        (ticket: { requesterId: number }) =>
          ticket.requesterId === requesterAId,
      ),
    ).toBe(true);
  });

  it("does not return tickets owned by another requester", async () => {
    const response = await request(app)
      .get("/api/tickets?pageSize=50")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(
      response.body.items.some(
        (ticket: { summary: string }) =>
          ticket.summary === "Other requester private ticket",
      ),
    ).toBe(false);
  });

  it("requires a Development Requester", async () => {
    const response = await request(app).get("/api/tickets");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Development Requester is required",
    );
  });

  it("rejects an invalid Development Requester", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "invalid");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Invalid Development Requester",
    );
  });

  it("searches tickets by Summary", async () => {
    const response = await request(app)
      .get("/api/tickets?search=VPN&pageSize=50")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(
      response.body.items.some(
        (ticket: { summary: string }) =>
          ticket.summary === "VPN connection problem",
      ),
    ).toBe(true);

    expect(
      response.body.items.every(
        (ticket: { summary: string; ticketNumber: string }) =>
          ticket.summary.toLowerCase().includes("vpn") ||
          ticket.ticketNumber.toLowerCase().includes("vpn"),
      ),
    ).toBe(true);
  });

  it("filters tickets by Category", async () => {
    const response = await request(app)
      .get(`/api/tickets?categoryId=${categoryAId}&pageSize=50`)
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(
      response.body.items.every(
        (ticket: { category: { id: number } }) =>
          ticket.category.id === categoryAId,
      ),
    ).toBe(true);
  });

  it("filters tickets by Related System", async () => {
    const response = await request(app)
      .get(
        `/api/tickets?relatedSystemId=${systemBId}&pageSize=50`,
      )
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(
      response.body.items.every(
        (ticket: { relatedSystem: { id: number } }) =>
          ticket.relatedSystem.id === systemBId,
      ),
    ).toBe(true);
  });

  it("filters tickets by Requested Priority", async () => {
    const response = await request(app)
      .get("/api/tickets?requestedPriority=HIGH&pageSize=50")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(
      response.body.items.every(
        (ticket: { requestedPriority: string }) =>
          ticket.requestedPriority === "HIGH",
      ),
    ).toBe(true);
  });

  it("filters tickets by Status", async () => {
    const response = await request(app)
      .get("/api/tickets?status=NEW&pageSize=50")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(
      response.body.items.every(
        (ticket: { status: string }) => ticket.status === "NEW",
      ),
    ).toBe(true);
  });

  it("sorts tickets by Ticket Number ascending", async () => {
    const response = await request(app)
      .get(
        "/api/tickets?sortBy=ticketNumber&sortOrder=asc&pageSize=50",
      )
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    const numbers = response.body.items.map(
      (ticket: { ticketNumber: string }) => ticket.ticketNumber,
    );

    const sorted = [...numbers].sort((a, b) =>
      a.localeCompare(b),
    );

    expect(numbers).toEqual(sorted);
  });

  it("returns pagination metadata", async () => {
    const response = await request(app)
      .get("/api/tickets?page=1&pageSize=10")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);

    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
      }),
    );

    expect(typeof response.body.pagination.totalItems).toBe(
      "number",
    );
    expect(typeof response.body.pagination.totalPages).toBe(
      "number",
    );
  });

  it("supports pagination", async () => {
    const response = await request(app)
      .get("/api/tickets?page=1&pageSize=10")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeLessThanOrEqual(10);
  });

  it("rejects an invalid Category filter", async () => {
    const response = await request(app)
      .get("/api/tickets?categoryId=abc")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Category filter");
  });

  it("rejects an invalid Related System filter", async () => {
    const response = await request(app)
      .get("/api/tickets?relatedSystemId=abc")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Invalid Related System filter",
    );
  });

  it("rejects an invalid Requested Priority filter", async () => {
    const response = await request(app)
      .get("/api/tickets?requestedPriority=URGENT")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Invalid Requested Priority filter",
    );
  });

  it("rejects an invalid Status filter", async () => {
    const response = await request(app)
      .get("/api/tickets?status=CLOSED")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Status filter");
  });

  it("rejects an invalid sort field", async () => {
    const response = await request(app)
      .get("/api/tickets?sortBy=summary")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid sort field");
  });

  it("rejects an invalid sort order", async () => {
    const response = await request(app)
      .get("/api/tickets?sortOrder=random")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid sort order");
  });

  it("rejects an invalid page", async () => {
    const response = await request(app)
      .get("/api/tickets?page=0")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid page");
  });

  it("rejects an unsupported page size", async () => {
    const response = await request(app)
      .get("/api/tickets?pageSize=25")
      .set("X-Requester-Id", String(requesterAId));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Page size must be 10, 20, or 50",
    );
  });
});