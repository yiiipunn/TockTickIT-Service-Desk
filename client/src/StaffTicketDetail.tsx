import { useEffect, useState } from "react";
import {
  ApiError,
  AuthenticatedUser,
  EligibleOwner,
  RequestedPriority,
  StaffTicketDetail as TicketDetail,
  TicketStatus,
  assignStaffTicket,
  claimStaffTicket,
  getEligibleOwners,
  getStaffTicketDetail,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "./api";

type DetailState = "loading" | "success" | "error";
type Action = "claim" | "assignment" | "priority" | "status";

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function statusLabel(status: TicketStatus) {
  const labels: Record<TicketStatus, string> = {
    NEW: "New",
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    WAITING_FOR_REQUESTER: "Waiting for Requester",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

function safeError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error : new ApiError(fallback, "REQUEST_FAILED", 0);
}

export default function StaffTicketDetail({
  ticketId,
  currentUser,
  onBack,
}: {
  ticketId: number;
  currentUser: AuthenticatedUser;
  onBack: () => void;
}) {
  const [state, setState] = useState<DetailState>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [eligibleOwners, setEligibleOwners] = useState<EligibleOwner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<RequestedPriority>("MEDIUM");
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [error, setError] = useState<ApiError | null>(null);
  const [errorAction, setErrorAction] = useState<Action | null>(null);
  const [savingAction, setSavingAction] = useState<Action | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  function applyTicket(loadedTicket: TicketDetail) {
    setTicket(loadedTicket);
    setSelectedOwnerId(loadedTicket.owner ? String(loadedTicket.owner.id) : "");
    setSelectedPriority(loadedTicket.itPriority);
    setSelectedStatus("");
  }

  async function loadTicket() {
    setState("loading");
    setError(null);
    try {
      const [loadedTicket, loadedOwners] = await Promise.all([
        getStaffTicketDetail(ticketId),
        getEligibleOwners(),
      ]);
      applyTicket(loadedTicket);
      setEligibleOwners(loadedOwners);
      setState("success");
    } catch (loadError) {
      setError(safeError(loadError, "Unable to load the Ticket right now."));
      setState("error");
    }
  }

  async function claim() {
    if (savingAction || !ticket || ticket.owner !== null || !canOperate) return;
    setSavingAction("claim");
    setError(null);
    setSuccess("");
    try {
      applyTicket(await claimStaffTicket(ticket.id));
      setSuccess("Ticket claimed successfully.");
    } catch (claimError) {
      setErrorAction("claim");
      setError(safeError(claimError, "Unable to claim the Ticket right now."));
    } finally {
      setSavingAction(null);
    }
  }

  async function assign() {
    const ownerId = Number(selectedOwnerId);
    if (savingAction || !ticket || !canOperate || !Number.isInteger(ownerId) || ownerId <= 0) return;
    setSavingAction("assignment");
    setError(null);
    setSuccess("");
    try {
      const wasAssigned = ticket.owner !== null;
      applyTicket(await assignStaffTicket(ticket.id, ownerId));
      setSuccess(wasAssigned ? "Ticket reassigned successfully." : "Ticket assigned successfully.");
    } catch (assignmentError) {
      setErrorAction("assignment");
      setError(safeError(assignmentError, "Unable to update the Ticket assignment right now."));
    } finally {
      setSavingAction(null);
    }
  }

  async function savePriority() {
    if (savingAction || !ticket || !canOperate || selectedPriority === ticket.itPriority) return;
    setSavingAction("priority");
    setError(null);
    setSuccess("");
    try {
      applyTicket(await updateStaffTicketPriority(ticket.id, selectedPriority));
      setSuccess("IT Priority updated successfully.");
    } catch (priorityError) {
      setErrorAction("priority");
      setError(safeError(priorityError, "Unable to update IT Priority right now."));
    } finally {
      setSavingAction(null);
    }
  }

  async function saveStatus() {
    if (savingAction || !ticket || !canOperate || !selectedStatus ||
        !ticket.allowedTransitions.includes(selectedStatus)) return;
    const confirmed = selectedStatus === "CLOSED" || selectedStatus === "CANCELLED";
    if (confirmed && !window.confirm(`Change this Ticket to ${statusLabel(selectedStatus)}?`)) return;
    setSavingAction("status");
    setError(null);
    setSuccess("");
    try {
      applyTicket(await updateStaffTicketStatus(ticket.id, ticket.status, selectedStatus, confirmed));
      setSuccess("Ticket status updated successfully.");
    } catch (statusError) {
      setErrorAction("status");
      const result = safeError(statusError, "Unable to update the Ticket status right now.");
      setError(result);
      if (result.code === "STATUS_CONFLICT") {
        try {
          applyTicket(await getStaffTicketDetail(ticket.id));
        } catch {
          // Keep the last confirmed Ticket and show the conflict.
        }
      }
    } finally {
      setSavingAction(null);
    }
  }

  if (state === "loading") {
    return <div className="card border-0 shadow-sm"><div className="card-body py-5 text-center" role="status">Loading Ticket Detail…</div></div>;
  }
  if (state === "error" || !ticket) {
    return <div className="card border-0 shadow-sm"><div className="card-body py-5 text-center">
      <div className="alert alert-danger" role="alert">{error?.status === 403 ? "You do not have access to this Ticket." : "Unable to load the Ticket right now."}</div>
      <button className="btn btn-success me-2" type="button" onClick={() => void loadTicket()}>Retry</button>
      <button className="btn btn-outline-success" type="button" onClick={onBack}>Back to Ticket Queue</button>
    </div></div>;
  }

  const canOperate = currentUser.role === "IT_STAFF" || currentUser.role === "ADMINISTRATOR";
  const unassigned = ticket.owner === null;
  const selectedOwnerMatchesCurrent = selectedOwnerId === String(ticket.owner?.id ?? "");
  const errorMessage = errorAction === "claim" && error?.code === "OWNER_CONFLICT"
    ? "This Ticket was assigned before your claim could complete."
    : errorAction === "assignment" && (error?.code === "VALIDATION_ERROR" || error?.code === "USER_NOT_FOUND")
      ? "The selected assignee is no longer available."
      : errorAction === "priority" && error?.code === "VALIDATION_ERROR"
        ? "Select a valid IT Priority."
        : errorAction === "status" && error?.code === "STATUS_CONFLICT"
          ? "The Ticket status changed or this transition is no longer available. Review the current status and try again."
          : errorAction === "status" && error?.code === "VALIDATION_ERROR"
            ? "The selected status change is invalid. Review the current status and try again."
          : errorAction === "priority"
            ? "Unable to update IT Priority right now."
            : errorAction === "status"
              ? "Unable to update the Ticket status right now."
              : "Unable to update the Ticket right now.";

  return <section aria-labelledby="staff-ticket-detail-heading">
    <button className="btn btn-outline-success mb-4" type="button" onClick={onBack}>Back to Ticket Queue</button>
    {success && <div className="alert alert-success" role="status">{success}</div>}
    {error && <div className="alert alert-danger" role="alert">{errorMessage}</div>}
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4 p-md-5">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
          <div>
            <p className="text-success fw-semibold mb-1">{ticket.ticketNumber}</p>
            <h1 id="staff-ticket-detail-heading" className="h2 mb-1">{ticket.summary}</h1>
            <span className="badge text-bg-secondary">Status: {statusLabel(ticket.status)}</span>
          </div>
          <div className="staff-owner-card">
            <span className="small text-muted d-block">Assigned To</span>
            {unassigned ? <strong>Unassigned</strong> : <><strong>{ticket.owner?.name}</strong><span className="small text-muted d-block">Assigned {date(ticket.ownerAssignedAt)}</span></>}
          </div>
        </div>
        <div className="row g-4">
          <div className="col-lg-8">
            <h2 className="h5">Requester request</h2>
            <p className="text-break mb-4">{ticket.description}</p>
            <dl className="row mb-0">
              <dt className="col-sm-4">Requester</dt><dd className="col-sm-8 text-break">{ticket.requester.name} · {ticket.requester.email}</dd>
              <dt className="col-sm-4">Category</dt><dd className="col-sm-8">{ticket.category.name}</dd>
              <dt className="col-sm-4">Related System</dt><dd className="col-sm-8">{ticket.relatedSystem.name}</dd>
              <dt className="col-sm-4">Requester indication</dt><dd className="col-sm-8">{ticket.requesterResolutionIndicatedAt ? `Problem appears resolved — ${date(ticket.requesterResolutionIndicatedAt)}` : "No resolution indication"}</dd>
            </dl>
          </div>
          <aside className="col-lg-4">
            <div className="staff-operation-panel">
              <h2 className="h5">Staff operations</h2>
              <p><strong>Requested Priority:</strong> {ticket.requestedPriority}</p>
              {unassigned && canOperate && <>
                <p className="text-muted">This Ticket is unassigned.</p>
                <button className="btn btn-success w-100 mb-3" type="button" onClick={() => void claim()} disabled={savingAction !== null}>{savingAction === "claim" ? "Claiming Ticket…" : "Claim Ticket"}</button>
              </>}
              {canOperate ? <>
                <div className="border-top pt-3">
                  <label className="form-label fw-semibold" htmlFor="staff-ticket-owner">{unassigned ? "Assign Ticket" : "Reassign Ticket"}</label>
                  <select id="staff-ticket-owner" className="form-select mb-2" value={selectedOwnerId} onChange={(event) => setSelectedOwnerId(event.target.value)} disabled={savingAction !== null}>
                    <option value="">Select an eligible assignee</option>
                    {eligibleOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>)}
                  </select>
                  <button className="btn btn-outline-success w-100" type="button" onClick={() => void assign()} disabled={savingAction !== null || !selectedOwnerId || selectedOwnerMatchesCurrent}>{savingAction === "assignment" ? "Saving Assignment…" : unassigned ? "Assign Ticket" : "Reassign Ticket"}</button>
                </div>
                <div className="border-top mt-3 pt-3">
                  <p className="mb-2"><strong>Current IT Priority:</strong> {ticket.itPriority}</p>
                  <label className="form-label fw-semibold" htmlFor="staff-ticket-it-priority">IT Priority</label>
                  <select id="staff-ticket-it-priority" className="form-select mb-2" value={selectedPriority} onChange={(event) => setSelectedPriority(event.target.value as RequestedPriority)} disabled={savingAction !== null}>
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                  </select>
                  <button className="btn btn-outline-success w-100" type="button" onClick={() => void savePriority()} disabled={savingAction !== null || selectedPriority === ticket.itPriority}>{savingAction === "priority" ? "Saving IT Priority…" : "Save IT Priority"}</button>
                </div>
                <div className="border-top mt-3 pt-3">
                  <p className="mb-2"><strong>Current Status:</strong> {statusLabel(ticket.status)}</p>
                  {ticket.allowedTransitions.length > 0 ? <>
                    <label className="form-label fw-semibold" htmlFor="staff-ticket-next-status">Next Status</label>
                    <select id="staff-ticket-next-status" className="form-select mb-2" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as TicketStatus | "")} disabled={savingAction !== null}>
                      <option value="">Select next status</option>
                      {ticket.allowedTransitions.map((next) => <option key={next} value={next}>{statusLabel(next)}</option>)}
                    </select>
                    <button className="btn btn-outline-success w-100" type="button" onClick={() => void saveStatus()} disabled={savingAction !== null || !selectedStatus}>{savingAction === "status" ? "Saving Status…" : "Update Status"}</button>
                  </> : <p className="text-muted mb-0">No further status changes are available.</p>}
                </div>
              </> : <p className="mb-0 text-muted">{unassigned ? "This Ticket is unassigned." : "This Ticket is assigned."}</p>}
            </div>
          </aside>
        </div>
        <section className="mt-4" aria-labelledby="staff-attachments-heading">
          <h2 id="staff-attachments-heading" className="h5">Attachments</h2>
          {ticket.attachments.length === 0 ? <p className="text-muted mb-0">No attachments were added to this Ticket.</p> : <ul className="list-group">{ticket.attachments.map((attachment) => <li className="list-group-item text-break" key={attachment.id}>{attachment.originalFilename} {attachment.isRemoved && <span className="badge text-bg-secondary">Removed</span>}</li>)}</ul>}
        </section>
      </div>
    </div>
  </section>;
}
