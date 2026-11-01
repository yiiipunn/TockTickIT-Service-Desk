import { PrismaClient, TicketStatus } from "@prisma/client";
import { DASHBOARD_ACTIVE_TICKET_STATUSES } from "./staff-dashboard.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const requesterTicketListSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  requestedPriority: true,
  updatedAt: true,
  resolvedAt: true,
} as const;

export async function getRequesterDashboardSnapshot(
  prisma: PrismaClient,
  requesterId: number,
  asOf = new Date(),
) {
  const recentBoundary = new Date(asOf.getTime() - 30 * DAY_MS);
  const activeStatuses = [...DASHBOARD_ACTIVE_TICKET_STATUSES];

  const [
    openCount,
    waitingForRequesterCount,
    attentionRequired,
    recentlyUpdated,
    recentlyResolved,
  ] = await prisma.$transaction([
    prisma.ticket.count({
      where: { requesterId, status: { in: activeStatuses } },
    }),
    prisma.ticket.count({
      where: { requesterId, status: TicketStatus.WAITING_FOR_REQUESTER },
    }),
    prisma.ticket.findMany({
      where: { requesterId, status: TicketStatus.WAITING_FOR_REQUESTER },
      select: requesterTicketListSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.ticket.findMany({
      where: {
        requesterId,
        updatedAt: { gte: recentBoundary, lte: asOf },
      },
      select: requesterTicketListSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
    prisma.ticket.findMany({
      where: {
        requesterId,
        resolvedAt: { gte: recentBoundary, lte: asOf },
      },
      select: requesterTicketListSelect,
      orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);

  return {
    asOf: asOf.toISOString(),
    timezone: "UTC" as const,
    metrics: { openCount, waitingForRequesterCount },
    attentionRequired,
    recentlyUpdated,
    recentlyResolved,
    links: {
      open: "/api/tickets?scope=open&page=1&pageSize=10",
      waitingForRequester:
        "/api/tickets?status=WAITING_FOR_REQUESTER&page=1&pageSize=10",
    },
  };
}
