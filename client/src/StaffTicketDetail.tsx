import { useEffect, useState } from "react";
import {
  ApiError,
  AuthenticatedUser,
  EligibleOwner,
  StaffTicketDetail as TicketDetail,
  assignStaffTicket,
  claimStaffTicket,
  getEligibleOwners,
  getStaffTicketDetail,
} from "./api";

type DetailState = "loading" | "success" | "error";

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
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
  const [error, setError] = useState<ApiError | null>(null);
  const [savingAction, setSavingAction] = useState<"claim" | "assignment" | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    setState("loading");
    setError(null);
    try {
      const [loadedTicket, loadedOwners] = await Promise.all([
        getStaffTicketDetail(ticketId),
        getEligibleOwners(),
      ]);
      setTicket(loadedTicket);
      setEligibleOwners(loadedOwners);
      setSelectedOwnerId(loadedTicket.owner ? String(loadedTicket.owner.id) : "");
      setState("success");
    } catch (loadError) {
      setError(loadError instanceof ApiError
        ? loadError
        : new ApiError("Unable to load the Ticket right now.", "REQUEST_FAILED", 0));
      setState("error");
    }
  }

  async function claim() {
    if (savingAction || !ticket || ticket.owner !== null || !["IT_STAFF", "ADMINISTRATOR"].includes(currentUser.role)) return;
    setSavingAction("claim");
    setError(null);
    setSuccess("");
    try {
      const claimedTicket = await claimStaffTicket(ticket.id);
      setTicket(claimedTicket);
      setSelectedOwnerId(String(claimedTicket.owner!.id));
      setSuccess("Ticket claimed successfully.");
    } catch (claimError) {
      setError(claimError instanceof ApiError
        ? claimError
        : new ApiError("Unable to claim the Ticket right now.", "REQUEST_FAILED", 0));
    } finally {
      setSavingAction(null);
    }
  }

  async function assign() {
    const ownerId = Number(selectedOwnerId);
    if (savingAction || !ticket || !["IT_STAFF", "ADMINISTRATOR"].includes(currentUser.role) || !Number.isInteger(ownerId) || ownerId <= 0) return;
    setSavingAction("assignment");
    setError(null);
    setSuccess("");
    try {
      const updatedTicket = await assignStaffTicket(ticket.id, ownerId);
      setTicket(updatedTicket);
      setSelectedOwnerId(String(updatedTicket.owner!.id));
      setSuccess(ticket.owner ? "Ticket reassigned successfully." : "Ticket assigned successfully.");
    } catch (assignmentError) {
      setError(assignmentError instanceof ApiError
        ? assignmentError
        : new ApiError("Unable to update the Ticket assignment right now.", "REQUEST_FAILED", 0));
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

  const unassigned = ticket.owner === null;
  const canOperate = ["IT_STAFF", "ADMINISTRATOR"].includes(currentUser.role);
  const canClaim = unassigned && canOperate;
  const selectedOwnerMatchesCurrent = selectedOwnerId === String(ticket.owner?.id ?? "");
  return <section aria-labelledby="staff-ticket-detail-heading">
    <button className="btn btn-outline-success mb-4" type="button" onClick={onBack}>Back to Ticket Queue</button>
    {success && <div className="alert alert-success" role="status">{success}</div>}
    {error && <div className="alert alert-danger" role="alert">{error.code === "OWNER_CONFLICT" ? "This Ticket was assigned before your claim could complete." : error.code === "VALIDATION_ERROR" || error.code === "USER_NOT_FOUND" ? "The selected assignee is no longer available." : "Unable to update the Ticket right now."}</div>}
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4 p-md-5">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
          <div><p className="text-success fw-semibold mb-1">{ticket.ticketNumber}</p><h1 id="staff-ticket-detail-heading" className="h2 mb-1">{ticket.summary}</h1><span className="badge text-bg-secondary">Status: {ticket.status.replaceAll("_", " ")}</span></div>
          <div className="staff-owner-card"><span className="small text-muted d-block">Assigned To</span>{unassigned ? <strong>Unassigned</strong> : <><strong>{ticket.owner?.name}</strong><span className="small text-muted d-block">Assigned {date(ticket.ownerAssignedAt)}</span></>}</div>
        </div>
        <div className="row g-4">
          <div className="col-lg-8"><h2 className="h5">Requester request</h2><p className="text-break mb-4">{ticket.description}</p><dl className="row mb-0"><dt className="col-sm-4">Requester</dt><dd className="col-sm-8">{ticket.requester.name} · {ticket.requester.email}</dd><dt className="col-sm-4">Category</dt><dd className="col-sm-8">{ticket.category.name}</dd><dt className="col-sm-4">Related System</dt><dd className="col-sm-8">{ticket.relatedSystem.name}</dd><dt className="col-sm-4">Requester indication</dt><dd className="col-sm-8">{ticket.requesterResolutionIndicatedAt ? `Problem appears resolved — ${date(ticket.requesterResolutionIndicatedAt)}` : "No resolution indication"}</dd></dl></div>
          <aside className="col-lg-4"><div className="staff-operation-panel"><h2 className="h5">Staff operations</h2><p><strong>Requested Priority:</strong> {ticket.requestedPriority}</p><p><strong>IT Priority:</strong> {ticket.itPriority}</p>{canClaim && <><p className="text-muted">This Ticket is unassigned.</p><button className="btn btn-success w-100 mb-3" type="button" onClick={() => void claim()} disabled={savingAction !== null}>{savingAction === "claim" ? "Claiming Ticket…" : "Claim Ticket"}</button></>}{canOperate ? <div className="border-top pt-3"><label className="form-label fw-semibold" htmlFor="staff-ticket-owner">{unassigned ? "Assign Ticket" : "Reassign Ticket"}</label><select id="staff-ticket-owner" className="form-select mb-2" value={selectedOwnerId} onChange={(event) => setSelectedOwnerId(event.target.value)} disabled={savingAction !== null}><option value="">Select an eligible assignee</option>{eligibleOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>)}</select><button className="btn btn-outline-success w-100" type="button" onClick={() => void assign()} disabled={savingAction !== null || !selectedOwnerId || selectedOwnerMatchesCurrent}>{savingAction === "assignment" ? "Saving Assignment…" : unassigned ? "Assign Ticket" : "Reassign Ticket"}</button></div> : <p className="mb-0 text-muted">{unassigned ? "This Ticket is unassigned." : "This Ticket is assigned."}</p>}</div></aside>
        </div>
        <section className="mt-4" aria-labelledby="staff-attachments-heading"><h2 id="staff-attachments-heading" className="h5">Attachments</h2>{ticket.attachments.length === 0 ? <p className="text-muted mb-0">No attachments were added to this Ticket.</p> : <ul className="list-group">{ticket.attachments.map((attachment) => <li className="list-group-item" key={attachment.id}>{attachment.originalFilename} {attachment.isRemoved && <span className="badge text-bg-secondary">Removed</span>}</li>)}</ul>}</section>
      </div>
    </div>
  </section>;
}
