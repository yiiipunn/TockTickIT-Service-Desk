import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, Priority, TicketStatus, UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import {
  SESSION_COOKIE_NAME,
  authenticationContext,
  createSession,
  digestToken,
  generateOpaqueToken,
  requireAuthentication,
  requireCsrf,
  requirePasswordChangeComplete,
  requireRole,
  rotateCsrfToken,
  safeUser,
  sendApiError,
  sessionCookieClearOptions,
  sessionCookieOptions,
  sessionExpiry,
} from "./auth.js";
import { loginThrottle } from "./login-throttle.js";
import {
  hashPassword,
  validatePasswordChange,
  verifyPassword,
} from "./password.js";
import {
  StaffQueueQueryError,
  parseStaffQueueQuery,
} from "./staff-queue.js";
import {
  allowedStatusTransitions,
  isListedTransition,
  requiresActiveOwner,
} from "./ticket-workflow.js";

export const app = express();

app.use(cors({
  origin: (process.env.CLIENT_ORIGIN?.trim() || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim()),
  credentials: true,
}));
app.use(express.json());
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error && typeof error === "object" && "type" in error &&
      error.type === "entity.parse.failed") {
    sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid JSON.");
    return;
  }
  next(error);
});

const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,p=1,t=2$8NhbztGbBnByHe2w/eRexQ$c95zo22n2FswcZF9t22Lc8+dYy7mB7xkMl6vVR41ysk";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ATTACHMENT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const DEFAULT_ATTACHMENT_STORAGE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "storage",
  "attachments",
);

function getAttachmentStorageDir() {
  return process.env.ATTACHMENT_STORAGE_DIR?.trim() ||
    DEFAULT_ATTACHMENT_STORAGE_DIR;
}

function getAttachmentPath(storedFilename: string) {
  if (basename(storedFilename) !== storedFilename) {
    throw new Error("Invalid attachment storage identifier");
  }

  return resolve(getAttachmentStorageDir(), storedFilename);
}

function fileContentMatchesMimeType(file: Express.Multer.File) {
  const { buffer, mimetype } = file;

  if (mimetype === "image/jpeg") {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (mimetype === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
  }

  if (mimetype === "image/webp") {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  if (mimetype === "application/pdf") {
    return buffer.length >= 5 &&
      buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  return false;
}

function getDownloadDisposition(originalFilename: string) {
  const asciiFilename = originalFilename
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");
  const encodedFilename = encodeURIComponent(originalFilename)
    .replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

  return `attachment; filename="${asciiFilename || "attachment"}"; filename*=UTF-8''${encodedFilename}`;
}

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      callback(
        new Error(
          "Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP, PDF.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

function sendAttachmentError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function attachmentMetadata<T extends { storedFilename?: string }>(
  attachment: T,
) {
  const { storedFilename: _storedFilename, ...metadata } = attachment;
  return metadata;
}

class AttachmentLimitError extends Error {}

// ---------------------------------------------------------------------------
// API health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TokTickIT API",
  });
});

// ---------------------------------------------------------------------------
// Lab 3 - Authentication Foundation
// ---------------------------------------------------------------------------
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown> | null;
  const fields: Record<string, string> = {};
  const allowedFields = new Set(["email", "password"]);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendApiError(
      res,
      400,
      "VALIDATION_ERROR",
      "The request contains invalid data.",
    );
  }

  const unknownField = Object.keys(body).find((key) => !allowedFields.has(key));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fields.email = "Enter a valid email address.";
  }
  if (!password || password.length > 128) {
    fields.password = "Enter your password.";
  }
  if (unknownField) {
    fields[unknownField] = "This field is not allowed.";
  }
  if (Object.keys(fields).length > 0) {
    return sendApiError(
      res,
      400,
      "VALIDATION_ERROR",
      "The request contains invalid data.",
      fields,
    );
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const existingRetryAfter = loginThrottle.retryAfter(email, ip);
  if (existingRetryAfter !== null) {
    res.set("Retry-After", String(existingRetryAfter));
    return sendApiError(
      res,
      429,
      "LOGIN_THROTTLED",
      "Too many sign-in attempts. Try again later.",
    );
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );

    if (!user || !passwordMatches) {
      const retryAfter = loginThrottle.recordFailure(email, ip);
      if (retryAfter !== null) {
        res.set("Retry-After", String(retryAfter));
        return sendApiError(
          res,
          429,
          "LOGIN_THROTTLED",
          "Too many sign-in attempts. Try again later.",
        );
      }
      return sendApiError(
        res,
        401,
        "INVALID_CREDENTIALS",
        "The email or password is incorrect.",
      );
    }

    if (!user.isActive) {
      const retryAfter = loginThrottle.recordFailure(email, ip);
      if (retryAfter !== null) {
        res.set("Retry-After", String(retryAfter));
        return sendApiError(
          res,
          429,
          "LOGIN_THROTTLED",
          "Too many sign-in attempts. Try again later.",
        );
      }
      return sendApiError(
        res,
        403,
        "ACCOUNT_INACTIVE",
        "This account cannot sign in. Contact an administrator.",
      );
    }

    loginThrottle.clear(email, ip);
    const { sessionToken, csrfToken } = await createSession(user.id);
    res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    return res.status(200).json({
      data: { user: safeUser(user), csrfToken },
    });
  } catch {
    return sendApiError(
      res,
      500,
      "INTERNAL_ERROR",
      "Unable to sign in right now.",
    );
  }
});

app.get(
  "/api/auth/me",
  requireAuthentication,
  async (_req: Request, res: Response) => {
    try {
      const authentication = authenticationContext(res);
      const csrfToken = await rotateCsrfToken(authentication.sessionId);
      return res.status(200).json({
        data: { user: authentication.user, csrfToken },
      });
    } catch {
      return sendApiError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to load the current user.",
      );
    }
  },
);

