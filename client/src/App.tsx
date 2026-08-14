import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states used for checking the system status.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

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
        <div className="mt-4">
          <div className="alert alert-success">
            Backend status: <strong>Online</strong>
          </div>

          <h2 className="h5">Supported Request Categories</h2>

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
  );
}