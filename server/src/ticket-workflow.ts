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

export const ACTIVE_TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
] as const satisfies readonly TicketStatus[];

export interface ResolutionGateFacts {
  hasActiveOwner: boolean;
  completedActions: number;
  activeActions: number;
}

export function requiresActiveOwner(status: TicketStatus) {
  return status === "IN_PROGRESS" || status === "RESOLVED";
}

export function resolutionGate(facts: ResolutionGateFacts) {
  const fields: Record<string, string> = {};
  if (!facts.hasActiveOwner) {
    fields.owner = "Assign an active IT Staff member or Administrator before resolving this Ticket.";
  }
  if (facts.completedActions < 1) {
    fields.completedActions = "Complete at least one Action before resolving this Ticket.";
  }
  if (facts.activeActions > 0) {
    fields.activeActions = "Complete or cancel every planned or in-progress Action before resolving this Ticket.";
  }
  return {
    canResolve: Object.keys(fields).length === 0,
    fields,
  };
}

export function allowedStatusTransitions(
  status: TicketStatus,
  hasActiveOwner: boolean,
  canResolve = true,
) {
  return transitions[status].filter((next) =>
    (hasActiveOwner || !requiresActiveOwner(next)) &&
    (next !== "RESOLVED" || canResolve));
}

export function isListedTransition(currentStatus: TicketStatus, status: TicketStatus) {
  return transitions[currentStatus].includes(status);
}
