import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActionEditableInput,
  ActionEvent,
  ActionStatus,
  ActionTaken,
  ApiError,
  AuthenticatedUser,
  EligibleOwner,
  TicketStatus,
  createAction,
  getAction,
  getActionEvents,
  getActions,
  getEligibleOwners,
  reassignAction,
  transitionAction,
  updateAction,
} from "./api";

type LoadState = "loading" | "success" | "error";
type EditorMode = "create" | "edit" | null;
type MutationName = "create" | "edit" | "assign" | "start" | "complete" | "cancel";
type DialogState =
  | { type: "assign"; action: ActionTaken }
  | { type: "complete"; action: ActionTaken }
  | { type: "cancel"; action: ActionTaken }
  | null;

interface ActionFormState {
  actionAt: string;
  description: string;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

const ACTIVE_TICKET_STATUSES = new Set<TicketStatus>([
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
]);

function safeError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error : new ApiError(fallback, "NETWORK_ERROR", 0);
}

function localInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function statusLabel(status: ActionStatus) {
  return {
    PLANNED: "Planned",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  }[status];
}

function statusClass(status: ActionStatus) {
  if (status === "COMPLETED") return "text-bg-success";
  if (status === "IN_PROGRESS") return "text-bg-primary";
  if (status === "CANCELLED") return "text-bg-secondary";
  return "text-bg-warning";
}

function emptyForm(currentUser: AuthenticatedUser): ActionFormState {
  return {
    actionAt: localInputValue(new Date()),
    description: "",
    result: "",
    assigneeId: String(currentUser.id),
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

function actionForm(action: ActionTaken): ActionFormState {
  return {
    actionAt: localInputValue(action.actionAt),
    description: action.description,
    result: action.result ?? "",
    assigneeId: String(action.assignee.id),
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? "",
    attachmentNotes: action.attachmentNotes ?? "",
  };
}

function eventText(event: ActionEvent) {
  if (event.type === "CREATED") return `Created and assigned to ${event.toAssignee?.name ?? "Staff"}.`;
  if (event.type === "UPDATED") return "Editable details updated.";
  if (event.type === "ASSIGNEE_CHANGED") {
    return `Reassigned from ${event.fromAssignee?.name ?? "Unknown"} to ${event.toAssignee?.name ?? "Unknown"}.`;
  }
  return `Status changed from ${event.fromStatus ? statusLabel(event.fromStatus) : "Unknown"} to ${event.toStatus ? statusLabel(event.toStatus) : "Unknown"}.`;
}

function ActionDialog({
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
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    );
    focusable?.focus();
  }, []);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    ) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="action-dialog-backdrop" role="presentation">
    <div
      ref={dialogRef}
      className="action-dialog card shadow-lg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-dialog-title"
      onKeyDown={trapFocus}
    >
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <h3 id="action-dialog-title" className="h5 mb-0">{title}</h3>
          <button type="button" className="btn-close" aria-label="Close dialog" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  </div>;
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  return message ? <div id={id} className="invalid-feedback d-block">{message}</div> : null;
}

