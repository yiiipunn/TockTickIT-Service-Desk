import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient, Priority, TicketStatus, UserRole } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/password.js";

export const LAB3_DEVELOPMENT_INITIAL_PASSWORD = "TokTickIT-Lab3!";

const categories = ["Account and Access", "Hardware", "Software", "Network"];

const relatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
];

const seedUsers = [
  { name: "Narin S.", email: "narin@example.com", role: UserRole.REQUESTER, isActive: true },
  { name: "Ploy K.", email: "ploy@example.com", role: UserRole.REQUESTER, isActive: true },
  { name: "Beam T.", email: "beam@example.com", role: UserRole.REQUESTER, isActive: true },
  { name: "Mew A.", email: "mew@example.com", role: UserRole.REQUESTER, isActive: true },
  { name: "Inactive User", email: "inactive@example.com", role: UserRole.REQUESTER, isActive: false },
  { name: "Ari Staff", email: "ari.staff@example.com", role: UserRole.IT_STAFF, isActive: true },
  { name: "Mali Staff", email: "mali.staff@example.com", role: UserRole.IT_STAFF, isActive: true },
  { name: "Kiet Staff", email: "kiet.staff@example.com", role: UserRole.IT_STAFF, isActive: true },
  { name: "Somchai Retired", email: "somchai.retired@example.com", role: UserRole.IT_STAFF, isActive: false },
  { name: "Anong Administrator", email: "anong.admin@example.com", role: UserRole.ADMINISTRATOR, isActive: true },
] as const;

type SeedTicket = {
  ticketNumber: string;
  requesterEmail: string;
  ownerEmail?: string;
  category: string;
  relatedSystem: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  status: TicketStatus;
  ownerAssignedAt?: Date;
  requesterResolutionIndicatedAt?: Date;
};

const seedTickets: SeedTicket[] = [
  {
    ticketNumber: "TKT-L3-000001",
    requesterEmail: "narin@example.com",
    category: "Account and Access",
    relatedSystem: "Email",
    summary: "Mailbox access stopped after device replacement",
    description: "The development mailbox asks for credentials repeatedly on the replacement laptop.",
    requestedPriority: Priority.HIGH,
    itPriority: Priority.HIGH,
    status: TicketStatus.NEW,
  },
  {
    ticketNumber: "TKT-L3-000002",
    requesterEmail: "ploy@example.com",
    ownerEmail: "ari.staff@example.com",
    category: "Hardware",
    relatedSystem: "Printer",
    summary: "Shared printer produces faded pages",
    description: "Print jobs complete, but the right side of every page is too faint to read.",
    requestedPriority: Priority.LOW,
    itPriority: Priority.MEDIUM,
    status: TicketStatus.OPEN,
    ownerAssignedAt: new Date("2026-09-12T02:00:00.000Z"),
  },
  {
    ticketNumber: "TKT-L3-000003",
    requesterEmail: "beam@example.com",
    ownerEmail: "mali.staff@example.com",
    category: "Network",
    relatedSystem: "VPN",
    summary: "VPN disconnects during test data upload",
    description: "The fictional test-data upload loses its connection after several minutes.",
    requestedPriority: Priority.MEDIUM,
    itPriority: Priority.HIGH,
    status: TicketStatus.IN_PROGRESS,
    ownerAssignedAt: new Date("2026-09-12T03:00:00.000Z"),
  },
  {
    ticketNumber: "TKT-L3-000004",
    requesterEmail: "mew@example.com",
    ownerEmail: "kiet.staff@example.com",
    category: "Software",
    relatedSystem: "LEB2 App",
    summary: "Course sandbox does not display a submitted file",
    description: "The submission receipt exists, but the sandbox preview remains empty.",
    requestedPriority: Priority.MEDIUM,
    itPriority: Priority.MEDIUM,
    status: TicketStatus.WAITING_FOR_REQUESTER,
    ownerAssignedAt: new Date("2026-09-12T04:00:00.000Z"),
  },
  {
    ticketNumber: "TKT-L3-000005",
    requesterEmail: "narin@example.com",
    ownerEmail: "ari.staff@example.com",
    category: "Account and Access",
    relatedSystem: "Grade Submission App",
    summary: "Practice grade sheet is available again",
    description: "Access was restored after refreshing the fictional course permissions.",
    requestedPriority: Priority.HIGH,
    itPriority: Priority.HIGH,
    status: TicketStatus.RESOLVED,
    ownerAssignedAt: new Date("2026-09-12T05:00:00.000Z"),
    requesterResolutionIndicatedAt: new Date("2026-09-12T06:00:00.000Z"),
  },
  {
    ticketNumber: "TKT-L3-000006",
    requesterEmail: "ploy@example.com",
    ownerEmail: "anong.admin@example.com",
    category: "Hardware",
    relatedSystem: "Printer",
    summary: "Demo printer queue was cleared",
    description: "The fictional stuck print job was removed and a test page completed.",
    requestedPriority: Priority.LOW,
    itPriority: Priority.LOW,
    status: TicketStatus.CLOSED,
    ownerAssignedAt: new Date("2026-09-11T03:00:00.000Z"),
  },
  {
    ticketNumber: "TKT-L3-000007",
    requesterEmail: "beam@example.com",
    ownerEmail: "mali.staff@example.com",
    category: "Network",
    relatedSystem: "Campus Wi-Fi",
    summary: "Intermittent sandbox Wi-Fi issue returned",
    description: "The lab access point again drops the fictional test device every few minutes.",
    requestedPriority: Priority.MEDIUM,
    itPriority: Priority.HIGH,
    status: TicketStatus.REOPENED,
    ownerAssignedAt: new Date("2026-09-13T03:00:00.000Z"),
  },
  {
    ticketNumber: "TKT-L3-000008",
    requesterEmail: "mew@example.com",
    category: "Software",
    relatedSystem: "LEB2 App",
    summary: "Duplicate sandbox request",
    description: "This fictional duplicate was cancelled after confirming the original Ticket.",
    requestedPriority: Priority.LOW,
    itPriority: Priority.LOW,
    status: TicketStatus.CANCELLED,
  },
];

