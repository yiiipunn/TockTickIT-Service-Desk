import {
  ActionStatus,
  PrismaClient,
  Priority,
  TicketStatus,
} from "@prisma/client";

export const DASHBOARD_ACTIVE_TICKET_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_REQUESTER,
  TicketStatus.REOPENED,
] as const;

const ACTIVE_ACTION_STATUSES = [
  ActionStatus.PLANNED,
  ActionStatus.IN_PROGRESS,
] as const;

const ALL_TICKET_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_REQUESTER,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.REOPENED,
  TicketStatus.CANCELLED,
] as const;

const ALL_PRIORITIES = [Priority.LOW, Priority.MEDIUM, Priority.HIGH] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function aggregateRowCount(row: { _count?: true | { _all?: number } }) {
  return typeof row._count === "object" ? row._count._all ?? 0 : 0;
}

const ticketListSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  itPriority: true,
  updatedAt: true,
} as const;

const actionListSelect = {
  id: true,
  status: true,
  actionAt: true,
  description: true,
  completedAt: true,
  ticket: {
    select: {
      id: true,
      ticketNumber: true,
      summary: true,
    },
  },
} as const;

export async function getStaffDashboardSnapshot(
  prisma: PrismaClient,
  currentUserId: number,
  asOf = new Date(),
) {
  const recentTicketBoundary = new Date(asOf.getTime() - 7 * DAY_MS);
  const recentActionBoundary = new Date(asOf.getTime() - 30 * DAY_MS);
  const activeTicketStatuses = [...DASHBOARD_ACTIVE_TICKET_STATUSES];
  const activeActionStatuses = [...ACTIVE_ACTION_STATUSES];

  const [
    unassignedOpenCount,
    myOpenTicketCount,
    myActiveActionsCount,
    groupedStatuses,
    groupedPriorities,
    urgentTickets,
    recentlyUpdated,
    myActiveActions,
    myRecentCompletedActions,
  ] = await prisma.$transaction([
    prisma.ticket.count({
      where: { status: { in: activeTicketStatuses }, ownerId: null },
    }),
    prisma.ticket.count({
      where: { status: { in: activeTicketStatuses }, ownerId: currentUserId },
    }),
    prisma.actionTaken.count({
      where: { assigneeId: currentUserId, status: { in: activeActionStatuses } },
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["itPriority"],
      where: { status: { in: activeTicketStatuses } },
      orderBy: { itPriority: "asc" },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: {
        status: { in: activeTicketStatuses },
        itPriority: Priority.HIGH,
      },
      select: ticketListSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.ticket.findMany({
      where: {
        status: { in: activeTicketStatuses },
        updatedAt: { gte: recentTicketBoundary, lte: asOf },
      },
      select: ticketListSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.actionTaken.findMany({
      where: {
        assigneeId: currentUserId,
        status: { in: activeActionStatuses },
      },
      select: actionListSelect,
      orderBy: [{ actionAt: "asc" }, { id: "asc" }],
      take: 10,
    }),
    prisma.actionTaken.findMany({
      where: {
        performedById: currentUserId,
        status: ActionStatus.COMPLETED,
        completedAt: { gte: recentActionBoundary, lte: asOf },
      },
      select: actionListSelect,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);

  const countsByStatus = Object.fromEntries(
    ALL_TICKET_STATUSES.map((status) => [status, 0]),
  ) as Record<TicketStatus, number>;
  for (const row of groupedStatuses) {
    countsByStatus[row.status] = aggregateRowCount(row);
  }

  const countsByItPriority = Object.fromEntries(
    ALL_PRIORITIES.map((priority) => [priority, 0]),
  ) as Record<Priority, number>;
  for (const row of groupedPriorities) {
    countsByItPriority[row.itPriority] = aggregateRowCount(row);
  }

  return {
    asOf: asOf.toISOString(),
    timezone: "UTC" as const,
    metrics: {
      unassignedOpenCount,
      myOpenTicketCount,
      myActiveActionsCount,
      countsByStatus,
      countsByItPriority,
    },
    urgentTickets,
    recentlyUpdated,
    myActiveActions,
    myRecentCompletedActions,
    links: {
      unassigned: "/api/staff/tickets?owner=unassigned&scope=open&page=1&pageSize=20",
      mine: "/api/staff/tickets?owner=me&scope=open&page=1&pageSize=20",
      urgent: "/api/staff/tickets?itPriority=HIGH&scope=open&page=1&pageSize=20",
    },
  };
}
