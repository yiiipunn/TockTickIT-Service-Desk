import { describe, expect, it } from "vitest";
import {
  hashPassword,
  validatePasswordChange,
  verifyPassword,
} from "../../src/password.js";

describe("password verification", () => {
  it("verifies the correct value and safely rejects wrong or malformed hashes", async () => {
    const hash = await hashPassword("TokTickIT-Lab3!");
    await expect(verifyPassword(hash, "TokTickIT-Lab3!")).resolves.toBe(true);
    await expect(verifyPassword(hash, "incorrect-password")).resolves.toBe(false);
    await expect(verifyPassword("not-a-hash", "TokTickIT-Lab3!")).resolves.toBe(false);
  });

  it("accepts the exact 12 and 128 character password boundaries", () => {
    expect(validatePasswordChange("current-value", "a".repeat(12), "a".repeat(12)))
      .toEqual({});
    expect(validatePasswordChange("current-value", "a".repeat(128), "a".repeat(128)))
      .toEqual({});
  });

  it("rejects passwords outside the policy without weakening confirmation checks", () => {
    expect(validatePasswordChange("a".repeat(129), "new-password!", "new-password!"))
      .toHaveProperty("currentPassword");
    expect(validatePasswordChange("current-value", "a".repeat(11), "a".repeat(11)))
      .toHaveProperty("newPassword");
    expect(validatePasswordChange("current-value", "a".repeat(129), "a".repeat(129)))
      .toHaveProperty("newPassword");
    expect(validatePasswordChange("current-value", " ".repeat(12), " ".repeat(12)))
      .toHaveProperty("newPassword", "Password cannot contain only whitespace.");
    expect(validatePasswordChange("current-value", "current-value", "current-value"))
      .toHaveProperty("newPassword", "New password must differ from your current password.");
    expect(validatePasswordChange("current-value", "new-password!", "different-value"))
      .toHaveProperty("confirmPassword", "Passwords do not match.");
  });
});
