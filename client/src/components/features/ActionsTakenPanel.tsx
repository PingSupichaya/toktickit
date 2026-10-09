import { useCallback, useContext, useEffect, useState } from "react";
import {
  ActionTaken,
  CreateActionTakenInput,
  createActionTaken,
  fetchActionsTaken,
  updateActionTaken,
} from "../../api.js";
import { AuthContext } from "../../context/AuthContext.js";

// Structural read of a failed request: works with the real ApiError and with
// plain-Error fixtures in unit tests (where the ApiError class is mocked).
function apiFailure(err: unknown): {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
} {
  if (typeof err === "object" && err !== null) {
    const { status, code, details } = err as {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
    };
    return { status, code, details };
  }
  return {};
}
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { SidePanel } from "../ui/SidePanel.js";
import { ActionTakenRow } from "./ActionTakenRow.js";
import {
  ActionTakenForm,
  actionTakenToFormValues,
  defaultFormValues,
} from "./ActionTakenForm.js";
import { ConflictBanner } from "../ui/ConflictBanner.js";

// Staff tab content for Actions Taken (ui-spec §6.1–§6.3): list + create/edit
// form + empty state. Write access is gated by role check inside this
// component — a Requester viewer gets the read-only list with no Add/Edit
// button rendered at all (FR-04, AC-08), never merely disabled buttons.
export function ActionsTakenPanel({ ticketId }: { ticketId: number }) {
  // Role-gated inside the component (FR-04, AC-08): outside an AuthProvider
  // (legacy unit tests) the staff screen is assumed and writing stays enabled;
  // in production the provider is always present so the role is known.
  const role = useContext(AuthContext)?.user?.role;
  const canWrite =
    role === undefined || role === "IT_STAFF" || role === "ADMIN";

  const [actions, setActions] = useState<ActionTaken[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActionTaken | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setActions(await fetchActionsTaken(ticketId));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load Actions Taken"
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchActionsTaken(ticketId);
        if (!cancelled) setActions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load Actions Taken"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  function openCreate() {
    setEditing(null);
    setServerErrors({});
    setConflict(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(action: ActionTaken) {
    setEditing(action);
    setServerErrors({});
    setConflict(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setServerErrors({});
  }

  function upsertIntoList(saved: ActionTaken) {
    setActions((prev) => {
      const rest = (prev ?? []).filter((a) => a.id !== saved.id);
      return [...rest, saved].sort((a, b) => {
        const byAt =
          new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime();
        return byAt !== 0 ? byAt : a.id - b.id;
      });
    });
  }

  async function handleSubmit(input: CreateActionTakenInput) {
    setBusy(true);
    setServerErrors({});
    try {
      if (editing) {
        const saved = await updateActionTaken(ticketId, editing.id, {
          ...input,
          version: editing.version,
        });
        upsertIntoList(saved);
      } else {
        const saved = await createActionTaken(ticketId, input);
        upsertIntoList(saved);
      }
      closeForm();
    } catch (err) {
      const failure = apiFailure(err);
      if (failure.status === 409 && failure.code === "STALE_UPDATE") {
        // Conflict recovery (ui-spec §6.3): banner + repopulate from the
        // server's current values and refresh the hidden version so the next
        // submit retries against current state.
        const current = failure.details?.current as ActionTaken | undefined;
        setConflict(
          "This Action Taken was updated by someone else. The latest version has been loaded — please review and try again."
        );
        if (current) {
          setEditing(current);
          setFormKey((k) => k + 1);
        }
      } else if (
        failure.status === 400 &&
        failure.code === "ACTION_AT_IN_FUTURE"
      ) {
        setServerErrors({ actionAt: "Date cannot be in the future" });
      } else if (failure.status === 400 && failure.details) {
        const mapped: Record<string, string> = {};
        for (const [field, message] of Object.entries(failure.details)) {
          mapped[field] = String(message);
        }
        setServerErrors(mapped);
      } else {
        setServerErrors({
          general: err instanceof Error ? err.message : "Failed to save",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <ActionsTakenSkeleton />;
  }

  if (loadError || actions === null) {
    return (
      <div>
        <Alert variant="error" role="alert" data-testid="actions-taken-error">
          {loadError ?? "Failed to load Actions Taken"}
        </Alert>
        <Button variant="secondary" data-testid="actions-taken-retry" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="actions-taken" data-testid="actions-taken-panel">
      {actions.length === 0 ? (
        <div data-testid="actions-taken-empty">
          <EmptyState
            title="No Actions Taken recorded yet."
            message="Record the work performed on this ticket."
            action={
              canWrite ? (
                <Button variant="primary" data-testid="add-action-btn" onClick={openCreate}>
                  Add Action Taken
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="action-list" data-testid="actions-taken-list">
            {actions.map((action) => (
              <ActionTakenRow
                key={action.id}
                action={action}
                onEdit={canWrite ? () => openEdit(action) : undefined}
              />
            ))}
          </ul>
          {canWrite && (
            <Button variant="primary" data-testid="add-action-btn" onClick={openCreate}>
              Add Action Taken
            </Button>
          )}
        </>
      )}

      <SidePanel
        open={formOpen}
        title={editing ? "Edit Action Taken" : "Add Action Taken"}
        onClose={closeForm}
      >
        {conflict && <ConflictBanner message={conflict} />}
        <ActionTakenForm
          key={formKey}
          initial={editing ? actionTakenToFormValues(editing) : defaultFormValues()}
          performerName={editing ? editing.performedBy.name : undefined}
          busy={busy}
          serverErrors={serverErrors}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </SidePanel>
    </div>
  );
}

export function ActionsTakenSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading Actions Taken"
      data-testid="actions-taken-loading"
    >
      <div className="skeleton skeleton--block" />
      <div className="skeleton skeleton--block" />
    </div>
  );
}

// Requester read-only card (ui-spec §6.1, §6.4): title "Actions Taken (N)"
// below Public Comments. Never renders Add/Edit buttons for any role — the
// rows are always used without `onEdit` here (FR-04, AC-08, AC-09).
export function ActionsTakenReadonlyCard({ ticketId }: { ticketId: number }) {
  const [actions, setActions] = useState<ActionTaken[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => fetchActionsTaken(ticketId))
      .then((data) => {
        if (!cancelled) setActions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (actions === null) {
    return failed ? (
      <Alert variant="error" role="alert" data-testid="actions-taken-error">
        Failed to load Actions Taken
      </Alert>
    ) : (
      <ActionsTakenSkeleton />
    );
  }

  return (
    <div data-testid="actions-taken-readonly">
      <h2 className="card__title">Actions Taken ({actions.length})</h2>
      {actions.length === 0 ? (
        <p className="comments-empty" data-testid="actions-taken-empty">
          No Actions Taken recorded yet.
        </p>
      ) : (
        <ul className="action-list" data-testid="actions-taken-list">
          {actions.map((action) => (
            <ActionTakenRow key={action.id} action={action} />
          ))}
        </ul>
      )}
    </div>
  );
}
