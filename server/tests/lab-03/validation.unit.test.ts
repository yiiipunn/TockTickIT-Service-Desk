import { describe, expect, it } from "vitest";
import { adminSafetyConflict } from "../../src/app.js";

describe("Lab 3 User Management validation", () => {
  const administrator = { id: 7, role: "ADMINISTRATOR" as const, isActive: true };

  it("blocks removal of the final active Administrator capability", () => {
    expect(adminSafetyConflict(administrator, 3, "ADMINISTRATOR", false, 1)).toBe("LAST_ACTIVE_ADMIN");
    expect(adminSafetyConflict(administrator, 3, "REQUESTER", true, 1)).toBe("LAST_ACTIVE_ADMIN");
    expect(adminSafetyConflict(administrator, 3, "IT_STAFF", true, 1)).toBe("LAST_ACTIVE_ADMIN");
  });

  it("allows safe changes when another active Administrator exists and blocks self-deactivation", () => {
    expect(adminSafetyConflict(administrator, 3, "IT_STAFF", true, 2)).toBeNull();
    expect(adminSafetyConflict(administrator, 7, "ADMINISTRATOR", false, 2)).toBe("SELF_DEACTIVATION");
  });
});
