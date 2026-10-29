import { useEffect, useState } from "react";
import {
  ApiError,
  AuthenticatedUser,
  GetStaffQueueParams,
  RequestedPriority,
  StaffDashboardAction,
  StaffDashboardData,
  StaffDashboardTicket,
  TicketStatus,
  getStaffDashboard,
} from "./api";

type DashboardState = "loading" | "success" | "error" | "forbidden";

const STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];

function label(value: string) {
  return value.split("_").map((part) =>
    part.charAt(0) + part.slice(1).toLowerCase(),
  ).join(" ");
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function priorityClass(priority: RequestedPriority) {
  if (priority === "HIGH") return "bg-danger-subtle text-danger-emphasis border border-danger-subtle";
  if (priority === "MEDIUM") return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
  return "bg-success-subtle text-success border border-success-subtle";
}

function TicketList({
  title,
  empty,
  items,
  onOpen,
}: {
  title: string;
  empty: string;
  items: StaffDashboardTicket[];
  onOpen: (ticketId: number) => void;
}) {
  return <section className="card border-0 shadow-sm dashboard-list-card" aria-labelledby={`${title.replaceAll(" ", "-").toLowerCase()}-heading`}>
    <div className="card-body">
      <h2 id={`${title.replaceAll(" ", "-").toLowerCase()}-heading`} className="h5">{title}</h2>
      {items.length === 0 ? <p className="text-muted mb-0">{empty}</p> : <ul className="list-group list-group-flush dashboard-list">
        {items.map((ticket) => <li className="list-group-item px-0" key={ticket.id}>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div className="dashboard-list-copy">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span className="fw-semibold">{ticket.ticketNumber}</span>
                <span className="badge text-bg-secondary">Status: {label(ticket.status)}</span>
                <span className={`badge ${priorityClass(ticket.itPriority)}`}>IT Priority: {label(ticket.itPriority)}</span>
              </div>
              <p className="mb-1 text-break">{ticket.summary}</p>
              <small className="text-muted">Updated {dateTime(ticket.updatedAt)}</small>
            </div>
            <button className="btn btn-sm btn-outline-success" type="button" onClick={() => onOpen(ticket.id)}>
              Open Ticket
            </button>
          </div>
        </li>)}
      </ul>}
    </div>
  </section>;
}

function ActionList({
  title,
  empty,
  items,
  completed,
  onOpen,
}: {
  title: string;
  empty: string;
  items: StaffDashboardAction[];
  completed?: boolean;
  onOpen: (ticketId: number, actionId: number) => void;
}) {
  const headingId = `${title.replaceAll(" ", "-").toLowerCase()}-heading`;
  return <section className="card border-0 shadow-sm dashboard-list-card" aria-labelledby={headingId}>
    <div className="card-body">
      <h2 id={headingId} className="h5" tabIndex={-1}>{title}</h2>
      {items.length === 0 ? <p className="text-muted mb-0">{empty}</p> : <ul className="list-group list-group-flush dashboard-list">
        {items.map((action) => <li className="list-group-item px-0" key={action.id}>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div className="dashboard-list-copy">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span className="fw-semibold">{action.ticket.ticketNumber} · Action #{action.id}</span>
                <span className="badge text-bg-secondary">Action status: {label(action.status)}</span>
              </div>
              <p className="mb-1 text-break">{action.description}</p>
              <small className="text-muted">
                {completed && action.completedAt
                  ? `Completed ${dateTime(action.completedAt)}`
                  : `Action date ${dateTime(action.actionAt)}`}
              </small>
            </div>
            <button className="btn btn-sm btn-outline-success" type="button" onClick={() => onOpen(action.ticket.id, action.id)}>
              View Action
            </button>
          </div>
        </li>)}
      </ul>}
    </div>
  </section>;
}

export default function StaffDashboard({
  currentUser,
  onOpenQueue,
  onOpenTicket,
  onOpenAction,
}: {
  currentUser: AuthenticatedUser;
  onOpenQueue: (query: GetStaffQueueParams) => void;
  onOpenTicket: (ticketId: number) => void;
  onOpenAction: (ticketId: number, actionId: number) => void;
}) {
  const [state, setState] = useState<DashboardState>("loading");
  const [dashboard, setDashboard] = useState<StaffDashboardData | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, [currentUser.id]);

  async function loadDashboard() {
    setState("loading");
    setDashboard(null);
    try {
      const loaded = await getStaffDashboard();
      setDashboard(loaded);
      setState("success");
    } catch (error) {
      setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }

  if (state === "loading") {
    return <section aria-labelledby="staff-dashboard-heading" aria-busy="true">
      <h1 id="staff-dashboard-heading" className="h2">Staff Dashboard</h1>
      <div className="card border-0 shadow-sm" role="status">
        <div className="card-body py-5 text-center">Loading Staff Dashboard…</div>
      </div>
    </section>;
  }

  if (state === "forbidden") {
    return <section aria-labelledby="staff-dashboard-heading">
      <h1 id="staff-dashboard-heading" className="h2">Staff Dashboard</h1>
      <div className="alert alert-danger" role="alert">You do not have access to the Staff Dashboard.</div>
      <button className="btn btn-outline-success" type="button" onClick={() => onOpenQueue({})}>Go to Ticket Queue</button>
    </section>;
  }

  if (state === "error" || !dashboard) {
    return <section aria-labelledby="staff-dashboard-heading">
      <h1 id="staff-dashboard-heading" className="h2">Staff Dashboard</h1>
      <div className="alert alert-danger" role="alert">Unable to load the Staff Dashboard right now.</div>
      <button className="btn btn-success" type="button" onClick={() => void loadDashboard()}>Retry</button>
    </section>;
  }

  const { metrics } = dashboard;
  const roleName = currentUser.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff";

  return <section aria-labelledby="staff-dashboard-heading">
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <p className="text-success fw-semibold mb-1">{roleName} workspace</p>
        <h1 id="staff-dashboard-heading" className="h2 mb-1">Staff Dashboard</h1>
        <p className="text-muted mb-0">Operational work as of {dateTime(dashboard.asOf)}.</p>
      </div>
      <button className="btn btn-outline-success" type="button" onClick={() => void loadDashboard()}>Refresh Dashboard</button>
    </div>

    <div className="dashboard-metric-grid mb-4" aria-label="Operational metrics">
      <button className="card border-0 shadow-sm dashboard-metric-card text-start" type="button" onClick={() => onOpenQueue({ owner: "unassigned", scope: "open" })}>
        <span className="card-body"><span className="d-block text-muted">Unassigned Open</span><strong className="dashboard-metric-value">{metrics.unassignedOpenCount}</strong><span className="d-block small text-success">View open unassigned Tickets</span></span>
      </button>
      <button className="card border-0 shadow-sm dashboard-metric-card text-start" type="button" onClick={() => onOpenQueue({ owner: "me", scope: "open" })}>
        <span className="card-body"><span className="d-block text-muted">My Open Tickets</span><strong className="dashboard-metric-value">{metrics.myOpenTicketCount}</strong><span className="d-block small text-success">View my active Ticket work</span></span>
      </button>
      <button className="card border-0 shadow-sm dashboard-metric-card text-start" type="button" onClick={() => document.getElementById("my-active-actions-heading")?.focus()}>
        <span className="card-body"><span className="d-block text-muted">My Active Actions</span><strong className="dashboard-metric-value">{metrics.myActiveActionsCount}</strong><span className="d-block small text-success">Jump to assigned Actions</span></span>
      </button>
    </div>

    <div className="dashboard-count-grid mb-4">
      <section className="card border-0 shadow-sm" aria-labelledby="tickets-by-status-heading">
        <div className="card-body">
          <h2 id="tickets-by-status-heading" className="h5">Tickets by Status</h2>
          <div className="dashboard-count-list">{STATUSES.map((status) => <button className="dashboard-count-row" type="button" key={status} onClick={() => onOpenQueue({ status })}>
            <span>{label(status)}</span><strong>{metrics.countsByStatus[status]}</strong>
          </button>)}</div>
        </div>
      </section>
      <section className="card border-0 shadow-sm" aria-labelledby="tickets-by-priority-heading">
        <div className="card-body">
          <h2 id="tickets-by-priority-heading" className="h5">Active Tickets by IT Priority</h2>
          <div className="dashboard-count-list">{PRIORITIES.map((priority) => <button className="dashboard-count-row" type="button" key={priority} onClick={() => onOpenQueue({ itPriority: priority, scope: "open" })}>
            <span>{label(priority)}</span><strong>{metrics.countsByItPriority[priority]}</strong>
          </button>)}</div>
        </div>
      </section>
    </div>

    <div className="dashboard-content-grid">
      <TicketList title="Urgent Tickets" empty="No active High-priority Tickets need attention." items={dashboard.urgentTickets} onOpen={onOpenTicket} />
      <TicketList title="Recently Updated" empty="No active Tickets were updated in the previous 7 days." items={dashboard.recentlyUpdated} onOpen={onOpenTicket} />
      <ActionList title="My Active Actions" empty="No planned or in-progress Actions are assigned to you." items={dashboard.myActiveActions} onOpen={onOpenAction} />
      <ActionList title="Recently Completed by Me" empty="You have not completed an Action in the previous 30 days." items={dashboard.myRecentCompletedActions} completed onOpen={onOpenAction} />
    </div>
  </section>;
}
