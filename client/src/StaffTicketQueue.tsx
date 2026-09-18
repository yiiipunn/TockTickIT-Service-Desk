import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  GetStaffQueueParams,
  RequestedPriority,
  StaffQueueResponse,
  StaffQueueTicket,
  getStaffTickets,
} from "./api";

type QueueState = "loading" | "success" | "error";

const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const defaultQuery: Required<Pick<GetStaffQueueParams, "sortBy" | "sortOrder" | "pageSize">> = {
  sortBy: "updatedAt",
  sortOrder: "desc",
  pageSize: 20,
};

function formatLabel(value: string) {
  return value.split("_").map((part) =>
    part.charAt(0) + part.slice(1).toLowerCase(),
  ).join(" ");
}

function priorityClass(priority: RequestedPriority) {
  if (priority === "HIGH") return "bg-danger-subtle text-danger-emphasis border border-danger-subtle";
  if (priority === "MEDIUM") return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
  return "bg-success-subtle text-success border border-success-subtle";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StaffTicketQueue({
  onOpenTicket,
  role,
}: {
  onOpenTicket: (ticket: StaffQueueTicket) => void;
  role: "IT_STAFF" | "ADMINISTRATOR";
}) {
  const [state, setState] = useState<QueueState>("loading");
  const [result, setResult] = useState<StaffQueueResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<RequestedPriority | "">("");
  const [itPriority, setItPriority] = useState<RequestedPriority | "">("");
  const [ownerMode, setOwnerMode] = useState<"" | "me" | "unassigned">("");
  const [ownerId, setOwnerId] = useState("");
  const [sortBy, setSortBy] = useState<GetStaffQueueParams["sortBy"]>(defaultQuery.sortBy);
  const [sortOrder, setSortOrder] = useState<GetStaffQueueParams["sortOrder"]>(defaultQuery.sortOrder);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(defaultQuery.pageSize);

  useEffect(() => {
    void loadQueue(1);
  }, []);

  function currentQuery(): GetStaffQueueParams {
    const parsedOwnerId = ownerId.trim() ? Number(ownerId) : undefined;
    return {
      search,
      status: status || undefined,
      requestedPriority: requestedPriority || undefined,
      itPriority: itPriority || undefined,
      owner: ownerMode || parsedOwnerId,
      sortBy,
      sortOrder,
      pageSize,
    };
  }

  async function loadQueue(page: number, query = currentQuery()) {
    setState("loading");
    setError(null);
    setResult(null);
    try {
      const loaded = await getStaffTickets({ ...query, page });
      setResult(loaded);
      setState("success");
    } catch (loadError) {
      setError(loadError instanceof ApiError
        ? loadError
        : new ApiError("Unable to load the Ticket Queue right now.", "REQUEST_FAILED", 0));
      setState("error");
    }
  }

  function applyQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadQueue(1);
  }

  function clearQuery() {
    setSearch("");
    setStatus("");
    setRequestedPriority("");
    setItPriority("");
    setOwnerMode("");
    setOwnerId("");
    setSortBy(defaultQuery.sortBy);
    setSortOrder(defaultQuery.sortOrder);
    setPageSize(defaultQuery.pageSize);
    void loadQueue(1, defaultQuery);
  }

  const hasSearchOrFilters = Boolean(
    search.trim() || status || requestedPriority || itPriority || ownerMode || ownerId.trim(),
  );

  return (
    <section aria-labelledby="ticket-queue-heading">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <p className="text-success fw-semibold mb-1">{role === "ADMINISTRATOR" ? "Administrator workspace" : "IT Staff workspace"}</p>
          <h1 id="ticket-queue-heading" className="h2 mb-1">Ticket Queue</h1>
          <p className="text-muted mb-0">Find and prioritize shared operational work.</p>
        </div>
        {state === "success" && result && (
          <div className="queue-counts" aria-live="polite">
            <span><strong>{result.counts.matching}</strong> matching</span>
            <span><strong>{result.counts.matchingUnassigned}</strong> unassigned</span>
          </div>
        )}
      </div>

      <form className="card shadow-sm border-0 mb-4" onSubmit={applyQuery}>
        <div className="card-body">
          <div className="queue-control-grid">
            <div className="queue-search-control">
              <label className="form-label" htmlFor="queue-search">Search</label>
              <input
                id="queue-search"
                className="form-control"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={120}
                placeholder="Ticket, summary, requester"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="queue-status">Status</label>
              <select id="queue-status" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="queue-requested-priority">Requested Priority</label>
              <select id="queue-requested-priority" className="form-select" value={requestedPriority} onChange={(event) => setRequestedPriority(event.target.value as RequestedPriority | "")}>
                <option value="">All requested priorities</option>
                {(["LOW", "MEDIUM", "HIGH"] as const).map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="queue-it-priority">IT Priority</label>
              <select id="queue-it-priority" className="form-select" value={itPriority} onChange={(event) => setItPriority(event.target.value as RequestedPriority | "")}>
                <option value="">All IT priorities</option>
                {(["LOW", "MEDIUM", "HIGH"] as const).map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="queue-owner">Owner</label>
              <select id="queue-owner" className="form-select" value={ownerMode} onChange={(event) => {
                setOwnerMode(event.target.value as "" | "me" | "unassigned");
                if (event.target.value) setOwnerId("");
              }}>
                <option value="">All owners</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="queue-owner-id">Owner user ID</label>
              <input
                id="queue-owner-id"
                className="form-control"
                type="text"
                inputMode="numeric"
                value={ownerId}
                onChange={(event) => {
                  setOwnerId(event.target.value);
                  if (event.target.value) setOwnerMode("");
                }}
                placeholder="Eligible ID"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="queue-sort">Sort</label>
              <select id="queue-sort" className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as GetStaffQueueParams["sortBy"])}>
                <option value="updatedAt">Last updated</option>
                <option value="createdAt">Created</option>
                <option value="ticketNumber">Ticket number</option>
                <option value="status">Status</option>
                <option value="requestedPriority">Requested Priority</option>
                <option value="itPriority">IT Priority</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="queue-sort-order">Order</label>
              <select id="queue-sort-order" className="form-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="queue-page-size">Page size</label>
              <select id="queue-page-size" className="form-select" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as 10 | 20 | 50)}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn btn-success" type="submit" disabled={state === "loading"}>
              {state === "loading" ? "Loading Queue…" : "Apply"}
            </button>
            <button className="btn btn-outline-success" type="button" onClick={clearQuery} disabled={state === "loading"}>Clear</button>
          </div>
        </div>
      </form>

      {state === "loading" && (
        <div className="card border-0 shadow-sm" role="status" aria-live="polite">
          <div className="card-body py-5 text-center">Loading Ticket Queue…</div>
        </div>
      )}

      {state === "error" && (
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <div className="alert alert-danger" role="alert">
              {error?.status === 403
                ? "You do not have access to the Ticket Queue."
                : "Unable to load the Ticket Queue right now."}
            </div>
            <button className="btn btn-success" type="button" onClick={() => void loadQueue(1)}>Retry</button>
          </div>
        </div>
      )}

      {state === "success" && result && result.items.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <h2 className="h5">{result.pagination.totalItems > 0
              ? "No tickets on this page"
              : hasSearchOrFilters ? "No matching tickets" : "The Ticket Queue is empty"}</h2>
            <p className="text-muted mb-3">
              {result.pagination.totalItems > 0
                ? "Return to the first page to view matching Tickets."
                : hasSearchOrFilters
                ? "Try changing or clearing the current search and filters."
                : "There are no Tickets waiting in the shared queue."}
            </p>
            {result.pagination.totalItems > 0 ? (
              <button className="btn btn-outline-success" type="button" onClick={() => void loadQueue(1)}>Go to first page</button>
            ) : hasSearchOrFilters && <button className="btn btn-outline-success" type="button" onClick={clearQuery}>Clear filters</button>}
          </div>
        </div>
      )}

      {state === "success" && result && result.items.length > 0 && (
        <>
          <div className="card shadow-sm border-0 d-none d-lg-block">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 staff-queue-table">
                <thead>
                  <tr>
                    <th scope="col">Ticket Number / Updated</th>
                    <th scope="col">Summary / Requester</th>
                    <th scope="col">Status</th>
                    <th scope="col">Requested / IT Priority</th>
                    <th scope="col">Owner</th>
                    <th scope="col"><span className="visually-hidden">Open Ticket</span></th>
                  </tr>
                </thead>
                <tbody>{result.items.map((ticket) => <QueueRow key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} />)}</tbody>
              </table>
            </div>
          </div>
          <div className="d-lg-none queue-card-list">{result.items.map((ticket) => <QueueCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} />)}</div>
          <nav className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3" aria-label="Ticket Queue pages">
            <span className="text-muted small">Page {result.pagination.page} of {result.pagination.totalPages}</span>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-success" type="button" disabled={result.pagination.page <= 1} onClick={() => void loadQueue(result.pagination.page - 1)}>Previous</button>
              <button className="btn btn-outline-success" type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => void loadQueue(result.pagination.page + 1)}>Next</button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}

