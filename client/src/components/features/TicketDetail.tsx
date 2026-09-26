import { useEffect, useState } from "react";
import {
  PublicComment,
  TicketDetail as TicketDetailData,
  formatTicketDate,
  fetchTicketDetail,
  indicateResolved as apiIndicateResolved,
  postComment as apiPostComment,
  requesterRespond as apiRequesterRespond,
} from "../../api.js";
import { useRequester } from "../../context/RequesterContext.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Modal } from "../ui/Modal.js";
import { Textarea } from "../ui/Textarea.js";
import { AttachmentSection } from "./AttachmentSection.js";

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

const TERMINAL_STATUSES = ["RESOLVED", "CLOSED", "CANCELLED"];
const INDICATE_RESOLVED_TEXT =
  "The Requester indicated the problem appears resolved.";

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

function PriorityBadge({
  priority,
  prefix,
}: {
  priority: string;
  prefix?: string;
}) {
  return (
    <span
      className={`badge badge--priority badge--priority-${priority.toLowerCase()}`}
      data-testid={prefix ? "it-priority-badge" : "priority-badge"}
      data-value={priority}
    >
      {prefix ? `${prefix}: ${priority}` : priority}
    </span>
  );
}

function CommentItem({ comment }: { comment: PublicComment }) {
  return (
    <li className="comment-item" data-testid={`comment-${comment.id}`}>
      <span className="comment-item__meta">
        <span className="comment-item__author">{comment.author.name}</span>
        {" · "}
        {formatTicketDate(comment.createdAt)}
      </span>
      <p className="comment-item__content">{comment.content}</p>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="ticket-detail" data-testid="ticket-detail-loading">
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

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const { requester } = useRequester();
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);

  const [confirmResolvedOpen, setConfirmResolvedOpen] = useState(false);
  const [confirmResolvedBusy, setConfirmResolvedBusy] = useState(false);
  const [confirmResolvedError, setConfirmResolvedError] = useState<string | null>(null);

  const [respondOpen, setRespondOpen] = useState(false);
  const [respondDraft, setRespondDraft] = useState("");
  const [respondBusy, setRespondBusy] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);

  useEffect(() => {
    if (!requester) return;
    let cancelled = false;
    setLoading(true);
    setErrorStatus(null);
    setTicket(null);

    fetchTicketDetail(ticketId)
      .then((data) => {
        if (cancelled) return;
        setTicket(data);
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
  }, [ticketId, requester]);

  const comments = ticket?.comments ?? [];
  const newestFirst = [...comments].reverse();

  function appendComment(comment: PublicComment) {
    setTicket((prev) =>
      prev ? { ...prev, comments: [...(prev.comments ?? []), comment] } : prev
    );
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
      const comment = await apiPostComment(ticket.id, content);
      appendComment(comment);
      setCommentDraft("");
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Failed to post comment"
      );
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleConfirmResolved() {
    if (!ticket) return;
    setConfirmResolvedBusy(true);
    setConfirmResolvedError(null);
    try {
      const comment = await apiIndicateResolved(ticket.id);
      appendComment(comment);
      setTicket((prev) => (prev ? { ...prev, canIndicateResolved: false } : prev));
      setConfirmResolvedOpen(false);
    } catch (err) {
      setConfirmResolvedError(
        err instanceof Error ? err.message : "Failed to record your response"
      );
    } finally {
      setConfirmResolvedBusy(false);
    }
  }

  async function handleRespond() {
    if (!ticket) return;
    const content = respondDraft.trim();
    setRespondBusy(true);
    setRespondError(null);
    try {
      const result = await apiRequesterRespond(ticket.id, content || undefined);
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              currentStatus: result.ticket.currentStatus,
              updatedAt: result.ticket.updatedAt,
              comments: result.comment
                ? [...(prev.comments ?? []), result.comment]
                : prev.comments,
            }
          : prev
      );
      setRespondDraft("");
      setRespondOpen(false);
    } catch (err) {
      setRespondError(
        err instanceof Error ? err.message : "Failed to submit your reply"
      );
    } finally {
      setRespondBusy(false);
    }
  }

  const backButton = (
    <Button
      variant="secondary"
      data-testid="cancel-btn"
      onClick={onBack}
    >
      Back to My Tickets
    </Button>
  );

  if (loading) return <DetailSkeleton />;

  if (errorStatus === 404) {
    return (
      <div className="ticket-detail">
        <ErrorState title="Ticket not found." action={backButton} />
      </div>
    );
  }

  if (errorStatus !== null) {
    return (
      <div className="ticket-detail">
        <ErrorState
          title="Something went wrong"
          message="We couldn't load this ticket. Please try again."
          action={backButton}
        />
      </div>
    );
  }

  if (!ticket) return <DetailSkeleton />;

  const canIndicateResolved =
    ticket.canIndicateResolved === true &&
    !TERMINAL_STATUSES.includes(ticket.currentStatus);
  const canRespond = ticket.currentStatus === "WAITING_FOR_REQUESTER";

  return (
    <div className="ticket-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="breadcrumb__link" onClick={onBack}>
          My Tickets
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
          <ReadOnlyField label="Ticket Number" value={ticket.ticketNumber} testId="ticket-number" />
          <ReadOnlyField
            label="Ticket Date"
            value={formatTicketDate(ticket.ticketDate)}
            testId="ticket-date"
          />
          <ReadOnlyField label="Requester" value={ticket.submitter.name} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />
          <div className="field field--readonly">
            <span className="field__label">Requested Priority</span>
            <div className="field__readonly-value">
              <PriorityBadge priority={ticket.requestedPriority} />
            </div>
          </div>
          <div className="field field--readonly">
            <span className="field__label">IT Priority</span>
            <div className="field__readonly-value">
              <PriorityBadge
                priority={ticket.itPriority ?? ticket.requestedPriority}
                prefix="IT"
              />
            </div>
          </div>
          <div className="field field--readonly">
            <span className="field__label">Current Status</span>
            <div className="field__readonly-value">
              <StatusBadge status={ticket.currentStatus} />
            </div>
          </div>
        </div>

        <div className="ticket-detail__body">
          <p className="ticket-detail__summary">{ticket.summary}</p>
          <p className="ticket-detail__description">{ticket.description}</p>
        </div>

        {(canIndicateResolved || canRespond) && (
          <div className="ticket-detail__actions-row">
            {canIndicateResolved && (
              <Button
                variant="secondary"
                data-testid="indicate-resolved-btn"
                onClick={() => setConfirmResolvedOpen(true)}
              >
                Problem Appears Resolved
              </Button>
            )}
            {canRespond && (
              <Button
                variant="secondary"
                data-testid="requester-respond-btn"
                onClick={() => setRespondOpen(true)}
              >
                Provide Information
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card className="ticket-detail__card">
        <div className="comments-section" data-testid="public-comments">
          <h2 className="card__title">
            Public Comments ({newestFirst.length})
          </h2>

          {newestFirst.length === 0 ? (
            <p className="comments-empty">No comments yet.</p>
          ) : (
            <ul className="comment-list">
              {newestFirst.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
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
      </Card>

      <Card className="ticket-detail__card">
        <AttachmentSection
          ticketId={ticket.id}
          attachments={ticket.attachments}
        />
      </Card>

      <Modal
        open={confirmResolvedOpen}
        title="Problem Appears Resolved"
        onClose={() => setConfirmResolvedOpen(false)}
      >
        <p className="modal__text">
          Have you confirmed the problem is resolved?
        </p>
        {confirmResolvedError && (
          <Alert variant="error" role="alert" data-testid="indicate-resolved-error">
            {confirmResolvedError}
          </Alert>
        )}
        <div className="modal__footer">
          <Button
            variant="ghost"
            data-testid="cancel-indicate-resolved-btn"
            disabled={confirmResolvedBusy}
            onClick={() => setConfirmResolvedOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            busy={confirmResolvedBusy}
            data-testid="confirm-indicate-resolved-btn"
            onClick={handleConfirmResolved}
          >
            Confirm
          </Button>
        </div>
      </Modal>

      <Modal
        open={respondOpen}
        title="Provide Information"
        onClose={() => setRespondOpen(false)}
      >
        <p className="modal__text">
          Your reply is optional. Submitting will move this ticket back to Open.
        </p>
        <Textarea
          label="Reply (optional)"
          data-testid="respond-textarea"
          counterTestId="counter-respond"
          maxLength={2000}
          placeholder="Describe the information you've provided…"
          value={respondDraft}
          onChange={(e) => {
            setRespondDraft(e.target.value);
            setRespondError(null);
          }}
        />
        {respondError && (
          <Alert variant="error" role="alert" data-testid="respond-error">
            {respondError}
          </Alert>
        )}
        <div className="modal__footer">
          <Button
            variant="ghost"
            data-testid="cancel-respond-btn"
            disabled={respondBusy}
            onClick={() => setRespondOpen(false)}
          >
            Cancel
          </Button>
          <Button
            busy={respondBusy}
            data-testid="confirm-respond-btn"
            onClick={handleRespond}
          >
            Submit
          </Button>
        </div>
      </Modal>

      <div className="ticket-detail__actions">
        {backButton}
      </div>
    </div>
  );
}