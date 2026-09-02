const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface DevelopmentRequester {
  id: number;
  name: string;
  email: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

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

// ---------------------------------------------------------------------------
// Lab 1 - System check
// ---------------------------------------------------------------------------

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`);

  if (!healthResponse.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const categoriesResponse = await fetch(
    `${API_URL}/api/categories`,
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
// Lab 2 - Development Requesters
// ---------------------------------------------------------------------------

export async function getRequesters(): Promise<
  DevelopmentRequester[]
> {
  const response = await fetch(`${API_URL}/api/requesters`);

  if (!response.ok) {
    throw new Error(
      "Unable to load development requesters",
    );
  }

  const requesters: DevelopmentRequester[] =
    await response.json();

  return requesters;
}

// ---------------------------------------------------------------------------
// Lab 2 - Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(
    `${API_URL}/api/categories`,
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
  requesterId: number,
  input: CreateTicketInput,
): Promise<Ticket> {
  const response = await fetch(
    `${API_URL}/api/tickets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requester-Id": String(requesterId),
      },
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
  requesterId: number,
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
      headers: {
        "X-Requester-Id": String(requesterId),
      },
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

// ---------------------------------------------------------------------------
// Lab 2 - Requester Ticket Detail
// ---------------------------------------------------------------------------

export async function getTicketDetail(
  requesterId: number,
  ticketId: number,
): Promise<TicketDetail> {
  const response = await fetch(
    `${API_URL}/api/tickets/${ticketId}`,
    {
      headers: {
        "X-Requester-Id": String(requesterId),
      },
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
  requesterId: number,
  ticketId: number,
  file: File,
): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/api/tickets/${ticketId}/attachments`,
    {
      method: "POST",
      headers: {
        "X-Requester-Id": String(requesterId),
      },
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
  requesterId: number,
  attachmentId: number,
  reason: string,
): Promise<TicketAttachment> {
  const response = await fetch(
    `${API_URL}/api/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Requester-Id": String(requesterId),
      },
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
  requesterId: number,
  attachmentId: number,
): Promise<TicketAttachment> {
  const response = await fetch(
    `${API_URL}/api/attachments/${attachmentId}`,
    {
      headers: {
        "X-Requester-Id": String(requesterId),
      },
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
  requesterId: number,
  attachmentId: number,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/attachments/${attachmentId}/download`,
    {
      headers: {
        "X-Requester-Id": String(requesterId),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Unable to download attachment"),
    );
  }

  return response.blob();
}
