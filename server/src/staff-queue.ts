import { Priority, TicketStatus } from "@prisma/client";

export const STAFF_QUEUE_PAGE_SIZES = [10, 20, 50] as const;
export const STAFF_QUEUE_SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "ticketNumber",
  "status",
  "requestedPriority",
  "itPriority",
] as const;

export type StaffQueueSortField = (typeof STAFF_QUEUE_SORT_FIELDS)[number];
export type StaffQueueOwner = "me" | "unassigned" | number;

export interface StaffQueueQuery {
  search: string;
  status?: TicketStatus;
  requestedPriority?: Priority;
  itPriority?: Priority;
  owner?: StaffQueueOwner;
  sortBy: StaffQueueSortField;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: (typeof STAFF_QUEUE_PAGE_SIZES)[number];
}

export class StaffQueueQueryError extends Error {}

function invalidQuery(): never {
  throw new StaffQueueQueryError("The queue query is invalid.");
}

function singleQueryValue(
  query: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalidQuery();
  return value;
}

function positiveInteger(value: string) {
  if (!/^[1-9]\d*$/.test(value)) invalidQuery();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) invalidQuery();
  return parsed;
}

function priority(value: string | undefined) {
  if (value === undefined) return undefined;
  if (!(["LOW", "MEDIUM", "HIGH"] as const).includes(value as Priority)) {
    invalidQuery();
  }
  return value as Priority;
}

export function parseStaffQueueQuery(query: Record<string, unknown>): StaffQueueQuery {
  const allowed = new Set([
    "search",
    "status",
    "requestedPriority",
    "itPriority",
    "owner",
    "sortBy",
    "sortOrder",
    "page",
    "pageSize",
  ]);
  if (Object.keys(query).some((name) => !allowed.has(name))) invalidQuery();

  const searchValue = singleQueryValue(query, "search");
  const search = searchValue?.trim() ?? "";
  if (search.length > 120) invalidQuery();

  const statusValue = singleQueryValue(query, "status");
  if (statusValue !== undefined && !Object.values(TicketStatus).includes(statusValue as TicketStatus)) {
    invalidQuery();
  }

  const ownerValue = singleQueryValue(query, "owner");
  let owner: StaffQueueOwner | undefined;
  if (ownerValue === "me" || ownerValue === "unassigned") {
    owner = ownerValue;
  } else if (ownerValue !== undefined) {
    owner = positiveInteger(ownerValue);
  }

  const sortByValue = singleQueryValue(query, "sortBy");
  if (sortByValue !== undefined && !STAFF_QUEUE_SORT_FIELDS.includes(sortByValue as StaffQueueSortField)) {
    invalidQuery();
  }

  const sortOrderValue = singleQueryValue(query, "sortOrder");
  if (sortOrderValue !== undefined && sortOrderValue !== "asc" && sortOrderValue !== "desc") {
    invalidQuery();
  }

  const pageValue = singleQueryValue(query, "page");
  const pageSizeValue = singleQueryValue(query, "pageSize");
  const page = pageValue === undefined ? 1 : positiveInteger(pageValue);
  const pageSize = pageSizeValue === undefined ? 20 : positiveInteger(pageSizeValue);
  if (!STAFF_QUEUE_PAGE_SIZES.includes(pageSize as (typeof STAFF_QUEUE_PAGE_SIZES)[number])) {
    invalidQuery();
  }

  return {
    search,
    status: statusValue as TicketStatus | undefined,
    requestedPriority: priority(singleQueryValue(query, "requestedPriority")),
    itPriority: priority(singleQueryValue(query, "itPriority")),
    owner,
    sortBy: (sortByValue ?? "updatedAt") as StaffQueueSortField,
    sortOrder: (sortOrderValue ?? "desc") as "asc" | "desc",
    page,
    pageSize: pageSize as (typeof STAFF_QUEUE_PAGE_SIZES)[number],
  };
}
