import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffDashboard from "../../src/StaffDashboard";
import type {
  AuthenticatedUser,
  StaffDashboardData,
} from "../../src/api";

const staffUser: AuthenticatedUser = {
  id: 7,
  name: "Ari Staff",
  email: "ari@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

function dashboardFixture(overrides: Partial<StaffDashboardData> = {}): StaffDashboardData {
  return {
    asOf: "2026-10-29T05:00:00.000Z",
    timezone: "UTC",
    metrics: {
      unassignedOpenCount: 4,
      myOpenTicketCount: 2,
      myActiveActionsCount: 1,
      countsByStatus: {
        NEW: 2,
        OPEN: 3,
        IN_PROGRESS: 1,
        WAITING_FOR_REQUESTER: 1,
        RESOLVED: 2,
        CLOSED: 5,
        REOPENED: 1,
        CANCELLED: 1,
      },
      countsByItPriority: { LOW: 2, MEDIUM: 3, HIGH: 3 },
    },
    urgentTickets: [{
      id: 25,
      ticketNumber: "TKT-000025",
      summary: "Cannot connect to Wi-Fi",
      status: "IN_PROGRESS",
      itPriority: "HIGH",
      updatedAt: "2026-10-29T04:00:00.000Z",
    }],
    recentlyUpdated: [{
      id: 26,
      ticketNumber: "TKT-000026",
      summary: "VPN profile failed",
      status: "OPEN",
      itPriority: "MEDIUM",
      updatedAt: "2026-10-28T04:00:00.000Z",
    }],
    myActiveActions: [{
      id: 41,
      status: "PLANNED",
      actionAt: "2026-10-30T03:30:00.000Z",
      description: "Replace the expired wireless profile.",
      completedAt: null,
      ticket: { id: 25, ticketNumber: "TKT-000025", summary: "Cannot connect to Wi-Fi" },
    }],
    myRecentCompletedActions: [{
      id: 40,
      status: "COMPLETED",
      actionAt: "2026-10-26T03:30:00.000Z",
      description: "Verified the replacement profile.",
      completedAt: "2026-10-26T04:00:00.000Z",
      ticket: { id: 25, ticketNumber: "TKT-000025", summary: "Cannot connect to Wi-Fi" },
    }],
    links: {
      unassigned: "/api/staff/tickets?owner=unassigned&scope=open&page=1&pageSize=20",
      mine: "/api/staff/tickets?owner=me&scope=open&page=1&pageSize=20",
      urgent: "/api/staff/tickets?itPriority=HIGH&scope=open&page=1&pageSize=20",
    },
    ...overrides,
  };
}

function response(data: StaffDashboardData, status = 200) {
  return new Response(JSON.stringify(status === 200
    ? { data }
    : { error: { code: status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR", message: "Safe failure" } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderDashboard(fetchMock: ReturnType<typeof vi.fn>, user = staffUser) {
  vi.stubGlobal("fetch", fetchMock);
  const onOpenQueue = vi.fn();
  const onOpenTicket = vi.fn();
  const onOpenAction = vi.fn();
  render(<StaffDashboard
    currentUser={user}
    onOpenQueue={onOpenQueue}
    onOpenTicket={onOpenTicket}
    onOpenAction={onOpenAction}
  />);
  return { onOpenQueue, onOpenTicket, onOpenAction };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Lab 4 Staff Dashboard", () => {
  it("[UI-STAFF-01 / AC-16, AC-21] renders exact metrics, ordered lists, current-user Actions, and role context", async () => {
    renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture())));

    expect(await screen.findByText("TKT-000025")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("IT Staff workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unassigned Open 4/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My Open Tickets 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My Active Actions 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Closed 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "High 3" })).toBeInTheDocument();
    expect(screen.getByText("Action status: Planned")).toBeInTheDocument();
    expect(screen.getByText("Action status: Completed")).toBeInTheDocument();
    expect(screen.getByText(/Operational work as of/)).toBeInTheDocument();
  });

  it("[UI-STAFF-01 / AC-16, AC-17] navigates metric, count, Ticket, and Action drill-downs with equivalent filters", async () => {
    const user = userEvent.setup();
    const callbacks = renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture())));
    await screen.findByText("TKT-000025");

    await user.click(screen.getByRole("button", { name: /Unassigned Open 4/ }));
    expect(callbacks.onOpenQueue).toHaveBeenLastCalledWith({ owner: "unassigned", scope: "open" });
    await user.click(screen.getByRole("button", { name: /My Open Tickets 2/ }));
    expect(callbacks.onOpenQueue).toHaveBeenLastCalledWith({ owner: "me", scope: "open" });
    await user.click(screen.getByRole("button", { name: "Closed 5" }));
    expect(callbacks.onOpenQueue).toHaveBeenLastCalledWith({ status: "CLOSED" });
    await user.click(screen.getByRole("button", { name: "High 3" }));
    expect(callbacks.onOpenQueue).toHaveBeenLastCalledWith({ itPriority: "HIGH", scope: "open" });

    const urgent = screen.getByRole("heading", { name: "Urgent Tickets" }).closest("section");
    await user.click(within(urgent!).getByRole("button", { name: "Open Ticket" }));
    expect(callbacks.onOpenTicket).toHaveBeenCalledWith(25);
    const activeActions = screen.getByRole("heading", { name: "My Active Actions" }).closest("section");
    await user.click(within(activeActions!).getByRole("button", { name: "View Action" }));
    expect(callbacks.onOpenAction).toHaveBeenCalledWith(25, 41);
  });

  it("[UI-STAFF-01 / AC-18, AC-21] renders every zero key and useful empty states", async () => {
    const empty = dashboardFixture({
      metrics: {
        unassignedOpenCount: 0,
        myOpenTicketCount: 0,
        myActiveActionsCount: 0,
        countsByStatus: {
          NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0,
          RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0,
        },
        countsByItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      },
      urgentTickets: [],
      recentlyUpdated: [],
      myActiveActions: [],
      myRecentCompletedActions: [],
    });
    renderDashboard(vi.fn().mockResolvedValue(response(empty)));

    expect(await screen.findByText("No active High-priority Tickets need attention.")).toBeInTheDocument();
    expect(screen.getByText("No active Tickets were updated in the previous 7 days.")).toBeInTheDocument();
    expect(screen.getByText("No planned or in-progress Actions are assigned to you.")).toBeInTheDocument();
    expect(screen.getByText("You have not completed an Action in the previous 30 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelled 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Low 0" })).toBeInTheDocument();
  });

  it("[UI-STAFF-01 / AC-18, AC-21] provides loading, whole-response error, safe retry, and forbidden states", async () => {
    const pending = new Promise<Response>(() => undefined);
    const loadingRender = renderDashboard(vi.fn().mockReturnValue(pending));
    expect(screen.getByRole("status")).toHaveTextContent("Loading Staff Dashboard");
    expect(screen.getByRole("heading", { name: "Staff Dashboard" }).closest("section")).toHaveAttribute("aria-busy", "true");
    expect(loadingRender.onOpenQueue).not.toHaveBeenCalled();
  });

  it("retries a safe dashboard failure without retaining partial values", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(dashboardFixture(), 500))
      .mockResolvedValueOnce(response(dashboardFixture()));
    renderDashboard(fetchMock);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the Staff Dashboard right now.");
    expect(screen.queryByText("TKT-000025")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("TKT-000025")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a protected forbidden state with only a permitted destination", async () => {
    const callbacks = renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture(), 403)));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access to the Staff Dashboard.");
    expect(screen.queryByText("TKT-000025")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go to Ticket Queue" }));
    expect(callbacks.onOpenQueue).toHaveBeenCalledWith({});
  });

  it("[UI-STAFF-01 / AC-17] identifies the reused Administrator workspace without adding account metrics", async () => {
    renderDashboard(
      vi.fn().mockResolvedValue(response(dashboardFixture())),
      { ...staffUser, role: "ADMINISTRATOR" },
    );
    expect(await screen.findByText("Administrator workspace")).toBeInTheDocument();
    expect(screen.queryByText(/user accounts/i)).not.toBeInTheDocument();
  });

  it("[UI-A11Y-01 / AC-23, AC-24] keeps semantic landmarks, text status cues, focus targets, and responsive one-column rules", async () => {
    renderDashboard(vi.fn().mockResolvedValue(response(dashboardFixture())));
    await screen.findByText("TKT-000025");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText("Operational metrics")).toBeInTheDocument();
    expect(screen.getByText("Status: In Progress")).toBeInTheDocument();
    expect(screen.getByText("IT Priority: High")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /My Active Actions 1/ }));
    expect(screen.getByRole("heading", { name: "My Active Actions" })).toHaveFocus();

    expect(document.querySelector(".dashboard-metric-grid")).toBeInTheDocument();
    expect(document.querySelector(".dashboard-count-grid")).toBeInTheDocument();
    expect(document.querySelector(".dashboard-content-grid")).toBeInTheDocument();
    expect(screen.getByText("Cannot connect to Wi-Fi")).toHaveClass("text-break");
  });
});
