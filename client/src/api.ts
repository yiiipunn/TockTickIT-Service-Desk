const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface CommunicationEntry {
  id: number;
  ticketId: number;
  content: string;
  author: { id: number; name: string; role: UserRole };
  createdAt: string;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

interface AuthenticationResponse {
  data: {
    user: AuthenticatedUser;
    csrfToken: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly fields?: Record<string, string>,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let authenticationCsrfToken = "";

function setAuthentication(response: AuthenticationResponse) {
  authenticationCsrfToken = response.data.csrfToken;
  return response.data.user;
}

function authenticatedHeaders(headers: Record<string, string> = {}, unsafe = false) {
  return {
    ...headers,
    ...(unsafe && authenticationCsrfToken
      ? { "X-CSRF-Token": authenticationCsrfToken }
      : {}),
  };
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" |
  "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Lab 2 - My Tickets types
// ---------------------------------------------------------------------------

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  requesterId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  status: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: number;
    name: string;
  };
}

export interface TicketPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketListResponse {
  items: TicketListItem[];
  pagination: TicketPagination;
}

export interface GetTicketsParams {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  status?: string;
  sortBy?: "createdAt" | "updatedAt" | "ticketNumber";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 20 | 50;
}

// ---------------------------------------------------------------------------
// Lab 3 - IT Staff Ticket Queue
// ---------------------------------------------------------------------------

export interface StaffQueueTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  requester: {
    id: number;
    name: string;
    email: string;
  };
  status: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  owner: {
    id: number;
    name: string;
  } | null;
  updatedAt: string;
}

export interface StaffQueueResponse {
  items: StaffQueueTicket[];
  pagination: TicketPagination;
  counts: {
    matching: number;
    matchingUnassigned: number;
  };
}

export interface StaffTicketDetail extends StaffQueueTicket {
  status: TicketStatus;
  description: string;
  category: Category;
  relatedSystem: RelatedSystem;
  ownerAssignedAt: string | null;
  requesterResolutionIndicatedAt: string | null;
  createdAt: string;
  attachments: TicketAttachment[];
  publicComments: CommunicationEntry[];
  internalNotes: CommunicationEntry[];
  allowedTransitions: TicketStatus[];
}

export interface EligibleOwner {
  id: number;
  name: string;
  email: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}

export interface GetStaffQueueParams {
  search?: string;
  status?: string;
  requestedPriority?: RequestedPriority;
  itPriority?: RequestedPriority;
  owner?: "me" | "unassigned" | number;
  sortBy?: "updatedAt" | "createdAt" | "ticketNumber" | "status" | "requestedPriority" | "itPriority";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 20 | 50;
}

// ---------------------------------------------------------------------------
// Lab 2 - Requester Ticket Detail types
// ---------------------------------------------------------------------------

export interface TicketAttachment {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  isRemoved: boolean;
  removedAt: string | null;
  removalReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  requesterId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: number;
    name: string;
  };
  attachments: TicketAttachment[];
}

// ---------------------------------------------------------------------------
// Shared response error helper
// ---------------------------------------------------------------------------

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();

    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }

    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error &&
      typeof body.error.message === "string"
    ) {
      return body.error.message;
    }
  } catch {
    // Keep fallback when the response body is not JSON.
  }

  return fallback;
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  try {
    const body = await response.json();
    if (body?.error && typeof body.error === "object") {
      throw new ApiError(
        typeof body.error.message === "string" ? body.error.message : fallback,
        typeof body.error.code === "string" ? body.error.code : "REQUEST_FAILED",
        response.status,
        body.error.fields,
        Number(response.headers.get("Retry-After")) || undefined,
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }
  throw new ApiError(fallback, "REQUEST_FAILED", response.status);
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) await throwApiError(response, "Unable to sign in right now.");
  return setAuthentication(await response.json() as AuthenticationResponse);
}

export async function getCurrentUser() {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    credentials: "include",
  });
  if (!response.ok) await throwApiError(response, "Unable to restore your session.");
  return setAuthentication(await response.json() as AuthenticationResponse);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  if (!response.ok) {
    await throwApiError(response, "Unable to change your password right now.");
  }
  return setAuthentication(await response.json() as AuthenticationResponse);
}

export async function logout() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: authenticatedHeaders({}, true),
  });
  if (!response.ok) await throwApiError(response, "Unable to sign out right now.");
  authenticationCsrfToken = "";
}

