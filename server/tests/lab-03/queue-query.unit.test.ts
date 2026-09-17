import { describe, expect, it } from "vitest";
import {
  StaffQueueQueryError,
  parseStaffQueueQuery,
} from "../../src/staff-queue.js";

describe("IT Staff Ticket Queue query parser", () => {
  it("uses the approved defaults and safely ignores an empty search", () => {
    expect(parseStaffQueueQuery({ search: "   " })).toEqual({
      search: "",
      sortBy: "updatedAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 20,
    });
  });

  it("accepts each approved filter, sort, and page value", () => {
    expect(parseStaffQueueQuery({
      search: "  Narin  ",
      status: "OPEN",
      requestedPriority: "LOW",
      itPriority: "HIGH",
      owner: "42",
      sortBy: "itPriority",
      sortOrder: "asc",
      page: "2",
      pageSize: "50",
    })).toEqual({
      search: "Narin",
      status: "OPEN",
      requestedPriority: "LOW",
      itPriority: "HIGH",
      owner: 42,
      sortBy: "itPriority",
      sortOrder: "asc",
      page: 2,
      pageSize: 50,
    });
    expect(parseStaffQueueQuery({ owner: "me" }).owner).toBe("me");
    expect(parseStaffQueueQuery({ owner: "unassigned" }).owner).toBe("unassigned");
  });

  it.each([
    { status: "UNKNOWN" },
    { requestedPriority: "URGENT" },
    { owner: "0" },
    { sortBy: "owner" },
    { sortOrder: "up" },
    { page: "0" },
    { pageSize: "15" },
    { unexpected: "value" },
    { search: "x".repeat(121) },
    { status: ["NEW", "OPEN"] },
  ])("rejects unsupported queue query %o", (query) => {
    expect(() => parseStaffQueueQuery(query)).toThrow(StaffQueueQueryError);
  });
});
