import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("GET /api/requesters", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns HTTP 200 with active development requesters", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4);
  });

  it("returns only id, name, and email for each requester", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);

    for (const requester of response.body) {
      expect(requester).toEqual({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
      });
    }
  });

  it("does not return inactive development requesters", async () => {
    const inactiveRequesters = await prisma.developmentRequester.findMany({
      where: {
        isActive: false,
      },
      select: {
        id: true,
      },
    });

    expect(inactiveRequesters.length).toBeGreaterThanOrEqual(1);

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);

    const returnedIds = response.body.map(
      (requester: { id: number }) => requester.id
    );

    for (const inactiveRequester of inactiveRequesters) {
      expect(returnedIds).not.toContain(inactiveRequester.id);
    }
  });

  it("returns requesters sorted by name", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);

    const names = response.body.map(
      (requester: { name: string }) => requester.name
    );

    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));

    expect(names).toEqual(sortedNames);
  });
});