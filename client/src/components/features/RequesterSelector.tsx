import { useState } from "react";
import { useRequester } from "../../context/RequesterContext.js";
import { Button } from "../ui/Button.js";
import { Select } from "../ui/Select.js";
import { Alert } from "../ui/Alert.js";
import { Spinner } from "../ui/Spinner.js";

interface RequesterSelectorProps {
  onSelected?: () => void;
}

export function RequesterSelector({ onSelected }: RequesterSelectorProps) {
  const { requesters, loading, error, loadRequesters, selectRequester } =
    useRequester();
  const [selectedId, setSelectedId] = useState<string>("");

  async function handleContinue() {
    const r = requesters.find((x) => String(x.id) === selectedId);
    if (!r) return;
    selectRequester(r);
    onSelected?.();
  }

  return (
    <div className="requester-select__screen">
      <div className="requester-select__card">
        <h1 className="requester-select__title">TokTickIT</h1>
        <p className="requester-select__subtitle">
          Select a Requester (Development Mode)
        </p>

        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spinner large />
          </div>
        )}

        {error && !loading && (
          <Alert variant="warning">
            Failed to load requesters: {error}
            <div style={{ marginTop: "12px" }}>
              <Button variant="secondary" onClick={loadRequesters}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {!loading && !error && requesters.length === 0 && (
          <Alert variant="warning">
            No active requesters found. Please run the database seed.
          </Alert>
        )}

        {!loading && !error && requesters.length > 0 && (
          <>
            <form
              className="requester-select__form"
              onSubmit={(e) => {
                e.preventDefault();
                handleContinue();
              }}
            >
              <Select
                label="Select Requester"
                required
                data-testid="requester-select"
                placeholder="Choose a requester…"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                options={requesters.map((r) => ({
                  value: r.id,
                  label: `${r.name} (${r.email})`,
                }))}
              />
              <Button
                type="submit"
                block
                data-testid="continue-btn"
                disabled={!selectedId}
              >
                Continue
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