app.post(
  "/api/auth/change-password",
  requireAuthentication,
  requireCsrf,
  async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | null;
    const allowedFields = new Set([
      "currentPassword",
      "newPassword",
      "confirmPassword",
    ]);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendApiError(
        res,
        400,
        "VALIDATION_ERROR",
        "The request contains invalid data.",
      );
    }

    const currentPassword = typeof body.currentPassword === "string"
      ? body.currentPassword
      : "";
    const newPassword = typeof body.newPassword === "string"
      ? body.newPassword
      : "";
    const confirmPassword = typeof body.confirmPassword === "string"
      ? body.confirmPassword
      : "";
    const fields = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmPassword,
    );
    const unknownField = Object.keys(body).find((key) => !allowedFields.has(key));
    if (unknownField) {
      fields[unknownField] = "This field is not allowed.";
    }

    if (Object.keys(fields).length > 0) {
      return sendApiError(
        res,
        400,
        "VALIDATION_ERROR",
        "The request contains invalid data.",
        fields,
      );
    }

    try {
      const prisma = getPrisma();
      const authentication = authenticationContext(res);
      const user = await prisma.user.findUnique({
        where: { id: authentication.user.id },
      });
      const currentPasswordMatches = user?.isActive
        ? await verifyPassword(user.passwordHash, currentPassword)
        : false;

      if (!user || !currentPasswordMatches) {
        return sendApiError(
          res,
          401,
          "INVALID_CREDENTIALS",
          "The current password is incorrect.",
          { currentPassword: "The current password is incorrect." },
        );
      }

      const passwordHash = await hashPassword(newPassword);
      const sessionToken = generateOpaqueToken();
      const csrfToken = generateOpaqueToken();
      const now = new Date();
      const expiry = sessionExpiry(now);

      const changed = await prisma.$transaction(async (transaction) => {
        const update = await transaction.user.updateMany({
          where: {
            id: user.id,
            isActive: true,
            passwordHash: user.passwordHash,
          },
          data: { passwordHash, mustChangePassword: false },
        });
        if (update.count !== 1) return false;

        await transaction.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.session.create({
          data: {
            userId: user.id,
            tokenHash: digestToken(sessionToken),
            csrfTokenHash: digestToken(csrfToken),
            ...expiry,
            lastActivityAt: now,
          },
        });
        return true;
      });

      if (!changed) {
        res.clearCookie(SESSION_COOKIE_NAME, sessionCookieClearOptions());
        return sendApiError(
          res,
          401,
          "AUTH_REQUIRED",
          "Authentication is required.",
        );
      }

      res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
      return res.status(200).json({
        data: {
          user: safeUser({ ...user, mustChangePassword: false }),
          csrfToken,
        },
      });
    } catch {
      return sendApiError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to change your password right now.",
      );
    }
  },
);

app.post(
  "/api/auth/logout",
  requireAuthentication,
  requireCsrf,
  async (_req: Request, res: Response) => {
    try {
      const authentication = authenticationContext(res);
      await getPrisma().session.updateMany({
        where: { id: authentication.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieClearOptions());
      return res.status(204).send();
    } catch {
      return sendApiError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to sign out right now.",
      );
    }
  },
);

app.use("/api", requireAuthentication, requirePasswordChangeComplete);
app.use("/api", (req: Request, res: Response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  requireCsrf(req, res, next);
});

// ---------------------------------------------------------------------------
// Lab 3 - IT Staff Ticket Queue
// ---------------------------------------------------------------------------
app.get("/api/staff/tickets", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  try {
    const query = parseStaffQueueQuery(req.query);
    const prisma = getPrisma();
    const currentUserId = authenticationContext(res).user.id;

    if (typeof query.owner === "number") {
      const eligibleOwner = await prisma.user.findFirst({
        where: {
          id: query.owner,
          isActive: true,
          role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
        },
        select: { id: true },
      });
      if (!eligibleOwner) {
        return sendApiError(
          res,
          400,
          "INVALID_QUERY",
          "The queue query is invalid.",
        );
      }
    }

    const where: Prisma.TicketWhereInput = {
      ...(query.status !== undefined && { status: query.status }),
      ...(query.requestedPriority !== undefined && {
        requestedPriority: query.requestedPriority,
      }),
      ...(query.itPriority !== undefined && { itPriority: query.itPriority }),
      ...(query.owner === "me" && { ownerId: currentUserId }),
      ...(query.owner === "unassigned" && { ownerId: null }),
      ...(typeof query.owner === "number" && { ownerId: query.owner }),
      ...(query.search && {
        OR: [
          { ticketNumber: { contains: query.search, mode: "insensitive" } },
          { summary: { contains: query.search, mode: "insensitive" } },
          {
            requester: {
              is: {
                OR: [
                  { name: { contains: query.search, mode: "insensitive" } },
                  { email: { contains: query.search, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }),
    };
    const skip = (query.page - 1) * query.pageSize;

    const [items, totalItems, matchingUnassigned] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          status: true,
          requestedPriority: true,
          itPriority: true,
          updatedAt: true,
          requester: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: [
          { [query.sortBy]: query.sortOrder },
          { id: "desc" },
        ],
        skip,
        take: query.pageSize,
      }),
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, ownerId: null } }),
    ]);

    return res.status(200).json({
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
      },
      counts: { matching: totalItems, matchingUnassigned },
    });
  } catch (error) {
    if (error instanceof StaffQueueQueryError) {
      return sendApiError(res, 400, "INVALID_QUERY", "The queue query is invalid.");
    }
    return sendApiError(
      res,
      500,
      "INTERNAL_ERROR",
      "Unable to load the Ticket Queue right now.",
    );
  }
});

