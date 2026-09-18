import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";

function installFetch(
  role = "REQUESTER",
  mustChangePassword = false,
  staffItems: Array<Record<string, unknown>> = [],
  staffDetail?: Record<string, unknown>,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/auth/me")) {
      return new Response(JSON.stringify({ data: { user: {
        id: 7,
        name: "Ari Example",
        email: "ari@example.com",
        role,
        isActive: true,
        mustChangePassword,
      }, csrfToken: "shell-csrf" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/api/auth/change-password") && init?.method === "POST") {
      return new Response(JSON.stringify({ data: { user: {
        id: 7,
        name: "Ari Example",
        email: "ari@example.com",
        role,
        isActive: true,
        mustChangePassword: false,
      }, csrfToken: "rotated-shell-csrf" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.match(/\/api\/staff\/tickets\/\d+$/)) {
      return new Response(JSON.stringify({ data: staffDetail }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/api/staff/eligible-owners")) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/staff/tickets")) {
      return new Response(JSON.stringify({
        items: staffItems,
        pagination: { page: 1, pageSize: 20, totalItems: staffItems.length, totalPages: staffItems.length ? 1 : 0 },
        counts: { matching: staffItems.length, matchingUnassigned: staffItems.filter((ticket) => ticket.owner === null).length },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/admin/users")) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const body = url.includes("/api/tickets")
      ? { items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }
      : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authenticated application shell", () => {
  it("restores a requester session and shows server-provided identity and role", async () => {
    installFetch();
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(screen.getByText("Ari Example")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ticket Queue" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Development Requester")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("blocks normal access when an initial password change is required", async () => {
    installFetch("REQUESTER", true);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Password change required" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("cannot bypass a required change on refresh and enters the requester app only after success", async () => {
    const fetchMock = installFetch("REQUESTER", true);
    render(<App />);
    await screen.findByRole("heading", { name: "Password change required" });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/tickets"))).toBe(false);

    await userEvent.type(screen.getByLabelText("Current password"), "initial-password");
    await userEvent.type(screen.getByLabelText("New password"), "new-password!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password!");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed successfully");
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/change-password",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "shell-csrf",
        },
      }),
    );
  });

  it("allows a normal user to open and cancel voluntary password change", async () => {
    installFetch("REQUESTER", false);
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("heading", { name: "Change Password" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("shows the staff queue navigation without implementing future staff operations", async () => {
    installFetch("IT_STAFF");
    render(<App />);
    expect(await screen.findByText("IT Staff")).toBeInTheDocument();
    expect(screen.getByText("Ari Example")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByText("IT Staff workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Claim Ticket")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
  });

  it("lets an Administrator navigate between User Management and the permitted Ticket Queue", async () => {
    installFetch("ADMINISTRATOR");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Application navigation" })).getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "User Management" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "User Management" })).toHaveClass("text-decoration-underline");
    await userEvent.click(screen.getByRole("button", { name: "Ticket Queue" }));
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByText("Administrator workspace")).toBeInTheDocument();
    expect(screen.queryByText("IT Staff workspace")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Ticket Queue" })).toHaveClass("text-decoration-underline");
    await userEvent.click(screen.getByRole("button", { name: "User Management" }));
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "User Management" })).toHaveAttribute("aria-current", "page");
  });

  it("opens Ticket Detail with Claim available for an unassigned Ticket", async () => {
    const queueTicket = {
      id: 25,
      ticketNumber: "TKT-000025",
      summary: "Cannot connect to Wi-Fi",
      requester: { id: 3, name: "Narin S.", email: "narin@example.com" },
      status: "OPEN",
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      owner: null,
      updatedAt: "2026-09-11T03:15:00.000Z",
    };
    installFetch("IT_STAFF", false, [queueTicket], {
      ...queueTicket,
      description: "The connection fails after login.",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "Wi-Fi" },
      ownerAssignedAt: null,
      requesterResolutionIndicatedAt: null,
      createdAt: "2026-09-11T03:00:00.000Z",
      attachments: [],
      publicComments: [],
      internalNotes: [],
      allowedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Ticket Queue" });
    await userEvent.click(screen.getAllByRole("button", { name: "Open Ticket" })[0]);
    expect(await screen.findByRole("heading", { name: "Cannot connect to Wi-Fi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeInTheDocument();
  });

  it("logs out with CSRF and returns to login", async () => {
    const fetchMock = installFetch("IT_STAFF");
    render(<App />);
    await screen.findByText("IT Staff");
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in to TokTickIT" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/logout",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-CSRF-Token": "shell-csrf" },
      }),
    );
  });
});
