import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCheck() {
    setState("loading");
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div>
          <div>
            System status: <span className="text-success">Online</span>
          </div>
          <br/><h5>Categories List</h5>
          <div className="text-muted small mt-1">
            Fetched {categories.length} {categories.length === 1 ? "category" : "categories"} from
            the API.
          </div>
          <ul className="list-group mt-3">
            {categories.map((category) => (
              <li key={category.id} className="list-group-item">
                {category.id}. {category.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state === "error" && (
        <div>
          System status: <span className="text-danger">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
