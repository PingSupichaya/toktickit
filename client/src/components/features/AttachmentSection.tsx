import { useEffect, useRef, useState } from "react";
import {
  Attachment,
  downloadAttachmentUrl,
  removeAttachment,
  uploadAttachment,
  formatTicketDate,
} from "../../api.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { Alert } from "../ui/Alert.js";
import { Modal } from "../ui/Modal.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|pdf)$/i;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;
  return ALLOWED_EXTENSIONS.test(file.name);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentSectionProps {
  ticketId: number;
  requesterId: number;
  attachments: Attachment[];
  onAttachmentRemoved?: (id: number) => void;
}

export function AttachmentSection({
  ticketId,
  requesterId,
  attachments,
  onAttachmentRemoved,
}: AttachmentSectionProps) {
  const [rows, setRows] = useState<Attachment[]>(attachments);
  const [pendingRemove, setPendingRemove] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalBusy, setRemovalBusy] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRows(attachments);
  }, [attachments]);

  const activeCount = rows.filter((a) => !a.isRemoved).length;
  const atLimit = activeCount >= MAX_ATTACHMENTS;

  function handleRemoveClick(attachment: Attachment) {
    setRemovalError(null);
    setRemovalReason("");
    setPendingRemove(attachment);
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemovalBusy(true);
    setRemovalError(null);
    try {
      const updated = await removeAttachment(
        pendingRemove.id,
        requesterId,
        removalReason.trim() || undefined
      );
      setRows((prev) =>
        prev.map((a) =>
          a.id === pendingRemove.id
            ? { ...a, isRemoved: true, removedAt: updated.removedAt, removalReason: updated.removalReason }
            : a
        )
      );
      onAttachmentRemoved?.(pendingRemove.id);
      setPendingRemove(null);
    } catch (err) {
      setRemovalError(err instanceof Error ? err.message : "Failed to remove attachment");
    } finally {
      setRemovalBusy(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    setUploadError(null);

    const rejections: string[] = [];
    const accepted: File[] = [];
    for (const file of chosen) {
      if (!isAllowedFile(file)) {
        rejections.push(`${file.name} is not an allowed file type`);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        rejections.push(`${file.name} exceeds the 5 MB limit`);
      } else {
        accepted.push(file);
      }
    }
    const remaining = MAX_ATTACHMENTS - activeCount;
    if (accepted.length > remaining) {
      accepted.length = remaining;
      rejections.push("Maximum 5 attachments per ticket");
    }
    if (rejections.length > 0) setUploadError(rejections.join("; "));

    if (accepted.length === 0) return;
    setUploading(true);
    try {
      for (const file of accepted) {
        const uploaded = await uploadAttachment(ticketId, requesterId, file);
        setRows((prev) => [...prev, { ...uploaded, isRemoved: false }]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="attachments-section" data-testid="attachments-section">
      <h2 className="card__title attachments-section__title" data-testid="attachment-count">
        Attachments ({activeCount} active)
      </h2>

      {rows.length === 0 ? (
        <EmptyState
          title="No attachments yet"
          message="Upload screenshots or evidence to help IT resolve this ticket faster."
        />
      ) : (
        <ul className="attachment-list attachment-list--detail">
          {rows.map((attachment) =>
            attachment.isRemoved ? (
              <li
                key={attachment.id}
                className="attachment-row attachment-row--removed"
                data-testid={`attachment-removed-${attachment.id}`}
                aria-label={`Removed attachment: ${attachment.originalFilename}`}
              >
                <span className="attachment-row__icon" aria-hidden="true">
                  📎
                </span>
                <span className="attachment-row__meta">
                  <span className="attachment-row__name">{attachment.originalFilename}</span>
                  <span className="attachment-row__detail">
                    {formatBytes(attachment.fileSizeBytes)} ·{" "}
                    {formatTicketDate(attachment.uploadedAt)}
                    {attachment.removalReason
                      ? ` · Removed ${attachment.removedAt ? formatTicketDate(attachment.removedAt) : ""}`
                      : ""}
                  </span>
                </span>
                <span className="attachment-row__status">
                  <span className="badge badge--neutral">Removed</span>
                  {attachment.removalReason && (
                    <span className="attachment-row__reason">
                      {attachment.removalReason}
                    </span>
                  )}
                </span>
              </li>
            ) : (
              <li
                key={attachment.id}
                className="attachment-row"
                data-testid={`attachment-${attachment.id}`}
              >
                <span className="attachment-row__icon" aria-hidden="true">
                  📎
                </span>
                <span className="attachment-row__meta">
                  <a
                    className="attachment-row__download"
                    href={downloadAttachmentUrl(attachment.id, requesterId)}
                    data-testid={`attachment-download-${attachment.id}`}
                  >
                    {attachment.originalFilename}
                  </a>
                  <span className="attachment-row__detail">
                    {formatBytes(attachment.fileSizeBytes)} ·{" "}
                    {formatTicketDate(attachment.uploadedAt)}
                  </span>
                </span>
                <span className="attachment-row__actions">
                  <Button
                    variant="ghost"
                    className="attachment-row__btn attachment-row__btn--danger"
                    data-testid="remove-attachment-btn"
                    onClick={() => handleRemoveClick(attachment)}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            )
          )}
        </ul>
      )}

      {uploadError && (
        <Alert variant="error" data-testid="attachments-upload-error" role="alert">
          {uploadError}
        </Alert>
      )}

      {atLimit ? (
        <div className="attachment-max" data-testid="attachment-max" role="status">
          Maximum {MAX_ATTACHMENTS} attachments reached
        </div>
      ) : (
        <div className="field attachments-field">
          <span className="field__label">Add attachments</span>
          <div className="upload-zone" data-testid="upload-zone">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              data-testid="attachment-input"
              aria-label="Add attachments"
              tabIndex={-1}
              disabled={uploading}
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="upload-zone__inner"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <span className="upload-zone__icon" aria-hidden="true">
                📎
              </span>
              <span className="upload-zone__title">
                Click to browse or drag &amp; drop files
              </span>
              <span className="upload-zone__hint">JPG, PNG, WEBP, PDF (max 5 MB)</span>
            </button>
          </div>
        </div>
      )}

      <Modal
        open={pendingRemove !== null}
        title="Remove Attachment"
        onClose={() => setPendingRemove(null)}
      >
        <p className="modal__text">
          Are you sure you want to remove{" "}
          <strong>{pendingRemove?.originalFilename}</strong>? This cannot be undone.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="removal-reason">
            Reason (optional)
          </label>
          <input
            id="removal-reason"
            className="input"
            data-testid="removal-reason"
            value={removalReason}
            maxLength={500}
            onChange={(e) => setRemovalReason(e.target.value)}
            placeholder="e.g. Wrong file uploaded"
          />
        </div>
        {removalError && (
          <Alert variant="error" role="alert" data-testid="removal-error">
            {removalError}
          </Alert>
        )}
        <div className="modal__footer">
          <Button
            variant="ghost"
            data-testid="cancel-remove-btn"
            disabled={removalBusy}
            onClick={() => setPendingRemove(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={removalBusy}
            data-testid="confirm-remove-btn"
            onClick={confirmRemove}
          >
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}