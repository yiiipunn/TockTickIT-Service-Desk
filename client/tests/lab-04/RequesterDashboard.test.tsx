import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterDashboard from "../../src/RequesterDashboard";
import App from "../../src/App";
import type { AuthenticatedUser, RequesterDashboardData } from "../../src/api";

const requester: AuthenticatedUser = {
  id: 11,
  name: "Narin Requester",
  email: "narin@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

function dashboardFixture(overrides: Partial<RequesterDashboardData> = {}): RequesterDashboardData {
  return {
    asOf: "2026-10-29T05:00:00.000Z",
    timezone: "UTC",
    metrics: { openCount: 4, waitingForRequesterCount: 1 },
    attentionRequired: [{
      id: 25,
      ticketNumber: "TKT-000025",
      summary: "Please confirm the replacement Wi-Fi profile",
      status: "WAITING_FOR_REQUESTER",
      requestedPriority: "HIGH",
      updatedAt: "2026-10-29T04:00:00.000Z",
      resolvedAt: null,
    }],
    recentlyUpdated: [{
      id: 26,
      ticketNumber: "TKT-000026",
      summary: "VPN profile investigation",
      status: "IN_PROGRESS",
      requestedPriority: "MEDIUM",
      updatedAt: "2026-10-28T04:00:00.000Z",
      resolvedAt: null,
    }],
    recentlyResolved: [{
      id: 27,
      ticketNumber: "TKT-000027",
      summary: "Printer access restored",
      status: "RESOLVED",
      requestedPriority: "LOW",
      updatedAt: "2026-10-27T04:00:00.000Z",
      resolvedAt: "2026-10-27T03:00:00.000Z",
    }],
    links: {
      open: "/api/tickets?scope=open&page=1&pageSize=10",
      waitingForRequester: "/api/tickets?status=WAITING_FOR_REQUESTER&page=1&pageSize=10",
    },
    ...overrides,
  };
}

function response(data: RequesterDashboardData, status = 200) {
  return new Response(JSON.stringify(status === 200
    ? { data }
    : { error: { code: status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR", message: "Safe failure" } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderDashboard(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const onOpenTickets = vi.fn();
  const onOpenTicket = vi.fn();
  const onCreateTicket = vi.fn();
  render(<RequesterDashboard
    currentUser={requester}
    onOpenTickets={onOpenTickets}
    onOpenTicket={onOpenTicket}
    onCreateTicket={onCreateTicket}
  />);
  return { onOpenTickets, onOpenTicket, onCreateTicket };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lab 4 Requester Dashboard", () => {
  it("[UI-REQ-01 / AC-02, AC-15, AC-21] renders own-data context, exact metrics, and the three ordered lists", async () => {
    renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture())));

    expect(await screen.findByText("TKT-000025")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/private summary of only your Tickets/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Tickets 4/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Waiting for You 1/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Attention Required" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Recently Updated" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Recently Resolved" })).toBeInTheDocument();
    expect(screen.getByText("Status: Waiting For Requester")).toBeInTheDocument();
    expect(screen.getByText("Requested Priority: High")).toBeInTheDocument();
  });

  it("[UI-REQ-01 / AC-02, AC-15] navigates cards, quick actions, and rows with equivalent filters", async () => {
    const user = userEvent.setup();
    const callbacks = renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture())));
    await screen.findByText("TKT-000025");

    await user.click(screen.getByRole("button", { name: /Open Tickets 4/ }));
    expect(callbacks.onOpenTickets).toHaveBeenLastCalledWith({ scope: "open" });
    await user.click(screen.getByRole("button", { name: /Waiting for You 1/ }));
    expect(callbacks.onOpenTickets).toHaveBeenLastCalledWith({ status: "WAITING_FOR_REQUESTER" });
    await user.click(screen.getByRole("button", { name: "Create Ticket" }));
    expect(callbacks.onCreateTicket).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "View My Tickets" }));
    expect(callbacks.onOpenTickets).toHaveBeenLastCalledWith({});

    const attention = screen.getByRole("heading", { name: "Attention Required" }).closest("section");
    await user.click(within(attention!).getByRole("button", { name: "Open Ticket" }));
    expect(callbacks.onOpenTicket).toHaveBeenCalledWith(25);
  });

  it("[UI-REQ-01 / AC-18, AC-21] renders useful zero and empty states", async () => {
    renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture({
      metrics: { openCount: 0, waitingForRequesterCount: 0 },
      attentionRequired: [],
      recentlyUpdated: [],
      recentlyResolved: [],
    }))));

    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.getByText("None of your Tickets were updated in the previous 30 days.")).toBeInTheDocument();
    expect(screen.getByText("None of your Tickets were resolved in the previous 30 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Tickets 0/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Waiting for You 0/ })).toBeInTheDocument();
  });

  it("[UI-REQ-01 / AC-18, AC-21] exposes a safe loading state", () => {
    const pending = new Promise<Response>(() => undefined);
    const callbacks = renderDashboard(vi.fn().mockReturnValue(pending));
    expect(screen.getByRole("status")).toHaveTextContent("Loading your Dashboard");
    expect(screen.getByRole("heading", { name: "Your Dashboard" }).closest("section")).toHaveAttribute("aria-busy", "true");
    expect(callbacks.onOpenTickets).not.toHaveBeenCalled();
  });

  it("[UI-REQ-01 / AC-18] retries whole-response failures without retaining partial values", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(dashboardFixture(), 500))
      .mockResolvedValueOnce(response(dashboardFixture()));
    renderDashboard(fetchMock);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your Dashboard right now.");
    expect(screen.queryByText("TKT-000025")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("TKT-000025")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("[UI-REQ-01 / AC-15, AC-18] renders the protected forbidden state with a permitted destination", async () => {
    const callbacks = renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture(), 403)));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access to the Requester Dashboard.");
    expect(screen.queryByText("TKT-000025")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View My Tickets" }));
    expect(callbacks.onOpenTickets).toHaveBeenCalledWith({});
  });

  it("[UI-A11Y-01 / AC-23, AC-24] keeps semantic headings, text cues, break-safe rows, and responsive layout hooks", async () => {
    renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture())));
    await screen.findByText("TKT-000025");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText("Your Ticket metrics")).toBeInTheDocument();
    expect(document.querySelector(".requester-dashboard .dashboard-metric-grid")).toBeInTheDocument();
    expect(document.querySelector(".requester-dashboard .dashboard-content-grid")).toBeInTheDocument();
    expect(document.querySelector(".requester-quick-actions")).toBeInTheDocument();
    expect(screen.getByText("Please confirm the replacement Wi-Fi profile")).toHaveClass("text-break");
  });
});