// ---------------------------------------------------------------------------
// Lab 1 - System check
// ---------------------------------------------------------------------------

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`, {
    credentials: "include",
  });

  if (!healthResponse.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const categoriesResponse = await fetch(
    `${API_URL}/api/categories`,
    { credentials: "include" },
  );

  if (!categoriesResponse.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] =
    await categoriesResponse.json();

  return {
    online: true,
    categories,
  };
}

// ---------------------------------------------------------------------------
// Lab 2 - Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(
    `${API_URL}/api/categories`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load request categories",
    );
  }

  const categories: Category[] =
    await response.json();

  return categories;
}

// ---------------------------------------------------------------------------
// Lab 2 - Related Systems
// ---------------------------------------------------------------------------

export async function getRelatedSystems(): Promise<
  RelatedSystem[]
> {
  const response = await fetch(
    `${API_URL}/api/related-systems`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error("Unable to load related systems");
  }

  const relatedSystems: RelatedSystem[] =
    await response.json();

  return relatedSystems;
}

// ---------------------------------------------------------------------------
// Lab 2 - Create Ticket
// ---------------------------------------------------------------------------

export async function createTicket(
  input: CreateTicketInput,
): Promise<Ticket> {
  const response = await fetch(
    `${API_URL}/api/tickets`,
    {
      method: "POST",
      credentials: "include",
      headers: authenticatedHeaders({
        "Content-Type": "application/json",
      }, true),
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Unable to create ticket",
      ),
    );
  }

  const ticket: Ticket = await response.json();

  return ticket;
}

// ---------------------------------------------------------------------------
// Lab 2 - My Tickets
// ---------------------------------------------------------------------------

export async function getTickets(
  params: GetTicketsParams = {},
): Promise<TicketListResponse> {
  const searchParams = new URLSearchParams();

  if (params.search?.trim()) {
    searchParams.set(
      "search",
      params.search.trim(),
    );
  }

  if (params.categoryId !== undefined) {
    searchParams.set(
      "categoryId",
      String(params.categoryId),
    );
  }

  if (params.relatedSystemId !== undefined) {
    searchParams.set(
      "relatedSystemId",
      String(params.relatedSystemId),
    );
  }

  if (params.requestedPriority !== undefined) {
    searchParams.set(
      "requestedPriority",
      params.requestedPriority,
    );
  }

  if (params.status !== undefined) {
    searchParams.set(
      "status",
      params.status,
    );
  }

  if (params.sortBy !== undefined) {
    searchParams.set(
      "sortBy",
      params.sortBy,
    );
  }

  if (params.sortOrder !== undefined) {
    searchParams.set(
      "sortOrder",
      params.sortOrder,
    );
  }

  if (params.page !== undefined) {
    searchParams.set(
      "page",
      String(params.page),
    );
  }

  if (params.pageSize !== undefined) {
    searchParams.set(
      "pageSize",
      String(params.pageSize),
    );
  }

  const query = searchParams.toString();

  const response = await fetch(
    `${API_URL}/api/tickets${query ? `?${query}` : ""}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Unable to load tickets",
      ),
    );
  }

  const result: TicketListResponse =
    await response.json();

  return result;
}

export async function getStaffTickets(
  params: GetStaffQueueParams = {},
): Promise<StaffQueueResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  const response = await fetch(
    `${API_URL}/api/staff/tickets${query ? `?${query}` : ""}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    await throwApiError(response, "Unable to load the Ticket Queue right now.");
  }
  return response.json() as Promise<StaffQueueResponse>;
}

export async function getStaffTicketDetail(ticketId: number): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, {
    credentials: "include",
  });
  if (!response.ok) await throwApiError(response, "Unable to load the Ticket right now.");
  const body = await response.json() as { data: StaffTicketDetail };
  return body.data;
}

export async function claimStaffTicket(ticketId: number): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/claim`, {
    method: "POST",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({}),
  });
  if (!response.ok) await throwApiError(response, "Unable to claim the Ticket right now.");
  const body = await response.json() as { data: StaffTicketDetail };
  return body.data;
}

export async function getEligibleOwners(): Promise<EligibleOwner[]> {
  const response = await fetch(`${API_URL}/api/staff/eligible-owners`, {
    credentials: "include",
  });
  if (!response.ok) await throwApiError(response, "Unable to load eligible owners right now.");
  const body = await response.json() as { items: EligibleOwner[] };
  return body.items;
}

