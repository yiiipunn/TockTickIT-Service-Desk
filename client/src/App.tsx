import { useEffect, useState } from "react";
import {
  checkSystem,
  Category,
  DevelopmentRequester,
  getRequesters,
} from "./api.js";

// UI states used for checking the system status.
type UiState = "idle" | "loading" | "success" | "error";

// UI states used for loading development requesters.
type RequesterState = "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  const [requesterState, setRequesterState] =
    useState<RequesterState>("loading");
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(
    null
  );
  const [currentRequester, setCurrentRequester] =
    useState<DevelopmentRequester | null>(null);

  useEffect(() => {
    loadRequesters();
  }, []);

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

  function handleContinue() {
    const requester =
      requesters.find(
        (requester) => requester.id === selectedRequesterId
      ) ?? null;

    setCurrentRequester(requester);
  }

  function handleChangeRequester() {
    setCurrentRequester(null);
    setSelectedRequesterId(null);
  }

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <h1 className="h3 mb-2">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <p className="text-muted mb-4">
        Requester Ticketing MVP
      </p>

      {/* Development Requester Context */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Development Requester</h2>

          {currentRequester ? (
            <>
              <div className="alert alert-success mb-3">
                <div>
                  Current requester:{" "}
                  <strong>{currentRequester.name}</strong>
                </div>

                <div className="small">
                  {currentRequester.email}
                </div>
              </div>

              <button
                className="btn btn-outline-success"
                onClick={handleChangeRequester}
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

                  <button
                    className="btn btn-danger"
                    onClick={loadRequesters}
                  >
                    Retry
                  </button>
                </div>
              )}

              {requesterState === "success" &&
                requesters.length === 0 && (
                  <div className="alert alert-warning mb-0">
                    No active development requesters are available.
                  </div>
                )}

              {requesterState === "success" &&
                requesters.length > 0 && (
                  <>
                    <p className="text-muted">
                      Select a requester before continuing.
                    </p>

                    <select
                      className="form-select mb-3"
                      value={selectedRequesterId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;

                        setSelectedRequesterId(
                          value === "" ? null : Number(value)
                        );
                      }}
                    >
                      <option value="">
                        Select a development requester
                      </option>

                      {requesters.map((requester) => (
                        <option
                          key={requester.id}
                          value={requester.id}
                        >
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
            <div className="alert alert-danger mt-4">
              Backend status: <strong>Offline</strong>
              <div>
                Unable to connect to the TokTickIT API.
              </div>
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