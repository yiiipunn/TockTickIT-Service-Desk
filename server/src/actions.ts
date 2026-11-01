import { ActionStatus, Prisma, type UserRole } from "@prisma/client";
import { Router as createRouter, type Request, type Response } from "express";
import {
  authenticationContext,
  requireRole,
  sendApiError,
} from "./auth.js";
import { getPrisma } from "./prisma.js";

const ACTIVE_TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
] as const;

const STAFF_ROLES: UserRole[] = ["IT_STAFF", "ADMINISTRATOR"];
const PAGE_SIZES = new Set([10, 20, 50]);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const actionSelect = Prisma.validator<Prisma.ActionTakenSelect>()({
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  status: true,
  assigneeId: true,
  createdById: true,
  performedById: true,
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  completedAt: true,
  cancelledAt: true,
  cancelledById: true,
  cancellationReason: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: { id: true, name: true, role: true, isActive: true },
  },
  createdBy: {
    select: { id: true, name: true, role: true },
  },
  performedBy: {
    select: { id: true, name: true, role: true },
  },
  cancelledBy: {
    select: { id: true, name: true, role: true },
  },
});

const eventSelect = Prisma.validator<Prisma.ActionTakenEventSelect>()({
  id: true,
  eventType: true,
  fromStatus: true,
  toStatus: true,
  createdAt: true,
  actor: { select: { id: true, name: true, role: true } },
  fromAssignee: { select: { id: true, name: true } },
  toAssignee: { select: { id: true, name: true } },
});

type ActionRecord = Prisma.ActionTakenGetPayload<{ select: typeof actionSelect }>;
type ActionEventRecord = Prisma.ActionTakenEventGetPayload<{ select: typeof eventSelect }>;
type Body = Record<string, unknown>;

interface EditableActionData {
  actionAt: Date;
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly current?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function sendFailure(res: Response, failure: RequestFailure) {
  return res.status(failure.status).json({
    error: {
      code: failure.code,
      message: failure.message,
      ...(failure.fields ? { fields: failure.fields } : {}),
      ...(failure.current ? { current: failure.current } : {}),
    },
  });
}

function bodyRecord(value: unknown): Body | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Body;
}

function unknownFields(body: Body, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(body).filter((key) => !allowedSet.has(key));
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function pathId(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : null;
}

function textValue(
  value: unknown,
  field: string,
  maxLength: number,
  fields: Record<string, string>,
  options: { nullable?: boolean } = {},
) {
  if (options.nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string") {
    fields[field] = options.nullable
      ? `Enter ${field} as text or null.`
      : `Enter ${field} as text.`;
    return null;
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    fields[field] = `${field} must contain 1 to ${maxLength} characters.`;
    return null;
  }
  return normalized;
}

function dateValue(value: unknown, fields: Record<string, string>) {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) {
    fields.actionAt = "Enter a valid ISO 8601 date and time with a UTC offset.";
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fields.actionAt = "Enter a valid ISO 8601 date and time with a UTC offset.";
    return null;
  }
  return new Date(timestamp);
}

function validateFollowUp(
  body: Body,
  fields: Record<string, string>,
) {
  if (typeof body.followUpRequired !== "boolean") {
    fields.followUpRequired = "Select whether follow-up is required.";
    return { followUpRequired: false, followUpNote: null };
  }

  if (body.followUpRequired) {
    const note = textValue(body.followUpNote, "followUpNote", 1000, fields);
    return { followUpRequired: true, followUpNote: note };
  }

  if (body.followUpNote !== null && body.followUpNote !== undefined) {
    fields.followUpNote = "Follow-up note must be null when follow-up is not required.";
  }
  return { followUpRequired: false, followUpNote: null };
}

function validationFailure(fields: Record<string, string>): never {
  throw new RequestFailure(
    400,
    "VALIDATION_ERROR",
    "The request contains invalid data.",
    fields,
  );
}

function validateEditableFields(body: Body, requireAll: boolean): EditableActionData {
  const fields: Record<string, string> = {};
  const required = [
    "actionAt",
    "description",
    "result",
    "followUpRequired",
    "followUpNote",
    "attachmentNotes",
  ];
  if (requireAll) {
    for (const field of required) {
      if (!Object.hasOwn(body, field)) fields[field] = `${field} is required.`;
    }
  }

  const actionAt = dateValue(body.actionAt, fields);
  const description = textValue(body.description, "description", 2000, fields);
  const result = textValue(body.result, "result", 2000, fields, { nullable: true });
  const attachmentNotes = textValue(
    body.attachmentNotes,
    "attachmentNotes",
    1000,
    fields,
    { nullable: true },
  );
  const followUp = validateFollowUp(body, fields);

  if (Object.keys(fields).length > 0 || !actionAt || !description) {
    validationFailure(fields);
  }
  return {
    actionAt,
    description,
    result,
    attachmentNotes,
    ...followUp,
  };
}

