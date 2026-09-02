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

  const categories: Category[] = await response.json();

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
    let message = "Unable to create ticket";

    try {
      const body = await response.json();

      if (typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the default message if the response cannot be parsed.
    }

    throw new Error(message);
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
    `${API_URL}/api/tickets${
      query ? `?${query}` : ""
    }`,
    {
      headers: {
        "X-Requester-Id": String(requesterId),
      },
    },
  );

  if (!response.ok) {
    let message = "Unable to load tickets";

    try {
      const body = await response.json();

      if (typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the default message if the response cannot be parsed.
    }

    throw new Error(message);
  }

  const result: TicketListResponse =
    await response.json();

  return result;
}