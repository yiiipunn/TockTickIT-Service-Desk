import request from "supertest";
import { TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { createAuthenticatedTestClient } from "../helpers/authenticated-client.js";
import { hashPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const requesterEmail = "staff-queue-requester@example.com";
const eligibleOwnerEmail = "staff-queue-owner@example.com";
const restrictedEmail = "staff-queue-restricted@example.com";
const password = "TokTickIT-Lab3!";
const origin = "http://localhost:5173";
let requesterId = 0;
let eligibleOwnerId = 0;
let staffClient: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let administratorClient: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;
let requesterClient: Awaited<ReturnType<typeof createAuthenticatedTestClient>>;

function cookieFrom(response: request.Response) {
  const values = response.headers["set-cookie"] as unknown as string[] | undefined;
  return values?.[0]?.split(";", 1)[0] ?? "";
}

describe("IT Staff Ticket Queue API", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    const [category, relatedSystem, requester, eligibleOwner] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { name: "Account and Access" } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } }),
      prisma.user.upsert({
        where: { email: requesterEmail },
        update: {
          name: "Queue Requester",
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
        },
        create: {
          name: "Queue Requester",
          email: requesterEmail,
          passwordHash,
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
        },
      }),
      prisma.user.upsert({
        where: { email: eligibleOwnerEmail },
        update: {
          name: "Queue Eligible Owner",
          passwordHash,
          role: "ADMINISTRATOR",
          isActive: true,
          mustChangePassword: false,
        },
        create: {
          name: "Queue Eligible Owner",
          email: eligibleOwnerEmail,
          passwordHash,
          role: "ADMINISTRATOR",
          isActive: true,
          mustChangePassword: false,
        },
      }),
    ]);
    requesterId = requester.id;
    eligibleOwnerId = eligibleOwner.id;

    staffClient = await createAuthenticatedTestClient({ role: "IT_STAFF" });
    administratorClient = await createAuthenticatedTestClient({ role: "ADMINISTRATOR" });
    requesterClient = await createAuthenticatedTestClient({ userId: requester.id });

    await Promise.all(Object.values(TicketStatus).concat(
      Array.from({ length: 13 }, () => "IN_PROGRESS" as TicketStatus),
    ).map((status, index) => prisma.ticket.upsert({
      where: { ticketNumber: `TKT-Q-${String(index + 1).padStart(3, "0")}` },
      update: {
        requesterId: requester.id,
        ownerId: index % 3 === 0 ? staffClient.user.id : index % 3 === 1 ? null : eligibleOwner.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: index === 0 ? "VPN access for Queue Requester" : `Queue ticket ${index + 1}`,
        requestedPriority: index % 3 === 0 ? "LOW" : index % 3 === 1 ? "MEDIUM" : "HIGH",
        itPriority: index % 3 === 0 ? "HIGH" : index % 3 === 1 ? "LOW" : "MEDIUM",
        status,
        updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
      },
      create: {
        ticketNumber: `TKT-Q-${String(index + 1).padStart(3, "0")}`,
        requesterId: requester.id,
        ownerId: index % 3 === 0 ? staffClient.user.id : index % 3 === 1 ? null : eligibleOwner.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: index === 0 ? "VPN access for Queue Requester" : `Queue ticket ${index + 1}`,
        description: `Queue fixture ${index + 1}`,
        requestedPriority: index % 3 === 0 ? "LOW" : index % 3 === 1 ? "MEDIUM" : "HIGH",
        itPriority: index % 3 === 0 ? "HIGH" : index % 3 === 1 ? "LOW" : "MEDIUM",
        status,
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
        updatedAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
      },
    })));

    await prisma.user.upsert({
      where: { email: restrictedEmail },
      update: {
        name: "Restricted Queue Staff",
        passwordHash,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
      },
      create: {
        name: "Restricted Queue Staff",
        email: restrictedEmail,
        passwordHash,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { user: { email: { in: [requesterEmail, eligibleOwnerEmail, restrictedEmail] } } },
    });
    await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: "TKT-Q-" } } });
    await prisma.user.deleteMany({ where: { email: { in: [requesterEmail, eligibleOwnerEmail, restrictedEmail] } } });
  });

  it("returns the shared queue, realistic status/priority data, ownership, and counts to IT Staff", async () => {
    const defaultQueue = await staffClient.get("/api/staff/tickets");
    expect(defaultQueue.status).toBe(200);
    expect(defaultQueue.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
    expect(defaultQueue.body.items).toHaveLength(20);

    const response = await staffClient.get("/api/staff/tickets?search=Queue%20Requester&pageSize=50");

    expect(response.status).toBe(200);
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 50, totalItems: 21, totalPages: 1 });
    expect(response.body.counts).toEqual({ matching: 21, matchingUnassigned: 7 });
    expect(response.body.items).toHaveLength(21);
    expect(response.body.items).toContainEqual(expect.objectContaining({
      ticketNumber: "TKT-Q-001",
      summary: "VPN access for Queue Requester",
      requester: { id: requesterId, name: "Queue Requester", email: requesterEmail },
      owner: { id: staffClient.user.id, name: staffClient.user.name },
      status: "NEW",
      requestedPriority: "LOW",
      itPriority: "HIGH",
      updatedAt: expect.any(String),
    }));
    expect(response.body.items.some((ticket: { owner: unknown }) => ticket.owner === null)).toBe(true);
    expect(new Set(response.body.items.map((ticket: { status: string }) => ticket.status))).toEqual(
      new Set(Object.values(TicketStatus)),
    );
  });

  it("requires authentication, denies Requesters despite a spoofed role, and enforces first-login restrictions", async () => {
    const unauthenticated = await request(app).get("/api/staff/tickets");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe("AUTH_REQUIRED");

    const requester = await requesterClient.get("/api/staff/tickets").set("X-Role", "IT_STAFF");
    expect(requester.status).toBe(403);
    expect(requester.body.error.code).toBe("FORBIDDEN");

    const login = await request(app).post("/api/auth/login").send({ email: restrictedEmail, password });
    const restricted = await request(app).get("/api/staff/tickets").set("Cookie", cookieFrom(login));
    expect(restricted.status).toBe(403);
    expect(restricted.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("permits both IT Staff and Administrators through the approved matrix", async () => {
    const response = await administratorClient.get("/api/staff/tickets");
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(expect.any(Array));
  });

  it("searches ticket number, summary, and Requester name/email, including safe no results", async () => {
    for (const search of ["TKT-Q-001", "VPN access"]) {
      const response = await staffClient.get(`/api/staff/tickets?search=${encodeURIComponent(search)}`);
      expect(response.status).toBe(200);
      expect(response.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toContain("TKT-Q-001");
    }

    for (const search of ["Queue Requester", requesterEmail]) {
      const response = await staffClient.get(`/api/staff/tickets?search=${encodeURIComponent(search)}`);
      expect(response.status).toBe(200);
      expect(response.body.pagination.totalItems).toBe(21);
    }

    const noResults = await staffClient.get("/api/staff/tickets?search=no-matching-queue-ticket");
    expect(noResults.status).toBe(200);
    expect(noResults.body).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      counts: { matching: 0, matchingUnassigned: 0 },
    });
  });

  it("applies each approved filter and deterministic sort/page controls together", async () => {
    const status = await staffClient.get("/api/staff/tickets?status=OPEN");
    expect(status.status).toBe(200);
    expect(status.body.items.every((ticket: { status: string }) => ticket.status === "OPEN")).toBe(true);

    const priorities = await staffClient.get("/api/staff/tickets?requestedPriority=LOW&itPriority=HIGH");
    expect(priorities.status).toBe(200);
    expect(priorities.body.items.every((ticket: { requestedPriority: string; itPriority: string }) =>
      ticket.requestedPriority === "LOW" && ticket.itPriority === "HIGH",
    )).toBe(true);

    const mine = await staffClient.get("/api/staff/tickets?owner=me");
    expect(mine.status).toBe(200);
    expect(mine.body.items.every((ticket: { owner: { id: number } }) => ticket.owner.id === staffClient.user.id)).toBe(true);

    const unassigned = await staffClient.get("/api/staff/tickets?owner=unassigned");
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.items.every((ticket: { owner: null }) => ticket.owner === null)).toBe(true);

    const eligibleOwner = await staffClient.get(`/api/staff/tickets?owner=${eligibleOwnerId}`);
    expect(eligibleOwner.status).toBe(200);
    expect(eligibleOwner.body.items.every((ticket: { owner: { id: number } }) => ticket.owner.id === eligibleOwnerId)).toBe(true);

    const combined = await staffClient.get("/api/staff/tickets?search=Queue%20Requester&status=IN_PROGRESS&sortBy=ticketNumber&sortOrder=desc&pageSize=10&page=2");
    expect(combined.status).toBe(200);
    expect(combined.body.pagination).toMatchObject({ page: 2, pageSize: 10, totalItems: 14, totalPages: 2 });
    expect(combined.body.items).toHaveLength(4);
    expect(combined.body.items.every((ticket: { status: string }) => ticket.status === "IN_PROGRESS")).toBe(true);
    expect(combined.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([
      "TKT-Q-011", "TKT-Q-010", "TKT-Q-009", "TKT-Q-003",
    ]);
  });

  it.each([
    "?page=0",
    "?pageSize=15",
    "?status=UNKNOWN",
    "?requestedPriority=URGENT",
    "?owner=0",
    "?owner=999999",
    `?owner=${requesterId}`,
    "?sortBy=owner",
    "?sortOrder=up",
    "?unexpected=value",
    `?search=${"x".repeat(121)}`,
  ])("returns a safe INVALID_QUERY error for %s", async (query) => {
    const response = await staffClient.get(`/api/staff/tickets${query}`);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: "INVALID_QUERY", message: "The queue query is invalid." },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/sql|stack|path/i);
  });
});
