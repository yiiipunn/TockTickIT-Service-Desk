import { describe, expect, it } from "vitest";
import {
  allowedStatusTransitions,
  isListedTransition,
  requiresActiveOwner,
} from "../../src/ticket-workflow.js";

describe("Ticket status transition policy", () => {
  it("matches the approved transition table and keeps CANCELLED terminal", () => {
    expect(allowedStatusTransitions("NEW", true)).toEqual(["OPEN", "CANCELLED"]);
    expect(allowedStatusTransitions("OPEN", true)).toEqual(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
    expect(allowedStatusTransitions("IN_PROGRESS", true)).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
    expect(allowedStatusTransitions("WAITING_FOR_REQUESTER", true)).toEqual(["IN_PROGRESS", "RESOLVED", "CANCELLED"]);
    expect(allowedStatusTransitions("RESOLVED", true)).toEqual(["CLOSED", "REOPENED"]);
    expect(allowedStatusTransitions("CLOSED", true)).toEqual(["REOPENED"]);
    expect(allowedStatusTransitions("REOPENED", true)).toEqual(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);
    expect(allowedStatusTransitions("CANCELLED", true)).toEqual([]);
    expect(isListedTransition("CANCELLED", "OPEN")).toBe(false);
  });

  it("requires an active owner only for IN_PROGRESS and RESOLVED", () => {
    expect(requiresActiveOwner("IN_PROGRESS")).toBe(true);
    expect(requiresActiveOwner("RESOLVED")).toBe(true);
    expect(requiresActiveOwner("WAITING_FOR_REQUESTER")).toBe(false);
    expect(allowedStatusTransitions("OPEN", false)).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
  });
});
