import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export const SESSION_COOKIE_NAME = "toktickit_session";
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AuthenticationContext {
  sessionId: number;
  csrfTokenHash: string;
  user: SafeUser;
}

export function generateOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function digestToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenMatchesDigest(token: string, expectedDigest: string) {
  const actual = Buffer.from(digestToken(token), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sessionExpiry(now = new Date()) {
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  return {
    expiresAt: new Date(Math.min(
      now.getTime() + SESSION_IDLE_MS,
      absoluteExpiresAt.getTime(),
    )),
    absoluteExpiresAt,
  };
}

export function safeUser(user: SafeUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

function cookieValue(req: Request, name: string) {
  const cookies = req.header("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return null;
}

function isLocalHttp() {
  const origin = process.env.CLIENT_ORIGIN?.trim() || "http://localhost:5173";
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: !isLocalHttp(),
  path: "/",
  maxAge: SESSION_ABSOLUTE_MS,
});

export const sessionCookieClearOptions = () => {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  return options;
};

export async function createSession(userId: number, now = new Date()) {
  const prisma = getPrisma();
  const sessionToken = generateOpaqueToken();
  const csrfToken = generateOpaqueToken();
  const expiry = sessionExpiry(now);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: digestToken(sessionToken),
      csrfTokenHash: digestToken(csrfToken),
      ...expiry,
      lastActivityAt: now,
    },
  });
  return { session, sessionToken, csrfToken };
}

export async function resolveAuthentication(req: Request) {
  const rawToken = cookieValue(req, SESSION_COOKIE_NAME);
  if (!rawToken) return null;

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { tokenHash: digestToken(rawToken) },
    include: { user: true },
  });
  if (!session || session.revokedAt) return null;

  const now = new Date();
  if (!session.user.isActive || session.expiresAt <= now || session.absoluteExpiresAt <= now) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return null;
  }

  const expiresAt = new Date(Math.min(
    now.getTime() + SESSION_IDLE_MS,
    session.absoluteExpiresAt.getTime(),
  ));
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivityAt: now, expiresAt },
  });

  return {
    sessionId: session.id,
    csrfTokenHash: session.csrfTokenHash,
    user: safeUser(session.user),
  } satisfies AuthenticationContext;
}

export function authenticationContext(res: Response) {
  return res.locals.authentication as AuthenticationContext;
}

export function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  return res.status(status).json({
    error: { code, message, ...(fields ? { fields } : {}) },
  });
}

export async function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authentication = await resolveAuthentication(req);
    if (!authentication) {
      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieClearOptions());
      sendApiError(res, 401, "AUTH_REQUIRED", "Authentication is required.");
      return;
    }
    res.locals.authentication = authentication;
    next();
  } catch {
    sendApiError(res, 500, "INTERNAL_ERROR", "Unable to authenticate the request.");
  }
}

export function requirePasswordChangeComplete(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (authenticationContext(res).user.mustChangePassword) {
    sendApiError(
      res,
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "You must change your password before continuing.",
    );
    return;
  }
  next();
}

function allowedOrigins() {
  return (process.env.CLIENT_ORIGIN?.trim() || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("origin");
  const csrfToken = req.header("X-CSRF-Token");
  const authentication = authenticationContext(res);

  if (
    !origin ||
    !allowedOrigins().includes(origin) ||
    !csrfToken ||
    !tokenMatchesDigest(csrfToken, authentication.csrfTokenHash)
  ) {
    sendApiError(res, 403, "CSRF_INVALID", "The request security token is invalid.");
    return;
  }
  next();
}

export async function rotateCsrfToken(sessionId: number) {
  const csrfToken = generateOpaqueToken();
  await getPrisma().session.update({
    where: { id: sessionId },
    data: { csrfTokenHash: digestToken(csrfToken) },
  });
  return csrfToken;
}