function validateExpectedVersion(body: Body, fields: Record<string, string>) {
  const expectedVersion = positiveInteger(body.expectedVersion);
  if (!expectedVersion) {
    fields.expectedVersion = "expectedVersion must be a positive integer.";
  }
  return expectedVersion;
}

function actionResponse(action: ActionRecord) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    actionAt: action.actionAt.toISOString(),
    description: action.description,
    result: action.result,
    status: action.status,
    assignee: action.assignee,
    createdBy: action.createdBy,
    performedBy: action.performedBy,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    completedAt: action.completedAt?.toISOString() ?? null,
    cancelledAt: action.cancelledAt?.toISOString() ?? null,
    cancelledBy: action.cancelledBy,
    cancellationReason: action.cancellationReason,
    version: action.version,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  };
}

function eventResponse(event: ActionEventRecord) {
  return {
    id: event.id,
    type: event.eventType,
    actor: event.actor,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    fromAssignee: event.fromAssignee,
    toAssignee: event.toAssignee,
    createdAt: event.createdAt.toISOString(),
  };
}

function currentState(action: {
  id: number;
  status: ActionStatus;
  assigneeId: number;
  version: number;
  updatedAt: Date;
}) {
  return {
    id: action.id,
    status: action.status,
    assigneeId: action.assigneeId,
    version: action.version,
    updatedAt: action.updatedAt.toISOString(),
  };
}

function editSnapshot(action: {
  actionAt: Date;
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}) {
  return {
    actionAt: action.actionAt.toISOString(),
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
  };
}

async function eligibleAssignee(
  transaction: Prisma.TransactionClient,
  assigneeId: number,
) {
  return transaction.user.findFirst({
    where: { id: assigneeId, isActive: true, role: { in: STAFF_ROLES } },
    select: { id: true },
  });
}

async function mutationConflict(
  transaction: Prisma.TransactionClient,
  actionId: number,
  expectedVersion: number,
): Promise<never> {
  const current = await transaction.actionTaken.findUnique({
    where: { id: actionId },
    select: { id: true, status: true, assigneeId: true, version: true, updatedAt: true },
  });
  if (!current) {
    throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
  }
  if (current.version !== expectedVersion) {
    throw new RequestFailure(
      409,
      "ACTION_VERSION_CONFLICT",
      "The Action changed after it was loaded.",
      undefined,
      currentState(current),
    );
  }
  throw new RequestFailure(
    409,
    "ACTION_STATUS_CONFLICT",
    "The Action cannot be changed in its current status.",
    undefined,
    currentState(current),
  );
}

function handleRouteError(res: Response, error: unknown, message: string) {
  if (error instanceof RequestFailure) return sendFailure(res, error);
  return sendApiError(res, 500, "INTERNAL_ERROR", message);
}

function parsePagination(req: Request) {
  const unknown = Object.keys(req.query).filter((key) => !["page", "pageSize"].includes(key));
  const pageRaw = req.query.page;
  const sizeRaw = req.query.pageSize;
  if (
    unknown.length > 0 ||
    Array.isArray(pageRaw) ||
    Array.isArray(sizeRaw) ||
    (pageRaw !== undefined && (typeof pageRaw !== "string" || !/^\d+$/.test(pageRaw))) ||
    (sizeRaw !== undefined && (typeof sizeRaw !== "string" || !/^\d+$/.test(sizeRaw)))
  ) {
    throw new RequestFailure(400, "INVALID_QUERY", "The Action query is invalid.");
  }
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const pageSize = sizeRaw === undefined ? 20 : Number(sizeRaw);
  if (!Number.isSafeInteger(page) || page < 1 || !PAGE_SIZES.has(pageSize)) {
    throw new RequestFailure(400, "INVALID_QUERY", "The Action query is invalid.");
  }
  return { page, pageSize };
}

export const actionsRouter = createRouter();

