import { useEffect, useMemo, useState } from "react";
import {
  Attachment,
  EligibleOwner,
  PublicComment,
  RequestedPriority,
  TicketDetail as TicketDetailData,
  TicketStatus,
  assignOwner as apiAssignOwner,
  claimTicket as apiClaimTicket,
  formatTicketDate,
  downloadAttachmentUrl,
  fetchEligibleOwners,
  fetchTicketDetail,
  postComment as apiPostComment,
  postNote as apiPostNote,
  updateTicketOperational as apiUpdateTicketOperational,
} from "../../api.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Select } from "../ui/Select.js";
import { Textarea } from "../ui/Textarea.js";

const PRIORITY_OPTIONS: { value: RequestedPriority; label: string }[] = [
  { value: "LOW", label: "LOW" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "HIGH", label: "HIGH" },
];

type TabId = "comments" | "notes" | "attachments";

interface StaffTicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="badge badge--status"
      data-testid="status-badge"
      data-value={status}
    >
      {status}
    </span>
  );
}

function ReadOnlyField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId?: string;
}) {
  return (
    <div className="field field--readonly">
      <span className="field__label">{label}</span>
      <div className="field__readonly-value" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

function ThreadItem({
  item,
  marker,
}: {
  item: PublicComment;
  marker?: string;
}) {
  return (
    <li className="thread-item" data-testid={`thread-item-${item.id}`}>
      <span className="thread-item__meta">
        <span className="thread-item__author">{item.author.name}</span>
        {marker && <span className="thread-item__marker">{marker}</span>}
        {" · "}
        {formatTicketDate(item.createdAt)}
      </span>
      <p className="thread-item__content">{item.content}</p>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="staff-detail" data-testid="staff-ticket-detail-loading">
      <div className="breadcrumb">
        <span className="skeleton skeleton--sm" />
      </div>
      <div className="skeleton skeleton--title" />
      <Card>
        <div className="skeleton skeleton--block" />
        <div className="skeleton skeleton--block" />
      </Card>
      <Card>
        <div className="skeleton skeleton--block" />
      </Card>
    </div>
  );
}

const NOTE_VISIBILITY_HINT = "Internal only — not visible to Requesters";

export function StaffTicketDetail({
  ticketId,
  onBack,
}: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [eligibleOwners, setEligibleOwners] = useState<EligibleOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("comments");

  // Operational draft state.
  const [ownerSel, setOwnerSel] = useState<number | "">("");
  const [itPrioritySel, setItPrioritySel] = useState<RequestedPriority | "">("");
  const [statusSel, setStatusSel] = useState<TicketStatus | "">("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Comment / Note composer state.
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorStatus(null);
    setTicket(null);

    Promise.all([fetchTicketDetail(ticketId), fetchEligibleOwners()])
      .then(([data, owners]) => {
        if (cancelled) return;
        setTicket(data);
        setEligibleOwners(owners);
        setOwnerSel(data.owner?.id ?? "");
        setItPrioritySel(data.itPriority ?? data.requestedPriority);
        setStatusSel("");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorStatus((err as { status?: number })?.status ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const comments = ticket?.comments ?? [];
  const notes = ticket?.notes ?? [];
  const commentsNewestFirst = useMemo(() => [...comments].reverse(), [comments]);
  const notesNewestFirst = useMemo(() => [...notes].reverse(), [notes]);

  // The Owner select lists active IT_STAFF/ADMIN users. If the current owner is
  // not in that list (e.g. account deactivated), keep them selectable so the
  // control never renders with an unrepresentable value.
  const ownerOptions = useMemo(() => {
    const list = [...eligibleOwners];
    if (ticket?.owner && !list.some((o) => o.id === ticket.owner!.id)) {
      list.push({
        id: ticket.owner.id,
        name: ticket.owner.name,
        role: ticket.owner.role,
      });
    }
    return list;
  }, [eligibleOwners, ticket]);

  const transitions = ticket?.permittedStatusTransitions ?? [];
  const statusOptions = transitions.map((s) => ({ value: s, label: s }));

  function applyOperational(data: TicketDetailData) {
    setTicket((prev) =>
      prev
        ? { ...prev, ...data, comments: prev.comments, notes: prev.notes }
        : data
    );
    setOwnerSel(data.owner?.id ?? "");
    setItPrioritySel(data.itPriority ?? data.requestedPriority);
    setStatusSel("");
  }

  function appendThread(kind: "comments" | "notes", item: PublicComment) {
    if (kind === "comments") {
      setTicket((prev) =>
        prev ? { ...prev, comments: [...(prev.comments ?? []), item] } : prev
      );
    } else {
      setTicket((prev) =>
        prev ? { ...prev, notes: [...(prev.notes ?? []), item] } : prev
      );
    }
  }

  async function handleClaim() {
    if (!ticket) return;
    setSaveBusy(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const result = await apiClaimTicket(ticket.id);
      setTicket((prev) =>
        prev
          ? { ...prev, owner: result.owner, ownerId: result.owner.id }
          : prev
      );
      setOwnerSel(result.owner.id);
      setSaveSuccess("Ticket updated.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to claim this ticket"
      );
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleSave() {
    if (!ticket) return;
    setSaveBusy(true);
    setSaveError(null);
    setSaveSuccess(null);

    const itPriorityChanged =
      itPrioritySel !== "" &&
      itPrioritySel !== (ticket.itPriority ?? ticket.requestedPriority);
    const statusChanged = statusSel !== "";
    const ownerChanged =
      ownerSel !== "" && ownerSel !== ticket.ownerId;

    try {
      let data: TicketDetailData = ticket;
      if (itPriorityChanged || statusChanged) {
        data = await apiUpdateTicketOperational(ticket.id, {
          ...(itPriorityChanged
            ? { itPriority: itPrioritySel as RequestedPriority }
            : {}),
          ...(statusChanged
            ? { currentStatus: statusSel as TicketStatus }
            : {}),
        });
      }
      if (ownerChanged) {
        const result = await apiAssignOwner(ticket.id, Number(ownerSel));
        data = { ...data, ownerId: result.owner.id, owner: result.owner };
      }
      applyOperational(data);
      setSaveSuccess("Ticket updated.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes"
      );
    } finally {
      setSaveBusy(false);
    }
  }

  async function handlePostComment() {
    if (!ticket) return;
    const content = commentDraft.trim();
    if (content.length === 0) {
      setCommentError("Comment must not be empty");
      return;
    }
    setCommentBusy(true);
    setCommentError(null);
    try {
      const item = await apiPostComment(ticket.id, content);
      appendThread("comments", item);
      setCommentDraft("");
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Failed to post comment"
      );
    } finally {
      setCommentBusy(false);
    }
  }

  async function handlePostNote() {
    if (!ticket) return;
    const content = noteDraft.trim();
    if (content.length === 0) {
      setNoteError("Note must not be empty");
      return;
    }
    setNoteBusy(true);
    setNoteError(null);
    try {
      const item = await apiPostNote(ticket.id, content);
      appendThread("notes", item);
      setNoteDraft("");
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : "Failed to post note"
      );
    } finally {
      setNoteBusy(false);
    }
  }

  const backButton = (
    <Button
      variant="secondary"
      data-testid="cancel-btn"
      onClick={onBack}
    >
      Back to Ticket Queue
    </Button>
  );

  if (loading) return <DetailSkeleton />;

  if (errorStatus === 404) {
    return (
      <div className="staff-detail">
        <ErrorState title="Ticket not found." action={backButton} />
      </div>
    );
  }

  if (errorStatus === 403) {
    return (
      <div className="staff-detail">
        <ErrorState
          title="You are not authorized to view this ticket."
          action={backButton}
        />
      </div>
    );
  }

  if (errorStatus !== null) {
    return (
      <div className="staff-detail">
        <ErrorState
          title="Something went wrong"
          message="We couldn't load this ticket. Please try again."
          action={backButton}
        />
      </div>
    );
  }

  if (!ticket) return <DetailSkeleton />;

  const unassigned = ticket.owner == null;

  return (
    <div className="staff-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="breadcrumb__link" onClick={onBack}>
          Ticket Queue
        </button>
        <span className="breadcrumb__sep" aria-hidden="true">
          /
        </span>
        <span className="breadcrumb__current" data-testid="ticket-detail-number">
          {ticket.ticketNumber}
        </span>
      </nav>

      <h1 className="screen-title">Ticket Detail</h1>

      <Card className="ticket-detail__card">
        <div className="ticket-detail__grid">
          <ReadOnlyField
            label="Ticket Number"
            value={ticket.ticketNumber}
            testId="ticket-number"
          />
          <ReadOnlyField
            label="Ticket Date"
            value={formatTicketDate(ticket.ticketDate)}
            testId="ticket-date"
          />
          <ReadOnlyField label="Requester" value={ticket.submitter.name} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField
            label="Related System"
            value={ticket.relatedSystem.name}
          />
          <div className="field field--readonly">
            <span className="field__label">Requested Priority</span>
            <div className="field__readonly-value">{ticket.requestedPriority}</div>
          </div>
        </div>

        <div className="ticket-detail__body">
          <p className="ticket-detail__summary">{ticket.summary}</p>
          <p className="ticket-detail__description">{ticket.description}</p>
        </div>

        <div className="staff-detail__ops-groups" data-testid="operational-panel">
          <h2 className="staff-detail__ops-title">Operational Fields</h2>
          <div className="staff-detail__ops">
            <div className="field field--editable">
              {unassigned ? (
                <>
                  <span className="field__label">Owner</span>
                  <div className="staff-detail__owner-row">
                    <span className="badge badge--neutral" data-testid="owner-unassigned">
                      Unassigned
                    </span>
                    <Button
                      variant="secondary"
                      data-testid="claim-btn"
                      onClick={handleClaim}
                    >
                      Claim
                    </Button>
                  </div>
                </>
              ) : (
                <Select
                  label="Owner"
                  data-testid="owner-select"
                  placeholder="Select an owner…"
                  value={ownerSel}
                  options={ownerOptions.map((o) => ({
                    value: o.id,
                    label: o.name,
                  }))}
                  onChange={(v) => setOwnerSel(v)}
                />
              )}
            </div>

            <div className="field field--editable">
              <Select
                label="IT Priority"
                data-testid="it-priority-select"
                value={itPrioritySel}
                options={PRIORITY_OPTIONS}
                onChange={(v) => setItPrioritySel(v)}
              />
            </div>

            <div className="field field--editable field--status">
              <Select
                label={
                  <>
                    Status <StatusBadge status={ticket.currentStatus} />
                  </>
                }
                labelText="Status"
                id="status-select-field"
                data-testid="status-select"
                placeholder={
                  transitions.length === 0
                    ? "No available transitions"
                    : "Select a transition…"
                }
                value={statusSel}
                options={statusOptions}
                onChange={(v) => setStatusSel(v)}
              />
            </div>
          </div>

          <div className="staff-detail__actions-row">
            {saveError && (
              <Alert variant="error" role="alert" data-testid="save-error">
                {saveError}
              </Alert>
            )}
            {saveSuccess && (
              <Alert variant="success" role="status" data-testid="save-success">
                {saveSuccess}
              </Alert>
            )}
            <Button
              data-testid="save-ticket-btn"
              busy={saveBusy}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      <Card className="ticket-detail__card">
        <div className="detail-tabs" data-testid="detail-tabs">
          <div
            className="detail-tabs__bar"
            role="tablist"
            aria-label="Ticket sections"
          >
            <button
              type="button"
              id="tab-comments"
              role="tab"
              className="detail-tabs__tab"
              data-testid="tab-comments"
              aria-selected={activeTab === "comments"}
              aria-controls="panel-comments"
              tabIndex={activeTab === "comments" ? 0 : -1}
              onClick={() => setActiveTab("comments")}
            >
              Public Comments
            </button>
            <button
              type="button"
              id="tab-notes"
              role="tab"
              className="detail-tabs__tab"
              data-testid="tab-notes"
              aria-selected={activeTab === "notes"}
              aria-controls="panel-notes"
              tabIndex={activeTab === "notes" ? 0 : -1}
              onClick={() => setActiveTab("notes")}
            >
              Internal Notes
            </button>
            <button
              type="button"
              id="tab-attachments"
              role="tab"
              className="detail-tabs__tab"
              data-testid="tab-attachments"
              aria-selected={activeTab === "attachments"}
              aria-controls="panel-attachments"
              tabIndex={activeTab === "attachments" ? 0 : -1}
              onClick={() => setActiveTab("attachments")}
            >
              Attachments
            </button>
          </div>

          <div
            id="panel-comments"
            role="tabpanel"
            aria-labelledby="tab-comments"
            hidden={activeTab !== "comments"}
            className="detail-tabs__panel"
          >
            <div className="thread-section" data-testid="public-comments">
              {commentsNewestFirst.length === 0 ? (
                <p className="comments-empty">No comments yet.</p>
              ) : (
                <ul className="thread-list" role="log" aria-live="polite">
                  {commentsNewestFirst.map((comment) => (
                    <ThreadItem key={comment.id} item={comment} />
                  ))}
                </ul>
              )}
              <div className="comments-composer">
                <Textarea
                  label="Add a comment"
                  data-testid="comment-textarea"
                  counterTestId="counter-comment"
                  maxLength={2000}
                  placeholder="Share details, updates, or evidence…"
                  value={commentDraft}
                  onChange={(e) => {
                    setCommentDraft(e.target.value);
                    setCommentError(null);
                  }}
                />
                {commentError && (
                  <Alert variant="error" role="alert" data-testid="comment-error">
                    {commentError}
                  </Alert>
                )}
                <Button
                  busy={commentBusy}
                  data-testid="post-comment-btn"
                  onClick={handlePostComment}
                >
                  Post Comment
                </Button>
              </div>
            </div>
          </div>

          <div
            id="panel-notes"
            role="tabpanel"
            aria-labelledby="tab-notes"
            hidden={activeTab !== "notes"}
            className="detail-tabs__panel"
          >
            <div className="note-hint" role="note" data-testid="notes-internal-hint">
              {NOTE_VISIBILITY_HINT}
            </div>
            <div className="thread-section" data-testid="internal-notes">
              {notesNewestFirst.length === 0 ? (
                <p className="comments-empty">No notes yet.</p>
              ) : (
                <ul className="thread-list thread-list--notes" role="log" aria-live="polite">
                  {notesNewestFirst.map((note) => (
                    <ThreadItem key={note.id} item={note} marker="Internal" />
                  ))}
                </ul>
              )}
              <div className="comments-composer">
                <Textarea
                  label="Add a note"
                  data-testid="note-textarea"
                  counterTestId="counter-note"
                  maxLength={2000}
                  placeholder="Add an internal note for IT Staff…"
                  value={noteDraft}
                  onChange={(e) => {
                    setNoteDraft(e.target.value);
                    setNoteError(null);
                  }}
                />
                {noteError && (
                  <Alert variant="error" role="alert" data-testid="note-error">
                    {noteError}
                  </Alert>
                )}
                <Button
                  busy={noteBusy}
                  data-testid="post-note-btn"
                  onClick={handlePostNote}
                >
                  Post Note
                </Button>
              </div>
            </div>
          </div>

          <div
            id="panel-attachments"
            role="tabpanel"
            aria-labelledby="tab-attachments"
            hidden={activeTab !== "attachments"}
            className="detail-tabs__panel"
          >
            <div className="attachments-section" data-testid="attachments-section">
              <h2 className="card__title attachments-section__title">
                Attachments
              </h2>
              {ticket.attachments.length === 0 ? (
                <p className="comments-empty">No attachments.</p>
              ) : (
                <ul className="attachment-list attachment-list--detail">
                  {ticket.attachments.map((attachment) => (
                    <AttachmentRow key={attachment.id} attachment={attachment} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="ticket-detail__actions">{backButton}</div>
    </div>
  );
}

function AttachmentRow({ attachment }: { attachment: Attachment }) {
  if (attachment.isRemoved) {
    return (
      <li
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
          </span>
          {attachment.removalReason && (
            <span className="attachment-row__reason">
              Reason: {attachment.removalReason}
            </span>
          )}
        </span>
        <span className="attachment-row__status">
          <span className="badge badge--neutral">Removed</span>
        </span>
      </li>
    );
  }
  return (
    <li
      className="attachment-row"
      data-testid={`attachment-${attachment.id}`}
    >
      <span className="attachment-row__icon" aria-hidden="true">
        📎
      </span>
      <span className="attachment-row__meta">
        <a
          className="attachment-row__download"
          href={downloadAttachmentUrl(attachment.id)}
          data-testid={`attachment-download-${attachment.id}`}
        >
          {attachment.originalFilename}
        </a>
        <span className="attachment-row__detail">
          {formatBytes(attachment.fileSizeBytes)} ·{" "}
          {formatTicketDate(attachment.uploadedAt)}
        </span>
      </span>
    </li>
  );
}