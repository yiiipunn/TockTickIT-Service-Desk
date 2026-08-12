import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states used for checking the system status.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  void categories;
  void setCategories;

  async function handleCheck() {
    setState("loading");

    try {
      await checkSystem();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button
        className="btn btn-success"
        onClick={handleCheck}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="alert alert-success mt-4">
          Backend status: <strong>Online</strong>
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4">
          Backend status: <strong>Offline</strong>
          <div>Unable to connect to the TokTickIT API.</div>
        </div>
      )}

      {/* TODO(Issue 4): display categories after a successful system check. */}
    </div>
  );
}