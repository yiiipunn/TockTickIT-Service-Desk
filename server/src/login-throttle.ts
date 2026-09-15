const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_FAILURE_LIMIT = 5;

interface FailureWindow {
  count: number;
  startedAt: number;
}

export class LoginThrottle {
  private readonly failures = new Map<string, FailureWindow>();

  constructor(
    private readonly windowMs = DEFAULT_WINDOW_MS,
    private readonly failureLimit = DEFAULT_FAILURE_LIMIT,
  ) {}

  private key(email: string, ip: string) {
    return `${email.trim().toLowerCase()}\u0000${ip}`;
  }

  retryAfter(email: string, ip: string, now = Date.now()): number | null {
    const key = this.key(email, ip);
    const failure = this.failures.get(key);

    if (!failure) return null;

    const elapsed = now - failure.startedAt;
    if (elapsed >= this.windowMs) {
      this.failures.delete(key);
      return null;
    }

    if (failure.count < this.failureLimit) return null;
    return Math.max(1, Math.ceil((this.windowMs - elapsed) / 1000));
  }

  recordFailure(email: string, ip: string, now = Date.now()): number | null {
    const key = this.key(email, ip);
    const existing = this.failures.get(key);
    const failure = !existing || now - existing.startedAt >= this.windowMs
      ? { count: 1, startedAt: now }
      : { ...existing, count: existing.count + 1 };

    this.failures.set(key, failure);
    return this.retryAfter(email, ip, now);
  }

  clear(email: string, ip: string) {
    this.failures.delete(this.key(email, ip));
  }

  reset() {
    this.failures.clear();
  }
}

export const loginThrottle = new LoginThrottle();
