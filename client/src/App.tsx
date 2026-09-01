import { FormEvent, useEffect, useState } from "react";
import {
  Category,
  checkSystem,
  createTicket,
  DevelopmentRequester,
  getCategories,
  getRelatedSystems,
  getRequesters,
  RelatedSystem,
  RequestedPriority,
  Ticket,
} from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";
type RequesterState = "loading" | "success" | "error";
type ReferenceDataState = "idle" | "loading" | "success" | "error";
type SubmitState = "idle" | "submitting" | "success" | "error";

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

  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(
    null
  );

  const [currentRequester, setCurrentRequester] =
    useState<DevelopmentRequester | null>(null);

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

  const [relatedSystemId, setRelatedSystemId] = useState<number | null>(null);

  const [summary, setSummary] = useState("");

  const [requestedPriority, setRequestedPriority] =
    useState<RequestedPriority>("MEDIUM");

  const [description, setDescription] = useState("");

  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  const [submitError, setSubmitError] = useState("");

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
        (requester) => requester.id === selectedRequesterId
      ) ?? null;

    if (!requester) {
      return;
    }

    setCurrentRequester(requester);

    await loadTicketReferenceData();
  }

  function handleChangeRequester() {
    setCurrentRequester(null);
    setSelectedRequesterId(null);

    resetTicketForm();

    setTicketCategories([]);
    setRelatedSystems([]);
    setReferenceDataState("idle");
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

    // Prevent duplicate submission while the request is in progress.
    if (submitState === "submitting") {
      return;
    }

    setSubmitState("submitting");
    setSubmitError("");
    setCreatedTicket(null);

    try {
      const ticket = await createTicket(currentRequester.id, {
        categoryId,
        relatedSystemId,
        summary,
        requestedPriority,
        description,
      });

      setCreatedTicket(ticket);
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
  }

  function handleCreateAnotherTicket() {
    resetTicketForm();
  }

  const formIsValid =
    categoryId !== null &&
    relatedSystemId !== null &&
    summary.trim().length >= 1 &&
    summary.trim().length <= 120 &&
    description.trim().length >= 1 &&
    description.trim().length <= 2000;

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <h1 className="h3 mb-2">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <p className="text-muted mb-4">Requester Ticketing MVP</p>

      {/* Development Requester Context */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Development Requester</h2>

          {currentRequester ? (
            <>
              <div className="alert alert-success mb-3">
                <div>
                  Current requester: <strong>{currentRequester.name}</strong>
                </div>

                <div className="small">{currentRequester.email}</div>
              </div>

              <button
                className="btn btn-outline-success"
                onClick={handleChangeRequester}
                disabled={submitState === "submitting"}
              >
                Change Requester
              </button>
            </>
          ) : (
            <>
              {requesterState === "loading" && (
                <div className="text-muted">
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
                  <p className="text-muted">
                    Select a requester before continuing.
                  </p>

                  <select
                    className="form-select mb-3"
                    aria-label="Development Requester"
                    value={selectedRequesterId ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;

                      setSelectedRequesterId(
                        value === "" ? null : Number(value)
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

                  <button
                    className="btn btn-success"
                    onClick={handleContinue}
                    disabled={selectedRequesterId === null}
                  >
                    Continue
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Ticket */}
      {currentRequester && (
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <h2 className="h5 mb-2">Create Ticket</h2>

            <p className="text-muted">
              Tell us about the issue you need help with.
            </p>

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
                <div className="alert alert-success mb-0">
                  <h3 className="h6">Ticket created successfully</h3>

                  <p className="mb-1">
                    Ticket Number:{" "}
                    <strong>{createdTicket.ticketNumber}</strong>
                  </p>

                  <p className="mb-3">
                    Status: <strong>{createdTicket.status}</strong>
                  </p>

                  <button
                    className="btn btn-success"
                    onClick={handleCreateAnotherTicket}
                  >
                    Create Another Ticket
                  </button>
                </div>
              )}

            {referenceDataState === "success" &&
              ticketCategories.length > 0 &&
              relatedSystems.length > 0 &&
              submitState !== "success" && (
                <form onSubmit={handleCreateTicket}>
                  <div className="mb-3">
                    <label htmlFor="ticket-category" className="form-label">
                      Category
                    </label>

                    <select
                      id="ticket-category"
                      className="form-select"
                      value={categoryId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;

                        setCategoryId(value === "" ? null : Number(value));
                      }}
                      disabled={submitState === "submitting"}
                      required
                    >
                      <option value="">Select a category</option>

                      {ticketCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
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
                          value === "" ? null : Number(value)
                        );
                      }}
                      disabled={submitState === "submitting"}
                      required
                    >
                      <option value="">Select a related system</option>

                      {relatedSystems.map((system) => (
                        <option key={system.id} value={system.id}>
                          {system.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="ticket-summary" className="form-label">
                      Summary
                    </label>

                    <input
                      id="ticket-summary"
                      className="form-control"
                      type="text"
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      maxLength={120}
                      disabled={submitState === "submitting"}
                      required
                    />

                    <div className="form-text">
                      {summary.length}/120 characters
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="ticket-priority" className="form-label">
                      Requested Priority
                    </label>

                    <select
                      id="ticket-priority"
                      className="form-select"
                      value={requestedPriority}
                      onChange={(event) =>
                        setRequestedPriority(
                          event.target.value as RequestedPriority
                        )
                      }
                      disabled={submitState === "submitting"}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="ticket-description" className="form-label">
                      Description
                    </label>

                    <textarea
                      id="ticket-description"
                      className="form-control"
                      rows={5}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={2000}
                      disabled={submitState === "submitting"}
                      required
                    />

                    <div className="form-text">
                      {description.length}/2000 characters
                    </div>
                  </div>

                  {submitState === "error" && (
                    <div className="alert alert-danger">
                      {submitError || "Unable to create ticket"}
                    </div>
                  )}

                  <button
                    className="btn btn-success"
                    type="submit"
                    disabled={
                      !formIsValid || submitState === "submitting"
                    }
                  >
                    {submitState === "submitting"
                      ? "Creating Ticket..."
                      : "Create Ticket"}
                  </button>
                </form>
              )}
          </div>
        </div>
      )}

      {/* Lab 1 System Check */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-3">System Status</h2>

          <button
            className="btn btn-success"
            onClick={handleCheck}
            disabled={state === "loading"}
          >
            {state === "loading" ? "Loading..." : "Check System"}
          </button>

          {state === "success" && (
            <div className="mt-4">
              <div className="alert alert-success">
                Backend status: <strong>Online</strong>
              </div>

              <h3 className="h6">Supported Request Categories</h3>

              <ol className="list-group list-group-numbered">
                {categories.map((category) => (
                  <li className="list-group-item" key={category.id}>
                    {category.name}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {state === "error" && (
            <div className="alert alert-danger mt-4">
              Backend status: <strong>Offline</strong>

              <div>Unable to connect to the TokTickIT API.</div>
            </div>
          )}
        </div>
      </div>

      <p className="small text-muted mt-4">
        Development Requester Selection is used for Lab 2 testing only and is
        not an authentication system.
      </p>
    </div>
  );
}