export default function ActionsTaken({
  ticketId,
  ticketNumber,
  ticketStatus,
  ticketOwnerName,
  currentUser,
  refreshKey = 0,
}: {
  ticketId: number;
  ticketNumber: string;
  ticketStatus: TicketStatus | string;
  ticketOwnerName?: string | null;
  currentUser: AuthenticatedUser;
  refreshKey?: number;
}) {
  const canManage = currentUser.role === "IT_STAFF" || currentUser.role === "ADMINISTRATOR";
  const canCreate = canManage && ACTIVE_TICKET_STATUSES.has(ticketStatus as TicketStatus);
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<ActionTaken[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [selected, setSelected] = useState<ActionTaken | null>(null);
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [form, setForm] = useState<ActionFormState>(() => emptyForm(currentUser));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [mutation, setMutation] = useState<MutationName | null>(null);
  const [feedback, setFeedback] = useState("");
  const [mutationError, setMutationError] = useState<ApiError | null>(null);
  const [conflict, setConflict] = useState<ActionTaken | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingAssigneeId, setPendingAssigneeId] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const invokingButton = useRef<HTMLButtonElement | null>(null);

  const selectedIndex = useMemo(
    () => selected ? items.findIndex((item) => item.id === selected.id) : -1,
    [items, selected],
  );

  useEffect(() => {
    setPage(1);
    setSelected(null);
    setEditorMode(null);
  }, [ticketId]);

  useEffect(() => {
    void loadActions();
  }, [ticketId, page, pageSize, refreshKey]);

  useEffect(() => {
    if (!canManage) return;
    getEligibleOwners().then(setOwners).catch((error) => {
      setMutationError(safeError(error, "Unable to load eligible assignees right now."));
    });
  }, [canManage, ticketId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function loadActions() {
    setState("loading");
    setLoadError(null);
    try {
      const result = await getActions(ticketId, page, pageSize);
      if (!Array.isArray(result.items) || !result.pagination || typeof result.pagination.totalItems !== "number") {
        throw new ApiError("Unable to load Actions Taken right now.", "INVALID_RESPONSE", 0);
      }
      setItems(result.items);
      setPagination(result.pagination);
      setState("success");
    } catch (error) {
      setItems([]);
      setLoadError(safeError(error, "Unable to load Actions Taken right now."));
      setState("error");
    }
  }

  function updateForm<K extends keyof ActionFormState>(field: K, value: ActionFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setDirty(true);
  }

  function closeEditor() {
    if (dirty && !window.confirm("Discard your unsaved Action changes?")) return;
    setEditorMode(null);
    setDirty(false);
    setFieldErrors({});
    setConflict(null);
  }

  function openCreate() {
    if (dirty && !window.confirm("Discard your unsaved Action changes?")) return;
    setSelected(null);
    setForm(emptyForm(currentUser));
    setEditorMode("create");
    setDirty(false);
    setFieldErrors({});
    setMutationError(null);
    setFeedback("");
  }

  function openEdit(action: ActionTaken) {
    setSelected(action);
    setForm(actionForm(action));
    setEditorMode("edit");
    setDirty(false);
    setFieldErrors({});
    setConflict(null);
    setMutationError(null);
  }

  function validateForm(requireAssignee: boolean, completing = false) {
    const errors: Record<string, string> = {};
    const timestamp = Date.parse(form.actionAt);
    if (!form.actionAt || !Number.isFinite(timestamp)) errors.actionAt = "Enter the planned action date and time.";
    if (completing && Number.isFinite(timestamp) && timestamp > Date.now()) {
      errors.actionAt = "Action date and time cannot be in the future when completing.";
    }
    const descriptionLength = form.description.trim().length;
    if (!completing && (descriptionLength < 1 || descriptionLength > 2000)) {
      errors.description = "Enter 1 to 2000 characters.";
    }
    if (form.result.trim().length > 2000) errors.result = "Enter no more than 2000 characters.";
    if (completing && form.result.trim().length < 1) errors.result = "Enter a Result before completing this Action.";
    if (form.followUpRequired && (form.followUpNote.trim().length < 1 || form.followUpNote.trim().length > 1000)) {
      errors.followUpNote = "Enter 1 to 1000 characters when follow-up is required.";
    }
    if (form.attachmentNotes.trim().length > 1000) errors.attachmentNotes = "Enter no more than 1000 characters.";
    if (requireAssignee && (!Number.isInteger(Number(form.assigneeId)) || Number(form.assigneeId) <= 0)) {
      errors.assigneeId = "Choose an active IT Staff member or Administrator.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".action-editor [aria-invalid='true']")?.focus());
      return false;
    }
    return true;
  }

  function editableInput(): ActionEditableInput {
    return {
      actionAt: new Date(form.actionAt).toISOString(),
      description: form.description.trim(),
      result: form.result.trim() || null,
      followUpRequired: form.followUpRequired,
      followUpNote: form.followUpRequired ? form.followUpNote.trim() : null,
      attachmentNotes: form.attachmentNotes.trim() || null,
    };
  }

  async function handleMutationFailure(error: unknown, fallback: string, action?: ActionTaken) {
    const apiError = safeError(error, fallback);
    setMutationError(apiError);
    if (apiError.fields) setFieldErrors(apiError.fields);
    if (apiError.status === 409 && action) {
      try {
        const latest = await getAction(action.id);
        setConflict(latest);
        setItems((current) => current.map((item) => item.id === latest.id ? latest : item));
      } catch {
        setConflict(null);
      }
    }
  }

  async function refreshAfterMutation(successMessage: string, action: ActionTaken) {
    setSelected(action);
    setItems((current) => {
      const exists = current.some((item) => item.id === action.id);
      return exists ? current.map((item) => item.id === action.id ? action : item) : [action, ...current];
    });
    setFeedback(successMessage);
    try {
      const refreshed = await getActions(ticketId, page, pageSize);
      setItems(refreshed.items);
      setPagination(refreshed.pagination);
    } catch {
      setFeedback(`${successMessage} The change succeeded, but the list could not be refreshed.`);
    }
    requestAnimationFrame(() => document.getElementById(`action-${action.id}`)?.focus());
  }

  async function submitEditor(event: FormEvent) {
    event.preventDefault();
    if (mutation || !editorMode || !validateForm(editorMode === "create")) return;
    setMutation(editorMode === "create" ? "create" : "edit");
    setMutationError(null);
    setFeedback("");
    try {
      if (editorMode === "create") {
        const action = await createAction(ticketId, { ...editableInput(), assigneeId: Number(form.assigneeId) });
        setEditorMode(null);
        setDirty(false);
        await refreshAfterMutation("Action planned.", action);
      } else if (selected) {
        const action = await updateAction(selected.id, selected.version, editableInput());
        setEditorMode(null);
        setDirty(false);
        setConflict(null);
        await refreshAfterMutation("Action changes saved.", action);
      }
    } catch (error) {
      await handleMutationFailure(error, editorMode === "create" ? "Unable to plan the Action right now." : "Unable to save the Action right now.", selected ?? undefined);
    } finally {
      setMutation(null);
    }
  }

  async function viewAction(action: ActionTaken) {
    if (dirty && !window.confirm("Discard your unsaved Action changes?")) return;
    setSelected(action);
    setEditorMode(null);
    setDirty(false);
    setMutationError(null);
    setFeedback("");
    setEvents([]);
    setEventsError("");
    try {
      const latest = await getAction(action.id);
      setSelected(latest);
      setItems((current) => current.map((item) => item.id === latest.id ? latest : item));
    } catch (error) {
      const apiError = safeError(error, "Unable to load the Action right now.");
      if (apiError.status === 403 || apiError.status === 404) setSelected(null);
      setEventsError(apiError.status === 403 ? "You do not have access to Action history." : "Unable to load Action details right now.");
      return;
    }
    if (canManage) {
      setEventsLoading(true);
      try {
        setEvents(await getActionEvents(action.id));
      } catch {
        setEventsError("Unable to load Action history right now.");
      } finally {
        setEventsLoading(false);
      }
    }
  }

  async function startAction(action: ActionTaken) {
    if (mutation) return;
    setMutation("start");
    setMutationError(null);
    try {
      const updated = await transitionAction(action.id, { expectedVersion: action.version, status: "IN_PROGRESS" });
      await refreshAfterMutation("Action started.", updated);
    } catch (error) {
      await handleMutationFailure(error, "Unable to start the Action right now.", action);
    } finally {
      setMutation(null);
    }
  }

  function openDialog(nextDialog: Exclude<DialogState, null>, button: HTMLButtonElement) {
    invokingButton.current = button;
    setDialog(nextDialog);
    setMutationError(null);
    if (nextDialog.type === "assign") setPendingAssigneeId(String(nextDialog.action.assignee.id));
    if (nextDialog.type === "complete") {
      setForm(actionForm(nextDialog.action));
      setDirty(false);
    }
    if (nextDialog.type === "cancel") setCancellationReason("");
  }

  function closeDialog() {
    if (mutation) return;
    if (dialog?.type === "complete" && dirty && !window.confirm("Discard your unsaved completion details?")) return;
    setDialog(null);
    setDirty(false);
    setFieldErrors({});
    invokingButton.current?.focus();
  }

  async function confirmAssignment() {
    if (mutation || dialog?.type !== "assign") return;
    const assigneeId = Number(pendingAssigneeId);
    if (!Number.isInteger(assigneeId) || assigneeId <= 0 || assigneeId === dialog.action.assignee.id) return;
    setMutation("assign");
    try {
      const updated = await reassignAction(dialog.action.id, dialog.action.version, assigneeId);
      setDialog(null);
      await refreshAfterMutation("Action reassigned.", updated);
    } catch (error) {
      await handleMutationFailure(error, "Unable to reassign the Action right now.", dialog.action);
    } finally {
      setMutation(null);
    }
  }

  async function confirmCompletion(event: FormEvent) {
    event.preventDefault();
    if (mutation || dialog?.type !== "complete" || !validateForm(false, true)) return;
    setMutation("complete");
    try {
      const input = editableInput();
      const updated = await transitionAction(dialog.action.id, {
        expectedVersion: dialog.action.version,
        status: "COMPLETED",
        actionAt: input.actionAt,
        result: input.result,
        followUpRequired: input.followUpRequired,
        followUpNote: input.followUpNote,
        attachmentNotes: input.attachmentNotes,
      });
      setDialog(null);
      setDirty(false);
      await refreshAfterMutation("Action completed.", updated);
    } catch (error) {
      await handleMutationFailure(error, "Unable to complete the Action right now.", dialog.action);
    } finally {
      setMutation(null);
    }
  }

  async function confirmCancellation(event: FormEvent) {
    event.preventDefault();
    if (mutation || dialog?.type !== "cancel") return;
    const reason = cancellationReason.trim();
    if (reason.length < 1 || reason.length > 500) {
      setFieldErrors({ cancellationReason: "Enter 1 to 500 characters." });
      return;
    }
    setMutation("cancel");
    try {
      const updated = await transitionAction(dialog.action.id, {
        expectedVersion: dialog.action.version,
        status: "CANCELLED",
        confirmed: true,
        cancellationReason: reason,
      });
      setDialog(null);
      await refreshAfterMutation("Action cancelled.", updated);
    } catch (error) {
      await handleMutationFailure(error, "Unable to cancel the Action right now.", dialog.action);
    } finally {
      setMutation(null);
    }
  }

  function useLatestValues() {
    if (!conflict) return;
    setSelected(conflict);
    if (editorMode === "edit") setForm(actionForm(conflict));
    setDialog(null);
    setConflict(null);
    setDirty(false);
    setMutationError(null);
    requestAnimationFrame(() => document.getElementById(`action-${conflict.id}`)?.focus());
  }

  function mutationErrorMessage(error: ApiError) {
    if (error.status === 409) return "This action changed after you opened it. Review the latest version before trying again.";
    if (error.status === 401) return "Your session has expired. Sign in again.";
    if (error.status === 403) return "You do not have permission to make this Action change.";
    if (error.status === 404) return "The Action is no longer available.";
    if (error.code === "INELIGIBLE_ASSIGNEE") return "The selected assignee is inactive or no longer eligible. Choose another active Staff member.";
    return error.message;
  }

  function changePage(nextPage: number) {
    if (dirty && !window.confirm("Discard your unsaved Action changes?")) return;
    setEditorMode(null);
    setDirty(false);
    setPage(nextPage);
  }

  function renderFields(includeAssignee: boolean, completing = false) {
    const prefix = completing ? "complete" : editorMode ?? "action";
    return <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label fw-semibold" htmlFor={`${prefix}-action-at`}>Action Date/Time <span aria-hidden="true">*</span></label>
        <input
          id={`${prefix}-action-at`}
          type="datetime-local"
          className={`form-control ${fieldErrors.actionAt ? "is-invalid" : ""}`}
          value={form.actionAt}
          onChange={(event) => updateForm("actionAt", event.target.value)}
          aria-invalid={Boolean(fieldErrors.actionAt)}
          aria-describedby={`${prefix}-action-at-help ${prefix}-action-at-error`}
          required
        />
        <div id={`${prefix}-action-at-help`} className="form-text">Entered in your local time zone; displayed with a zone label.</div>
        <ErrorText id={`${prefix}-action-at-error`} message={fieldErrors.actionAt} />
      </div>
      {includeAssignee && <div className="col-md-6">
        <label className="form-label fw-semibold" htmlFor={`${prefix}-assignee`}>Assigned to <span aria-hidden="true">*</span></label>
        <select
          id={`${prefix}-assignee`}
          className={`form-select ${fieldErrors.assigneeId ? "is-invalid" : ""}`}
          value={form.assigneeId}
          onChange={(event) => updateForm("assigneeId", event.target.value)}
          aria-invalid={Boolean(fieldErrors.assigneeId)}
          aria-describedby={`${prefix}-assignee-error`}
          required
        >
          <option value="">Choose an eligible assignee</option>
          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"})</option>)}
        </select>
        <ErrorText id={`${prefix}-assignee-error`} message={fieldErrors.assigneeId} />
      </div>}
      {!completing && <div className="col-12">
        <label className="form-label fw-semibold" htmlFor={`${prefix}-description`}>Action Description <span aria-hidden="true">*</span></label>
        <textarea
          id={`${prefix}-description`}
          className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
          rows={4}
          maxLength={2000}
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={`${prefix}-description-count ${prefix}-description-error`}
          required
        />
        <div id={`${prefix}-description-count`} className="form-text">{form.description.length}/2000 characters</div>
        <ErrorText id={`${prefix}-description-error`} message={fieldErrors.description} />
      </div>}
      <div className="col-12">
        <label className="form-label fw-semibold" htmlFor={`${prefix}-result`}>Result{completing && <span aria-hidden="true"> *</span>}</label>
        <textarea
          id={`${prefix}-result`}
          className={`form-control ${fieldErrors.result ? "is-invalid" : ""}`}
          rows={3}
          maxLength={2000}
          value={form.result}
          onChange={(event) => updateForm("result", event.target.value)}
          aria-invalid={Boolean(fieldErrors.result)}
          aria-describedby={`${prefix}-result-help ${prefix}-result-error`}
          required={completing}
        />
        <div id={`${prefix}-result-help`} className="form-text">{completing ? "Required to complete this Action." : "Optional while planned or in progress; required at completion."}</div>
        <ErrorText id={`${prefix}-result-error`} message={fieldErrors.result} />
      </div>
      <div className="col-12">
        <div className="form-check">
          <input
            id={`${prefix}-follow-up`}
            className="form-check-input"
            type="checkbox"
            checked={form.followUpRequired}
            onChange={(event) => {
              updateForm("followUpRequired", event.target.checked);
              if (!event.target.checked) updateForm("followUpNote", "");
            }}
          />
          <label className="form-check-label fw-semibold" htmlFor={`${prefix}-follow-up`}>Follow-Up Required?</label>
        </div>
      </div>
      <div className="col-12">
        <label className="form-label fw-semibold" htmlFor={`${prefix}-follow-up-note`}>Follow-up Note{form.followUpRequired && <span aria-hidden="true"> *</span>}</label>
        <textarea
          id={`${prefix}-follow-up-note`}
          className={`form-control ${fieldErrors.followUpNote ? "is-invalid" : ""}`}
          rows={3}
          maxLength={1000}
          value={form.followUpNote}
          disabled={!form.followUpRequired}
          onChange={(event) => updateForm("followUpNote", event.target.value)}
          aria-invalid={Boolean(fieldErrors.followUpNote)}
          aria-describedby={`${prefix}-follow-up-error`}
          required={form.followUpRequired}
        />
        <ErrorText id={`${prefix}-follow-up-error`} message={fieldErrors.followUpNote} />
      </div>
      <div className="col-12">
        <label className="form-label fw-semibold" htmlFor={`${prefix}-attachment-notes`}>Attachment Notes</label>
        <textarea
          id={`${prefix}-attachment-notes`}
          className={`form-control ${fieldErrors.attachmentNotes ? "is-invalid" : ""}`}
          rows={3}
          maxLength={1000}
          value={form.attachmentNotes}
          onChange={(event) => updateForm("attachmentNotes", event.target.value)}
          aria-invalid={Boolean(fieldErrors.attachmentNotes)}
          aria-describedby={`${prefix}-attachment-help ${prefix}-attachment-error`}
        />
        <div id={`${prefix}-attachment-help`} className="form-text">Identify an existing Ticket file or context. This field does not upload a file.</div>
        <ErrorText id={`${prefix}-attachment-error`} message={fieldErrors.attachmentNotes} />
      </div>
    </div>;
  }

  function actionControls(action: ActionTaken) {
    if (!canManage || action.status === "COMPLETED" || action.status === "CANCELLED") return null;
    const canPerform = currentUser.role === "ADMINISTRATOR" || action.assignee.id === currentUser.id;
    return <div className="d-flex flex-wrap gap-2 mt-3">
      <button type="button" className="btn btn-sm btn-outline-success" onClick={() => openEdit(action)} disabled={mutation !== null}>Edit action</button>
      <button
        type="button"
        className="btn btn-sm btn-outline-success"
        onClick={(event) => openDialog({ type: "assign", action }, event.currentTarget)}
        disabled={mutation !== null}
      >Reassign action</button>
      {action.status === "PLANNED" && canPerform && <button type="button" className="btn btn-sm btn-success" onClick={() => void startAction(action)} disabled={mutation !== null}>{mutation === "start" ? "Starting…" : "Start action"}</button>}
      {action.status === "IN_PROGRESS" && canPerform && <button type="button" className="btn btn-sm btn-success" onClick={(event) => openDialog({ type: "complete", action }, event.currentTarget)} disabled={mutation !== null}>Complete action</button>}
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={(event) => openDialog({ type: "cancel", action }, event.currentTarget)} disabled={mutation !== null}>Cancel action</button>
    </div>;
  }

  function renderMobileCard(action: ActionTaken) {
    return <article className="action-mobile-card border rounded-3 p-3" key={action.id} id={`mobile-action-${action.id}`}>
      <div className="d-flex justify-content-between align-items-start gap-2">
        <strong>{formatDate(action.actionAt)}</strong>
        <span className={`badge ${statusClass(action.status)}`}>{statusLabel(action.status)}</span>
      </div>
      <p className="mt-2 mb-2 text-break">{action.description}</p>
      <dl className="action-card-details mb-3">
        <dt>Assigned to</dt><dd>{action.assignee.name}{!action.assignee.isActive && <span className="badge text-bg-secondary ms-1">Inactive</span>}</dd>
        <dt>Result</dt><dd>{action.result ?? "Not completed"}</dd>
        <dt>Follow-up</dt><dd>{action.followUpRequired ? "Required" : "Not required"}</dd>
        <dt>Attachment notes</dt><dd>{action.attachmentNotes ? "Provided" : "None"}</dd>
      </dl>
      <button type="button" className="btn btn-outline-success w-100" onClick={() => void viewAction(action)}>View action</button>
    </article>;
  }

  return <section className="actions-taken mt-4" aria-labelledby="actions-taken-heading">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <div>
        <h2 id="actions-taken-heading" className="h4 mb-1" tabIndex={-1}>Actions Taken <span className="text-muted">({pagination.totalItems})</span></h2>
        <p className="text-muted mb-0">Planned and completed work for this Ticket.</p>
      </div>
      {canCreate && <button type="button" className="btn btn-success" onClick={openCreate} disabled={mutation !== null || editorMode !== null}>Plan action</button>}
    </div>

    {feedback && <div className="alert alert-success" role="status">{feedback}</div>}
    {mutationError && !dialog && <div className="alert alert-danger" role="alert">{mutationErrorMessage(mutationError)}</div>}

    {conflict && <div className="alert alert-warning" role="alert">
      <p className="fw-semibold mb-2">Latest server values</p>
      <p className="mb-2">Status: {statusLabel(conflict.status)} · Assigned to: {conflict.assignee.name} · Updated: {formatDate(conflict.updatedAt)} · Version {conflict.version}</p>
      <button type="button" className="btn btn-sm btn-outline-dark" onClick={useLatestValues}>{editorMode === "edit" ? "Use latest values" : "Review latest values"}</button>
    </div>}

    {editorMode && <form className="action-editor border rounded-3 p-3 p-md-4 mb-4" onSubmit={submitEditor} noValidate>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h3 className="h5 mb-1">{editorMode === "create" ? "Plan an Action" : "Edit Action"}</h3>
          <p className="small text-muted mb-0">Created by: {editorMode === "create" ? currentUser.name : selected?.createdBy.name}</p>
        </div>
        <button type="button" className="btn-close" aria-label="Close Action form" onClick={closeEditor} />
      </div>
      {renderFields(editorMode === "create")}
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="submit" className="btn btn-success" disabled={mutation !== null}>{mutation === "create" ? "Planning…" : mutation === "edit" ? "Saving…" : editorMode === "create" ? "Plan action" : "Save changes"}</button>
        <button type="button" className="btn btn-outline-secondary" onClick={closeEditor} disabled={mutation !== null}>Cancel</button>
      </div>
    </form>}

    {state === "loading" && <div className="action-loading border rounded-3 p-4 text-center" role="status" aria-busy="true">Loading Actions Taken…</div>}
    {state === "error" && <div className="border rounded-3 p-4 text-center">
      <div className="alert alert-danger" role="alert">{loadError?.status === 401 ? "Your session has expired. Sign in again." : loadError?.status === 404 ? "This Ticket is unavailable or you do not have access." : loadError?.status === 403 ? "You do not have access to Actions Taken for this Ticket." : "Unable to load Actions Taken right now."}</div>
      <button type="button" className="btn btn-success" onClick={() => void loadActions()}>Retry</button>
    </div>}
    {state === "success" && items.length === 0 && <div className="border rounded-3 p-4 text-center">
      <p className="mb-0">No Actions Taken have been recorded for this Ticket.</p>
      {canCreate && <button type="button" className="btn btn-outline-success mt-3" onClick={openCreate} disabled={editorMode !== null}>Plan action</button>}
    </div>}
    {state === "success" && items.length > 0 && <>
      <div className="table-responsive action-table-region d-none d-md-block" role="region" aria-label="Actions Taken table" tabIndex={0}>
        <table className="table align-middle action-table">
          <thead><tr><th scope="col">Action Date/Time</th><th scope="col">Description</th><th scope="col">Status</th><th scope="col">Assigned to</th><th scope="col">Result</th><th scope="col"><span className="visually-hidden">Action</span></th></tr></thead>
          <tbody>{items.map((action) => <tr key={action.id} id={`action-${action.id}`} tabIndex={-1}>
            <td>{formatDate(action.actionAt)}</td>
            <td className="text-break">{action.description}</td>
            <td><span className={`badge ${statusClass(action.status)}`}>{statusLabel(action.status)}</span></td>
            <td>{action.assignee.name}{!action.assignee.isActive && <span className="badge text-bg-secondary ms-1">Inactive</span>}</td>
            <td className="text-break">{action.result ?? "Not completed"}</td>
            <td><button type="button" className="btn btn-sm btn-outline-success" onClick={() => void viewAction(action)}>View action</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="d-grid gap-3 d-md-none">{items.map(renderMobileCard)}</div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
        <label className="d-flex align-items-center gap-2" htmlFor="actions-page-size">Rows per page
          <select id="actions-page-size" className="form-select form-select-sm action-page-size" value={pageSize} onChange={(event) => { if (dirty && !window.confirm("Discard your unsaved Action changes?")) return; setEditorMode(null); setDirty(false); setPageSize(Number(event.target.value) as 10 | 20 | 50); setPage(1); }}>
            <option value="10">10</option><option value="20">20</option><option value="50">50</option>
          </select>
        </label>
        <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
        <nav aria-label="Actions Taken pages" className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-success" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
          <button type="button" className="btn btn-sm btn-outline-success" disabled={pagination.totalPages === 0 || page >= pagination.totalPages} onClick={() => changePage(page + 1)}>Next</button>
        </nav>
      </div>
    </>}

    {selected && !editorMode && <article className="action-detail border rounded-3 p-3 p-md-4 mt-4" aria-labelledby="action-detail-heading">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div><h3 id="action-detail-heading" className="h5 mb-1">Action Detail</h3><p className="text-muted mb-0">Action #{selected.id} · Version {selected.version}</p></div>
        <span className={`badge ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
      </div>
      <p className="mt-3 text-break" style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>
      <dl className="row action-detail-list mb-0">
        <dt className="col-sm-4">Action Date/Time</dt><dd className="col-sm-8">{formatDate(selected.actionAt)}</dd>
        <dt className="col-sm-4">Result</dt><dd className="col-sm-8 text-break">{selected.result ?? "Not completed"}</dd>
        <dt className="col-sm-4">Assigned to</dt><dd className="col-sm-8">{selected.assignee.name}{!selected.assignee.isActive && <span className="badge text-bg-secondary ms-1">Inactive</span>}</dd>
        {ticketOwnerName !== undefined && <><dt className="col-sm-4">Ticket owner</dt><dd className="col-sm-8">{ticketOwnerName ?? "Unassigned"}</dd></>}
        <dt className="col-sm-4">Created by</dt><dd className="col-sm-8">{selected.createdBy.name}</dd>
        <dt className="col-sm-4">Performed by</dt><dd className="col-sm-8">{selected.performedBy?.name ?? "Not completed"}</dd>
        <dt className="col-sm-4">Follow-up</dt><dd className="col-sm-8">{selected.followUpRequired ? `Required — ${selected.followUpNote}` : "Not required"}</dd>
        <dt className="col-sm-4">Attachment Notes</dt><dd className="col-sm-8 text-break">{selected.attachmentNotes ?? "None"}</dd>
        <dt className="col-sm-4">Created</dt><dd className="col-sm-8">{formatDate(selected.createdAt)}</dd>
        <dt className="col-sm-4">Updated</dt><dd className="col-sm-8">{formatDate(selected.updatedAt)}</dd>
        {selected.completedAt && <><dt className="col-sm-4">Completed</dt><dd className="col-sm-8">{formatDate(selected.completedAt)}</dd></>}
        {selected.cancelledAt && <><dt className="col-sm-4">Cancelled</dt><dd className="col-sm-8">{formatDate(selected.cancelledAt)} by {selected.cancelledBy?.name ?? "Staff"} — {selected.cancellationReason}</dd></>}
      </dl>
      {actionControls(selected)}
      {canManage && <section className="border-top mt-4 pt-3" aria-labelledby="action-history-heading">
        <h4 id="action-history-heading" className="h6">Action history</h4>
        {eventsLoading && <p className="text-muted" role="status">Loading Action history…</p>}
        {eventsError && <div className="alert alert-warning py-2">{eventsError}</div>}
        {!eventsLoading && !eventsError && events.length === 0 ? <p className="text-muted mb-0">No Action history is available.</p> : !eventsLoading && <ol className="list-group list-group-numbered">{events.map((event) => <li className="list-group-item" key={event.id}><span className="fw-semibold">{event.actor.name}</span> — {eventText(event)} <span className="small text-muted">{formatDate(event.createdAt)}</span></li>)}</ol>}
      </section>}
    </article>}

    {dialog?.type === "assign" && <ActionDialog title="Confirm reassignment" onClose={closeDialog}>
      {mutationError && <div className="alert alert-danger" role="alert">{mutationErrorMessage(mutationError)}</div>}
      {conflict && <button type="button" className="btn btn-sm btn-outline-dark mb-3" onClick={useLatestValues}>Review latest values</button>}
      <p>Reassign this Action from <strong>{dialog.action.assignee.name}</strong> to:</p>
      <label className="form-label fw-semibold" htmlFor="reassign-action-user">Assigned to</label>
      <select id="reassign-action-user" className="form-select" value={pendingAssigneeId} onChange={(event) => setPendingAssigneeId(event.target.value)} disabled={mutation !== null}>
        {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"})</option>)}
      </select>
      <div className="d-flex gap-2 mt-3"><button type="button" className="btn btn-success" onClick={() => void confirmAssignment()} disabled={mutation !== null || pendingAssigneeId === String(dialog.action.assignee.id)}>{mutation === "assign" ? "Assigning…" : "Confirm reassignment"}</button><button type="button" className="btn btn-outline-secondary" onClick={closeDialog} disabled={mutation !== null}>Keep current assignee</button></div>
    </ActionDialog>}

    {dialog?.type === "complete" && <ActionDialog title="Complete Action" onClose={closeDialog}>
      {mutationError && <div className="alert alert-danger" role="alert">{mutationErrorMessage(mutationError)}</div>}
      {conflict && <button type="button" className="btn btn-sm btn-outline-dark mb-3" onClick={useLatestValues}>Review latest values</button>}
      <p className="small">Completing as <strong>{currentUser.name}</strong>. Assigned to {dialog.action.assignee.name}. Review the final Result and follow-up details.</p>
      <form onSubmit={confirmCompletion} noValidate>{renderFields(false, true)}<div className="d-flex gap-2 mt-3"><button type="submit" className="btn btn-success" disabled={mutation !== null}>{mutation === "complete" ? "Completing…" : "Confirm completion"}</button><button type="button" className="btn btn-outline-secondary" onClick={closeDialog} disabled={mutation !== null}>Keep in progress</button></div></form>
    </ActionDialog>}

    {dialog?.type === "cancel" && <ActionDialog title="Cancel Action" onClose={closeDialog}>
      {mutationError && <div className="alert alert-danger" role="alert">{mutationErrorMessage(mutationError)}</div>}
      {conflict && <button type="button" className="btn btn-sm btn-outline-dark mb-3" onClick={useLatestValues}>Review latest values</button>}
      <p>Cancel Action #{dialog.action.id} on Ticket {ticketNumber}? This transition is terminal.</p>
      <form onSubmit={confirmCancellation} noValidate>
        <label className="form-label fw-semibold" htmlFor="action-cancellation-reason">Cancellation reason <span aria-hidden="true">*</span></label>
        <textarea id="action-cancellation-reason" className={`form-control ${fieldErrors.cancellationReason ? "is-invalid" : ""}`} rows={4} maxLength={500} value={cancellationReason} onChange={(event) => { setCancellationReason(event.target.value); setFieldErrors({}); }} aria-invalid={Boolean(fieldErrors.cancellationReason)} aria-describedby="action-cancellation-error" required />
        <ErrorText id="action-cancellation-error" message={fieldErrors.cancellationReason} />
        <div className="d-flex gap-2 mt-3"><button type="submit" className="btn btn-danger" disabled={mutation !== null}>{mutation === "cancel" ? "Cancelling…" : "Confirm cancellation"}</button><button type="button" className="btn btn-outline-secondary" onClick={closeDialog} disabled={mutation !== null}>Keep Action</button></div>
      </form>
    </ActionDialog>}

    {selectedIndex >= 0 && <span className="visually-hidden">Selected Action position {selectedIndex + 1}</span>}
  </section>;
}
