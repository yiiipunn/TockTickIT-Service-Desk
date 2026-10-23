import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionEventType,
  ActionStatus,
  Prisma,
  PrismaClient,
  Priority,
  Ticket,
  TicketStatus,
  UserRole,
} from "@prisma/client";
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
  resolvedAt?: Date;
  updatedAt: Date;
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
    updatedAt: new Date("2026-10-23T01:00:00.000Z"),
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
    updatedAt: new Date("2026-10-22T02:00:00.000Z"),
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
    updatedAt: new Date("2026-10-21T03:00:00.000Z"),
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
    updatedAt: new Date("2026-10-20T04:00:00.000Z"),
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
    resolvedAt: new Date("2026-10-19T05:00:00.000Z"),
    updatedAt: new Date("2026-10-19T05:00:00.000Z"),
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
    resolvedAt: new Date("2026-09-01T03:00:00.000Z"),
    updatedAt: new Date("2026-09-02T03:00:00.000Z"),
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
    updatedAt: new Date("2026-10-18T03:00:00.000Z"),
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
    updatedAt: new Date("2026-08-01T03:00:00.000Z"),
  },
];

type SeedActionEvent = {
  eventType: ActionEventType;
  actorEmail: string;
  createdAt: Date;
  fromStatus?: ActionStatus;
  toStatus?: ActionStatus;
};

type SeedAction = {
  ticketNumber: string;
  actionAt: Date;
  description: string;
  result?: string;
  status: ActionStatus;
  assigneeEmail: string;
  createdByEmail: string;
  performedByEmail?: string;
  followUpRequired: boolean;
  followUpNote?: string;
  attachmentNotes?: string;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledByEmail?: string;
  cancellationReason?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  events: SeedActionEvent[];
};

