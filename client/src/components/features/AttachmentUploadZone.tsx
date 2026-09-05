import { useId, useRef, useState } from "react";
import { Button } from "../ui/Button.js";

export interface PendingAttachmentFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
}

interface AttachmentUploadZoneProps {
  files: PendingAttachmentFile[];
  disabled?: boolean;
  selectionDisabled?: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onRetryFile: (id: string) => void;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|pdf)$/i;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;
  return ALLOWED_EXTENSIONS.test(file.name);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentUploadZone({
  files,
  disabled = false,
  selectionDisabled = false,
  onAddFiles,
  onRemoveFile,
  onRetryFile,
}: AttachmentUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragover, setDragover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, MAX_FILES - files.length);
  const atLimit = remaining === 0;
  const addBlocked = disabled || selectionDisabled;

  function addFiles(newFiles: File[]) {
    setError(null);
    const rejections: string[] = [];
    const accepted: File[] = [];

    for (const file of newFiles) {
      if (!isAllowedFile(file)) {
        rejections.push(`${file.name} is not an allowed file type`);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        rejections.push(`${file.name} exceeds the 5 MB limit`);
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length > remaining) {
      accepted.length = remaining;
      rejections.push(`Maximum ${MAX_FILES} attachments per ticket`);
    }

    if (accepted.length > 0) {
      onAddFiles(accepted);
    }
    if (rejections.length > 0) {
      setError(rejections.join("; "));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (addBlocked || atLimit) return;
    addFiles(chosen);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragover(false);
    if (addBlocked || atLimit) return;
    addFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="field attachments-field" data-testid="attachments-field">
      <span className="field__label">
        Attachments <span className="field__label-optional">(optional)</span>
      </span>

      {atLimit ? (
        <div className="attachment-max" data-testid="attachment-max" role="status">
          Maximum 5 attachments reached
        </div>
      ) : (
        <div
          className={`upload-zone${dragover ? " upload-zone--dragover" : ""}${
            addBlocked ? " upload-zone--disabled" : ""
          }`}
          data-testid="upload-zone"
          onDragOver={(e) => {
            e.preventDefault();
            if (!addBlocked) setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            data-testid="attachment-input"
            aria-label="Attachments"
            tabIndex={-1}
            disabled={addBlocked}
            onChange={handleChange}
          />
          <button
            type="button"
            className="upload-zone__inner"
            disabled={addBlocked}
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
      )}

      {error && (
        <span className="field__error" role="alert" data-testid="attachment-error">
          {error}
        </span>
      )}

      {files.length > 0 && (
        <ul className="attachment-list">
          {files.map((item) => (
            <li
              key={item.id}
              className={`attachment-row${
                item.status === "failed" ? " attachment-row--failed" : ""
              }`}
              data-testid={`attachment-row-${item.id}`}
            >
              <span className="attachment-row__icon" aria-hidden="true">
                📎
              </span>
              <span className="attachment-row__meta">
                <span className="attachment-row__name">{item.file.name}</span>
                <span className="attachment-row__size">
                  {formatBytes(item.file.size)}
                </span>
              </span>
              <span className="attachment-row__status">
                {item.status === "uploading" && (
                  <>
                    <span className="spinner spinner--sm" aria-hidden="true" />
                    <span className="progress-bar" aria-hidden="true" />
                    Uploading…
                  </>
                )}
                {item.status === "uploaded" && <span>Uploaded</span>}
                {item.status === "failed" && (
                  <span className="attachment-row__error" role="alert">
                    {item.error ?? "Upload failed. Try again."}
                  </span>
                )}
              </span>
              {(item.status === "pending" || item.status === "failed") && (
                <span className="attachment-row__actions">
                  {item.status === "failed" && (
                    <Button
                      variant="ghost"
                      className="attachment-row__btn"
                      data-testid={`retry-attachment-${item.id}`}
                      onClick={() => onRetryFile(item.id)}
                      disabled={disabled}
                    >
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="attachment-row__btn"
                    data-testid={`remove-attachment-${item.id}`}
                    onClick={() => onRemoveFile(item.id)}
                    disabled={disabled}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}