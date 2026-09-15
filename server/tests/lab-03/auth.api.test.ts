import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { digestToken, SESSION_COOKIE_NAME } from "../../src/auth.js";
import { loginThrottle } from "../../src/login-throttle.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const password = "TokTickIT-Lab3!";
const activeEmail = "auth-active@example.com";
const inactiveEmail = "auth-inactive@example.com";
const restrictedEmail = "auth-restricted@example.com";
const origin = "http://localhost:5173";
let initialPasswordHash = "";

function cookieFrom(response: request.Response) {
  const values = response.headers["set-cookie"] as unknown as string[] | undefined;
  return values?.[0]?.split(";", 1)[0] ?? "";
}

async function login(email = activeEmail, suppliedPassword = password) {
  return request(app).post("/api/auth/login").send({ email, password: suppliedPassword });
}

describe("Authentication Foundation API", () => {
  beforeAll(async () => {
    initialPasswordHash = await hashPassword(password);
    await Promise.all([
      prisma.user.upsert({
        where: { email: activeEmail },
        update: { name: "Active Auth User", passwordHash: initialPasswordHash, role: "REQUESTER", isActive: true, mustChangePassword: false },
        create: { name: "Active Auth User", email: activeEmail, passwordHash: initialPasswordHash, role: "REQUESTER", isActive: true, mustChangePassword: false },
      }),
      prisma.user.upsert({
        where: { email: inactiveEmail },
        update: { name: "Inactive Auth User", passwordHash: initialPasswordHash, role: "REQUESTER", isActive: false, mustChangePassword: false },
        create: { name: "Inactive Auth User", email: inactiveEmail, passwordHash: initialPasswordHash, role: "REQUESTER", isActive: false, mustChangePassword: false },
      }),
      prisma.user.upsert({
        where: { email: restrictedEmail },
        update: { name: "Restricted Auth User", passwordHash: initialPasswordHash, role: "REQUESTER", isActive: true, mustChangePassword: true },
        create: { name: "Restricted Auth User", email: restrictedEmail, passwordHash: initialPasswordHash, role: "REQUESTER", isActive: true, mustChangePassword: true },
      }),
    ]);
  });

  beforeEach(async () => {
    loginThrottle.reset();
    await prisma.session.deleteMany({
      where: { user: { email: { in: [activeEmail, inactiveEmail, restrictedEmail] } } },
    });
    await Promise.all([
      prisma.user.update({
        where: { email: activeEmail },
        data: { passwordHash: initialPasswordHash, isActive: true, mustChangePassword: false },
      }),
      prisma.user.update({
        where: { email: inactiveEmail },
        data: { passwordHash: initialPasswordHash, isActive: false, mustChangePassword: false },
      }),
      prisma.user.update({
        where: { email: restrictedEmail },
        data: { passwordHash: initialPasswordHash, isActive: true, mustChangePassword: true },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { user: { email: { in: [activeEmail, inactiveEmail, restrictedEmail] } } },
    });
  });

  it("logs in an active user and persists only token digests", async () => {
    const response = await login(" AUTH-ACTIVE@EXAMPLE.COM ");
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      name: "Active Auth User",
      email: activeEmail,
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    });
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.csrfToken).toEqual(expect.any(String));

    const cookie = cookieFrom(response);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect((response.headers["set-cookie"] as unknown as string[])[0]).toMatch(/HttpOnly/i);
    expect((response.headers["set-cookie"] as unknown as string[])[0]).toMatch(/SameSite=Lax/i);

    const rawToken = cookie.slice(cookie.indexOf("=") + 1);
    const stored = await prisma.session.findUnique({ where: { tokenHash: digestToken(rawToken) } });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(rawToken);
    expect(stored?.csrfTokenHash).not.toBe(response.body.data.csrfToken);
  });

  it("returns the safe current user through a persisted cookie", async () => {
    const loginResponse = await login();
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieFrom(loginResponse));
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(activeEmail);
    expect(response.body.data).toHaveProperty("csrfToken");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("uses safe errors for wrong and nonexistent credentials", async () => {
    for (const email of [activeEmail, "missing-account@example.com"]) {
      const response = await login(email, "wrong-password");
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "The email or password is incorrect.",
        },
      });
      expect(JSON.stringify(response.body)).not.toMatch(/hash|argon|sql/i);
    }
  });

  it("rejects an inactive account without creating a session", async () => {
    const response = await login(inactiveEmail);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_INACTIVE");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("throttles the fifth failed login for an email/IP pair", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login("throttled@example.com", "wrong-password");
      expect(response.status).toBe(attempt === 5 ? 429 : 401);
      if (attempt === 5) {
        expect(response.body.error.code).toBe("LOGIN_THROTTLED");
        expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
      }
    }
  });

  it("rejects missing authentication on current-user and protected APIs", async () => {
    const [me, categories] = await Promise.all([
      request(app).get("/api/auth/me"),
      request(app).get("/api/categories"),
    ]);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("AUTH_REQUIRED");
    expect(categories.status).toBe(401);
    expect(categories.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("enforces the password-change-required boundary without a bypass", async () => {
    const loginResponse = await login(restrictedEmail);
    const cookie = cookieFrom(loginResponse);
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    const categories = await request(app).get("/api/categories").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.mustChangePassword).toBe(true);
    expect(categories.status).toBe(403);
    expect(categories.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("validates password changes without mutating the password or restriction", async () => {
    const loginResponse = await login(restrictedEmail);
    const cookie = cookieFrom(loginResponse);
    const csrfToken = loginResponse.body.data.csrfToken as string;
    const cases = [
      { currentPassword: "", newPassword: "new-password!", confirmPassword: "new-password!" },
      { currentPassword: password, newPassword: "short", confirmPassword: "short" },
      { currentPassword: password, newPassword: " ".repeat(12), confirmPassword: " ".repeat(12) },
      { currentPassword: password, newPassword: password, confirmPassword: password },
      { currentPassword: password, newPassword: "new-password!", confirmPassword: "different-value" },
    ];

    for (const body of cases) {
      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrfToken)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields).toEqual(expect.any(Object));
    }

    for (const malformedBody of [
      ["not", "an", "object"],
      { currentPassword: 123, newPassword: "new-password!", confirmPassword: "new-password!" },
      { currentPassword: password, newPassword: "new-password!", confirmPassword: "new-password!", role: "ADMINISTRATOR" },
    ]) {
      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrfToken)
        .send(malformedBody);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }

    const incorrect = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        currentPassword: "incorrect-password",
        newPassword: "new-password!",
        confirmPassword: "new-password!",
      });
    expect(incorrect.status).toBe(401);
    expect(incorrect.body.error.code).toBe("INVALID_CREDENTIALS");

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: restrictedEmail } });
    expect(stored.mustChangePassword).toBe(true);
    await expect(verifyPassword(stored.passwordHash, password)).resolves.toBe(true);
  });

  it("changes the password atomically, clears the restriction, and rotates all sessions", async () => {
    const firstLogin = await login(restrictedEmail);
    const secondLogin = await login(restrictedEmail);
    const firstCookie = cookieFrom(firstLogin);
    const secondCookie = cookieFrom(secondLogin);
    const newPassword = "TokTickIT-New!";

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", firstCookie)
      .set("Origin", origin)
      .set("X-CSRF-Token", firstLogin.body.data.csrfToken)
      .send({
        currentPassword: password,
        newPassword,
        confirmPassword: newPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.mustChangePassword).toBe(false);
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    const replacementCookie = cookieFrom(response);
    expect(replacementCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(replacementCookie).not.toBe(firstCookie);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: restrictedEmail } });
    expect(stored.mustChangePassword).toBe(false);
    expect(stored.passwordHash).not.toBe(newPassword);
    await expect(verifyPassword(stored.passwordHash, newPassword)).resolves.toBe(true);
    await expect(verifyPassword(stored.passwordHash, password)).resolves.toBe(false);

    for (const revokedCookie of [firstCookie, secondCookie]) {
      const replay = await request(app).get("/api/auth/me").set("Cookie", revokedCookie);
      expect(replay.status).toBe(401);
    }
    const current = await request(app).get("/api/auth/me").set("Cookie", replacementCookie);
    expect(current.status).toBe(200);
    expect(current.body.data.user.mustChangePassword).toBe(false);
    const categories = await request(app).get("/api/categories").set("Cookie", replacementCookie);
    expect(categories.status).toBe(200);

    expect((await login(restrictedEmail, password)).status).toBe(401);
    expect((await login(restrictedEmail, newPassword)).status).toBe(200);
  });

  it("protects password changes with authentication, Origin, and CSRF", async () => {
    const unauthenticated = await request(app).post("/api/auth/change-password").send({});
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe("AUTH_REQUIRED");

    const loginResponse = await login(restrictedEmail);
    const cookie = cookieFrom(loginResponse);
    const missingCsrf = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: password, newPassword: "new-password!", confirmPassword: "new-password!" });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_INVALID");
  });

  it("requires the allowed Origin and session-bound CSRF token for mutations", async () => {
    const loginResponse = await login();
    const cookie = cookieFrom(loginResponse);
    const missing = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    const invalid = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set("X-CSRF-Token", "invalid");
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe("CSRF_INVALID");
    expect(invalid.status).toBe(403);
    expect(invalid.body.error.code).toBe("CSRF_INVALID");
  });

  it("revokes logout sessions and rejects replay", async () => {
    const loginResponse = await login();
    const cookie = cookieFrom(loginResponse);
    const csrfToken = loginResponse.body.data.csrfToken as string;
    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken);
    expect(logout.status).toBe(204);
    const replay = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(replay.status).toBe(401);
  });

  it("rejects an expired session", async () => {
    const loginResponse = await login();
    const cookie = cookieFrom(loginResponse);
    const rawToken = cookie.slice(cookie.indexOf("=") + 1);
    await prisma.session.update({
      where: { tokenHash: digestToken(rawToken) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const response = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(response.status).toBe(401);
  });
});
