import { FormEvent, useEffect, useState } from "react";
import {
  Category,
  checkSystem,
  createTicket,
  DevelopmentRequester,
  downloadTicketAttachment,
  getCategories,
  getRelatedSystems,
  getRequesters,
  getTicketDetail,
  getTickets,
  GetTicketsParams,
  RelatedSystem,
  RequestedPriority,
  Ticket,
  TicketDetail,
  TicketListItem,
  TicketPagination,
  uploadTicketAttachment,
  removeTicketAttachment,
} from "./api";

type UiState = "idle" | "loading" | "success" | "error";
type RequesterState = "loading" | "success" | "error";
type ReferenceDataState = "idle" | "loading" | "success" | "error";
type SubmitState = "idle" | "submitting" | "success" | "error";
type AppView = "tickets" | "create" | "detail";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function getAttachmentValidationError(file: File) {
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return `${file.name}: only JPG, JPEG, PNG, WEBP, and PDF files are allowed.`;
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `${file.name}: the file must not exceed 5 MB.`;
  }

  return "";
}

export default function App() {
  // -------------------------------------------------------------------------
  // Lab 1 - System Status
  // -------------------------------------------------------------------------
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  // -------------------------------------------------------------------------
  // Lab 2 - Development Requester Context
  // -------------------------------------------------------------------------
  const [requesterState, setRequesterState] =
    useState<RequesterState>("loading");

  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);

  const [selectedRequesterId, setSelectedRequesterId] =
    useState<number | null>(null);

  const [currentRequester, setCurrentRequester] =
    useState<DevelopmentRequester | null>(null);

  const [appView, setAppView] = useState<AppView>("tickets");

  // -------------------------------------------------------------------------
  // Lab 2 - Create Ticket Reference Data
  // -------------------------------------------------------------------------
  const [referenceDataState, setReferenceDataState] =
    useState<ReferenceDataState>("idle");

  const [ticketCategories, setTicketCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  // -------------------------------------------------------------------------
  // Lab 2 - Create Ticket Form
  // -------------------------------------------------------------------------
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [relatedSystemId, setRelatedSystemId] =
    useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const [requestedPriority, setRequestedPriority] =
    useState<RequestedPriority>("MEDIUM");
  const [description, setDescription] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [createAttachmentErrors, setCreateAttachmentErrors] = useState<string[]>([]);
  const [attachmentUploadFailures, setAttachmentUploadFailures] = useState<string[]>([]);

  // -------------------------------------------------------------------------
  // Lab 2 - My Tickets
  // -------------------------------------------------------------------------
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [ticketsState, setTicketsState] = useState<UiState>("idle");
  const [ticketsError, setTicketsError] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketCategoryFilter, setTicketCategoryFilter] =
    useState<number | null>(null);
  const [ticketSystemFilter, setTicketSystemFilter] =
    useState<number | null>(null);
  const [ticketPriorityFilter, setTicketPriorityFilter] =
    useState<RequestedPriority | "">("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketSortBy, setTicketSortBy] =
    useState<GetTicketsParams["sortBy"]>("updatedAt");
  const [ticketSortOrder, setTicketSortOrder] =
    useState<GetTicketsParams["sortOrder"]>("desc");
  const [ticketPageSize, setTicketPageSize] =
    useState<10 | 20 | 50>(10);
  const [ticketPagination, setTicketPagination] =
    useState<TicketPagination>({
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });

  // -------------------------------------------------------------------------
  // Lab 2 - Requester Ticket Detail
  // -------------------------------------------------------------------------
  const [selectedTicketDetail, setSelectedTicketDetail] =
    useState<TicketDetail | null>(null);
  const [ticketDetailState, setTicketDetailState] =
    useState<UiState>("idle");
  const [ticketDetailError, setTicketDetailError] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentState, setAttachmentState] = useState<SubmitState>("idle");
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentSuccess, setAttachmentSuccess] = useState("");
  const [removingAttachmentId, setRemovingAttachmentId] =
    useState<number | null>(null);
  const [removalTargetId, setRemovalTargetId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] =
    useState<number | null>(null);

  useEffect(() => {
    loadRequesters();
  }, []);

  // -------------------------------------------------------------------------
  // Lab 1 - System Check
  // -------------------------------------------------------------------------
  async function handleCheck() {
    setState("loading");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  // -------------------------------------------------------------------------
  // Development Requester
  // -------------------------------------------------------------------------
  async function loadRequesters() {
    setRequesterState("loading");

    try {
      const result = await getRequesters();
      setRequesters(result);
      setRequesterState("success");
    } catch {
      setRequesters([]);
      setRequesterState("error");
    }
  }

  async function handleContinue() {
    const requester =
      requesters.find(
        (requester) => requester.id === selectedRequesterId,
      ) ?? null;

    if (!requester) {
      return;
    }

    setCurrentRequester(requester);
    setAppView("tickets");

    await Promise.all([
      loadTicketReferenceData(),
      loadTickets(requester.id, 1),
    ]);
  }

  function handleChangeRequester() {
    setCurrentRequester(null);
    setSelectedRequesterId(null);
    setAppView("tickets");

    resetTicketForm();

    setTicketCategories([]);
    setRelatedSystems([]);
    setReferenceDataState("idle");

    setTickets([]);
    setTicketsState("idle");
    setTicketsError("");
    setTicketSearch("");
    setTicketCategoryFilter(null);
    setTicketSystemFilter(null);
    setTicketPriorityFilter("");
    setTicketStatusFilter("");
    setTicketSortBy("updatedAt");
    setTicketSortOrder("desc");
    setTicketPageSize(10);

    setTicketPagination({
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });

    setSelectedTicketDetail(null);
    setTicketDetailState("idle");
    setTicketDetailError("");
    setAttachmentFile(null);
    setAttachmentState("idle");
    setAttachmentError("");
    setAttachmentSuccess("");
    setRemovalTargetId(null);
    setRemovalReason("");
  }

  // -------------------------------------------------------------------------
  // Create Ticket Reference Data
  // -------------------------------------------------------------------------
  async function loadTicketReferenceData() {
    setReferenceDataState("loading");

    try {
      const [categoryResult, relatedSystemResult] = await Promise.all([
        getCategories(),
        getRelatedSystems(),
      ]);

      setTicketCategories(categoryResult);
      setRelatedSystems(relatedSystemResult);
      setReferenceDataState("success");
    } catch {
      setTicketCategories([]);
      setRelatedSystems([]);
      setReferenceDataState("error");
    }
  }

  // -------------------------------------------------------------------------
  // Create Ticket
  // -------------------------------------------------------------------------
  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !currentRequester ||
      categoryId === null ||
      relatedSystemId === null ||
      summary.trim().length === 0 ||
      description.trim().length === 0
    ) {
      return;
    }

    if (submitState === "submitting") {
      return;
    }

    setSubmitState("submitting");
    setSubmitError("");

    try {
      const ticket = await createTicket(currentRequester.id, {
        categoryId,
        relatedSystemId,
        summary,
        requestedPriority,
        description,
      });

      const uploadFailures: string[] = [];

      for (const file of pendingAttachments) {
        try {
          await uploadTicketAttachment(currentRequester.id, ticket.id, file);
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "Unable to upload attachment";
          uploadFailures.push(`${file.name}: ${message}`);
        }
      }

      await loadTickets(currentRequester.id, 1);
      setCreatedTicket(ticket);
      setAttachmentUploadFailures(uploadFailures);
      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");

      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Unable to create ticket");
      }
    }
  }

  function resetTicketForm() {
    setCategoryId(null);
    setRelatedSystemId(null);
    setSummary("");
    setRequestedPriority("MEDIUM");
    setDescription("");
    setSubmitState("idle");
    setCreatedTicket(null);
    setSubmitError("");
    setPendingAttachments([]);
    setCreateAttachmentErrors([]);
    setAttachmentUploadFailures([]);
  }

  function handleOpenCreateTicket() {
    resetTicketForm();
    setAppView("create");
  }

  function handleCancelCreateTicket() {
    resetTicketForm();
    setAppView("tickets");
  }

  // -------------------------------------------------------------------------
  // My Tickets
  // -------------------------------------------------------------------------
  async function loadTickets(requesterId: number, page = 1) {
    setTicketsState("loading");
    setTicketsError("");

    try {
      const result = await getTickets(requesterId, {
        search: ticketSearch,
        categoryId: ticketCategoryFilter ?? undefined,
        relatedSystemId: ticketSystemFilter ?? undefined,
        requestedPriority: ticketPriorityFilter || undefined,
        status: ticketStatusFilter || undefined,
        sortBy: ticketSortBy,
        sortOrder: ticketSortOrder,
        page,
        pageSize: ticketPageSize,
      });

      setTickets(result.items);
      setTicketPagination(result.pagination);
      setTicketsState("success");
    } catch (error) {
      setTickets([]);
      setTicketsState("error");

      if (error instanceof Error) {
        setTicketsError(error.message);
      } else {
        setTicketsError("Unable to load tickets");
      }
    }
  }

  function handleTicketSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentRequester) {
      void loadTickets(currentRequester.id, 1);
    }
  }

  function handleClearTicketFilters() {
    setTicketSearch("");
    setTicketCategoryFilter(null);
    setTicketSystemFilter(null);
    setTicketPriorityFilter("");
    setTicketStatusFilter("");
    setTicketSortBy("updatedAt");
    setTicketSortOrder("desc");
    setTicketPageSize(10);
  }

  // -------------------------------------------------------------------------
  // Requester Ticket Detail
  // -------------------------------------------------------------------------
  async function handleViewTicket(ticketId: number) {
    if (!currentRequester) {
      return;
    }

    setAppView("detail");
    setSelectedTicketDetail(null);
    setTicketDetailState("loading");
    setTicketDetailError("");
    setAttachmentFile(null);
    setAttachmentState("idle");
    setAttachmentError("");
    setAttachmentSuccess("");
    setRemovalTargetId(null);
    setRemovalReason("");

    try {
      const result = await getTicketDetail(
        currentRequester.id,
        ticketId,
      );

      setSelectedTicketDetail(result);
      setTicketDetailState("success");
    } catch (error) {
      setTicketDetailState("error");

      if (error instanceof Error) {
        setTicketDetailError(error.message);
      } else {
        setTicketDetailError("Unable to load ticket");
      }
    }
  }

  function handleBackToTickets() {
    setAppView("tickets");
    setSelectedTicketDetail(null);
    setTicketDetailState("idle");
    setTicketDetailError("");
    setAttachmentFile(null);
    setAttachmentState("idle");
    setAttachmentError("");
    setAttachmentSuccess("");
    setRemovalTargetId(null);
    setRemovalReason("");
  }

  async function refreshTicketDetail(ticketId: number) {
    if (!currentRequester) return;
    const result = await getTicketDetail(currentRequester.id, ticketId);
    setSelectedTicketDetail(result);
  }

  async function handleUploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentRequester || !selectedTicketDetail || !attachmentFile ||
        attachmentState === "submitting") return;

    setAttachmentState("submitting");
    setAttachmentError("");
    setAttachmentSuccess("");

    try {
      await uploadTicketAttachment(
        currentRequester.id,
        selectedTicketDetail.id,
        attachmentFile,
      );
      await refreshTicketDetail(selectedTicketDetail.id);
      setAttachmentFile(null);
      setAttachmentState("success");
      setAttachmentSuccess("Attachment uploaded successfully.");

      const input = document.getElementById("ticket-attachment") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (error) {
      setAttachmentState("error");
      setAttachmentError(
        error instanceof Error ? error.message : "Unable to upload attachment",
      );
    }
  }

  function handleSelectDetailAttachment(file: File | null) {
    setAttachmentState("idle");
    setAttachmentError("");
    setAttachmentSuccess("");

    if (!file) {
      setAttachmentFile(null);
      return;
    }

    const validationError = getAttachmentValidationError(file);

    if (validationError) {
      setAttachmentFile(null);
      setAttachmentError(validationError);
      return;
    }

    setAttachmentFile(file);
  }

  function handleRequestRemoveAttachment(attachmentId: number) {
    setRemovalTargetId(attachmentId);
    setRemovalReason("");
    setAttachmentError("");
    setAttachmentSuccess("");
  }

  async function handleRemoveAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentRequester || !selectedTicketDetail || removalTargetId === null) {
      return;
    }

    const trimmedReason = removalReason.trim();

    if (trimmedReason.length < 1 || trimmedReason.length > 250) {
      setAttachmentError("Removal reason must contain 1 to 250 characters.");
      return;
    }

    setRemovingAttachmentId(removalTargetId);
    setAttachmentError("");

    try {
      await removeTicketAttachment(
        currentRequester.id,
        removalTargetId,
        trimmedReason,
      );
      await refreshTicketDetail(selectedTicketDetail.id);
      setRemovalTargetId(null);
      setRemovalReason("");
      setAttachmentState("success");
      setAttachmentSuccess("Attachment removed successfully.");
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : "Unable to remove attachment",
      );
    } finally {
      setRemovingAttachmentId(null);
    }
  }

  async function handleDownloadAttachment(
    attachmentId: number,
    originalFilename: string,
  ) {
    if (!currentRequester) return;

    setDownloadingAttachmentId(attachmentId);
    setAttachmentError("");

    try {
      const blob = await downloadTicketAttachment(
        currentRequester.id,
        attachmentId,
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = originalFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : "Unable to download attachment",
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  }

  function formatFileSize(sizeBytes: number) {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }

    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getPriorityBadgeClass(priority: RequestedPriority) {
    switch (priority) {
      case "LOW":
        return "bg-success-subtle text-success border border-success-subtle";
      case "MEDIUM":
        return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
      case "HIGH":
        return "bg-danger-subtle text-danger border border-danger-subtle";
      default:
        return "bg-secondary-subtle text-secondary border";
    }
  }

  function formatPriority(priority: RequestedPriority) {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  }

  function formatTicketDate(date: string) {
    return new Date(date).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const formIsValid =
    categoryId !== null &&
    relatedSystemId !== null &&
    summary.trim().length >= 1 &&
    summary.trim().length <= 120 &&
    description.trim().length >= 1 &&
    description.trim().length <= 2000;

  return (
    <div className="app-shell">
      {!currentRequester && (
        <>
          <nav className="navbar bg-success rounded-0 shadow-sm navbar mb-0 px-4 py-3" style={{ borderRadius: 0 }}>
            <span className="navbar-brand text-white fw-bold mb-0">
              ◷ TokTickIT
            </span>
          </nav>

          <div className="app-content">
            <div className="small text-success fw-semibold mb-3">
             ⌂ &nbsp;›&nbsp; Development Requester Selection
            </div>

            <div
              className="card shadow-sm mx-auto mb-4"
              style={{ maxWidth: 760 }}
            >
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success mb-3"
                    style={{ width: 64, height: 64, fontSize: 28 }}
                    aria-hidden="true"
                  >
                    ♙
                  </div>
                  <h1 className="h3 mb-2">Select Development Requester</h1>
                  <p className="text-muted mb-0">
                    Choose a development requester to simulate the current
                    requester context for Lab 2.
                  </p>
                  <p className="text-muted mb-0">
                    This is for testing only and is not a login screen.
                  </p>
                </div>

                <hr className="my-4" />

                {requesterState === "loading" && (
                  <div className="text-center text-muted py-4">
                    Loading development requesters...
                  </div>
                )}

                {requesterState === "error" && (
                  <div className="alert alert-danger mb-0">
                    <div className="mb-3">
                      Unable to load development requesters.
                    </div>
                    <button className="btn btn-danger" onClick={loadRequesters}>
                      Retry
                    </button>
                  </div>
                )}

                {requesterState === "success" && requesters.length === 0 && (
                  <div className="alert alert-warning mb-0">
                    No active development requesters are available.
                  </div>
                )}

                {requesterState === "success" && requesters.length > 0 && (
                  <>
                    <div className="mb-3">
                      <label
                        htmlFor="development-requester"
                        className="form-label fw-semibold"
                      >
                        Development Requester{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <select
                        id="development-requester"
                        className="form-select form-select-lg"
                        aria-label="Development Requester"
                        value={selectedRequesterId ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedRequesterId(
                            value === "" ? null : Number(value),
                          );
                        }}
                      >
                        <option value="">Select a development requester</option>
                        {requesters.map((requester) => (
                          <option key={requester.id} value={requester.id}>
                            {requester.name} - {requester.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="alert alert-success d-flex gap-2 align-items-start">
                      <span aria-hidden="true">ⓘ</span>
                      <span>Only active development requesters are shown.</span>
                    </div>

                    <div className="border rounded-3 bg-light p-3 p-md-4 mb-4">
                      <div className="d-flex gap-3">
                        <div
                          className="d-flex align-items-center justify-content-center rounded-circle bg-white border flex-shrink-0"
                          style={{ width: 44, height: 44 }}
                          aria-hidden="true"
                        >
                          ◇
                        </div>
                        <div>
                          <div className="fw-semibold mb-1">
                            Authentication coming in Lab 3
                          </div>
                          <div className="small text-muted">
                            In Lab 3, this selection will be replaced with secure
                            authentication so you can access the system with your
                            own account.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-end">
                      <button
                        className="btn btn-success px-4"
                        onClick={handleContinue}
                        disabled={selectedRequesterId === null}
                      >
                        Continue →
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {currentRequester && (
        <>
          {/* Requester Application Navbar */}
          <nav
            className="navbar navbar-expand-md bg-success rounded-0 shadow-sm mb-0 px-4 py-3"
            style={{ borderRadius: 0 }}
            aria-label="Requester application navigation"
          >
            <button
              type="button"
              className="navbar-brand btn btn-link text-decoration-none p-0 me-3 text-white fw-bold"
              onClick={() => {
                handleBackToTickets();
              }}
            >
              TokTickIT
            </button>

            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
              <button
                type="button"
                className={`btn btn-sm ${
                  appView === "tickets"
                    ? "btn-light text-success"
                    : "btn-link text-white text-decoration-none"
                }`}
                onClick={handleBackToTickets}
              >
                My Tickets
              </button>

              <button
                type="button"
                className={`btn btn-sm ${
                  appView === "create"
                    ? "btn-light text-success"
                    : "btn-link text-white text-decoration-none"
                }`}
                onClick={handleOpenCreateTicket}
              >
                Create Ticket
              </button>
            </div>

            <div className="ms-auto ps-md-3">
              <div className="d-flex flex-column align-items-end gap-1">
                <div className="small text-white-50">Requester</div>
                <div className="small fw-semibold text-white">{currentRequester.name}</div>
              </div>
              <button
                type="button"
                className="btn btn-link btn-sm text-white p-0 text-decoration-none d-block mt-1"
                onClick={handleChangeRequester}
                disabled={submitState === "submitting"}
              >
                Change →
              </button>
            </div>
          </nav>

          <div className="app-content">
            {/* My Tickets View */}
            {appView === "tickets" && (
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                    <div>
                      <h2 className="h4 mb-1">My Tickets</h2>
                      <p className="text-muted mb-0">
                        View and search your submitted tickets.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleOpenCreateTicket}
                    >
                      + Create Ticket
                    </button>
                  </div>

                  <div className="border-top pt-4 mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="small text-muted fw-semibold text-uppercase">Search & Filter</div>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-success p-0"
                        onClick={() =>
                          loadTickets(
                            currentRequester.id,
                            ticketPagination.page,
                          )
                        }
                        disabled={ticketsState === "loading"}
                      >
                        Refresh
                      </button>
                    </div>

                    <form onSubmit={handleTicketSearch}>
                      {/* Row 1: Search field */}
                      <div className="mb-3">
                        <label htmlFor="ticket-search" className="form-label">
                          Search
                        </label>
                        <input
                          id="ticket-search"
                          className="form-control"
                          type="search"
                          placeholder="Ticket Number or Summary"
                          value={ticketSearch}
                          onChange={(event) =>
                            setTicketSearch(event.target.value)
                          }
                        />
                      </div>

                      {/* Row 2: Main filters (Category, System, Priority, Status) */}
                      <div className="row g-3 mb-3">
                        <div className="col-md-6 col-lg-3">
                          <label
                            htmlFor="my-ticket-category"
                            className="form-label"
                          >
                            Filter by Category
                          </label>
                          <select
                            id="my-ticket-category"
                            className="form-select"
                            aria-label="My Tickets category filter"
                            value={ticketCategoryFilter ?? ""}
                            onChange={(event) =>
                              setTicketCategoryFilter(
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                              )
                            }
                          >
                            <option value="">All Categories</option>
                            {ticketCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <label
                            htmlFor="my-ticket-system"
                            className="form-label"
                          >
                            Filter by Related System
                          </label>
                          <select
                            id="my-ticket-system"
                            className="form-select"
                            aria-label="My Tickets related system filter"
                            value={ticketSystemFilter ?? ""}
                            onChange={(event) =>
                              setTicketSystemFilter(
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                              )
                            }
                          >
                            <option value="">All Related Systems</option>
                            {relatedSystems.map((system) => (
                              <option key={system.id} value={system.id}>
                                {system.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <label
                            htmlFor="my-ticket-priority"
                            className="form-label"
                          >
                            Filter by Priority
                          </label>
                          <select
                            id="my-ticket-priority"
                            className="form-select"
                            aria-label="My Tickets priority filter"
                            value={ticketPriorityFilter}
                            onChange={(event) =>
                              setTicketPriorityFilter(
                                event.target.value as
                                  | RequestedPriority
                                  | "",
                              )
                            }
                          >
                            <option value="">All Priorities</option>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <label
                            htmlFor="my-ticket-status"
                            className="form-label"
                          >
                            Filter by Status
                          </label>
                          <select
                            id="my-ticket-status"
                            className="form-select"
                            aria-label="My Tickets status filter"
                            value={ticketStatusFilter}
                            onChange={(event) =>
                              setTicketStatusFilter(event.target.value)
                            }
                          >
                            <option value="">All Statuses</option>
                            <option value="NEW">New</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 3: Sort controls and buttons */}
                      <div className="row g-3 mb-3">
                        <div className="col-md-6 col-lg-3">
                          <label
                            htmlFor="my-ticket-sort"
                            className="form-label"
                          >
                            Sort By
                          </label>
                          <select
                            id="my-ticket-sort"
                            className="form-select"
                            value={ticketSortBy}
                            onChange={(event) =>
                              setTicketSortBy(
                                event.target
                                  .value as GetTicketsParams["sortBy"],
                              )
                            }
                          >
                            <option value="updatedAt">Last Updated</option>
                            <option value="createdAt">Created Date</option>
                            <option value="ticketNumber">Ticket Number</option>
                          </select>
                        </div>

                        <div className="col-md-6 col-lg-3">
                          <label
                            htmlFor="my-ticket-order"
                            className="form-label"
                          >
                            Order
                          </label>
                          <select
                            id="my-ticket-order"
                            className="form-select"
                            value={ticketSortOrder}
                            onChange={(event) =>
                              setTicketSortOrder(
                                event.target
                                  .value as GetTicketsParams["sortOrder"],
                              )
                            }
                          >
                            <option value="desc">Descending</option>
                            <option value="asc">Ascending</option>
                          </select>
                        </div>

                        <div className="col-md-6 col-lg-6 d-flex align-items-end gap-2">
                          <button className="btn btn-success flex-grow-1" type="submit">
                            Apply
                          </button>
                          <button
                            className="btn btn-outline-secondary flex-grow-1"
                            type="button"
                            onClick={handleClearTicketFilters}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {ticketsState === "loading" && (
                    <div className="text-muted">Loading tickets...</div>
                  )}

                  {ticketsState === "error" && (
                    <div className="alert alert-danger">
                      <div className="mb-3">
                        {ticketsError || "Unable to load tickets"}
                      </div>
                      <button
                        className="btn btn-danger"
                        onClick={() =>
                          loadTickets(
                            currentRequester.id,
                            ticketPagination.page,
                          )
                        }
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {ticketsState === "success" && tickets.length === 0 && (
                    <div className="alert alert-light border">
                      {ticketSearch ||
                      ticketCategoryFilter !== null ||
                      ticketSystemFilter !== null ||
                      ticketPriorityFilter ||
                      ticketStatusFilter
                        ? "No tickets match the current search or filters."
                        : "You have not created any tickets yet."}
                    </div>
                  )}

                  {ticketsState === "success" && tickets.length > 0 && (
                    <>
                      {/* Desktop / tablet representation */}
                      <div className="d-none d-md-block">
                        <div className="table-responsive">
                          <table className="table align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Ticket No.</th>
                                <th>Summary</th>
                                <th>Category</th>
                                <th>Related System</th>
                                <th>Requested Priority</th>
                                <th>Status</th>
                                <th>Last Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tickets.map((ticket) => (
                                <tr key={ticket.id}>
                                  <td className="text-nowrap">
                                    <button
                                      type="button"
                                      className="btn btn-link p-0 fw-semibold text-success text-decoration-none"
                                      onClick={() =>
                                        handleViewTicket(ticket.id)
                                      }
                                      aria-label={`View ${ticket.ticketNumber}`}
                                    >
                                      {ticket.ticketNumber}
                                    </button>
                                  </td>
                                  <td style={{ minWidth: 180 }}>
                                    {ticket.summary}
                                  </td>
                                  <td>{ticket.category.name}</td>
                                  <td>{ticket.relatedSystem.name}</td>
                                  <td>
                                    <span
                                      className={`badge rounded-pill ${getPriorityBadgeClass(
                                        ticket.requestedPriority,
                                      )}`}
                                    >
                                      {formatPriority(
                                        ticket.requestedPriority,
                                      )}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle">
                                      {ticket.status === "NEW"
                                        ? "New"
                                        : ticket.status}
                                    </span>
                                  </td>
                                  <td className="text-nowrap">
                                    {formatTicketDate(ticket.updatedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile representation */}
                      <div className="d-md-none">
                        <div className="d-grid gap-3">
                          {tickets.map((ticket) => (
                            <article
                              key={ticket.id}
                              className="card border shadow-sm"
                            >
                              <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                                  <button
                                    type="button"
                                    className="btn btn-link p-0 fw-semibold text-success text-decoration-none text-start"
                                    onClick={() =>
                                      handleViewTicket(ticket.id)
                                    }
                                    aria-label={`View ${ticket.ticketNumber}`}
                                  >
                                    {ticket.ticketNumber}
                                  </button>

                                  <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle">
                                    {ticket.status === "NEW"
                                      ? "New"
                                      : ticket.status}
                                  </span>
                                </div>

                                <h3 className="h6 mb-3">
                                  {ticket.summary}
                                </h3>

                                <dl className="row small mb-3">
                                  <dt className="col-5 text-muted fw-normal">
                                    Category
                                  </dt>
                                  <dd className="col-7 mb-2">
                                    {ticket.category.name}
                                  </dd>

                                  <dt className="col-5 text-muted fw-normal">
                                    Related System
                                  </dt>
                                  <dd className="col-7 mb-2">
                                    {ticket.relatedSystem.name}
                                  </dd>

                                  <dt className="col-5 text-muted fw-normal">
                                    Priority
                                  </dt>
                                  <dd className="col-7 mb-2">
                                    <span
                                      className={`badge rounded-pill ${getPriorityBadgeClass(
                                        ticket.requestedPriority,
                                      )}`}
                                    >
                                      {formatPriority(
                                        ticket.requestedPriority,
                                      )}
                                    </span>
                                  </dd>

                                  <dt className="col-5 text-muted fw-normal">
                                    Last Updated
                                  </dt>
                                  <dd className="col-7 mb-0">
                                    {formatTicketDate(ticket.updatedAt)}
                                  </dd>
                                </dl>

                                <button
                                  type="button"
                                  className="btn btn-outline-success w-100"
                                  onClick={() =>
                                    handleViewTicket(ticket.id)
                                  }
                                >
                                  View Ticket
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
                        <div className="small text-muted">
                          {ticketPagination.totalItems} ticket
                          {ticketPagination.totalItems === 1 ? "" : "s"}
                        </div>

                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <label
                            htmlFor="my-ticket-page-size"
                            className="small"
                          >
                            Per page
                          </label>

                          <select
                            id="my-ticket-page-size"
                            className="form-select form-select-sm"
                            style={{ width: 80 }}
                            value={ticketPageSize}
                            onChange={(event) => {
                              const size = Number(event.target.value) as
                                | 10
                                | 20
                                | 50;
                              setTicketPageSize(size);
                            }}
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>

                          <button
                            className="btn btn-sm btn-outline-success"
                            disabled={ticketPagination.page <= 1}
                            onClick={() =>
                              loadTickets(
                                currentRequester.id,
                                ticketPagination.page - 1,
                              )
                            }
                          >
                            Previous
                          </button>

                          <span className="small">
                            Page {ticketPagination.page} of{" "}
                            {Math.max(ticketPagination.totalPages, 1)}
                          </span>

                          <button
                            className="btn btn-sm btn-outline-success"
                            disabled={
                              ticketPagination.totalPages === 0 ||
                              ticketPagination.page >=
                                ticketPagination.totalPages
                            }
                            onClick={() =>
                              loadTickets(
                                currentRequester.id,
                                ticketPagination.page + 1,
                              )
                            }
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Create Ticket View */}
            {appView === "create" && (
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="mb-4">
                    <button
                      type="button"
                      className="btn btn-link text-success p-0 text-decoration-none"
                      onClick={handleCancelCreateTicket}
                      disabled={submitState === "submitting"}
                    >
                      ← Back to My Tickets
                    </button>
                    <h2 className="h4 mt-3 mb-2">Create Ticket</h2>
                    <p className="text-muted mb-0">
                      Tell us about the issue you need help with.
                    </p>
                  </div>

                  {referenceDataState === "loading" && (
                    <div className="text-muted">
                      Loading ticket information...
                    </div>
                  )}

                  {referenceDataState === "error" && (
                    <div className="alert alert-danger mb-0">
                      <div className="mb-3">
                        Unable to load ticket information.
                      </div>
                      <button
                        className="btn btn-danger"
                        onClick={loadTicketReferenceData}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {referenceDataState === "success" &&
                    (ticketCategories.length === 0 ||
                      relatedSystems.length === 0) && (
                      <div className="alert alert-warning mb-0">
                        Ticket reference data is not available.
                      </div>
                    )}

                  {referenceDataState === "success" &&
                    ticketCategories.length > 0 &&
                    relatedSystems.length > 0 &&
                    submitState === "success" &&
                    createdTicket && (
                      <div className="alert alert-success">
                        <h3 className="h6">Ticket created successfully</h3>
                        <p className="mb-1">
                          Official Ticket Number:{" "}
                          <strong>{createdTicket.ticketNumber}</strong>
                        </p>
                        <p className="mb-3">
                          Status: <strong>{createdTicket.status}</strong>
                        </p>
                        {pendingAttachments.length > 0 &&
                          attachmentUploadFailures.length === 0 && (
                            <p className="mb-3">
                              {pendingAttachments.length} attachment
                              {pendingAttachments.length === 1 ? "" : "s"} uploaded successfully.
                            </p>
                          )}
                        {attachmentUploadFailures.length > 0 && (
                          <div className="alert alert-warning">
                            <div className="fw-semibold">
                              The ticket was created, but some attachments could not be uploaded.
                            </div>
                            {attachmentUploadFailures.map((message) => (
                              <div key={message}>{message}</div>
                            ))}
                            <div className="mt-1">
                              You can retry from Ticket Detail.
                            </div>
                          </div>
                        )}
                        <div className="d-flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handleViewTicket(createdTicket.id)}
                          >
                            View Ticket
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-success"
                            onClick={handleOpenCreateTicket}
                          >
                            Create Another Ticket
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={handleBackToTickets}
                          >
                            Back to My Tickets
                          </button>
                        </div>
                      </div>
                    )}

                  {referenceDataState === "success" &&
                    ticketCategories.length > 0 &&
                    relatedSystems.length > 0 &&
                    submitState !== "success" && (
                      <form onSubmit={handleCreateTicket}>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label
                              htmlFor="ticket-category"
                              className="form-label"
                            >
                              Category
                            </label>
                            <select
                              id="ticket-category"
                              className="form-select"
                              value={categoryId ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCategoryId(
                                  value === "" ? null : Number(value),
                                );
                              }}
                              disabled={submitState === "submitting"}
                              required
                            >
                              <option value="">Select a category</option>
                              {ticketCategories.map((category) => (
                                <option
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-6">
                            <label
                              htmlFor="ticket-related-system"
                              className="form-label"
                            >
                              Related System
                            </label>
                            <select
                              id="ticket-related-system"
                              className="form-select"
                              value={relatedSystemId ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setRelatedSystemId(
                                  value === "" ? null : Number(value),
                                );
                              }}
                              disabled={submitState === "submitting"}
                              required
                            >
                              <option value="">
                                Select a related system
                              </option>
                              {relatedSystems.map((system) => (
                                <option key={system.id} value={system.id}>
                                  {system.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-12">
                            <label
                              htmlFor="ticket-summary"
                              className="form-label"
                            >
                              Summary
                            </label>
                            <input
                              id="ticket-summary"
                              className="form-control"
                              type="text"
                              value={summary}
                              onChange={(event) =>
                                setSummary(event.target.value)
                              }
                              maxLength={120}
                              disabled={submitState === "submitting"}
                              required
                            />
                            <div className="form-text">
                              {summary.length}/120 characters
                            </div>
                          </div>

                          <div className="col-md-6">
                            <label
                              htmlFor="ticket-priority"
                              className="form-label"
                            >
                              Requested Priority
                            </label>
                            <select
                              id="ticket-priority"
                              className="form-select"
                              value={requestedPriority}
                              onChange={(event) =>
                                setRequestedPriority(
                                  event.target
                                    .value as RequestedPriority,
                                )
                              }
                              disabled={submitState === "submitting"}
                            >
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                            </select>
                          </div>

                          <div className="col-12">
                            <label
                              htmlFor="ticket-description"
                              className="form-label"
                            >
                              Description
                            </label>
                            <textarea
                              id="ticket-description"
                              className="form-control"
                              rows={7}
                              value={description}
                              onChange={(event) =>
                                setDescription(event.target.value)
                              }
                              maxLength={2000}
                              disabled={submitState === "submitting"}
                              required
                            />
                            <div className="form-text">
                              {description.length}/2000 characters
                            </div>
                          </div>

                          <div className="col-12">
                            <label
                              htmlFor="create-ticket-attachments"
                              className="form-label"
                            >
                              Attachments
                            </label>
                            <input
                              id="create-ticket-attachments"
                              className="form-control"
                              type="file"
                              multiple
                              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                              disabled={
                                submitState === "submitting" ||
                                pendingAttachments.length >= 5
                              }
                              onChange={(event) => {
                                const selectedFiles = Array.from(
                                  event.target.files ?? [],
                                );
                                const errors: string[] = [];
                                const validFiles = selectedFiles.filter((file) => {
                                  const validationError =
                                    getAttachmentValidationError(file);

                                  if (validationError) {
                                    errors.push(validationError);
                                    return false;
                                  }

                                  return true;
                                });
                                const remainingSlots =
                                  5 - pendingAttachments.length;

                                if (validFiles.length > remainingSlots) {
                                  errors.push(
                                    "A ticket can have a maximum of 5 active attachments.",
                                  );
                                }

                                setPendingAttachments((current) => [
                                  ...current,
                                  ...validFiles.slice(0, remainingSlots),
                                ]);
                                setCreateAttachmentErrors(errors);
                                event.target.value = "";
                              }}
                            />
                            <div className="form-text">
                              JPG, JPEG, PNG, WEBP, or PDF · Maximum 5 MB per file · Up to 5 files
                            </div>

                            {createAttachmentErrors.length > 0 && (
                              <div className="alert alert-danger py-2 mt-2 mb-0">
                                {createAttachmentErrors.map((message) => (
                                  <div key={message}>{message}</div>
                                ))}
                              </div>
                            )}

                            {pendingAttachments.length > 0 && (
                              <div className="list-group mt-2">
                                {pendingAttachments.map((file, index) => (
                                  <div
                                    className="list-group-item d-flex justify-content-between align-items-center gap-3"
                                    key={`${file.name}-${file.size}-${index}`}
                                  >
                                    <span className="text-break">
                                      {file.name} · {formatFileSize(file.size)}
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      disabled={submitState === "submitting"}
                                      aria-label={`Remove pending attachment ${file.name}`}
                                      onClick={() => {
                                        setPendingAttachments((current) =>
                                          current.filter((_, itemIndex) =>
                                            itemIndex !== index,
                                          ),
                                        );
                                        setCreateAttachmentErrors([]);
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {submitState === "error" && (
                          <div className="alert alert-danger mt-3">
                            {submitError || "Unable to create ticket"}
                          </div>
                        )}

                        <div className="d-flex justify-content-end gap-2 mt-4">
                          <button
                            className="btn btn-outline-secondary"
                            type="button"
                            onClick={handleCancelCreateTicket}
                            disabled={submitState === "submitting"}
                          >
                            Cancel
                          </button>

                          <button
                            className="btn btn-success"
                            type="submit"
                            disabled={
                              !formIsValid ||
                              submitState === "submitting"
                            }
                          >
                            {submitState === "submitting"
                              ? "Creating Ticket..."
                              : "Create Ticket"}
                          </button>
                        </div>
                      </form>
                    )}
                </div>
              </div>
            )}

            {/* Ticket Detail View */}
            {appView === "detail" && (
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="mb-4">
                    <button
                      type="button"
                      className="btn btn-link text-success p-0 text-decoration-none"
                      onClick={handleBackToTickets}
                    >
                      ← Back to My Tickets
                    </button>
                  </div>

                  {ticketDetailState === "loading" && (
                    <div className="text-muted">
                      Loading ticket detail...
                    </div>
                  )}

                  {ticketDetailState === "error" && (
                    <div className="alert alert-danger mb-0">
                      {ticketDetailError || "Unable to load ticket"}
                    </div>
                  )}

                  {ticketDetailState === "success" &&
                    selectedTicketDetail && (
                      <>
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                          <div>
                            <h2 className="h4 mb-1">Ticket Detail</h2>
                            <div className="fs-5 fw-semibold text-success">
                              {selectedTicketDetail.ticketNumber}
                            </div>
                            <p className="text-muted mb-0">
                              {selectedTicketDetail.summary}
                            </p>
                          </div>

                          <span className="badge text-bg-success fs-6">
                            {selectedTicketDetail.status}
                          </span>
                        </div>

                        <div className="row g-3 mb-4">
                          <div className="col-md-4">
                            <div className="small text-muted">Category</div>
                            <div className="fw-semibold">
                              {selectedTicketDetail.category.name}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Related System
                            </div>
                            <div className="fw-semibold">
                              {selectedTicketDetail.relatedSystem.name}
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="small text-muted">
                              Requested Priority
                            </div>
                            <div>
                              <span
                                className={`badge rounded-pill ${getPriorityBadgeClass(
                                  selectedTicketDetail.requestedPriority,
                                )}`}
                              >
                                {formatPriority(
                                  selectedTicketDetail.requestedPriority,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="border rounded-3 p-3 mb-4">
                          <h3 className="h6">Description</h3>
                          <p
                            className="mb-0"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {selectedTicketDetail.description}
                          </p>
                        </div>

                        <div className="mb-4">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                            <div>
                              <h3 className="h6 mb-1">Attachments</h3>
                              <div className="small text-muted">
                                JPG, JPEG, PNG, WEBP, or PDF · Maximum 5 MB per file · Up to 5 active attachments
                              </div>
                            </div>
                            <span className="small text-muted">
                              {selectedTicketDetail.attachments.filter(
                                (attachment) => !attachment.isRemoved,
                              ).length}/5 active
                            </span>
                          </div>

                          <form className="border rounded-3 p-3 mb-3" onSubmit={handleUploadAttachment}>
                            <div className="row g-2 align-items-end">
                              <div className="col-md">
                                <label htmlFor="ticket-attachment" className="form-label fw-semibold">
                                  Add attachment
                                </label>
                                <input
                                  id="ticket-attachment"
                                  className="form-control"
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                                  onChange={(event) => {
                                    handleSelectDetailAttachment(
                                      event.target.files?.[0] ?? null,
                                    );
                                  }}
                                  disabled={
                                    attachmentState === "submitting" ||
                                    selectedTicketDetail.attachments.filter(
                                      (attachment) => !attachment.isRemoved,
                                    ).length >= 5
                                  }
                                />
                              </div>
                              <div className="col-md-auto">
                                <button
                                  type="submit"
                                  className="btn btn-success w-100"
                                  disabled={
                                    !attachmentFile ||
                                    attachmentState === "submitting" ||
                                    selectedTicketDetail.attachments.filter(
                                      (attachment) => !attachment.isRemoved,
                                    ).length >= 5
                                  }
                                >
                                  {attachmentState === "submitting" ? "Uploading..." : "Upload"}
                                </button>
                              </div>
                            </div>
                          </form>

                          {attachmentState === "success" && attachmentSuccess && (
                            <div className="alert alert-success py-2">
                              {attachmentSuccess}
                            </div>
                          )}

                          {attachmentError && (
                            <div className="alert alert-danger py-2" role="alert">
                              {attachmentError}
                            </div>
                          )}

                          {selectedTicketDetail.attachments.filter(
                            (attachment) => !attachment.isRemoved,
                          ).length >= 5 && (
                            <div className="alert alert-warning py-2">
                              This ticket already has the maximum of 5 active attachments.
                            </div>
                          )}

                          {selectedTicketDetail.attachments.length === 0 ? (
                            <div className="alert alert-light border mb-0">
                              No attachments for this ticket.
                            </div>
                          ) : (
                            <div className="list-group">
                              {selectedTicketDetail.attachments.map((attachment) => (
                                <div
                                  className="list-group-item"
                                  key={attachment.id}
                                >
                                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                    <div className="text-break">
                                      <div className="d-flex flex-wrap align-items-center gap-2">
                                        <span className="fw-semibold">
                                          {attachment.originalFilename}
                                        </span>
                                        <span className={`badge ${
                                          attachment.isRemoved
                                            ? "text-bg-secondary"
                                            : "text-bg-success"
                                        }`}>
                                          {attachment.isRemoved ? "Removed" : "Active"}
                                        </span>
                                      </div>
                                      <div className="small text-muted">
                                        {attachment.mimeType} · {formatFileSize(attachment.sizeBytes)} · Uploaded {new Date(
                                          attachment.createdAt,
                                        ).toLocaleString()}
                                      </div>
                                      {attachment.isRemoved && (
                                        <div className="small text-muted mt-1">
                                          Removed {attachment.removedAt
                                            ? new Date(attachment.removedAt).toLocaleString()
                                            : ""}
                                          {attachment.removalReason
                                            ? ` · Reason: ${attachment.removalReason}`
                                            : ""}
                                        </div>
                                      )}
                                    </div>
                                    {!attachment.isRemoved && (
                                      <div className="d-flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-success"
                                          onClick={() => handleDownloadAttachment(
                                            attachment.id,
                                            attachment.originalFilename,
                                          )}
                                          disabled={downloadingAttachmentId === attachment.id}
                                        >
                                          {downloadingAttachmentId === attachment.id
                                            ? "Downloading..."
                                            : "Download"}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={() =>
                                            handleRequestRemoveAttachment(attachment.id)
                                          }
                                          disabled={removingAttachmentId === attachment.id}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {removalTargetId === attachment.id &&
                                    !attachment.isRemoved && (
                                      <form
                                        className="border-top mt-3 pt-3"
                                        onSubmit={handleRemoveAttachment}
                                      >
                                        <p className="small mb-2">
                                          Confirm removal. This file will no longer be available for download or preview.
                                        </p>
                                        <label
                                          htmlFor={`attachment-removal-reason-${attachment.id}`}
                                          className="form-label fw-semibold"
                                        >
                                          Reason for removal <span className="text-danger">*</span>
                                        </label>
                                        <textarea
                                          id={`attachment-removal-reason-${attachment.id}`}
                                          className="form-control"
                                          rows={2}
                                          maxLength={250}
                                          value={removalReason}
                                          disabled={removingAttachmentId === attachment.id}
                                          onChange={(event) =>
                                            setRemovalReason(event.target.value)
                                          }
                                          required
                                        />
                                        <div className="form-text">
                                          {removalReason.length}/250 characters
                                        </div>
                                        <div className="d-flex flex-wrap gap-2 mt-2">
                                          <button
                                            type="submit"
                                            className="btn btn-sm btn-danger"
                                            disabled={
                                              removalReason.trim().length === 0 ||
                                              removingAttachmentId === attachment.id
                                            }
                                          >
                                            {removingAttachmentId === attachment.id
                                              ? "Removing..."
                                              : "Confirm removal"}
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            disabled={removingAttachmentId === attachment.id}
                                            onClick={() => {
                                              setRemovalTargetId(null);
                                              setRemovalReason("");
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="row g-3 border-top pt-3">
                          <div className="col-md-6">
                            <div className="small text-muted">Created</div>
                            <div>
                              {new Date(
                                selectedTicketDetail.createdAt,
                              ).toLocaleString()}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="small text-muted">
                              Last Updated
                            </div>
                            <div>
                              {new Date(
                                selectedTicketDetail.updatedAt,
                              ).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                </div>
              </div>
            )}

            {/* Lab 1 System Status - kept as a secondary utility */}
            {appView === "tickets" && (
              <details className="card shadow-sm mb-4">
                <summary
                  className="card-body fw-semibold"
                  style={{ cursor: "pointer" }}
                >
                  System Status
                </summary>
                <div className="card-body border-top">
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={handleCheck}
                    disabled={state === "loading"}
                  >
                    {state === "loading"
                      ? "Checking..."
                      : "Check System"}
                  </button>

                  {state === "success" && (
                    <div className="mt-3">
                      <div className="alert alert-success">
                        Backend status: <strong>Online</strong>
                      </div>

                      <h3 className="h6">
                        Supported Request Categories
                      </h3>
                      <ol className="list-group list-group-numbered">
                        {categories.map((category) => (
                          <li
                            className="list-group-item"
                            key={category.id}
                          >
                            {category.name}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {state === "error" && (
                    <div className="alert alert-danger mt-3">
                      Backend status: <strong>Offline</strong>
                      <div>
                        Unable to connect to the TokTickIT API.
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </>
      )}
    </div>
  );
}