function QueueRow({ ticket, onOpenTicket }: { ticket: StaffQueueTicket; onOpenTicket: (ticket: StaffQueueTicket) => void }) {
  return <tr>
    <td><div className="fw-semibold text-nowrap">{ticket.ticketNumber}</div><small className="text-muted">{formatDate(ticket.updatedAt)}</small></td>
    <td><div className="fw-semibold text-break">{ticket.summary}</div><small className="text-muted text-break">{ticket.requester.name} · {ticket.requester.email}</small></td>
    <td><span className="badge text-bg-secondary">{formatLabel(ticket.status)}</span></td>
    <td><div><span className={`badge ${priorityClass(ticket.requestedPriority)}`}>Requested: {formatLabel(ticket.requestedPriority)}</span></div><div className="mt-1"><span className={`badge ${priorityClass(ticket.itPriority)}`}>IT: {formatLabel(ticket.itPriority)}</span></div></td>
    <td>{ticket.owner ? <><div className="fw-semibold text-break">{ticket.owner.name}</div><small className="text-muted">Assigned</small></> : <span className="badge text-bg-light border text-dark">Unassigned</span>}</td>
    <td><button type="button" className="btn btn-sm btn-success text-nowrap" onClick={() => onOpenTicket(ticket)}>Open Ticket</button></td>
  </tr>;
}

function QueueCard({ ticket, onOpenTicket }: { ticket: StaffQueueTicket; onOpenTicket: (ticket: StaffQueueTicket) => void }) {
  return <article className="card shadow-sm border-0">
    <div className="card-body">
      <div className="d-flex justify-content-between gap-2"><span className="fw-semibold">{ticket.ticketNumber}</span><span className="badge text-bg-secondary">{formatLabel(ticket.status)}</span></div>
      <h2 className="h6 mt-2 text-break">{ticket.summary}</h2>
      <dl className="queue-card-details mb-3"><div><dt>Requester</dt><dd>{ticket.requester.name}<br /><span className="text-break">{ticket.requester.email}</span></dd></div><div><dt>Priorities</dt><dd>Requested: {formatLabel(ticket.requestedPriority)}<br />IT: {formatLabel(ticket.itPriority)}</dd></div><div><dt>Owner</dt><dd>{ticket.owner?.name ?? "Unassigned"}</dd></div><div><dt>Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div></dl>
      <button type="button" className="btn btn-success w-100" onClick={() => onOpenTicket(ticket)}>Open Ticket</button>
    </div>
  </article>;
}