app.get("/api/staff/eligible-owners", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  _req: Request,
  res: Response,
) => {
  try {
    const items = await getPrisma().user.findMany({
      where: {
        isActive: true,
        role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ items });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to load eligible owners right now.");
  }
});

const communicationEntrySelect = {
  id: true,
  ticketId: true,
  content: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const satisfies Prisma.PublicCommentSelect;

const staffTicketDetailSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  description: true,
  requestedPriority: true,
  itPriority: true,
  status: true,
  ownerAssignedAt: true,
  requesterResolutionIndicatedAt: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, isActive: true, role: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    select: {
      id: true,
      ticketId: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      isRemoved: true,
      removedAt: true,
      removalReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  publicComments: {
    select: communicationEntrySelect,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  internalNotes: {
    select: communicationEntrySelect,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} as const satisfies Prisma.TicketSelect;

type StaffTicketDetailRecord = Prisma.TicketGetPayload<{
  select: typeof staffTicketDetailSelect;
}>;

function staffTicketDetailData(ticket: StaffTicketDetailRecord) {
  const { owner, ...data } = ticket;
  const activeOwner = owner !== null && owner.isActive &&
    (owner.role === "IT_STAFF" || owner.role === "ADMINISTRATOR");
  return {
    ...data,
    owner: owner ? { id: owner.id, name: owner.name } : null,
    allowedTransitions: allowedStatusTransitions(ticket.status, activeOwner),
  };
}

function staffTicketId(value: string) {
  const ticketId = Number(value);
  return Number.isInteger(ticketId) && ticketId > 0 ? ticketId : null;
}

app.get("/api/staff/tickets/:ticketId", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) {
    return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  }
  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: ticketId },
      select: staffTicketDetailSelect,
    });
    if (!ticket) {
      return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    }
    return res.status(200).json({ data: staffTicketDetailData(ticket) });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to load the Ticket right now.");
  }
});

app.post("/api/staff/tickets/:ticketId/claim", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null || !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length !== 0) {
    return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.");
  }
  try {
    const prisma = getPrisma();
    const now = new Date();
    const ownerId = authenticationContext(res).user.id;
    const claimed = await prisma.ticket.updateMany({
      where: { id: ticketId, ownerId: null },
      data: { ownerId, ownerAssignedAt: now },
    });
    if (claimed.count !== 1) {
      const exists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (!exists) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
      return sendApiError(res, 409, "OWNER_CONFLICT", "This Ticket is already assigned.");
    }
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: staffTicketDetailSelect,
    });
    return res.status(200).json({ data: staffTicketDetailData(ticket) });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to claim the Ticket right now.");
  }
});

app.patch("/api/staff/tickets/:ticketId/owner", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  const body = req.body as Record<string, unknown> | null;
  const fields: Record<string, string> = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.");
  }
  const unknownField = Object.keys(body).find((key) => key !== "ownerId");
  const ownerId = body.ownerId;
  if (ticketId === null) {
    return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  }
  if (unknownField) fields[unknownField] = "This field is not allowed.";
  if (ownerId !== null && (!Number.isInteger(ownerId) || (ownerId as number) <= 0)) {
    fields.ownerId = "Select an eligible owner.";
  }
  if (Object.keys(fields).length > 0) {
    return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", fields);
  }

  try {
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");

    if (ownerId !== null) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId as number },
        select: { id: true, isActive: true, role: true },
      });
      if (!owner) return sendApiError(res, 404, "USER_NOT_FOUND", "The selected User is not available.");
      if (!owner.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(owner.role)) {
        return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", {
          ownerId: "Select an active IT Staff or Administrator.",
        });
      }
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ownerId: ownerId as number | null,
        ownerAssignedAt: ownerId === null ? null : new Date(),
      },
      select: staffTicketDetailSelect,
    });
    return res.status(200).json({ data: staffTicketDetailData(updated) });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to update the Ticket assignment right now.");
  }
});

app.patch("/api/staff/tickets/:ticketId/it-priority", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) {
    return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  }
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, "itPriority") ||
      !Object.values(Priority).includes(body.itPriority as Priority)) {
    return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", {
      itPriority: "Select LOW, MEDIUM, or HIGH.",
    });
  }

  try {
    const prisma = getPrisma();
    const exists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!exists) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { itPriority: body.itPriority as Priority },
      select: staffTicketDetailSelect,
    });
    return res.status(200).json({ data: staffTicketDetailData(ticket) });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to update IT Priority right now.");
  }
});

app.patch("/api/staff/tickets/:ticketId/status", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) {
    return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  }
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["currentStatus", "status", "confirmed"].includes(key)) ||
      !Object.values(TicketStatus).includes(body.currentStatus as TicketStatus) ||
      !Object.values(TicketStatus).includes(body.status as TicketStatus) ||
      (body.confirmed !== undefined && typeof body.confirmed !== "boolean")) {
    return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.");
  }
  const currentStatus = body.currentStatus as TicketStatus;
  const status = body.status as TicketStatus;

  try {
    const prisma = getPrisma();
    const existing = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!existing) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    if (existing.status !== currentStatus || !isListedTransition(currentStatus, status)) {
      return sendApiError(res, 409, "STATUS_CONFLICT", "The Ticket status has changed or the transition is not permitted.");
    }
    if ((status === "CLOSED" || status === "CANCELLED") && body.confirmed !== true) {
      return sendApiError(res, 400, "VALIDATION_ERROR", "Confirmation is required for this status change.", {
        confirmed: "Confirm this status change.",
      });
    }

    const updated = await prisma.ticket.updateMany({
      where: {
        id: ticketId,
        status: currentStatus,
        ...(requiresActiveOwner(status) && {
          owner: { is: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } } },
        }),
      },
      data: {
        status,
        ...(status === "REOPENED" && { requesterResolutionIndicatedAt: null }),
      },
    });
    if (updated.count !== 1) {
      return sendApiError(res, 409, "STATUS_CONFLICT", "The Ticket status has changed or the transition is not permitted.");
    }
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: staffTicketDetailSelect });
    return res.status(200).json({ data: staffTicketDetailData(ticket) });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to update the Ticket status right now.");
  }
});

