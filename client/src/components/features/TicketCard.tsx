import {
  TicketSummary,
  formatTicketDate,
} from "../../api.js";
import { Card } from "../ui/Card.js";

interface TicketCardProps {
  ticket: TicketSummary;
  onClick?: () => void;
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

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <Card hover={!!onClick} className="ticket-card">
      <button
        type="button"
        className="ticket-card__link"
        onClick={onClick}
        disabled={!onClick}
        aria-label={`Open ticket ${ticket.ticketNumber}`}
      >
        <span className="ticket-card__main">
          <span className="ticket-card__row">
            <span className="ticket-card__number" data-testid="ticket-number">
              {ticket.ticketNumber}
            </span>
            <StatusBadge status={ticket.currentStatus} />
          </span>
          <span className="ticket-card__summary">{ticket.summary}</span>
          <span className="ticket-card__meta">
            <span className="badge badge--category">{ticket.category.name}</span>
            <span className="ticket-card__system">{ticket.relatedSystem.name}</span>
            <PriorityBadge priority={ticket.requestedPriority} />
            <span className="ticket-card__date">
              {formatTicketDate(ticket.ticketDate)}
            </span>
            {ticket.attachmentCount > 0 && (
              <span className="ticket-card__attachments">
                📎 {ticket.attachmentCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </Card>
  );
}