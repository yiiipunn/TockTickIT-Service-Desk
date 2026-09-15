import { describe, expect, it } from "vitest";
import {
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  digestToken,
  generateOpaqueToken,
  sessionExpiry,
  tokenMatchesDigest,
} from "../../src/auth.js";

describe("session and CSRF helpers", () => {
  it("creates independent 32-byte opaque values and stores only digests", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    expect(Buffer.from(second, "base64url")).toHaveLength(32);
    expect(first).not.toBe(second);
    expect(digestToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(digestToken(first)).not.toContain(first);
    expect(tokenMatchesDigest(first, digestToken(first))).toBe(true);
    expect(tokenMatchesDigest(second, digestToken(first))).toBe(false);
  });

  it("uses a 30-minute idle and eight-hour absolute expiry", () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const expiry = sessionExpiry(now);
    expect(expiry.expiresAt.getTime() - now.getTime()).toBe(SESSION_IDLE_MS);
    expect(expiry.absoluteExpiresAt.getTime() - now.getTime()).toBe(
      SESSION_ABSOLUTE_MS,
    );
  });
});
