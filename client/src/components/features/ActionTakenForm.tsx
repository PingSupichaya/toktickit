import { useState } from "react";
import type { ActionTaken, CreateActionTakenInput } from "../../api.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Textarea } from "../ui/Textarea.js";
import { Toggle } from "../ui/Toggle.js";

// Create/edit form for an Action Taken (ui-spec §6.3). Rendered inside a
// SidePanel by the parent; hidden `version` is tracked by the parent for
// 409 STALE_UPDATE recovery.
export interface ActionTakenFormValues {
  actionAtLocal: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

export function actionTakenToFormValues(action: ActionTaken): ActionTakenFormValues {
  return {
    actionAtLocal: toLocalInputValue(new Date(action.actionAt)),
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? "",
    attachmentNotes: action.attachmentNotes ?? "",
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// datetime-local value in the browser's local time zone (yyyy-MM-ddTHH:mm).
export function toLocalInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function defaultFormValues(): ActionTakenFormValues {
  return {
    actionAtLocal: toLocalInputValue(new Date()),
    description: "",
    result: "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

interface ActionTakenFormProps {
  initial: ActionTakenFormValues;
  // Shown as static text in edit mode only, never as an input (ui-spec §6.3).
  performerName?: string;
  busy: boolean;
  serverErrors: Record<string, string>;
  onSubmit: (input: CreateActionTakenInput) => void;
  onCancel: () => void;
}

export function ActionTakenForm({
  initial,
  performerName,
  busy,
  serverErrors,
  onSubmit,
  onCancel,
}: ActionTakenFormProps) {
  const [actionAtLocal, setActionAtLocal] = useState(initial.actionAtLocal);
  const [description, setDescription] = useState(initial.description);
  const [result, setResult] = useState(initial.result);
  const [followUpRequired, setFollowUpRequired] = useState(initial.followUpRequired);
  const [followUpNote, setFollowUpNote] = useState(initial.followUpNote);
  const [attachmentNotes, setAttachmentNotes] = useState(initial.attachmentNotes);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nowLocal = toLocalInputValue(new Date());

  function handleToggle(next: boolean) {
    setFollowUpRequired(next);
    // Hidden and cleared when the toggle is off (ui-spec §6.3); the backend
    // additionally auto-clears any stale note (BR-04).
    if (!next) {
      setFollowUpNote("");
      setErrors((prev) => {
        const { followUpNote: _dropped, ...rest } = prev;
        return rest;
      });
    }
  }

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!actionAtLocal) {
      next.actionAt = "Action date/time is required";
    } else {
      const picked = new Date(actionAtLocal);
      if (Number.isNaN(picked.getTime())) {
        next.actionAt = "Action date/time is invalid";
      } else if (picked.getTime() > Date.now()) {
        next.actionAt = "Date cannot be in the future";
      }
    }
    if (description.trim().length < 1 || description.trim().length > 2000) {
      next.description = "Description must be between 1 and 2000 characters";
    }
    if (result.trim().length < 1 || result.trim().length > 2000) {
      next.result = "Result must be between 1 and 2000 characters";
    }
    if (followUpRequired && followUpNote.trim().length < 1) {
      next.followUpNote = "Required when follow-up is needed";
    }
    if (attachmentNotes.trim().length > 500) {
      next.attachmentNotes = "Attachment notes must be at most 500 characters";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({
      actionAt: new Date(actionAtLocal).toISOString(),
      description: description.trim(),
      result: result.trim(),
      followUpRequired,
      ...(followUpRequired ? { followUpNote: followUpNote.trim() } : {}),
      ...(attachmentNotes.trim() !== "" ? { attachmentNotes: attachmentNotes.trim() } : {}),
    });
  }

  const fieldError = (field: string): string | undefined =>
    errors[field] ?? serverErrors[field];

  return (
    <div className="action-form">
      {performerName !== undefined && (
        <p className="action-form__performer" data-testid="action-performer-static">
          Performed by {performerName}
        </p>
      )}

      <div className={`field${fieldError("actionAt") ? " field--error" : ""}`}>
        <label
          className="field__label field__label--required"
          htmlFor="action-datetime-field"
        >
          Action Date/Time
        </label>
        <input
          id="action-datetime-field"
          type="datetime-local"
          className="input"
          required
          max={nowLocal}
          value={actionAtLocal}
          disabled={busy}
          aria-invalid={fieldError("actionAt") ? true : undefined}
          data-testid="action-datetime-input"
          onChange={(e) => setActionAtLocal(e.target.value)}
        />
        {fieldError("actionAt") && (
          <span className="field__error" role="alert" data-testid="action-datetime-error">
            {fieldError("actionAt")}
          </span>
        )}
      </div>

      <Textarea
        label="Action Description"
        required
        maxLength={2000}
        value={description}
        disabled={busy}
        error={fieldError("description")}
        errorTestId="action-description-error"
        data-testid="action-description-input"
        onChange={(e) => setDescription(e.target.value)}
      />

      <Textarea
        label="Result"
        required
        maxLength={2000}
        value={result}
        disabled={busy}
        error={fieldError("result")}
        errorTestId="action-result-error"
        data-testid="action-result-input"
        onChange={(e) => setResult(e.target.value)}
      />

      <Toggle
        label="Follow-Up Required?"
        checked={followUpRequired}
        onChange={handleToggle}
        data-testid="action-followup-toggle"
      />

      {followUpRequired && (
        <Textarea
          label="Follow-up Note"
          required
          maxLength={1000}
          value={followUpNote}
          disabled={busy}
          error={fieldError("followUpNote")}
          errorTestId="action-followup-note-error"
          data-testid="action-followup-note-input"
          onChange={(e) => setFollowUpNote(e.target.value)}
        />
      )}

      <Input
        label="Attachment Notes"
        maxLength={500}
        hint="e.g. 'See diagnostic_log_2.pdf on the shared drive.'"
        value={attachmentNotes}
        disabled={busy}
        error={fieldError("attachmentNotes")}
        errorTestId="action-attachment-notes-error"
        data-testid="action-attachment-notes-input"
        onChange={(e) => setAttachmentNotes(e.target.value)}
      />

      {serverErrors.general && (
        <Alert variant="error" role="alert" data-testid="action-form-error">
          {serverErrors.general}
        </Alert>
      )}

      <div className="action-form__actions">
        <Button
          variant="primary"
          busy={busy}
          data-testid="save-action-btn"
          onClick={handleSubmit}
        >
          Save Action Taken
        </Button>
        <Button
          variant="secondary"
          data-testid="cancel-action-btn"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