function validCommunicationContent(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, "content")) return null;
  const content = (body as { content: unknown }).content;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  return trimmed.length >= 1 && trimmed.length <= 2000 ? trimmed : null;
}

function communicationValidationError(res: Response) {
  return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", {
    content: "Enter 1 to 2000 characters of plain text and no other fields.",
  });
}

async function accessiblePublicTicket(ticketId: number, res: Response) {
  const user = authenticationContext(res).user;
  return getPrisma().ticket.findFirst({
    where: user.role === "REQUESTER" ? { id: ticketId, requesterId: user.id } : { id: ticketId },
    select: { id: true },
  });
}

app.get("/api/tickets/:ticketId/public-comments", async (req: Request, res: Response) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  try {
    if (!await accessiblePublicTicket(ticketId, res)) {
      return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    }
    const items = await getPrisma().publicComment.findMany({
      where: { ticketId }, select: communicationEntrySelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ items });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to load Public Comments right now.");
  }
});

app.post("/api/tickets/:ticketId/public-comments", async (req: Request, res: Response) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  try {
    if (!await accessiblePublicTicket(ticketId, res)) {
      return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    }
    const content = validCommunicationContent(req.body);
    if (content === null) return communicationValidationError(res);
    const data = await getPrisma().publicComment.create({
      data: { ticketId, authorId: authenticationContext(res).user.id, content },
      select: communicationEntrySelect,
    });
    return res.status(201).json({ data });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to post the Public Comment right now.");
  }
});

app.get("/api/staff/tickets/:ticketId/internal-notes", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    const items = await getPrisma().internalNote.findMany({
      where: { ticketId }, select: communicationEntrySelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ items });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to load Internal Notes right now.");
  }
});

app.post("/api/staff/tickets/:ticketId/internal-notes", requireRole("IT_STAFF", "ADMINISTRATOR"), async (
  req: Request,
  res: Response,
) => {
  const ticketId = staffTicketId(req.params.ticketId);
  if (ticketId === null) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
  try {
    const ticket = await getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) return sendApiError(res, 404, "TICKET_NOT_FOUND", "The Ticket is not available.");
    const content = validCommunicationContent(req.body);
    if (content === null) return communicationValidationError(res);
    const data = await getPrisma().internalNote.create({
      data: { ticketId, authorId: authenticationContext(res).user.id, content },
      select: communicationEntrySelect,
    });
    return res.status(201).json({ data });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to add the Internal Note right now.");
  }
});

// ---------------------------------------------------------------------------
// Lab 3 - Administrator User Management
// ---------------------------------------------------------------------------
const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

const userRoles = new Set<UserRole>(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]);

function administratorUserId(value: string) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function normalizedEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function trimmedUserName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

function initialPasswordError(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128 || /^\s+$/.test(value)) {
    return "Password must contain 12 to 128 characters and cannot contain only whitespace.";
  }
  return null;
}

function userValidationError(res: Response, fields: Record<string, string>) {
  return sendApiError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", fields);
}

export function adminSafetyConflict(
  target: { id: number; role: UserRole; isActive: boolean },
  actorId: number,
  nextRole: UserRole,
  nextActive: boolean,
  activeAdministratorCount: number,
) {
  if (target.id === actorId && target.isActive && !nextActive) return "SELF_DEACTIVATION" as const;
  if (target.isActive && target.role === "ADMINISTRATOR" &&
      (!nextActive || nextRole !== "ADMINISTRATOR") && activeAdministratorCount <= 1) {
    return "LAST_ACTIVE_ADMIN" as const;
  }
  return null;
}

function strictObject(body: unknown, allowed: readonly string[]) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const object = body as Record<string, unknown>;
  const unknown = Object.keys(object).find((key) => !allowed.includes(key));
  return unknown ? { object, unknown } : { object, unknown: null };
}

function parseCreateUser(body: unknown) {
  const parsed = strictObject(body, ["name", "email", "role", "isActive", "initialPassword"]);
  const fields: Record<string, string> = {};
  if (!parsed) return { fields: { body: "Send a valid User object." } };
  if (parsed.unknown) fields[parsed.unknown] = "This field is not allowed.";
  const name = trimmedUserName(parsed.object.name);
  const email = normalizedEmail(parsed.object.email);
  const role = typeof parsed.object.role === "string" && userRoles.has(parsed.object.role as UserRole)
    ? parsed.object.role as UserRole : null;
  const isActive = parsed.object.isActive;
  const passwordError = initialPasswordError(parsed.object.initialPassword);
  if (!name) fields.name = "Enter a name from 1 to 100 characters.";
  if (!email) fields.email = "Enter a valid email address.";
  if (!role) fields.role = "Select one valid role.";
  if (typeof isActive !== "boolean") fields.isActive = "Select whether the account is active.";
  if (passwordError) fields.initialPassword = passwordError;
  return Object.keys(fields).length ? { fields } : {
    fields,
    data: { name: name!, email: email!, role: role!, isActive: isActive as boolean, initialPassword: parsed.object.initialPassword as string },
  };
}

