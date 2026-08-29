import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("Lab 2 data model and reference data", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("contains exactly the four required categories", async () => {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    });

    const names = categories.map((category) => category.name);

    expect(names).toEqual([
      "Account and Access",
      "Hardware",
      "Network",
      "Software",
    ]);
  });

  it("contains at least six related systems", async () => {
    const relatedSystems = await prisma.relatedSystem.findMany();

    expect(relatedSystems.length).toBeGreaterThanOrEqual(6);
  });

  it("contains the expected seeded related systems", async () => {
    const relatedSystems = await prisma.relatedSystem.findMany();

    const names = relatedSystems.map((system) => system.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "Email",
        "Campus Wi-Fi",
        "VPN",
        "LEB2 App",
        "Grade Submission App",
        "Printer",
      ])
    );
  });

  it("contains at least four active development requesters", async () => {
    const activeRequesters = await prisma.developmentRequester.count({
      where: {
        isActive: true,
      },
    });

    expect(activeRequesters).toBeGreaterThanOrEqual(4);
  });

  it("contains at least one inactive development requester", async () => {
    const inactiveRequesters = await prisma.developmentRequester.count({
      where: {
        isActive: false,
      },
    });

    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
  });

  it("does not contain duplicate category names", async () => {
    const categories = await prisma.category.findMany();

    const names = categories.map((category) => category.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  it("does not contain duplicate related system names", async () => {
    const relatedSystems = await prisma.relatedSystem.findMany();

    const names = relatedSystems.map((system) => system.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  it("does not contain duplicate requester emails", async () => {
    const requesters = await prisma.developmentRequester.findMany();

    const emails = requesters.map((requester) => requester.email);
    const uniqueEmails = new Set(emails);

    expect(uniqueEmails.size).toBe(emails.length);
  });
});