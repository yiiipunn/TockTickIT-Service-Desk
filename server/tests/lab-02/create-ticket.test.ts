import { beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma";
import {
  createAuthenticatedTestClient,
  type AuthenticatedTestClient,
} from "../helpers/authenticated-client.js";

const prisma = getPrisma();
let api: AuthenticatedTestClient;

beforeAll(async () => {
  api = await createAuthenticatedTestClient();
});

async function getValidTestData() {
  const requester = await prisma.user.findUnique({
    where: { id: api.user.id },
  });

  const category = await prisma.category.findFirst();

  const relatedSystem = await prisma.relatedSystem.findFirst();

  if (!requester || !category || !relatedSystem) {
    throw new Error(
      "Required Lab 2 seed data is missing. Run the seed script before testing."
    );
  }

  return {
    requester,
    category,
    relatedSystem,
  };
}

function validTicketBody(categoryId: number, relatedSystemId: number) {
  return {
    categoryId,
    relatedSystemId,
    summary: "Unable to connect to campus Wi-Fi",
    requestedPriority: "MEDIUM",
    description:
      "The requester cannot connect to the campus Wi-Fi from the engineering building.",
  };
}

describe("Lab 2 - Create Ticket API", () => {
  it("creates a ticket for the authenticated Requester", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const response = await api
      .post("/api/tickets")
      .send(validTicketBody(category.id, relatedSystem.id));

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Unable to connect to campus Wi-Fi",
      requestedPriority: "MEDIUM",
      status: "NEW",
    });

    expect(response.body.ticketNumber).toMatch(/^TKT-\d{6,}$/);
  });

  it("generates a different Ticket Number for each ticket", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const firstResponse = await api
      .post("/api/tickets")
      .send(validTicketBody(category.id, relatedSystem.id));

    const secondResponse = await api
      .post("/api/tickets")
      .send(validTicketBody(category.id, relatedSystem.id));

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    expect(firstResponse.body.ticketNumber).not.toBe(
      secondResponse.body.ticketNumber
    );
  });

  it("creates without a Development Requester header", async () => {
    const { category, relatedSystem } = await getValidTestData();

    const response = await api
      .post("/api/tickets")
      .send(validTicketBody(category.id, relatedSystem.id));

    expect(response.status).toBe(201);
    expect(response.body.requesterId).toBe(api.user.id);
  });

  it("ignores a client-supplied inactive Development Requester", async () => {
    const inactiveRequester =
      await prisma.user.findFirst({
        where: {
          role: "REQUESTER",
          isActive: false,
        },
      });

    const { category, relatedSystem } = await getValidTestData();

    if (!inactiveRequester) {
      throw new Error(
        "Inactive Development Requester seed data is missing."
      );
    }

    const response = await api
      .post("/api/tickets")
      .set("X-Requester-Id", String(inactiveRequester.id))
      .send(validTicketBody(category.id, relatedSystem.id));

    expect(response.status).toBe(201);
    expect(response.body.requesterId).toBe(api.user.id);
    expect(response.body.requesterId).not.toBe(inactiveRequester.id);
  });

  it("rejects an invalid Category", async () => {
    const { requester, relatedSystem } = await getValidTestData();

    const response = await api
      .post("/api/tickets")
      .send(validTicketBody(999999, relatedSystem.id));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Category");
  });

  it("rejects an invalid Related System", async () => {
    const { requester, category } = await getValidTestData();

    const response = await api
      .post("/api/tickets")
      .send(validTicketBody(category.id, 999999));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Related System");
  });

  it("rejects an empty Summary", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const body = validTicketBody(category.id, relatedSystem.id);

    const response = await api
      .post("/api/tickets")
      .send({
        ...body,
        summary: "   ",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Summary must be between 1 and 120 characters"
    );
  });

  it("rejects a Summary longer than 120 characters", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const body = validTicketBody(category.id, relatedSystem.id);

    const response = await api
      .post("/api/tickets")
      .send({
        ...body,
        summary: "A".repeat(121),
      });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid Requested Priority", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const body = validTicketBody(category.id, relatedSystem.id);

    const response = await api
      .post("/api/tickets")
      .send({
        ...body,
        requestedPriority: "URGENT",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Requested Priority must be LOW, MEDIUM, or HIGH"
    );
  });

  it("rejects an empty Description", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const body = validTicketBody(category.id, relatedSystem.id);

    const response = await api
      .post("/api/tickets")
      .send({
        ...body,
        description: "   ",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Description must be between 1 and 2000 characters"
    );
  });

  it("rejects a Description longer than 2000 characters", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const body = validTicketBody(category.id, relatedSystem.id);

    const response = await api
      .post("/api/tickets")
      .send({
        ...body,
        description: "A".repeat(2001),
      });

    expect(response.status).toBe(400);
  });

  it("trims Summary and Description before storing the ticket", async () => {
    const { requester, category, relatedSystem } =
      await getValidTestData();

    const response = await api
      .post("/api/tickets")
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "   Printer is not working   ",
        requestedPriority: "LOW",
        description: "   The printer does not respond.   ",
      });

    expect(response.status).toBe(201);
    expect(response.body.summary).toBe("Printer is not working");
    expect(response.body.description).toBe(
      "The printer does not respond."
    );
  });
});