actionsRouter.get("/tickets/:ticketId/actions", async (req, res) => {
  try {
    const ticketId = pathId(req.params.ticketId);
    if (!ticketId) throw new RequestFailure(404, "TICKET_NOT_FOUND", "Ticket not found.");
    const { page, pageSize } = parsePagination(req);
    const user = authenticationContext(res).user;
    const prisma = getPrisma();
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(user.role === "REQUESTER" ? { requesterId: user.id } : {}),
      },
      select: { id: true },
    });
    if (!ticket) throw new RequestFailure(404, "TICKET_NOT_FOUND", "Ticket not found.");

    const where = { ticketId };
    const [items, totalItems] = await prisma.$transaction([
      prisma.actionTaken.findMany({
        where,
        select: actionSelect,
        orderBy: [{ actionAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.actionTaken.count({ where }),
    ]);
    return res.status(200).json({
      items: items.map(actionResponse),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      },
    });
  } catch (error) {
    return handleRouteError(res, error, "Unable to load Actions.");
  }
});

actionsRouter.get("/actions/:actionId", async (req, res) => {
  try {
    const actionId = pathId(req.params.actionId);
    if (!actionId) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
    if (Object.keys(req.query).length > 0) {
      throw new RequestFailure(400, "INVALID_QUERY", "The Action query is invalid.");
    }
    const user = authenticationContext(res).user;
    const action = await getPrisma().actionTaken.findFirst({
      where: {
        id: actionId,
        ...(user.role === "REQUESTER" ? { ticket: { requesterId: user.id } } : {}),
      },
      select: actionSelect,
    });
    if (!action) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
    return res.status(200).json({ data: actionResponse(action) });
  } catch (error) {
    return handleRouteError(res, error, "Unable to load the Action.");
  }
});

actionsRouter.get(
  "/staff/actions/:actionId/events",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req, res) => {
    try {
      const actionId = pathId(req.params.actionId);
      if (!actionId) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
      if (Object.keys(req.query).length > 0) {
        throw new RequestFailure(400, "INVALID_QUERY", "The Action query is invalid.");
      }
      const prisma = getPrisma();
      const action = await prisma.actionTaken.findUnique({ where: { id: actionId }, select: { id: true } });
      if (!action) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
      const items = await prisma.actionTakenEvent.findMany({
        where: { actionTakenId: actionId },
        select: eventSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return res.status(200).json({ items: items.map(eventResponse) });
    } catch (error) {
      return handleRouteError(res, error, "Unable to load Action history.");
    }
  },
);

actionsRouter.post(
  "/staff/tickets/:ticketId/actions",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req, res) => {
    try {
      const ticketId = pathId(req.params.ticketId);
      if (!ticketId) throw new RequestFailure(404, "TICKET_NOT_FOUND", "Ticket not found.");
      const body = bodyRecord(req.body);
      const allowed = [
        "actionAt", "description", "result", "assigneeId",
        "followUpRequired", "followUpNote", "attachmentNotes",
      ];
      if (!body) validationFailure({ body: "Enter a JSON object." });
      const unknown = unknownFields(body, allowed);
      const fields: Record<string, string> = {};
      for (const field of unknown) fields[field] = "This field is not allowed.";
      const assigneeId = positiveInteger(body.assigneeId);
      if (!assigneeId) fields.assigneeId = "assigneeId must be a positive integer.";
      if (Object.keys(fields).length > 0) validationFailure(fields);
      const editable = validateEditableFields(body, false);
      const actorId = authenticationContext(res).user.id;
      const prisma = getPrisma();

      const action = await prisma.$transaction(async (transaction) => {
        const ticket = await transaction.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, status: true },
        });
        if (!ticket) throw new RequestFailure(404, "TICKET_NOT_FOUND", "Ticket not found.");
        if (!ACTIVE_TICKET_STATUSES.includes(ticket.status as typeof ACTIVE_TICKET_STATUSES[number])) {
          throw new RequestFailure(
            409,
            "TICKET_STATE_CONFLICT",
            "Actions cannot be created for a Ticket in its current status.",
          );
        }
        if (!await eligibleAssignee(transaction, assigneeId!)) {
          throw new RequestFailure(400, "INELIGIBLE_ASSIGNEE", "Select an active Staff or Administrator assignee.");
        }
        const created = await transaction.actionTaken.create({
          data: {
            ticketId,
            assigneeId: assigneeId!,
            createdById: actorId,
            status: "PLANNED",
            version: 1,
            ...editable,
          },
          select: actionSelect,
        });
        await transaction.actionTakenEvent.create({
          data: {
            actionTakenId: created.id,
            actorId,
            eventType: "CREATED",
            toStatus: "PLANNED",
            toAssigneeId: assigneeId!,
            snapshot: editSnapshot(created),
          },
        });
        return created;
      });
      return res.status(201).json({ data: actionResponse(action) });
    } catch (error) {
      return handleRouteError(res, error, "Unable to create the Action.");
    }
  },
);

