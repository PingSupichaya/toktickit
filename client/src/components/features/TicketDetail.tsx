import { useEffect, useState } from "react";
import {
  TicketDetail as TicketDetailData,
  formatTicketDate,
  fetchTicketDetail,
} from "../../api.js";
import { useRequester } from "../../context/RequesterContext.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { ErrorState } from "../ui/ErrorState.js";
import { AttachmentSection } from "./AttachmentSection.js";

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
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

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`badge badge--priority badge--priority-${priority.toLowerCase()}`}
      data-testid="priority-badge"
      data-value={priority}
    >
      {priority}
    </span>
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

  useEffect(() => {
    if (!requester) return;
    let cancelled = false;
    setLoading(true);
    setErrorStatus(null);
    setTicket(null);

    fetchTicketDetail(ticketId, requester.id)
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

  if (errorStatus === 403) {
    return (
      <div className="ticket-detail">
        <ErrorState
          title="You do not have permission to view this ticket."
          message="This ticket belongs to another requester."
          action={backButton}
        />
      </div>
    );
  }

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
          <ReadOnlyField label="Requester" value={ticket.requester.name} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />
          <div className="field field--readonly">
            <span className="field__label">Requested Priority</span>
            <div className="field__readonly-value">
              <PriorityBadge priority={ticket.requestedPriority} />
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
      </Card>

      <Card className="ticket-detail__card">
        <AttachmentSection
          ticketId={ticket.id}
          requesterId={requester?.id ?? ticket.requesterId}
          attachments={ticket.attachments}
        />
      </Card>

      <div className="ticket-detail__actions">
        {backButton}
      </div>
    </div>
  );
}