import { describe, expect, it } from "vitest";
import type { TicketStatus } from "@prisma/client";
import { allowedStatusTransitions, resolutionGate } from "../../src/ticket-workflow.js";

const matrix: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

describe("Lab 4 Ticket workflow rules", () => {
  it("[FLOW-UNIT-01 / AC-12, AC-13] returns the complete transition matrix", () => {
    for (const [status, expected] of Object.entries(matrix) as Array<[TicketStatus, TicketStatus[]]>) {
      expect(allowedStatusTransitions(status, true, true)).toEqual(expected);
    }
  });

  it("[FLOW-UNIT-02 / AC-13, AC-14] filters owner- and resolution-dependent choices", () => {
    expect(allowedStatusTransitions("OPEN", false, false)).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(allowedStatusTransitions("REOPENED", false, false)).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(allowedStatusTransitions("RESOLVED", false, false)).toEqual(["CLOSED", "REOPENED"]);
  });

  it("[FLOW-UNIT-03 / AC-14] explains every failed resolution condition", () => {
    expect(resolutionGate({ hasActiveOwner: false, completedActions: 0, activeActions: 2 })).toEqual({
      canResolve: false,
      fields: {
        owner: "Assign an active IT Staff member or Administrator before resolving this Ticket.",
        completedActions: "Complete at least one Action before resolving this Ticket.",
        activeActions: "Complete or cancel every planned or in-progress Action before resolving this Ticket.",
      },
    });
    expect(resolutionGate({ hasActiveOwner: true, completedActions: 1, activeActions: 0 })).toEqual({
      canResolve: true,
      fields: {},
    });
  });
});