function parseEditUser(body: unknown) {
  const parsed = strictObject(body, ["name", "email", "role", "isActive"]);
  const fields: Record<string, string> = {};
  if (!parsed) return { fields: { body: "Send a valid User object." } };
  if (parsed.unknown) fields[parsed.unknown] = "This field is not allowed.";
  if (Object.keys(parsed.object).length === 0) fields.body = "Provide at least one editable field.";
  const data: { name?: string; email?: string; role?: UserRole; isActive?: boolean } = {};
  if ("name" in parsed.object) {
    const name = trimmedUserName(parsed.object.name);
    if (!name) fields.name = "Enter a name from 1 to 100 characters.";
    else data.name = name;
  }
  if ("email" in parsed.object) {
    const email = normalizedEmail(parsed.object.email);
    if (!email) fields.email = "Enter a valid email address.";
    else data.email = email;
  }
  if ("role" in parsed.object) {
    if (typeof parsed.object.role !== "string" || !userRoles.has(parsed.object.role as UserRole)) fields.role = "Select one valid role.";
    else data.role = parsed.object.role as UserRole;
  }
  if ("isActive" in parsed.object) {
    if (typeof parsed.object.isActive !== "boolean") fields.isActive = "Select whether the account is active.";
    else data.isActive = parsed.object.isActive;
  }
  return Object.keys(fields).length ? { fields } : { fields, data };
}

async function emailAlreadyUsed(email: string, exceptUserId?: number) {
  return getPrisma().user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });
}

app.get("/api/admin/users", requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  const allowedQuery = new Set(["search", "role"]);
  const unknown = Object.keys(req.query).find((key) => !allowedQuery.has(key));
  const search = req.query.search;
  const role = req.query.role;
  if (unknown || (search !== undefined && (typeof search !== "string" || search.length > 120)) ||
      (role !== undefined && (typeof role !== "string" || !userRoles.has(role as UserRole)))) {
    return sendApiError(res, 400, "INVALID_QUERY", "The query contains invalid data.");
  }
  try {
    const needle = typeof search === "string" ? search.trim() : "";
    const items = await getPrisma().user.findMany({
      where: {
        ...(role ? { role: role as UserRole } : {}),
        ...(needle ? { OR: [
          { name: { contains: needle, mode: "insensitive" } },
          { email: { contains: needle, mode: "insensitive" } },
        ] } : {}),
      },
      select: adminUserSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({ items });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to load Users right now.");
  }
});

app.post("/api/admin/users", requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  const parsed = parseCreateUser(req.body);
  if (Object.keys(parsed.fields).length || !parsed.data) return userValidationError(res, parsed.fields);
  try {
    if (await emailAlreadyUsed(parsed.data.email)) {
      return sendApiError(res, 409, "DUPLICATE_EMAIL", "An account already uses that email address.");
    }
    const data = await getPrisma().user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        isActive: parsed.data.isActive,
        passwordHash: await hashPassword(parsed.data.initialPassword),
        mustChangePassword: true,
      },
      select: adminUserSelect,
    });
    return res.status(201).json({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendApiError(res, 409, "DUPLICATE_EMAIL", "An account already uses that email address.");
    }
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to create the User right now.");
  }
});

app.patch("/api/admin/users/:userId", requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  const userId = administratorUserId(req.params.userId);
  if (userId === null) return sendApiError(res, 404, "USER_NOT_FOUND", "The User is not available.");
  const parsed = parseEditUser(req.body);
  if (Object.keys(parsed.fields).length || !parsed.data) return userValidationError(res, parsed.fields);
  try {
    const data = await getPrisma().$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: userId } });
      if (!target) return { error: "missing" as const };
      const nextRole = parsed.data.role ?? target.role;
      const nextActive = parsed.data.isActive ?? target.isActive;
      if (parsed.data.email) {
        const duplicate = await transaction.user.findFirst({
          where: { email: { equals: parsed.data.email, mode: "insensitive" }, id: { not: target.id } },
          select: { id: true },
        });
        if (duplicate) return { error: "duplicate" as const };
      }
      const removesAdministrator = target.isActive && target.role === "ADMINISTRATOR" &&
        (!nextActive || nextRole !== "ADMINISTRATOR");
      const activeAdministrators = removesAdministrator
        ? await transaction.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })
        : 0;
      const safety = adminSafetyConflict(target, authenticationContext(res).user.id, nextRole, nextActive, activeAdministrators);
      if (safety === "SELF_DEACTIVATION") return { error: "self" as const };
      if (safety === "LAST_ACTIVE_ADMIN") return { error: "lastAdmin" as const };
      const updated = await transaction.user.update({ where: { id: target.id }, data: parsed.data, select: adminUserSelect });
      if (!nextActive) {
        await transaction.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      if (!nextActive || nextRole === "REQUESTER") {
        await transaction.ticket.updateMany({ where: { ownerId: target.id }, data: { ownerId: null, ownerAssignedAt: null } });
      }
      return { data: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in data) {
      if (data.error === "missing") return sendApiError(res, 404, "USER_NOT_FOUND", "The User is not available.");
      if (data.error === "self") return sendApiError(res, 409, "SELF_DEACTIVATION", "Administrators cannot deactivate their own account.");
      if (data.error === "duplicate") return sendApiError(res, 409, "DUPLICATE_EMAIL", "An account already uses that email address.");
      return sendApiError(res, 409, "LAST_ACTIVE_ADMIN", "At least one active Administrator must remain.");
    }
    return res.status(200).json({ data: data.data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendApiError(res, 409, "DUPLICATE_EMAIL", "An account already uses that email address.");
    }
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to update the User right now.");
  }
});

app.post("/api/admin/users/:userId/initial-password", requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  const userId = administratorUserId(req.params.userId);
  if (userId === null) return sendApiError(res, 404, "USER_NOT_FOUND", "The User is not available.");
  const parsed = strictObject(req.body, ["initialPassword"]);
  const fields: Record<string, string> = {};
  if (!parsed) fields.body = "Send a valid User object.";
  else {
    if (parsed.unknown) fields[parsed.unknown] = "This field is not allowed.";
    const passwordError = initialPasswordError(parsed.object.initialPassword);
    if (passwordError) fields.initialPassword = passwordError;
  }
  if (Object.keys(fields).length) return userValidationError(res, fields);
  try {
    const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return sendApiError(res, 404, "USER_NOT_FOUND", "The User is not available.");
    await getPrisma().$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword((parsed!.object.initialPassword as string)), mustChangePassword: true },
      });
      await transaction.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return res.status(200).json({ data: { userId, mustChangePassword: true } });
  } catch {
    return sendApiError(res, 500, "INTERNAL_ERROR", "Unable to set the initial password right now.");
  }
});

