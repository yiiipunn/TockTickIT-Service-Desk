import { useEffect, useState } from "react";
import {
  ApiError,
  AuthenticatedUser,
  GetTicketsParams,
  RequestedPriority,
  RequesterDashboardData,
  RequesterDashboardTicket,
  getRequesterDashboard,
} from "./api";

type DashboardState = "loading" | "success" | "error" | "forbidden";

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
  timestamp,
  onOpen,
}: {
  title: string;
  empty: string;
  items: RequesterDashboardTicket[];
  timestamp: "updatedAt" | "resolvedAt";
  onOpen: (ticketId: number) => void;
}) {
  const headingId = `${title.replaceAll(" ", "-").toLowerCase()}-heading`;
  const timestampLabel = timestamp === "resolvedAt" ? "Resolved" : "Updated";
  return <section className="card border-0 shadow-sm dashboard-list-card" aria-labelledby={headingId}>
    <div className="card-body">
      <h2 id={headingId} className="h5">{title}</h2>
      {items.length === 0 ? <p className="text-muted mb-0">{empty}</p> : <ul className="list-group list-group-flush dashboard-list">
        {items.map((ticket) => <li className="list-group-item px-0" key={ticket.id}>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div className="dashboard-list-copy">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span className="fw-semibold">{ticket.ticketNumber}</span>
                <span className="badge text-bg-secondary">Status: {label(ticket.status)}</span>
                <span className={`badge ${priorityClass(ticket.requestedPriority)}`}>
                  Requested Priority: {label(ticket.requestedPriority)}
                </span>
              </div>
              <p className="mb-1 text-break">{ticket.summary}</p>
              <small className="text-muted">
                {timestampLabel} {dateTime(timestamp === "resolvedAt" && ticket.resolvedAt
                  ? ticket.resolvedAt
                  : ticket.updatedAt)}
              </small>
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

export default function RequesterDashboard({
  currentUser,
  onOpenTickets,
  onOpenTicket,
  onCreateTicket,
}: {
  currentUser: AuthenticatedUser;
  onOpenTickets: (query: GetTicketsParams) => void;
  onOpenTicket: (ticketId: number) => void;
  onCreateTicket: () => void;
}) {
  const [state, setState] = useState<DashboardState>("loading");
  const [dashboard, setDashboard] = useState<RequesterDashboardData | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, [currentUser.id]);

  async function loadDashboard() {
    setState("loading");
    setDashboard(null);
    try {
      setDashboard(await getRequesterDashboard());
      setState("success");
    } catch (error) {
      setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }

  if (state === "loading") {
    return <section aria-labelledby="requester-dashboard-heading" aria-busy="true">
      <h1 id="requester-dashboard-heading" className="h2">Your Dashboard</h1>
      <div className="card border-0 shadow-sm" role="status">
        <div className="card-body py-5 text-center">Loading your Dashboard...</div>
      </div>
    </section>;
  }

  if (state === "forbidden") {
    return <section aria-labelledby="requester-dashboard-heading">
      <h1 id="requester-dashboard-heading" className="h2">Your Dashboard</h1>
      <div className="alert alert-danger" role="alert">You do not have access to the Requester Dashboard.</div>
      <button className="btn btn-outline-success" type="button" onClick={() => onOpenTickets({})}>View My Tickets</button>
    </section>;
  }

  if (state === "error" || !dashboard) {
    return <section aria-labelledby="requester-dashboard-heading">
      <h1 id="requester-dashboard-heading" className="h2">Your Dashboard</h1>
      <div className="alert alert-danger" role="alert">Unable to load your Dashboard right now.</div>
      <button className="btn btn-success" type="button" onClick={() => void loadDashboard()}>Retry</button>
    </section>;
  }

  return <section className="requester-dashboard" aria-labelledby="requester-dashboard-heading">
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <p className="text-success fw-semibold mb-1">Requester workspace</p>
        <h1 id="requester-dashboard-heading" className="h2 mb-1">Your Dashboard</h1>
        <p className="text-muted mb-0">A private summary of only your Tickets as of {dateTime(dashboard.asOf)}.</p>
      </div>
      <button className="btn btn-outline-success" type="button" onClick={() => void loadDashboard()}>Refresh Dashboard</button>
    </div>

    <div className="dashboard-metric-grid mb-4" aria-label="Your Ticket metrics">
      <button className="card border-0 shadow-sm dashboard-metric-card text-start" type="button" onClick={() => onOpenTickets({ scope: "open" })}>
        <span className="card-body"><span className="d-block text-muted">Open Tickets</span><strong className="dashboard-metric-value">{dashboard.metrics.openCount}</strong><span className="d-block small text-success">View your active Tickets</span></span>
      </button>
      <button className="card border-0 shadow-sm dashboard-metric-card text-start" type="button" onClick={() => onOpenTickets({ status: "WAITING_FOR_REQUESTER" })}>
        <span className="card-body"><span className="d-block text-muted">Waiting for You</span><strong className="dashboard-metric-value">{dashboard.metrics.waitingForRequesterCount}</strong><span className="d-block small text-success">View Tickets needing your response</span></span>
      </button>
    </div>

    <section className="card border-0 shadow-sm mb-4 requester-quick-actions" aria-labelledby="quick-actions-heading">
      <div className="card-body">
        <h2 id="quick-actions-heading" className="h5">Quick Actions</h2>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-success" type="button" onClick={onCreateTicket}>Create Ticket</button>
          <button className="btn btn-outline-success" type="button" onClick={() => onOpenTickets({})}>View My Tickets</button>
        </div>
      </div>
    </section>

    <div className="dashboard-content-grid">
      <TicketList title="Attention Required" empty="No Tickets are waiting for your response." items={dashboard.attentionRequired} timestamp="updatedAt" onOpen={onOpenTicket} />
      <TicketList title="Recently Updated" empty="None of your Tickets were updated in the previous 30 days." items={dashboard.recentlyUpdated} timestamp="updatedAt" onOpen={onOpenTicket} />
      <TicketList title="Recently Resolved" empty="None of your Tickets were resolved in the previous 30 days." items={dashboard.recentlyResolved} timestamp="resolvedAt" onOpen={onOpenTicket} />
    </div>
  </section>;
}
