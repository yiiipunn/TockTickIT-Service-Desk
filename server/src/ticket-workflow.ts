import type { TicketStatus } from "@prisma/client";

const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export function requiresActiveOwner(status: TicketStatus) {
  return status === "IN_PROGRESS" || status === "RESOLVED";
}

export function allowedStatusTransitions(status: TicketStatus, hasActiveOwner: boolean) {
  return transitions[status].filter((next) => hasActiveOwner || !requiresActiveOwner(next));
}

export function isListedTransition(currentStatus: TicketStatus, status: TicketStatus) {
  return transitions[currentStatus].includes(status);
}
