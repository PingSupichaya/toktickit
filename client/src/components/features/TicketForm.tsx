import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  RequestedPriority,
  Ticket,
  createTicket,
  fetchCategories,
  fetchRelatedSystems,
  uploadAttachment,
} from "../../api.js";
import { useRequester } from "../../context/RequesterContext.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import { Select } from "../ui/Select.js";
import { Textarea } from "../ui/Textarea.js";
import {
  AttachmentUploadZone,
  PendingAttachmentFile,
} from "./AttachmentUploadZone.js";

const PRIORITIES: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];

const SUMMARY_MIN = 10;
const SUMMARY_MAX = 200;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 2000;

const SUMMARY_ERROR = "Summary must be between 10 and 200 characters";
const DESCRIPTION_ERROR =
  "Description must be between 20 and 2000 characters";

interface TicketFormProps {
  onCancel?: () => void;
}

interface Touched {
  summary: boolean;
  description: boolean;
}

export function validateSummary(value: string): string | null {
  const length = value.trim().length;
  if (length < SUMMARY_MIN || length > SUMMARY_MAX) {
    return SUMMARY_ERROR;
  }
  return null;
}

export function validateDescription(value: string): string | null {
  const length = value.trim().length;
  if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
    return DESCRIPTION_ERROR;
  }
  return null;
}