actionsRouter.patch(
  "/staff/actions/:actionId",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req, res) => {
    try {
      const actionId = pathId(req.params.actionId);
      if (!actionId) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
      const body = bodyRecord(req.body);
      const allowed = [
        "expectedVersion", "actionAt", "description", "result",
        "followUpRequired", "followUpNote", "attachmentNotes",
      ];
      if (!body) validationFailure({ body: "Enter a JSON object." });
      const fields: Record<string, string> = {};
      for (const field of unknownFields(body, allowed)) fields[field] = "This field is not allowed.";
      const expectedVersion = validateExpectedVersion(body, fields);
      if (Object.keys(fields).length > 0) validationFailure(fields);
      const editable = validateEditableFields(body, true);
      const actorId = authenticationContext(res).user.id;
      const prisma = getPrisma();

      const action = await prisma.$transaction(async (transaction) => {
        const before = await transaction.actionTaken.findUnique({ where: { id: actionId } });
        if (!before) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
        if (before.version !== expectedVersion) return mutationConflict(transaction, actionId, expectedVersion!);
        if (!["PLANNED", "IN_PROGRESS"].includes(before.status)) {
          throw new RequestFailure(409, "ACTION_STATUS_CONFLICT", "The Action cannot be edited in its current status.", undefined, currentState(before));
        }
        const updated = await transaction.actionTaken.updateMany({
          where: { id: actionId, version: expectedVersion!, status: { in: ["PLANNED", "IN_PROGRESS"] } },
          data: { ...editable, version: { increment: 1 } },
        });
        if (updated.count === 0) return mutationConflict(transaction, actionId, expectedVersion!);
        await transaction.actionTakenEvent.create({
          data: {
            actionTakenId: actionId,
            actorId,
            eventType: "UPDATED",
            fromStatus: before.status,
            toStatus: before.status,
            snapshot: editSnapshot(before),
          },
        });
        return transaction.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });
      });
      return res.status(200).json({ data: actionResponse(action) });
    } catch (error) {
      return handleRouteError(res, error, "Unable to update the Action.");
    }
  },
);

actionsRouter.patch(
  "/staff/actions/:actionId/assignee",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req, res) => {
    try {
      const actionId = pathId(req.params.actionId);
      if (!actionId) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
      const body = bodyRecord(req.body);
      if (!body) validationFailure({ body: "Enter a JSON object." });
      const fields: Record<string, string> = {};
      for (const field of unknownFields(body, ["expectedVersion", "assigneeId"])) fields[field] = "This field is not allowed.";
      const expectedVersion = validateExpectedVersion(body, fields);
      const assigneeId = positiveInteger(body.assigneeId);
      if (!assigneeId) fields.assigneeId = "assigneeId must be a positive integer.";
      if (Object.keys(fields).length > 0) validationFailure(fields);
      const actorId = authenticationContext(res).user.id;
      const prisma = getPrisma();

      const action = await prisma.$transaction(async (transaction) => {
        const before = await transaction.actionTaken.findUnique({ where: { id: actionId } });
        if (!before) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
        if (before.version !== expectedVersion) return mutationConflict(transaction, actionId, expectedVersion!);
        if (!["PLANNED", "IN_PROGRESS"].includes(before.status)) {
          throw new RequestFailure(409, "ACTION_STATUS_CONFLICT", "The Action cannot be reassigned in its current status.", undefined, currentState(before));
        }
        if (!await eligibleAssignee(transaction, assigneeId!)) {
          throw new RequestFailure(400, "INELIGIBLE_ASSIGNEE", "Select an active Staff or Administrator assignee.");
        }
        const updated = await transaction.actionTaken.updateMany({
          where: { id: actionId, version: expectedVersion!, status: { in: ["PLANNED", "IN_PROGRESS"] } },
          data: { assigneeId: assigneeId!, version: { increment: 1 } },
        });
        if (updated.count === 0) return mutationConflict(transaction, actionId, expectedVersion!);
        await transaction.actionTakenEvent.create({
          data: {
            actionTakenId: actionId,
            actorId,
            eventType: "ASSIGNEE_CHANGED",
            fromStatus: before.status,
            toStatus: before.status,
            fromAssigneeId: before.assigneeId,
            toAssigneeId: assigneeId!,
          },
        });
        return transaction.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });
      });
      return res.status(200).json({ data: actionResponse(action) });
    } catch (error) {
      return handleRouteError(res, error, "Unable to reassign the Action.");
    }
  },
);