export async function assignStaffTicket(
  ticketId: number,
  ownerId: number | null,
): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/owner`, {
    method: "PATCH",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({ ownerId }),
  });
  if (!response.ok) await throwApiError(response, "Unable to update the Ticket assignment right now.");
  const body = await response.json() as { data: StaffTicketDetail };
  return body.data;
}

export async function updateStaffTicketPriority(
  ticketId: number,
  itPriority: RequestedPriority,
): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/it-priority`, {
    method: "PATCH",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({ itPriority }),
  });
  if (!response.ok) await throwApiError(response, "Unable to update IT Priority right now.");
  const body = await response.json() as { data: StaffTicketDetail };
  return body.data;
}

export async function updateStaffTicketStatus(
  ticketId: number,
  currentStatus: TicketStatus,
  status: TicketStatus,
  confirmed = false,
): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({ currentStatus, status, confirmed }),
  });
  if (!response.ok) await throwApiError(response, "Unable to update the Ticket status right now.");
  const body = await response.json() as { data: StaffTicketDetail };
  return body.data;
}

export async function getPublicComments(ticketId: number): Promise<CommunicationEntry[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/public-comments`, {
    credentials: "include",
  });
  if (!response.ok) await throwApiError(response, "Unable to load Public Comments right now.");
  const body = await response.json() as { items: CommunicationEntry[] };
  return body.items;
}

export async function postPublicComment(ticketId: number, content: string): Promise<CommunicationEntry> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/public-comments`, {
    method: "POST",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({ content }),
  });
  if (!response.ok) await throwApiError(response, "Unable to post the Public Comment right now.");
  const body = await response.json() as { data: CommunicationEntry };
  return body.data;
}

export async function getInternalNotes(ticketId: number): Promise<CommunicationEntry[]> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/internal-notes`, {
    credentials: "include",
  });
  if (!response.ok) await throwApiError(response, "Unable to load Internal Notes right now.");
  const body = await response.json() as { items: CommunicationEntry[] };
  return body.items;
}

export async function postInternalNote(ticketId: number, content: string): Promise<CommunicationEntry> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/internal-notes`, {
    method: "POST",
    credentials: "include",
    headers: authenticatedHeaders({ "Content-Type": "application/json" }, true),
    body: JSON.stringify({ content }),
  });
  if (!response.ok) await throwApiError(response, "Unable to add the Internal Note right now.");
  const body = await response.json() as { data: CommunicationEntry };
  return body.data;
}

// ---------------------------------------------------------------------------
// Lab 2 - Requester Ticket Detail
// ---------------------------------------------------------------------------

export async function getTicketDetail(
  ticketId: number,
): Promise<TicketDetail> {
  const response = await fetch(
    `${API_URL}/api/tickets/${ticketId}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Unable to load ticket",
      ),
    );
  }

  const ticket: TicketDetail =
    await response.json();

  return ticket;
}

// ---------------------------------------------------------------------------
// Lab 2 - Attachment Management
// ---------------------------------------------------------------------------

export async function uploadTicketAttachment(
  ticketId: number,
  file: File,
): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/api/tickets/${ticketId}/attachments`,
    {
      method: "POST",
      credentials: "include",
      headers: authenticatedHeaders({}, true),
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Unable to upload attachment",
      ),
    );
  }

  const body: { data: TicketAttachment } =
    await response.json();

  return body.data;
}

export async function removeTicketAttachment(
  attachmentId: number,
  reason: string,
): Promise<TicketAttachment> {
  const response = await fetch(
    `${API_URL}/api/attachments/${attachmentId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: authenticatedHeaders({
        "Content-Type": "application/json",
      }, true),
      body: JSON.stringify({ reason }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Unable to remove attachment",
      ),
    );
  }

  const body: { data: TicketAttachment } = await response.json();
  return body.data;
}

export async function getAttachmentMetadata(
  attachmentId: number,
): Promise<TicketAttachment> {
  const response = await fetch(
    `${API_URL}/api/attachments/${attachmentId}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Unable to load attachment"),
    );
  }

  const body: { data: TicketAttachment } = await response.json();
  return body.data;
}

export async function downloadTicketAttachment(
  attachmentId: number,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/attachments/${attachmentId}/download`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Unable to download attachment"),
    );
  }

  return response.blob();
}
