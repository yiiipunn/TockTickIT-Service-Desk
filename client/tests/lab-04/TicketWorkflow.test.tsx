import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import StaffTicketDetail from "../../src/StaffTicketDetail";
import type { StaffTicketDetail as StaffTicketDetailData } from "../../src/api";

const staff = { id: 7, name: "Ari Staff", email: "ari@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false };
const staffOwner = { id: staff.id, name: staff.name, role: "IT_STAFF" as const, isActive: true };
const ownerOptions = [{ id: staff.id, name: staff.name, email: staff.email, role: "IT_STAFF" as const }];

const baseTicket: StaffTicketDetailData = {
  id: 25,
  ticketNumber: "TKT-000025",
  summary: "Cannot connect",
  description: "The connection fails after login.",
  requester: { id: 3, name: "Narin", email: "narin@example.com" },
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 1, name: "Wi-Fi" },
  status: "OPEN",
  requestedPriority: "MEDIUM",
  itPriority: "HIGH",
  owner: staffOwner,
  ownerAssignedAt: "2026-10-01T00:00:00.000Z",
  requesterResolutionIndicatedAt: null,
  version: 4,
  resolvedAt: null,
  createdAt: "2026-09-11T03:00:00.000Z",
  updatedAt: "2026-09-11T03:15:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
  allowedTransitions: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  resolutionGate: { canResolve: true, completedActions: 1, activeActions: 0, missing: [] },
  workflowEvents: [],
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function emptyActions() {
  return response({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
}

function installStaffFetch(options: {
  ticket?: StaffTicketDetailData;
  mutation?: (body: Record<string, unknown>) => Response | Promise<Response>;
  refreshedTicket?: StaffTicketDetailData;
} = {}) {
  let detailReads = 0;
  const ticket = options.ticket ?? baseTicket;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/staff/tickets/25" && (!init?.method || init.method === "GET")) {
      detailReads += 1;
      return Promise.resolve(response({ data: detailReads > 1 && options.refreshedTicket ? options.refreshedTicket : ticket }));
    }
    if (url.pathname === "/api/staff/eligible-owners") return Promise.resolve(response({ items: ownerOptions }));
    if (url.pathname === "/api/tickets/25/actions") return Promise.resolve(emptyActions());
    if (url.pathname === "/api/staff/tickets/25/status" && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Promise.resolve(options.mutation?.(body) ?? response({ data: { ...ticket, version: ticket.version + 1, status: body.status } }));
    }
    return Promise.resolve(response({ error: { code: "UNEXPECTED", message: `Unexpected ${url.pathname}` } }, 500));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Lab 4 Staff Ticket workflow UI", () => {
  it("[UI-FLOW-01 / AC-12, AC-13, AC-14, AC-26] renders the server choices and sends versioned status mutations", async () => {
    let sentBody: Record<string, unknown> | undefined;
    const fetchMock = installStaffFetch({ mutation: (body) => {
      sentBody = body;
      return response({ data: { ...baseTicket, version: 5, status: "RESOLVED", resolvedAt: "2026-10-10T00:00:00.000Z", allowedTransitions: ["CLOSED", "REOPENED"] } });
    } });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    const next = await screen.findByLabelText("Next Status");
    expect(next).toHaveTextContent("Resolved");
    expect(next).not.toHaveTextContent("Closed");
    expect(screen.getByText("This Ticket is ready for formal resolution.")).toBeInTheDocument();
    await userEvent.selectOptions(next, "RESOLVED");
    await userEvent.click(screen.getByRole("button", { name: "Resolve ticket" }));
    expect(await screen.findByText("Ticket status updated successfully.")).toBeInTheDocument();
    expect(sentBody).toEqual({ expectedVersion: 4, currentStatus: "OPEN", status: "RESOLVED", confirmed: false });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/tickets/25/actions")).length).toBeGreaterThan(1));
  });

  it("[UI-FLOW-01 / AC-14] explains every unmet resolution condition and hides Resolve", async () => {
    installStaffFetch({ ticket: {
      ...baseTicket,
      allowedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
      resolutionGate: { canResolve: false, completedActions: 0, activeActions: 2, missing: ["owner", "completedActions", "activeActions"] },
      owner: null,
    } });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    const next = await screen.findByLabelText("Next Status");
    expect(next).not.toHaveTextContent("Resolved");
    expect(screen.getByText("Active Ticket owner: Missing")).toBeInTheDocument();
    expect(screen.getByText("At least one completed Action: Missing")).toBeInTheDocument();
    expect(screen.getByText("No planned or in-progress Actions: 2 remaining")).toBeInTheDocument();
  });

  it("[UI-FLOW-01 / AC-14, AC-25] shows field errors and focuses Actions after a raced resolution-gate failure", async () => {
    installStaffFetch({ mutation: () => response({
      error: {
        code: "RESOLUTION_GATE_FAILED",
        message: "The Ticket does not meet the resolution requirements.",
        fields: { activeActions: "Complete or cancel every planned or in-progress Action." },
      },
    }, 409) });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "RESOLVED");
    await userEvent.click(screen.getByRole("button", { name: "Resolve ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Complete or cancel every planned or in-progress Action.");
    expect(screen.getByLabelText("Next Status")).toHaveValue("RESOLVED");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Actions Taken/ })));
  });

  it("[UI-FLOW-01 / AC-12, AC-25] uses an accessible cancellation dialog with Escape/focus return and explicit confirmation", async () => {
    let sentBody: Record<string, unknown> | undefined;
    installStaffFetch({ mutation: (body) => {
      sentBody = body;
      return response({ data: { ...baseTicket, status: "CANCELLED", version: 5, allowedTransitions: [] } });
    } });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "CANCELLED");
    const invoker = screen.getByRole("button", { name: "Cancel ticket" });
    await userEvent.click(invoker);
    expect(screen.getByRole("dialog", { name: "Cancel ticket confirmation" })).toHaveTextContent("TKT-000025");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(invoker));
    await userEvent.click(invoker);
    await userEvent.click(screen.getByRole("button", { name: "Confirm Cancelled" }));
    expect(await screen.findByText("Ticket status updated successfully.")).toBeInTheDocument();
    expect(sentBody).toEqual({ expectedVersion: 4, currentStatus: "OPEN", status: "CANCELLED", confirmed: true });
  });

  it("[UI-FLOW-01 / AC-25, AC-26] refetches a stale Ticket and preserves the attempted choice as guidance", async () => {
    const latest = { ...baseTicket, version: 5, status: "WAITING_FOR_REQUESTER" as const, allowedTransitions: ["IN_PROGRESS", "RESOLVED", "CANCELLED"] as StaffTicketDetailData["allowedTransitions"] };
    installStaffFetch({
      mutation: () => response({ error: { code: "TICKET_VERSION_CONFLICT", message: "stale", current: { version: 5 } } }, 409),
      refreshedTicket: latest,
    });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "WAITING_FOR_REQUESTER");
    await userEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("latest Ticket is shown");
    expect(screen.getByRole("alert")).toHaveTextContent("Waiting for Requester");
    expect(screen.getByText("Current Status:").parentElement).toHaveTextContent("Waiting for Requester");
  });

  it("[UI-FLOW-01 / AC-21, AC-22] prevents duplicate status submissions while the real request is pending", async () => {
    let resolveMutation!: (value: Response) => void;
    const fetchMock = installStaffFetch({ mutation: () => new Promise<Response>((resolve) => { resolveMutation = resolve; }) });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    await userEvent.selectOptions(await screen.findByLabelText("Next Status"), "RESOLVED");
    await userEvent.click(screen.getByRole("button", { name: "Resolve ticket" }));
    const saving = screen.getByRole("button", { name: /Resolving/ });
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input).includes("/status") && init?.method === "PATCH")).toHaveLength(1);
    resolveMutation(response({ data: { ...baseTicket, version: 5, status: "RESOLVED", resolvedAt: "2026-10-10T00:00:00.000Z", allowedTransitions: ["CLOSED", "REOPENED"] } }));
    expect(await screen.findByText("Ticket status updated successfully.")).toBeInTheDocument();
  });

  it("[UI-FLOW-01 / AC-26] renders ordered workflow history with actor attribution", async () => {
    installStaffFetch({ ticket: { ...baseTicket, workflowEvents: [
      { id: 1, eventType: "OWNER_CHANGED", actor: { id: 9, name: "Mali Admin", role: "ADMINISTRATOR" }, fromStatus: null, toStatus: null, fromOwner: null, toOwner: { id: 7, name: "Ari Staff" }, createdAt: "2026-10-01T01:00:00.000Z" },
      { id: 2, eventType: "STATUS_CHANGED", actor: { id: 7, name: "Ari Staff", role: "IT_STAFF" }, fromStatus: "NEW", toStatus: "OPEN", fromOwner: null, toOwner: null, createdAt: "2026-10-01T02:00:00.000Z" },
    ] } });
    render(<StaffTicketDetail ticketId={25} currentUser={staff} onBack={vi.fn()} showActions />);
    expect(await screen.findByRole("heading", { name: "Ticket workflow history" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").filter((item) => item.textContent?.includes("Mali Admin") || item.textContent?.includes("Ari Staff"));
    expect(items[0]).toHaveTextContent("Owner changed from Unassigned to Ari Staff");
    expect(items[0]).toHaveTextContent("Mali Admin");
    expect(items[1]).toHaveTextContent("Status changed from New to Open");
  });
});

describe("Lab 4 Requester resolution advisory UI", () => {
  it("[UI-FLOW-02 / AC-21, AC-22] calls the real advisory API once, explains the effect, and keeps formal status unchanged", async () => {
    const requester = { id: 3, name: "Narin", email: "narin@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false };
    const category = { id: 1, name: "Network" };
    const system = { id: 1, name: "Wi-Fi" };
    let indicatedAt: string | null = null;
    const ticket = { id: 101, ticketNumber: "TKT-000101", requesterId: 3, summary: "Cannot connect", description: "Connection fails.", requestedPriority: "MEDIUM", status: "OPEN", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", category, relatedSystem: system, attachments: [] };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/auth/me") return Promise.resolve(response({ data: { user: requester, csrfToken: "csrf" } }));
      if (url.pathname === "/api/categories") return Promise.resolve(response([category]));
      if (url.pathname === "/api/related-systems") return Promise.resolve(response([system]));
      if (url.pathname === "/api/tickets") return Promise.resolve(response({ items: [ticket], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }));
      if (url.pathname === "/api/tickets/101/resolution-indication" && init?.method === "POST") {
        indicatedAt = "2026-10-10T00:00:00.000Z";
        return Promise.resolve(response({ data: { ticketId: 101, status: "OPEN", requesterResolutionIndicatedAt: indicatedAt } }));
      }
      if (url.pathname === "/api/tickets/101") return Promise.resolve(response({ ...ticket, requesterResolutionIndicatedAt: indicatedAt }));
      if (url.pathname === "/api/tickets/101/actions") return Promise.resolve(emptyActions());
      if (url.pathname === "/api/tickets/101/public-comments") return Promise.resolve(response({ items: [] }));
      return Promise.resolve(response({ error: { code: "UNEXPECTED", message: url.pathname } }, 500));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await userEvent.click(screen.getAllByRole("button", { name: "View TKT-000101" })[0]);
    expect(await screen.findByText("This notifies IT; it does not change the Ticket status.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Problem Appears Resolved" }));
    expect(await screen.findByText("IT has been notified that the problem appears resolved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IT has been notified" })).toBeDisabled();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input).includes("resolution-indication") && init?.method === "POST")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tickets/101/resolution-indication",
      expect.objectContaining({ method: "POST", body: JSON.stringify({}), headers: expect.objectContaining({ "X-CSRF-Token": "csrf" }) }),
    );
  });
});