export function TicketForm({ onCancel }: TicketFormProps) {
  const { requester } = useRequester();

  const [categories, setCategories] = useState<
    { id: number; name: string }[]
  >([]);
  const [relatedSystems, setRelatedSystems] = useState<
    { id: number; name: string }[]
  >([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<string>("");
  const [relatedSystemId, setRelatedSystemId] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RequestedPriority | "">("");

  const [touched, setTouched] = useState<Touched>({
    summary: false,
    description: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Ticket | null>(null);

  const [attachmentFiles, setAttachmentFiles] = useState<PendingAttachmentFile[]>(
    []
  );
  const [createdTicketId, setCreatedTicketId] = useState<number | null>(null);

  const loadReferenceData = useCallback(async () => {
    setRefLoading(true);
    setRefError(null);
    try {
      const [cats, systems] = await Promise.all([
        fetchCategories(),
        fetchRelatedSystems(),
      ]);
      if (!Array.isArray(cats) || !Array.isArray(systems)) {
        throw new Error("Failed to load reference data");
      }
      setCategories(cats);
      setRelatedSystems(systems);
    } catch (err) {
      setRefError(
        err instanceof Error ? err.message : "Failed to load reference data"
      );
    } finally {
      setRefLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  const summaryError = validateSummary(summary);
  const descriptionError = validateDescription(description);

  const isFormValid =
    summaryError === null &&
    descriptionError === null &&
    categoryId !== "" &&
    relatedSystemId !== "" &&
    priority !== "";

  function resetForm() {
    setCategoryId("");
    setRelatedSystemId("");
    setSummary("");
    setDescription("");
    setPriority("");
    setTouched({ summary: false, description: false });
  }

  function createFileId(file: File): string {
    return `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
  }

  function addAttachmentFiles(newFiles: File[]) {
    if (success !== null) return;
    setAttachmentFiles((prev) => [
      ...prev,
      ...newFiles.map((file) => ({
        id: createFileId(file),
        file,
        status: "pending" as const,
      })),
    ]);
  }

  function removeAttachmentFile(id: string) {
    setAttachmentFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function setAttachmentStatus(
    id: string,
    status: PendingAttachmentFile["status"],
    extra?: Partial<PendingAttachmentFile>
  ) {
    setAttachmentFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, ...extra } : f))
    );
  }

  async function uploadFiles(
    ticketId: number,
    requesterId: number,
    targets: PendingAttachmentFile[]
  ) {
    for (const item of targets) {
      setAttachmentStatus(item.id, "uploading", { error: undefined });
      try {
        await uploadAttachment(ticketId, requesterId, item.file);
        setAttachmentStatus(item.id, "uploaded");
      } catch (err) {
        setAttachmentStatus(item.id, "failed", {
          error:
            err instanceof Error ? err.message : "Upload failed. Try again.",
        });
      }
    }
  }

  async function retryAttachmentFile(id: string) {
    if (!createdTicketId || !requester) return;
    const item = attachmentFiles.find((f) => f.id === id);
    if (!item) return;
    await uploadFiles(createdTicketId, requester.id, [item]);
  }

  function dismissSuccess() {
    setSuccess(null);
    setCreatedTicketId(null);
    setAttachmentFiles([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!requester || !isFormValid) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const ticket = await createTicket({
        requesterId: requester.id,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority: priority as RequestedPriority,
      });
      setSuccess(ticket);
      setCreatedTicketId(ticket.id);
      resetForm();
      if (attachmentFiles.length > 0) {
        await uploadFiles(
          ticket.id,
          requester.id,
          attachmentFiles.filter((f) => f.status !== "uploaded")
        );
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Failed to create ticket. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="create-ticket__form"
      onSubmit={handleSubmit}
      noValidate
    >
      {success && (
        <Alert variant="success" data-testid="success-banner">
          <span role="status">
            Ticket {success.ticketNumber} created successfully.
          </span>
          <Button
            variant="ghost"
            className="create-ticket__dismiss"
            data-testid="success-dismiss"
            onClick={dismissSuccess}
          >
            Dismiss
          </Button>
        </Alert>
      )}

      {serverError && !success && (
        <Alert variant="error" data-testid="error-banner">
          {serverError}
        </Alert>
      )}

      {refError && !success && (
        <Alert variant="error" data-testid="ref-error-banner">
          Failed to load reference data: {refError}
          <div style={{ marginTop: "12px" }}>
            <Button variant="secondary" onClick={loadReferenceData}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <Input
        label="Requester"
        id="requester"
        readonly
        disabled={submitting}
        value={
          requester ? `${requester.name} (${requester.email})` : "Not selected"
        }
      />

      {refLoading ? (
        <div className="field" aria-busy="true">
          <span className="field__label field__label--required">Category</span>
          <span
            className="skeleton select-skeleton"
            role="status"
            aria-label="Loading categories"
            data-testid="loading-categories"
          />
        </div>
      ) : (
        <Select
          label="Category"
          required
          data-testid="category-select"
          placeholder="Select a category…"
          value={categoryId}
          disabled={submitting}
          onChange={(v) => setCategoryId(String(v))}
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
        />
      )}

      {refLoading ? (
        <div className="field" aria-busy="true">
          <span className="field__label field__label--required">
            Related System
          </span>
          <span
            className="skeleton select-skeleton"
            role="status"
            aria-label="Loading related systems"
            data-testid="loading-related-systems"
          />
        </div>
      ) : (
        <Select
          label="Related System"
          required
          data-testid="related-system-select"
          placeholder="Select a related system…"
          value={relatedSystemId}
          disabled={submitting}
          onChange={(v) => setRelatedSystemId(String(v))}
          options={relatedSystems.map((s) => ({
            value: String(s.id),
            label: s.name,
          }))}
        />
      )}

      <Input
        label="Summary"
        required
        id="summary"
        data-testid="summary-input"
        errorTestId="error-summary"
        counterTestId="counter-summary"
        disabled={submitting}
        maxLength={SUMMARY_MAX}
        value={summary}
        placeholder="Brief description of the issue"
        error={
          touched.summary ? summaryError ?? undefined : undefined
        }
        onChange={(e) => setSummary(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, summary: true }))}
      />

      <Textarea
        label="Description"
        required
        id="description"
        data-testid="description-input"
        errorTestId="error-description"
        counterTestId="counter-description"
        disabled={submitting}
        maxLength={DESCRIPTION_MAX}
        placeholder="Full details of the issue"
        value={description}
        error={
          touched.description ? descriptionError ?? undefined : undefined
        }
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, description: true }))}
      />

      <fieldset className="field create-ticket__priority">
        <legend className="field__label field__label--required">
          Requested Priority
        </legend>
        <div className="radio-group">
          {PRIORITIES.map((p) => (
            <label key={p} className="radio-item">
              <input
                type="radio"
                name="requestedPriority"
                value={p}
                checked={priority === p}
                disabled={submitting}
                aria-required="true"
                className="radio-input"
                onChange={() => setPriority(p)}
              />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <AttachmentUploadZone
        files={attachmentFiles}
        disabled={submitting}
        selectionDisabled={success !== null}
        onAddFiles={addAttachmentFiles}
        onRemoveFile={removeAttachmentFile}
        onRetryFile={retryAttachmentFile}
      />

      <div className="create-ticket__actions">
        <Button
          type="submit"
          data-testid={submitting ? "submit-btn-busy" : "submit-btn"}
          busy={submitting}
          disabled={!isFormValid || refLoading || success !== null}
        >
          Submit Ticket
        </Button>
        <Button
          variant="secondary"
          data-testid="cancel-btn"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}