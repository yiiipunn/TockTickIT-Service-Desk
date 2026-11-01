import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import {
  ApiError,
  AuthenticatedUser,
  EligibleOwner,
  RequestedPriority,
  StaffTicketDetail as TicketDetail,
  TicketStatus,
  TicketWorkflowEvent,
  assignStaffTicket,
  claimStaffTicket,
  getEligibleOwners,
  getStaffTicketDetail,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "./api";
import TicketCommunication from "./TicketCommunication";
import ActionsTaken from "./ActionsTaken";

type DetailState = "loading" | "success" | "error";
type Action = "claim" | "assignment" | "priority" | "status";

function TicketWorkflowDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    )?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    ) ?? []);
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="ticket-workflow-dialog-backdrop" role="presentation">
    <div ref={dialogRef} className="ticket-workflow-dialog card shadow-lg" role="dialog" aria-modal="true" aria-labelledby="ticket-workflow-dialog-title" onKeyDown={handleKeyDown}>
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <h3 id="ticket-workflow-dialog-title" className="h5 mb-0">{title}</h3>
          <button type="button" className="btn-close" aria-label="Close dialog" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  </div>;
}

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

function transitionLabel(status: TicketStatus | "") {
  if (status === "RESOLVED") return "Resolve ticket";
  if (status === "CLOSED") return "Close ticket";
  if (status === "CANCELLED") return "Cancel ticket";
  if (status === "REOPENED") return "Reopen ticket";
  return "Update Status";
}

function workflowEventText(event: TicketWorkflowEvent) {
  if (event.eventType === "OWNER_CHANGED") {
    return `Owner changed from ${event.fromOwner?.name ?? "Unassigned"} to ${event.toOwner?.name ?? "Unassigned"}.`;
  }
  if (event.eventType === "STATUS_CHANGED") {
    return `Status changed from ${event.fromStatus ? statusLabel(event.fromStatus) : "Unknown"} to ${event.toStatus ? statusLabel(event.toStatus) : "Unknown"}.`;
  }
  return "IT Priority changed.";
}

function safeError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error : new ApiError(fallback, "REQUEST_FAILED", 0);
}