const seedActions: SeedAction[] = [
  {
    ticketNumber: "TKT-L3-000002",
    actionAt: new Date("2026-10-24T02:00:00.000Z"),
    description: "Inspect the shared printer and prepare a toner test page.",
    status: ActionStatus.PLANNED,
    assigneeEmail: "ari.staff@example.com",
    createdByEmail: "mali.staff@example.com",
    followUpRequired: true,
    followUpNote: "Compare the test page with the requester's faded sample.",
    attachmentNotes: "See the printer sample attached to the Ticket.",
    version: 1,
    createdAt: new Date("2026-10-22T02:10:00.000Z"),
    updatedAt: new Date("2026-10-22T02:10:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "mali.staff@example.com",
        createdAt: new Date("2026-10-22T02:10:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000003",
    actionAt: new Date("2026-10-21T04:00:00.000Z"),
    description: "Capture VPN disconnect diagnostics during a controlled upload.",
    status: ActionStatus.IN_PROGRESS,
    assigneeEmail: "mali.staff@example.com",
    createdByEmail: "ari.staff@example.com",
    followUpRequired: false,
    attachmentNotes: "Record the diagnostic filename in the completion result.",
    version: 2,
    createdAt: new Date("2026-10-20T03:00:00.000Z"),
    updatedAt: new Date("2026-10-21T03:30:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "ari.staff@example.com",
        createdAt: new Date("2026-10-20T03:00:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "mali.staff@example.com",
        createdAt: new Date("2026-10-21T03:30:00.000Z"),
        fromStatus: ActionStatus.PLANNED,
        toStatus: ActionStatus.IN_PROGRESS,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000003",
    actionAt: new Date("2026-10-20T05:00:00.000Z"),
    description: "Refresh the VPN profile and verify a complete test upload.",
    result: "The refreshed profile completed the controlled upload without disconnecting.",
    status: ActionStatus.COMPLETED,
    assigneeEmail: "kiet.staff@example.com",
    createdByEmail: "ari.staff@example.com",
    performedByEmail: "mali.staff@example.com",
    followUpRequired: true,
    followUpNote: "Confirm stability with the requester after one business day.",
    completedAt: new Date("2026-10-20T05:30:00.000Z"),
    version: 3,
    createdAt: new Date("2026-10-19T03:00:00.000Z"),
    updatedAt: new Date("2026-10-20T05:30:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "ari.staff@example.com",
        createdAt: new Date("2026-10-19T03:00:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "kiet.staff@example.com",
        createdAt: new Date("2026-10-20T04:30:00.000Z"),
        fromStatus: ActionStatus.PLANNED,
        toStatus: ActionStatus.IN_PROGRESS,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "mali.staff@example.com",
        createdAt: new Date("2026-10-20T05:30:00.000Z"),
        fromStatus: ActionStatus.IN_PROGRESS,
        toStatus: ActionStatus.COMPLETED,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000003",
    actionAt: new Date("2026-10-22T06:00:00.000Z"),
    description: "Collect an additional packet trace after the profile test.",
    status: ActionStatus.CANCELLED,
    assigneeEmail: "anong.admin@example.com",
    createdByEmail: "mali.staff@example.com",
    followUpRequired: false,
    cancelledAt: new Date("2026-10-21T06:30:00.000Z"),
    cancelledByEmail: "anong.admin@example.com",
    cancellationReason: "The successful controlled upload made the additional trace unnecessary.",
    version: 2,
    createdAt: new Date("2026-10-21T06:00:00.000Z"),
    updatedAt: new Date("2026-10-21T06:30:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "mali.staff@example.com",
        createdAt: new Date("2026-10-21T06:00:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "anong.admin@example.com",
        createdAt: new Date("2026-10-21T06:30:00.000Z"),
        fromStatus: ActionStatus.PLANNED,
        toStatus: ActionStatus.CANCELLED,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000004",
    actionAt: new Date("2026-10-25T04:00:00.000Z"),
    description: "Review the requester's replacement preview file after upload.",
    status: ActionStatus.PLANNED,
    assigneeEmail: "kiet.staff@example.com",
    createdByEmail: "kiet.staff@example.com",
    followUpRequired: true,
    followUpNote: "Wait for the requester to attach the replacement file.",
    version: 1,
    createdAt: new Date("2026-10-20T04:10:00.000Z"),
    updatedAt: new Date("2026-10-20T04:10:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "kiet.staff@example.com",
        createdAt: new Date("2026-10-20T04:10:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000005",
    actionAt: new Date("2026-10-19T04:00:00.000Z"),
    description: "Refresh the fictional course permission group and verify access.",
    result: "The practice grade sheet opened successfully for the requester.",
    status: ActionStatus.COMPLETED,
    assigneeEmail: "ari.staff@example.com",
    createdByEmail: "anong.admin@example.com",
    performedByEmail: "kiet.staff@example.com",
    followUpRequired: false,
    attachmentNotes: "See the access confirmation attached to the Ticket.",
    completedAt: new Date("2026-10-19T04:30:00.000Z"),
    version: 3,
    createdAt: new Date("2026-10-18T04:00:00.000Z"),
    updatedAt: new Date("2026-10-19T04:30:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "anong.admin@example.com",
        createdAt: new Date("2026-10-18T04:00:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "ari.staff@example.com",
        createdAt: new Date("2026-10-19T03:30:00.000Z"),
        fromStatus: ActionStatus.PLANNED,
        toStatus: ActionStatus.IN_PROGRESS,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "kiet.staff@example.com",
        createdAt: new Date("2026-10-19T04:30:00.000Z"),
        fromStatus: ActionStatus.IN_PROGRESS,
        toStatus: ActionStatus.COMPLETED,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000006",
    actionAt: new Date("2026-09-01T02:00:00.000Z"),
    description: "Clear the fictional print queue and verify a test page.",
    result: "The queue cleared and the test page printed successfully.",
    status: ActionStatus.COMPLETED,
    assigneeEmail: "somchai.retired@example.com",
    createdByEmail: "anong.admin@example.com",
    performedByEmail: "ari.staff@example.com",
    followUpRequired: false,
    completedAt: new Date("2026-09-01T02:30:00.000Z"),
    version: 3,
    createdAt: new Date("2026-08-31T02:00:00.000Z"),
    updatedAt: new Date("2026-09-01T02:30:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "anong.admin@example.com",
        createdAt: new Date("2026-08-31T02:00:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "somchai.retired@example.com",
        createdAt: new Date("2026-09-01T02:10:00.000Z"),
        fromStatus: ActionStatus.PLANNED,
        toStatus: ActionStatus.IN_PROGRESS,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "ari.staff@example.com",
        createdAt: new Date("2026-09-01T02:30:00.000Z"),
        fromStatus: ActionStatus.IN_PROGRESS,
        toStatus: ActionStatus.COMPLETED,
      },
    ],
  },
  {
    ticketNumber: "TKT-L3-000007",
    actionAt: new Date("2026-10-18T05:00:00.000Z"),
    description: "Monitor the lab access point while reproducing the disconnect.",
    status: ActionStatus.IN_PROGRESS,
    assigneeEmail: "mali.staff@example.com",
    createdByEmail: "mali.staff@example.com",
    followUpRequired: false,
    version: 2,
    createdAt: new Date("2026-10-18T04:00:00.000Z"),
    updatedAt: new Date("2026-10-18T04:30:00.000Z"),
    events: [
      {
        eventType: ActionEventType.CREATED,
        actorEmail: "mali.staff@example.com",
        createdAt: new Date("2026-10-18T04:00:00.000Z"),
        toStatus: ActionStatus.PLANNED,
      },
      {
        eventType: ActionEventType.STATUS_CHANGED,
        actorEmail: "mali.staff@example.com",
        createdAt: new Date("2026-10-18T04:30:00.000Z"),
        fromStatus: ActionStatus.PLANNED,
        toStatus: ActionStatus.IN_PROGRESS,
      },
    ],
  },
];

export const LAB4_SEED_TICKET_NUMBERS = seedTickets.map((ticket) => ticket.ticketNumber);
export const LAB4_SEED_ACTION_DESCRIPTIONS = seedActions.map((action) => action.description);

export const LAB3_SEED_USER_EMAILS = seedUsers.map((user) => user.email);

type SeedDatabase = PrismaClient | Prisma.TransactionClient;

async function ensureSeedUser(
  prisma: SeedDatabase,
  user: (typeof seedUsers)[number],
) {
  const existing = await prisma.user.findUnique({ where: { email: user.email } });

  if (existing) {
    if (
      existing.name === user.name &&
      existing.role === user.role &&
      existing.isActive === user.isActive
    ) {
      return existing;
    }

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

  const tickets = new Map<string, Ticket>();
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
      resolvedAt: ticket.resolvedAt ?? null,
      version: 1,
      updatedAt: ticket.updatedAt,
    };

    const row = await prisma.ticket.upsert({
      where: { ticketNumber: ticket.ticketNumber },
      update: data,
      create: { ticketNumber: ticket.ticketNumber, ...data },
    });
    tickets.set(ticket.ticketNumber, row);
  }

  for (const action of seedActions) {
    const ticket = tickets.get(action.ticketNumber);
    const assignee = users.get(action.assigneeEmail);
    const createdBy = users.get(action.createdByEmail);
    const performedBy = action.performedByEmail
      ? users.get(action.performedByEmail)
      : undefined;
    const cancelledBy = action.cancelledByEmail
      ? users.get(action.cancelledByEmail)
      : undefined;

    if (!ticket || !assignee || !createdBy) {
      throw new Error(`Missing Action reference data for ${action.ticketNumber}`);
    }
    if (action.performedByEmail && !performedBy) {
      throw new Error(`Missing Action performer ${action.performedByEmail}`);
    }
    if (action.cancelledByEmail && !cancelledBy) {
      throw new Error(`Missing Action canceller ${action.cancelledByEmail}`);
    }

    const actionData = {
      ticketId: ticket.id,
      actionAt: action.actionAt,
      description: action.description,
      result: action.result ?? null,
      status: action.status,
      assigneeId: assignee.id,
      createdById: createdBy.id,
      performedById: performedBy?.id ?? null,
      followUpRequired: action.followUpRequired,
      followUpNote: action.followUpNote ?? null,
      attachmentNotes: action.attachmentNotes ?? null,
      completedAt: action.completedAt ?? null,
      cancelledAt: action.cancelledAt ?? null,
      cancelledById: cancelledBy?.id ?? null,
      cancellationReason: action.cancellationReason ?? null,
      version: action.version,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    };

    const matches = await prisma.actionTaken.findMany({
      where: {
        ticketId: ticket.id,
        actionAt: action.actionAt,
        description: action.description,
      },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (matches.length > 1) {
      throw new Error(`Duplicate Lab 4 seed Action for ${action.ticketNumber}`);
    }

    const actionRow = matches[0]
      ? await prisma.actionTaken.update({
          where: { id: matches[0].id },
          data: actionData,
        })
      : await prisma.actionTaken.create({ data: actionData });

    for (const event of action.events) {
      const actor = users.get(event.actorEmail);
      if (!actor) {
        throw new Error(`Missing Action event actor ${event.actorEmail}`);
      }

      const eventData = {
        actionTakenId: actionRow.id,
        actorId: actor.id,
        eventType: event.eventType,
        fromStatus: event.fromStatus ?? null,
        toStatus: event.toStatus ?? null,
        fromAssigneeId: event.eventType === ActionEventType.CREATED ? null : assignee.id,
        toAssigneeId: assignee.id,
        snapshot: {
          source: "lab4-seed",
          ticketNumber: action.ticketNumber,
          actionStatus: event.toStatus ?? action.status,
        },
        createdAt: event.createdAt,
      } satisfies Prisma.ActionTakenEventUncheckedCreateInput;

      const eventMatches = await prisma.actionTakenEvent.findMany({
        where: {
          actionTakenId: actionRow.id,
          eventType: event.eventType,
          createdAt: event.createdAt,
        },
        orderBy: { id: "asc" },
        take: 2,
      });
      if (eventMatches.length > 1) {
        throw new Error(`Duplicate Lab 4 seed Action event for Action ${actionRow.id}`);
      }

      if (!eventMatches[0]) {
        await prisma.actionTakenEvent.create({ data: eventData });
      }
    }
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

  console.log("Lab 4 seed completed.");
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