// ---------------------------------------------------------------------------
// Category list
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({
      error: "Unable to load request categories",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Related System list
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const relatedSystems = await prisma.relatedSystem.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json({
      error: "Unable to load related systems",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Create Ticket
// ---------------------------------------------------------------------------
app.post("/api/tickets", requireRole("REQUESTER"), async (
  req: Request,
  res: Response,
) => {
  try {
    const prisma = getPrisma();
    const requesterId = authenticationContext(res).user.id;

    const {
      categoryId,
      relatedSystemId,
      summary,
      requestedPriority,
      description,
    } = req.body;

    // Validate Category.
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        error: "Category is required",
      });
    }

    // Validate Related System.
    if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
      return res.status(400).json({
        error: "Related System is required",
      });
    }

    // Validate Summary.
    if (
      typeof summary !== "string" ||
      summary.trim().length < 1 ||
      summary.trim().length > 120
    ) {
      return res.status(400).json({
        error: "Summary must be between 1 and 120 characters",
      });
    }

    // Validate Requested Priority.
    const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];

    if (
      typeof requestedPriority !== "string" ||
      !allowedPriorities.includes(requestedPriority)
    ) {
      return res.status(400).json({
        error: "Requested Priority must be LOW, MEDIUM, or HIGH",
      });
    }

    const ticketPriority = requestedPriority as Priority;

    // Validate Description.
    if (
      typeof description !== "string" ||
      description.trim().length < 1 ||
      description.trim().length > 2000
    ) {
      return res.status(400).json({
        error: "Description must be between 1 and 2000 characters",
      });
    }

    // Verify that the selected Category exists.
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      return res.status(400).json({
        error: "Invalid Category",
      });
    }

    // Verify that the selected Related System exists.
    const relatedSystem = await prisma.relatedSystem.findUnique({
      where: {
        id: relatedSystemId,
      },
      select: {
        id: true,
      },
    });

    if (!relatedSystem) {
      return res.status(400).json({
        error: "Invalid Related System",
      });
    }

    // Create the ticket inside a transaction.
    // A temporary unique value is used first because ticketNumber is required
    // and unique in the database. After PostgreSQL generates the ticket ID,
    // the official Ticket Number is generated from that ID.
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `TEMP-${randomUUID()}`,
          requesterId,
          categoryId,
          relatedSystemId,
          summary: summary.trim(),
          requestedPriority: ticketPriority,
          itPriority: ticketPriority,
          description: description.trim(),
          status: "NEW",
        },
      });

      const ticketNumber = `TKT-${String(created.id).padStart(6, "0")}`;

      return tx.ticket.update({
        where: {
          id: created.id,
        },
        data: {
          ticketNumber,
        },
        select: {
          id: true,
          ticketNumber: true,
          requesterId: true,
          categoryId: true,
          relatedSystemId: true,
          summary: true,
          requestedPriority: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return res.status(201).json(ticket);
  } catch {
    return res.status(500).json({
      error: "Unable to create ticket",
    });
  }
});
// ---------------------------------------------------------------------------
// Lab 2 - My Tickets
// Returns only tickets owned by the authenticated Requester.
// Supports search, filtering, sorting, and pagination.
// ---------------------------------------------------------------------------
app.get("/api/tickets", requireRole("REQUESTER"), async (
  req: Request,
  res: Response,
) => {
  try {
    const prisma = getPrisma();
    const requesterId = authenticationContext(res).user.id;

    // -----------------------------------------------------------------------
    // Query parameters
    // -----------------------------------------------------------------------
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const categoryIdQuery = req.query.categoryId;
    const relatedSystemIdQuery = req.query.relatedSystemId;
    const requestedPriorityQuery = req.query.requestedPriority;
    const statusQuery = req.query.status;
    const sortByQuery = req.query.sortBy;
    const sortOrderQuery = req.query.sortOrder;
    const pageQuery = req.query.page;
    const pageSizeQuery = req.query.pageSize;

    // -----------------------------------------------------------------------
    // Category filter
    // -----------------------------------------------------------------------
    let categoryId: number | undefined;

    if (categoryIdQuery !== undefined) {
      if (typeof categoryIdQuery !== "string") {
        return res.status(400).json({
          error: "Invalid Category filter",
        });
      }

      categoryId = Number(categoryIdQuery);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({
          error: "Invalid Category filter",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Related System filter
    // -----------------------------------------------------------------------
    let relatedSystemId: number | undefined;

    if (relatedSystemIdQuery !== undefined) {
      if (typeof relatedSystemIdQuery !== "string") {
        return res.status(400).json({
          error: "Invalid Related System filter",
        });
      }

      relatedSystemId = Number(relatedSystemIdQuery);

      if (!Number.isInteger(relatedSystemId) || relatedSystemId <= 0) {
        return res.status(400).json({
          error: "Invalid Related System filter",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Requested Priority filter
    // -----------------------------------------------------------------------
    let requestedPriority: Priority | undefined;

    if (requestedPriorityQuery !== undefined) {
      if (typeof requestedPriorityQuery !== "string") {
        return res.status(400).json({
          error: "Invalid Requested Priority filter",
        });
      }

      const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];

      if (!allowedPriorities.includes(requestedPriorityQuery)) {
        return res.status(400).json({
          error: "Invalid Requested Priority filter",
        });
      }

      requestedPriority = requestedPriorityQuery as Priority;
    }

    // -----------------------------------------------------------------------
    // Status filter
    // Lab 2 currently creates tickets with NEW status only.
    // -----------------------------------------------------------------------
    let status: TicketStatus | undefined;

    if (statusQuery !== undefined) {
      if (typeof statusQuery !== "string" || statusQuery !== "NEW") {
        return res.status(400).json({
          error: "Invalid Status filter",
        });
      }

      status = TicketStatus.NEW;
    }

    // -----------------------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------------------
    const allowedSortFields = ["createdAt", "updatedAt", "ticketNumber"];

    let sortBy = "updatedAt";

    if (sortByQuery !== undefined) {
      if (
        typeof sortByQuery !== "string" ||
        !allowedSortFields.includes(sortByQuery)
      ) {
        return res.status(400).json({
          error: "Invalid sort field",
        });
      }

      sortBy = sortByQuery;
    }

    let sortOrder: "asc" | "desc" = "desc";

    if (sortOrderQuery !== undefined) {
      if (
        typeof sortOrderQuery !== "string" ||
        !["asc", "desc"].includes(sortOrderQuery)
      ) {
        return res.status(400).json({
          error: "Invalid sort order",
        });
      }

      sortOrder = sortOrderQuery as "asc" | "desc";
    }

    // -----------------------------------------------------------------------
    // Pagination
    // -----------------------------------------------------------------------
    let page = 1;

    if (pageQuery !== undefined) {
      if (typeof pageQuery !== "string") {
        return res.status(400).json({
          error: "Invalid page",
        });
      }

      page = Number(pageQuery);

      if (!Number.isInteger(page) || page <= 0) {
        return res.status(400).json({
          error: "Invalid page",
        });
      }
    }

    let pageSize = 10;

    if (pageSizeQuery !== undefined) {
      if (typeof pageSizeQuery !== "string") {
        return res.status(400).json({
          error: "Invalid page size",
        });
      }

      pageSize = Number(pageSizeQuery);

      if (![10, 20, 50].includes(pageSize)) {
        return res.status(400).json({
          error: "Page size must be 10, 20, or 50",
        });
      }
    }

    // -----------------------------------------------------------------------
    // Build ticket query
    // -----------------------------------------------------------------------
    const where = {
      requesterId,

      ...(categoryId !== undefined && {
        categoryId,
      }),

      ...(relatedSystemId !== undefined && {
        relatedSystemId,
      }),

      ...(requestedPriority !== undefined && {
        requestedPriority,
      }),

      ...(status !== undefined && {
        status,
      }),

      ...(search.length > 0 && {
        OR: [
          {
            ticketNumber: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            summary: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }),
    };

    const skip = (page - 1) * pageSize;

    // -----------------------------------------------------------------------
    // Load tickets and count
    // -----------------------------------------------------------------------
    const [tickets, totalItems] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          requesterId: true,
          summary: true,
          requestedPriority: true,
          status: true,
          createdAt: true,
          updatedAt: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },

          relatedSystem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          {
            [sortBy]: sortOrder,
          },
          {
            id: "desc",
          },
        ],
        skip,
        take: pageSize,
      }),

      prisma.ticket.count({
        where,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return res.status(200).json({
      items: tickets,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  } catch {
    return res.status(500).json({
      error: "Unable to load tickets",
    });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 - Requester Ticket Detail
// Returns one ticket only when it belongs to the authenticated Requester.
// Missing tickets and cross-requester access both return 404.
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", requireRole("REQUESTER"), async (
  req: Request,
  res: Response,
) => {
  try {
    const prisma = getPrisma();
    const requesterId = authenticationContext(res).user.id;

    // -----------------------------------------------------------------------
    // Ticket ID
    // -----------------------------------------------------------------------
    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return sendApiError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    }

    // -----------------------------------------------------------------------
    // Load owned ticket
    // Ownership is enforced directly in the query.
    // -----------------------------------------------------------------------
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        requesterId,
      },
      select: {
        id: true,
        ticketNumber: true,
        requesterId: true,
        summary: true,
        requestedPriority: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        category: {
          select: {
            id: true,
            name: true,
          },
        },

        relatedSystem: {
          select: {
            id: true,
            name: true,
          },
        },

        attachments: {
          select: {
            id: true,
            ticketId: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            isRemoved: true,
            removedAt: true,
            removalReason: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!ticket) {
      return sendApiError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    }

    return res.status(200).json(ticket);
  } catch {
    return res.status(500).json({
      error: "Unable to load ticket",
    });
  }
});


// ---------------------------------------------------------------------------
// Lab 2 - Attachment Management
// ---------------------------------------------------------------------------
app.post(
  "/api/tickets/:id/attachments",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    try {
      await new Promise<void>((resolve, reject) => {
        attachmentUpload.single("file")(req, res, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      const prisma = getPrisma();

      const requesterId = authenticationContext(res).user.id;

      const ticketId = Number(req.params.id);

      if (!Number.isInteger(ticketId) || ticketId <= 0) {
        return sendAttachmentError(
          res,
          404,
          "TICKET_NOT_FOUND",
          "Ticket not found.",
        );
      }

      const ticket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          requesterId,
        },
        select: {
          id: true,
        },
      });

      if (!ticket) {
        return sendAttachmentError(
          res,
          404,
          "TICKET_NOT_FOUND",
          "Ticket not found.",
        );
      }

      if (!req.file) {
        return sendAttachmentError(
          res,
          400,
          "VALIDATION_ERROR",
          "An attachment file is required.",
          { file: "Attachment file is required." },
        );
      }

      if (!fileContentMatchesMimeType(req.file)) {
        return sendAttachmentError(
          res,
          415,
          "UNSUPPORTED_ATTACHMENT_TYPE",
          "Attachment content does not match an allowed file type.",
        );
      }

      const storedFilename = `${randomUUID()}${ATTACHMENT_EXTENSIONS[req.file.mimetype]}`;
      const storedPath = getAttachmentPath(storedFilename);

      await fs.mkdir(getAttachmentStorageDir(), { recursive: true });
      await fs.writeFile(storedPath, req.file.buffer, { flag: "wx" });

      let attachment;

      try {
        attachment = await prisma.$transaction(async (transaction) => {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(${ticketId})
          `;

          const activeAttachmentCount = await transaction.attachment.count({
            where: {
              ticketId,
              isRemoved: false,
            },
          });

          if (activeAttachmentCount >= 5) {
            throw new AttachmentLimitError();
          }

          return transaction.attachment.create({
            data: {
              ticketId,
              originalFilename: req.file!.originalname,
              storedFilename,
              mimeType: req.file!.mimetype,
              sizeBytes: req.file!.size,
              isRemoved: false,
            },
          });
        });
      } catch (error) {
        await fs.rm(storedPath, { force: true });
        throw error;
      }

      return res.status(201).json({ data: attachmentMetadata(attachment) });
    } catch (error) {
      if (error instanceof AttachmentLimitError) {
        return sendAttachmentError(
          res,
          409,
          "ATTACHMENT_LIMIT_REACHED",
          "This ticket already has the maximum of 5 active attachments.",
        );
      }

      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return sendAttachmentError(
          res,
          413,
          "ATTACHMENT_TOO_LARGE",
          "The attachment must not exceed 5 MB.",
        );
      }

      if (
        error instanceof Error &&
        error.message.startsWith("Unsupported file type")
      ) {
        return sendAttachmentError(
          res,
          415,
          "UNSUPPORTED_ATTACHMENT_TYPE",
          "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.",
        );
      }

      return sendAttachmentError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to upload attachment.",
      );
    }
  },
);

app.get("/api/attachments/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const user = authenticationContext(res).user;

    const attachmentId = Number(req.params.id);

    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ...(user.role === "REQUESTER" && {
          ticket: { requesterId: user.id },
        }),
      },
      select: {
        id: true,
        ticketId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        isRemoved: true,
        removedAt: true,
        removalReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!attachment) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    return res.status(200).json({ data: attachment });
  } catch {
    return sendAttachmentError(
      res,
      500,
      "INTERNAL_ERROR",
      "Unable to load attachment.",
    );
  }
});

app.get(
  "/api/attachments/:id/download",
  async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const user = authenticationContext(res).user;

      const attachmentId = Number(req.params.id);

      if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
        return sendAttachmentError(
          res,
          404,
          "ATTACHMENT_NOT_FOUND",
          "Attachment not found.",
        );
      }

      const attachment = await prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          isRemoved: false,
          ...(user.role === "REQUESTER" && {
            ticket: { requesterId: user.id },
          }),
        },
        select: {
          originalFilename: true,
          storedFilename: true,
          mimeType: true,
          sizeBytes: true,
        },
      });

      if (!attachment) {
        return sendAttachmentError(
          res,
          404,
          "ATTACHMENT_NOT_FOUND",
          "Attachment not found.",
        );
      }

      let file: Buffer;

      try {
        file = await fs.readFile(getAttachmentPath(attachment.storedFilename));
      } catch {
        return sendAttachmentError(
          res,
          404,
          "ATTACHMENT_NOT_FOUND",
          "Attachment not found.",
        );
      }

      res.set({
        "Content-Type": attachment.mimeType,
        "Content-Length": String(file.length),
        "Content-Disposition": getDownloadDisposition(
          attachment.originalFilename,
        ),
      });

      return res.status(200).send(file);
    } catch {
      return sendAttachmentError(
        res,
        500,
        "INTERNAL_ERROR",
        "Unable to download attachment.",
      );
    }
  },
);

app.delete("/api/attachments/:id", requireRole("REQUESTER"), async (
  req: Request,
  res: Response,
) => {
  try {
    const prisma = getPrisma();
    const requesterId = authenticationContext(res).user.id;

    const attachmentId = Number(req.params.id);

    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticket: { requesterId },
      },
      select: { id: true, isRemoved: true },
    });

    if (!attachment) {
      return sendAttachmentError(
        res,
        404,
        "ATTACHMENT_NOT_FOUND",
        "Attachment not found.",
      );
    }

    if (attachment.isRemoved) {
      return sendAttachmentError(
        res,
        409,
        "ATTACHMENT_ALREADY_REMOVED",
        "This attachment has already been removed.",
      );
    }

    const reason = typeof req.body?.reason === "string"
      ? req.body.reason.trim()
      : "";

    if (reason.length < 1 || reason.length > 250) {
      return sendAttachmentError(
        res,
        400,
        "VALIDATION_ERROR",
        "A valid removal reason is required.",
        { reason: "Removal reason must contain 1 to 250 characters." },
      );
    }

    const removedAt = new Date();
    const result = await prisma.attachment.updateMany({
      where: { id: attachmentId, isRemoved: false },
      data: { isRemoved: true, removedAt, removalReason: reason },
    });

    if (result.count === 0) {
      return sendAttachmentError(
        res,
        409,
        "ATTACHMENT_ALREADY_REMOVED",
        "This attachment has already been removed.",
      );
    }

    const removedAttachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    return res.status(200).json({
      data: attachmentMetadata(removedAttachment!),
    });
  } catch {
    return sendAttachmentError(
      res,
      500,
      "INTERNAL_ERROR",
      "Unable to remove attachment.",
    );
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    sendApiError(
      res,
      400,
      "VALIDATION_ERROR",
      "The request contains invalid data.",
    );
    return;
  }
  sendApiError(res, 500, "INTERNAL_ERROR", "Unable to process the request.");
});

export default app;
