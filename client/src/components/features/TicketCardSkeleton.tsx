export function TicketCardSkeleton() {
  return (
    <div className="ticket-card ticket-card--skeleton" role="status" aria-label="Loading tickets">
      <div className="ticket-card__main">
        <div className="ticket-card__row">
          <span className="skeleton skeleton-line skeleton-line--number" />
          <span className="skeleton skeleton-pill" />
        </div>
        <span className="skeleton skeleton-line skeleton-line--summary" />
        <div className="ticket-card__meta">
          <span className="skeleton skeleton-pill" />
          <span className="skeleton skeleton-line skeleton-line--system" />
          <span className="skeleton skeleton-pill" />
        </div>
      </div>
    </div>
  );
}