export const LAB3_SEED_USER_EMAILS = seedUsers.map((user) => user.email);

type SeedDatabase = PrismaClient | Prisma.TransactionClient;

async function ensureSeedUser(
  prisma: SeedDatabase,
  user: (typeof seedUsers)[number],
) {
  const existing = await prisma.user.findUnique({ where: { email: user.email } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: user.name, role: user.role, isActive: user.isActive },
    });
  }

  return prisma.user.create({
    data: {
      ...user,
      passwordHash: await hashPassword(LAB3_DEVELOPMENT_INITIAL_PASSWORD),
      mustChangePassword: true,
    },
  });
}

export async function runSeed(prisma: SeedDatabase = getPrisma()) {

  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { name }, update: {}, create: { name } });
  }

  const users = new Map<string, Awaited<ReturnType<typeof ensureSeedUser>>>();
  for (const user of seedUsers) {
    users.set(user.email, await ensureSeedUser(prisma, user));
  }

  const categoryRows = await prisma.category.findMany();
  const systemRows = await prisma.relatedSystem.findMany();
  const categoryIds = new Map(categoryRows.map((category) => [category.name, category.id]));
  const systemIds = new Map(systemRows.map((system) => [system.name, system.id]));

  for (const ticket of seedTickets) {
    const requester = users.get(ticket.requesterEmail);
    const owner = ticket.ownerEmail ? users.get(ticket.ownerEmail) : undefined;
    const categoryId = categoryIds.get(ticket.category);
    const relatedSystemId = systemIds.get(ticket.relatedSystem);

    if (!requester || !categoryId || !relatedSystemId) {
      throw new Error(`Missing reference data for ${ticket.ticketNumber}`);
    }

    const data = {
      requesterId: requester.id,
      ownerId: owner?.id ?? null,
      categoryId,
      relatedSystemId,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      status: ticket.status,
      ownerAssignedAt: ticket.ownerAssignedAt ?? null,
      requesterResolutionIndicatedAt: ticket.requesterResolutionIndicatedAt ?? null,
    };

    await prisma.ticket.upsert({
      where: { ticketNumber: ticket.ticketNumber },
      update: data,
      create: { ticketNumber: ticket.ticketNumber, ...data },
    });
  }

  const resolvedTicket = await prisma.ticket.findUniqueOrThrow({
    where: { ticketNumber: "TKT-L3-000005" },
  });
  const requesterAuthor = users.get("narin@example.com");
  const staffAuthor = users.get("ari.staff@example.com");

  if (!requesterAuthor || !staffAuthor) {
    throw new Error("Missing comment seed authors");
  }

  const publicContent = "The practice grade sheet opens correctly now. Thank you.";
  const existingComment = await prisma.publicComment.findFirst({
    where: { ticketId: resolvedTicket.id, authorId: requesterAuthor.id, content: publicContent },
  });
  if (!existingComment) {
    await prisma.publicComment.create({
      data: { ticketId: resolvedTicket.id, authorId: requesterAuthor.id, content: publicContent },
    });
  }

  const noteContent = "Verified the fictional permission group before marking the Ticket resolved.";
  const existingNote = await prisma.internalNote.findFirst({
    where: { ticketId: resolvedTicket.id, authorId: staffAuthor.id, content: noteContent },
  });
  if (!existingNote) {
    await prisma.internalNote.create({
      data: { ticketId: resolvedTicket.id, authorId: staffAuthor.id, content: noteContent },
    });
  }

  console.log("Lab 3 seed completed.");
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (isDirectRun) {
  runSeed()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}