export default function StaffTicketDetail({
  ticketId,
  currentUser,
  onBack,
  showActions = false,
  focusActionId,
}: {
  ticketId: number;
  currentUser: AuthenticatedUser;
  onBack: () => void;
  showActions?: boolean;
  focusActionId?: number;
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
  const [confirmationStatus, setConfirmationStatus] = useState<TicketStatus | null>(null);
  const [conflictChoice, setConflictChoice] = useState("");
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0);
  const confirmationInvoker = useRef<HTMLButtonElement | null>(null);

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

  async function refreshTicketAfterAction() {
    applyTicket(await getStaffTicketDetail(ticketId));
  }

  async function claim() {
    if (savingAction || !ticket || ticket.owner !== null || !canOperate) return;
    setSavingAction("claim");
    setError(null);
    setErrorAction(null);
    setSuccess("");
    try {
      applyTicket(await claimStaffTicket(ticket.id, ticket.version));
      setSuccess("Ticket claimed successfully.");
    } catch (claimError) {
      setErrorAction("claim");
      const result = safeError(claimError, "Unable to claim the Ticket right now.");
      setError(result);
      if (["TICKET_VERSION_CONFLICT", "OWNER_CONFLICT"].includes(result.code)) {
        await refreshConflict("Claim Ticket");
      }
    } finally {
      setSavingAction(null);
    }
  }

  async function assign() {
    const ownerId = Number(selectedOwnerId);
    if (savingAction || !ticket || !canOperate || !Number.isInteger(ownerId) || ownerId <= 0) return;
    setSavingAction("assignment");
    setError(null);
    setErrorAction(null);
    setSuccess("");
    try {
      const wasAssigned = ticket.owner !== null;
      applyTicket(await assignStaffTicket(ticket.id, ticket.version, ownerId));
      setSuccess(wasAssigned ? "Ticket reassigned successfully." : "Ticket assigned successfully.");
    } catch (assignmentError) {
      setErrorAction("assignment");
      const result = safeError(assignmentError, "Unable to update the Ticket assignment right now.");
      setError(result);
      if (["TICKET_VERSION_CONFLICT", "OWNER_CONFLICT"].includes(result.code)) {
        await refreshConflict("Change Ticket owner");
      }
    } finally {
      setSavingAction(null);
    }
  }

  async function savePriority() {
    if (savingAction || !ticket || !canOperate || selectedPriority === ticket.itPriority) return;
    setSavingAction("priority");
    setError(null);
    setErrorAction(null);
    setSuccess("");
    try {
      applyTicket(await updateStaffTicketPriority(ticket.id, ticket.version, selectedPriority));
      setSuccess("IT Priority updated successfully.");
    } catch (priorityError) {
      setErrorAction("priority");
      const result = safeError(priorityError, "Unable to update IT Priority right now.");
      setError(result);
      if (result.code === "TICKET_VERSION_CONFLICT") {
        await refreshConflict(`Set IT Priority to ${selectedPriority}`);
      }
    } finally {
      setSavingAction(null);
    }
  }

  function requestStatusChange(button: HTMLButtonElement) {
    if (savingAction || !ticket || !canOperate || !selectedStatus ||
        !ticket.allowedTransitions.includes(selectedStatus)) return;
    if (selectedStatus === "CLOSED" || selectedStatus === "CANCELLED") {
      confirmationInvoker.current = button;
      setConfirmationStatus(selectedStatus);
      return;
    }
    void saveStatus(false);
  }

  function closeConfirmation() {
    if (savingAction) return;
    setConfirmationStatus(null);
    requestAnimationFrame(() => confirmationInvoker.current?.focus());
  }

  async function refreshConflict(choice: string) {
    if (!ticket) return;
    setConflictChoice(choice);
    try {
      applyTicket(await getStaffTicketDetail(ticket.id));
    } catch {
      // Keep the last confirmed Ticket when the current state cannot be refreshed.
    }
  }

  async function saveStatus(confirmed: boolean) {
    if (savingAction || !ticket || !canOperate || !selectedStatus) return;
    const requestedStatus = selectedStatus;
    setSavingAction("status");
    setError(null);
    setErrorAction(null);
    setSuccess("");
    try {
      applyTicket(await updateStaffTicketStatus(
        ticket.id,
        ticket.version,
        ticket.status,
        requestedStatus,
        confirmed,
      ));
      setConfirmationStatus(null);
      setConflictChoice("");
      setActionsRefreshKey((current) => current + 1);
      setSuccess("Ticket status updated successfully.");
    } catch (statusError) {
      setErrorAction("status");
      const result = safeError(statusError, "Unable to update the Ticket status right now.");
      setError(result);
      setConfirmationStatus(null);
      requestAnimationFrame(() => confirmationInvoker.current?.focus());
      if (["TICKET_VERSION_CONFLICT", "STATUS_CONFLICT", "TICKET_STATE_CONFLICT"].includes(result.code)) {
        await refreshConflict(statusLabel(requestedStatus));
      }
      if (result.code === "RESOLUTION_GATE_FAILED") {
        setConflictChoice(statusLabel(requestedStatus));
        requestAnimationFrame(() => document.getElementById("actions-taken-heading")?.focus());
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
  const errorMessage = error?.code === "TICKET_VERSION_CONFLICT"
    ? `This Ticket changed after you opened it. The latest Ticket is shown. Review it before retrying${conflictChoice ? ` “${conflictChoice}”` : ""}.`
    : errorAction === "claim" && error?.code === "OWNER_CONFLICT"
      ? "This Ticket was assigned before your claim could complete. The latest owner is shown."
      : errorAction === "assignment" && ["VALIDATION_ERROR", "USER_NOT_FOUND", "INELIGIBLE_OWNER"].includes(error?.code ?? "")
        ? "The selected owner is inactive or no longer eligible."
        : errorAction === "priority" && error?.code === "VALIDATION_ERROR"
          ? "Select a valid IT Priority."
          : errorAction === "status" && ["STATUS_CONFLICT", "TICKET_STATE_CONFLICT"].includes(error?.code ?? "")
            ? "The Ticket changed or this transition is no longer available. Review the current status and choose again."
            : errorAction === "status" && error?.code === "RESOLUTION_GATE_FAILED"
              ? "This Ticket cannot be resolved yet. Complete the missing requirements listed below."
              : errorAction === "status" && ["VALIDATION_ERROR", "CONFIRMATION_REQUIRED"].includes(error?.code ?? "")
                ? "The selected status change is invalid. Review the current status and try again."
                : errorAction === "priority"
                  ? "Unable to update IT Priority right now."
                  : errorAction === "status"
                    ? "Unable to update the Ticket status right now."
                    : "Unable to update the Ticket right now.";

  return <section aria-labelledby="staff-ticket-detail-heading">
    <button className="btn btn-outline-success mb-4" type="button" onClick={onBack}>Back to Ticket Queue</button>
    {success && <div className="alert alert-success" role="status">{success}</div>}
    {error && <div className="alert alert-danger" role="alert">
      <p className="mb-1">{errorMessage}</p>
      {error.fields && Object.values(error.fields).length > 0 && <ul className="mb-0">
        {Object.values(error.fields).map((message) => <li key={message}>{message}</li>)}
      </ul>}
    </div>}
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
            {unassigned ? <strong>Unassigned</strong> : <><strong>{ticket.owner?.name}</strong>{ticket.owner && !ticket.owner.isActive && <span className="badge text-bg-secondary ms-2">Inactive</span>}<span className="small text-muted d-block">Assigned {date(ticket.ownerAssignedAt)}</span></>}
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
                    {ticket.owner && !ticket.owner.isActive && <option value={ticket.owner.id} disabled>{ticket.owner.name} (Inactive current owner)</option>}
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
                  <div className="ticket-resolution-gate rounded-3 p-3 mb-3" aria-labelledby="ticket-resolution-gate-heading">
                    <h3 id="ticket-resolution-gate-heading" className="h6">Resolution requirements</h3>
                    <ul className="small mb-2">
                      <li>Active Ticket owner: {ticket.owner?.isActive ? "Met" : "Missing"}</li>
                      <li>At least one completed Action: {ticket.resolutionGate.completedActions > 0 ? "Met" : "Missing"}</li>
                      <li>No planned or in-progress Actions: {ticket.resolutionGate.activeActions === 0 ? "Met" : `${ticket.resolutionGate.activeActions} remaining`}</li>
                    </ul>
                    <p className="small mb-0">{ticket.resolutionGate.canResolve ? "This Ticket is ready for formal resolution." : "Resolve ticket becomes available after every requirement is met."}</p>
                  </div>
                  {ticket.allowedTransitions.length > 0 ? <>
                    <label className="form-label fw-semibold" htmlFor="staff-ticket-next-status">Next Status</label>
                    <select id="staff-ticket-next-status" className="form-select mb-2" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as TicketStatus | "")} disabled={savingAction !== null}>
                      <option value="">Select next status</option>
                      {ticket.allowedTransitions.map((next) => <option key={next} value={next}>{statusLabel(next)}</option>)}
                    </select>
                    <button className="btn btn-outline-success w-100" type="button" onClick={(event) => requestStatusChange(event.currentTarget)} disabled={savingAction !== null || !selectedStatus}>{savingAction === "status" ? (selectedStatus === "RESOLVED" ? "Resolving…" : "Saving Status…") : transitionLabel(selectedStatus)}</button>
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
        {showActions && <ActionsTaken
          ticketId={ticket.id}
          ticketNumber={ticket.ticketNumber}
          ticketStatus={ticket.status}
          ticketOwnerName={ticket.owner?.name ?? null}
          currentUser={currentUser}
          refreshKey={actionsRefreshKey}
          focusActionId={focusActionId}
          onChanged={refreshTicketAfterAction}
        />}
        {canOperate && <section className="border rounded-3 p-3 p-md-4 mt-4" aria-labelledby="ticket-workflow-history-heading">
          <h2 id="ticket-workflow-history-heading" className="h5">Ticket workflow history</h2>
          {ticket.workflowEvents.length === 0 ? <p className="text-muted mb-0">No Ticket workflow changes have been recorded yet.</p> : <ol className="list-group list-group-numbered">
            {ticket.workflowEvents.map((event) => <li className="list-group-item" key={event.id}>
              <span className="fw-semibold">{event.actor.name}</span> — {workflowEventText(event)} <span className="small text-muted">{date(event.createdAt)}</span>
            </li>)}
          </ol>}
        </section>}
        {canOperate && <>
          <TicketCommunication ticketId={ticket.id} kind="public" initialEntries={ticket.publicComments} />
          <TicketCommunication ticketId={ticket.id} kind="internal" initialEntries={ticket.internalNotes} />
        </>}
      </div>
    </div>
    {confirmationStatus && <TicketWorkflowDialog title={`${transitionLabel(confirmationStatus)} confirmation`} onClose={closeConfirmation}>
      <p>Change Ticket <strong>{ticket.ticketNumber}</strong> from <strong>{statusLabel(ticket.status)}</strong> to <strong>{statusLabel(confirmationStatus)}</strong>?</p>
      <p className="text-muted small">This is a formal Ticket status change. {confirmationStatus === "CANCELLED" ? "Cancellation is terminal." : "Closing preserves the recorded resolution time."}</p>
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className={confirmationStatus === "CANCELLED" ? "btn btn-danger" : "btn btn-success"} onClick={() => void saveStatus(true)} disabled={savingAction !== null}>
          {savingAction === "status" ? "Saving Status…" : `Confirm ${statusLabel(confirmationStatus)}`}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={closeConfirmation} disabled={savingAction !== null}>Keep current status</button>
      </div>
    </TicketWorkflowDialog>}
  </section>;
}
