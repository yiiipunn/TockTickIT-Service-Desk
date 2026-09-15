import { describe, expect, it } from "vitest";
import { LoginThrottle } from "../../src/login-throttle.js";

describe("login throttling", () => {
  it("blocks the fifth failure for one normalized email/IP pair", () => {
    const throttle = new LoginThrottle(15 * 60 * 1000, 5);
    const now = Date.parse("2026-09-15T00:00:00.000Z");
    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(throttle.recordFailure(" USER@example.com ", "127.0.0.1", now)).toBeNull();
    }
    expect(throttle.recordFailure("user@example.com", "127.0.0.1", now)).toBe(900);
    expect(throttle.retryAfter("user@example.com", "127.0.0.1", now + 1_000)).toBe(899);
  });

  it("isolates keys and clears on success or window expiry", () => {
    const throttle = new LoginThrottle(1_000, 2);
    throttle.recordFailure("user@example.com", "one", 0);
    expect(throttle.recordFailure("user@example.com", "one", 0)).toBe(1);
    expect(throttle.retryAfter("user@example.com", "two", 0)).toBeNull();
    throttle.clear("user@example.com", "one");
    expect(throttle.retryAfter("user@example.com", "one", 0)).toBeNull();
    throttle.recordFailure("user@example.com", "one", 0);
    throttle.recordFailure("user@example.com", "one", 0);
    expect(throttle.retryAfter("user@example.com", "one", 1_000)).toBeNull();
  });
});
