import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------
  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // -------------------------------------------------------------------------
  // Related Systems
  // -------------------------------------------------------------------------
  const relatedSystems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
  ];

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // -------------------------------------------------------------------------
  // Development Requesters
  // At least 4 active + 1 inactive
  // -------------------------------------------------------------------------
  const requesters = [
    {
      name: "Narin S.",
      email: "narin@example.com",
      isActive: true,
    },
    {
      name: "Ploy K.",
      email: "ploy@example.com",
      isActive: true,
    },
    {
      name: "Beam T.",
      email: "beam@example.com",
      isActive: true,
    },
    {
      name: "Mew A.",
      email: "mew@example.com",
      isActive: true,
    },
    {
      name: "Inactive User",
      email: "inactive@example.com",
      isActive: false,
    },
  ];

  for (const requester of requesters) {
    await prisma.developmentRequester.upsert({
      where: {
        email: requester.email,
      },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  console.log("Lab 2 seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });