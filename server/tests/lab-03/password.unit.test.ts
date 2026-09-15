import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/password.js";

describe("password verification", () => {
  it("verifies the correct value and safely rejects wrong or malformed hashes", async () => {
    const hash = await hashPassword("TokTickIT-Lab3!");
    await expect(verifyPassword(hash, "TokTickIT-Lab3!")).resolves.toBe(true);
    await expect(verifyPassword(hash, "incorrect-password")).resolves.toBe(false);
    await expect(verifyPassword("not-a-hash", "TokTickIT-Lab3!")).resolves.toBe(false);
  });
});