actionsRouter.patch(
  "/staff/actions/:actionId/status",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req, res) => {
    try {
      const actionId = pathId(req.params.actionId);
      if (!actionId) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
      const body = bodyRecord(req.body);
      if (!body) validationFailure({ body: "Enter a JSON object." });
      if (!["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(String(body.status))) {
        validationFailure({ status: "Select an allowed target status." });
      }
      const status = body.status as "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      const allowedByStatus = status === "IN_PROGRESS"
        ? ["expectedVersion", "status"]
        : status === "COMPLETED"
          ? ["expectedVersion", "status", "actionAt", "result", "followUpRequired", "followUpNote", "attachmentNotes"]
          : ["expectedVersion", "status", "confirmed", "cancellationReason"];
      const fields: Record<string, string> = {};
      for (const field of unknownFields(body, allowedByStatus)) fields[field] = "This field is not allowed.";
      const expectedVersion = validateExpectedVersion(body, fields);
      if (Object.keys(fields).length > 0) validationFailure(fields);

      let completion: EditableActionData | null = null;
      let cancellationReason: string | null = null;
      if (status === "COMPLETED") {
        completion = validateEditableFields(
          { ...body, description: "completion-placeholder" },
          true,
        );
        const completionFields: Record<string, string> = {};
        const result = textValue(body.result, "result", 2000, completionFields);
        if (completion.actionAt.getTime() > Date.now()) {
          completionFields.actionAt = "Action date and time cannot be in the future when completing.";
        }
        if (!result || Object.keys(completionFields).length > 0) validationFailure(completionFields);
        completion.result = result;
      }
      if (status === "CANCELLED") {
        if (body.confirmed !== true) {
          throw new RequestFailure(400, "CONFIRMATION_REQUIRED", "Confirmation is required to cancel an Action.");
        }
        const cancellationFields: Record<string, string> = {};
        cancellationReason = textValue(body.cancellationReason, "cancellationReason", 500, cancellationFields);
        if (!cancellationReason || Object.keys(cancellationFields).length > 0) validationFailure(cancellationFields);
      }

      const actor = authenticationContext(res).user;
      const prisma = getPrisma();
      const action = await prisma.$transaction(async (transaction) => {
        const before = await transaction.actionTaken.findUnique({ where: { id: actionId } });
        if (!before) throw new RequestFailure(404, "ACTION_NOT_FOUND", "Action not found.");
        if (before.version !== expectedVersion) return mutationConflict(transaction, actionId, expectedVersion!);
        const validTransition =
          (before.status === "PLANNED" && ["IN_PROGRESS", "CANCELLED"].includes(status)) ||
          (before.status === "IN_PROGRESS" && ["COMPLETED", "CANCELLED"].includes(status));
        if (!validTransition) {
          throw new RequestFailure(409, "ACTION_STATUS_CONFLICT", "The requested Action status transition is not allowed.", undefined, currentState(before));
        }
        if (
          ["IN_PROGRESS", "COMPLETED"].includes(status) &&
          actor.role !== "ADMINISTRATOR" &&
          before.assigneeId !== actor.id
        ) {
          throw new RequestFailure(403, "FORBIDDEN", "Only the current assignee or an Administrator may perform this transition.");
        }

        const now = new Date();
        const data: Prisma.ActionTakenUpdateManyMutationInput = {
          status,
          version: { increment: 1 },
          ...(status === "COMPLETED" && completion ? {
            actionAt: completion.actionAt,
            result: completion.result,
            followUpRequired: completion.followUpRequired,
            followUpNote: completion.followUpNote,
            attachmentNotes: completion.attachmentNotes,
            performedById: actor.id,
            completedAt: now,
          } : {}),
          ...(status === "CANCELLED" ? {
            cancelledById: actor.id,
            cancelledAt: now,
            cancellationReason,
          } : {}),
        };
        const updated = await transaction.actionTaken.updateMany({
          where: { id: actionId, version: expectedVersion!, status: before.status },
          data,
        });
        if (updated.count === 0) return mutationConflict(transaction, actionId, expectedVersion!);
        await transaction.actionTakenEvent.create({
          data: {
            actionTakenId: actionId,
            actorId: actor.id,
            eventType: "STATUS_CHANGED",
            fromStatus: before.status,
            toStatus: status,
            fromAssigneeId: before.assigneeId,
            toAssigneeId: before.assigneeId,
            snapshot: editSnapshot(before),
          },
        });
        return transaction.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });
      });
      return res.status(200).json({ data: actionResponse(action) });
    } catch (error) {
      return handleRouteError(res, error, "Unable to change the Action status.");
    }
  },
);
