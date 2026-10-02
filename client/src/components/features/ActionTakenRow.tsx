import type { ActionTaken } from "../../api.js";
import { RoleBadge } from "../ui/RoleBadge.js";

// Single Actions Taken row/card (ui-spec §6.2). Read-only by default; the
// Edit button renders only when `onEdit` is provided — Requester views never
// pass it, so no write control exists in the DOM at all (FR-04, AC-08).
export function formatActionDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ActionTakenRowProps {
  action: ActionTaken;
  onEdit?: () => void;
}

export function ActionTakenRow({ action, onEdit }: ActionTakenRowProps) {
  return (
    <li className="action-row" data-testid={`action-row-${action.id}`}>
      <div className="action-row__header">
        <span
          className="action-row__datetime"
          data-testid={`action-datetime-${action.id}`}
        >
          {formatActionDateTime(action.actionAt)}
        </span>
        <span className="action-row__performer">
          {action.performedBy.name}{" "}
          <RoleBadge role={action.performedBy.role} />
        </span>
        {onEdit && (
          <button
            type="button"
            className="btn btn--ghost action-row__edit"
            data-testid="edit-action-btn"
            data-action-id={action.id}
            onClick={onEdit}
          >
            Edit
          </button>
        )}
      </div>
      <p className="action-row__description">{action.description}</p>
      <p className="action-row__result">{action.result}</p>
      {action.followUpRequired && (
        <div className="action-row__followup">
          <span className="badge badge--warning">Follow-up required</span>
          {action.followUpNote && (
            <p className="action-row__followup-note">{action.followUpNote}</p>
          )}
        </div>
      )}
      {action.attachmentNotes && (
        <p className="action-row__attachment-notes">
          <em>{action.attachmentNotes}</em>
        </p>
      )}
    </li>
  );
}