describe("Lab 4 Requester Dashboard application integration", () => {
  it("[UI-REQ-01 / AC-02, AC-15, AC-21] is the default Requester view and preserves exact My Tickets drill-down filters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/auth/me") {
        return new Response(JSON.stringify({ data: { user: requester, csrfToken: "requester-csrf" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.pathname === "/api/dashboards/requester") {
        return response(dashboardFixture());
      }
      if (url.pathname === "/api/categories" || url.pathname === "/api/related-systems") {
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/api/tickets") {
        return new Response(JSON.stringify({
          items: [],
          pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const openCard = await screen.findByRole("button", { name: /Open Tickets 4/ });
    expect(screen.getByRole("heading", { level: 1, name: "Your Dashboard" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Requester application navigation" });
    expect(within(navigation).getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("button", { name: "My Tickets" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();
    expect(within(navigation).queryByRole("button", { name: "Ticket Queue" })).not.toBeInTheDocument();

    await userEvent.click(openCard);
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const calledUrl = new URL(String(input));
      return calledUrl.pathname === "/api/tickets" && calledUrl.searchParams.get("scope") === "open";
    })).toBe(true));
    expect(screen.getByLabelText("My Tickets scope filter")).toHaveValue("open");

    await userEvent.click(within(navigation).getByRole("button", { name: "Dashboard" }));
    await screen.findByRole("heading", { level: 1, name: "Your Dashboard" });
    await userEvent.click(await screen.findByRole("button", { name: /Waiting for You 1/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const calledUrl = new URL(String(input));
      return calledUrl.pathname === "/api/tickets" &&
        calledUrl.searchParams.get("status") === "WAITING_FOR_REQUESTER";
    })).toBe(true));
    expect(screen.getByLabelText("My Tickets status filter")).toHaveValue("WAITING_FOR_REQUESTER");
  });
});
