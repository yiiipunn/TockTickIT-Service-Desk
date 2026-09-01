const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
// Lab 1 - System check
// ---------------------------------------------------------------------------
export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`);

  if (!healthResponse.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const categoriesResponse = await fetch(`${API_URL}/api/categories`);

  if (!categoriesResponse.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] = await categoriesResponse.json();

  return {
    online: true,
    categories,
  };
}

// ---------------------------------------------------------------------------
// Lab 2 - Development Requesters
// ---------------------------------------------------------------------------
export async function getRequesters(): Promise<DevelopmentRequester[]> {
  const response = await fetch(`${API_URL}/api/requesters`);

  if (!response.ok) {
    throw new Error("Unable to load development requesters");
  }

  const requesters: DevelopmentRequester[] = await response.json();

  return requesters;
}

// ---------------------------------------------------------------------------
// Lab 2 - Categories
// ---------------------------------------------------------------------------
export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`);

  if (!response.ok) {
    throw new Error("Unable to load request categories");
  }

  const categories: Category[] = await response.json();

  return categories;
}

// ---------------------------------------------------------------------------
// Lab 2 - Related Systems
// ---------------------------------------------------------------------------
export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`);

  if (!response.ok) {
    throw new Error("Unable to load related systems");
  }

  const relatedSystems: RelatedSystem[] = await response.json();

  return relatedSystems;
}

// ---------------------------------------------------------------------------
// Lab 2 - Create Ticket
// ---------------------------------------------------------------------------
export async function createTicket(
  requesterId: number,
  input: CreateTicketInput
): Promise<Ticket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": String(requesterId),
    },
    body: JSON.stringify(input),
  });

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