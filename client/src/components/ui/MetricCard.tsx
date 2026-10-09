// Metric card (ui-spec §2): label + value + optional "View all" drill-down
// link. The card carries an accessible name combining label and value so
// screen readers announce the count, not just the digits (ui-spec §10).
interface MetricCardProps {
  label: string;
  value: number;
  onDrillDown?: () => void;
}

export function MetricCard({ label, value, onDrillDown }: MetricCardProps) {
  return (
    <div className="card metric-card" aria-label={`${label}: ${value} tickets`}>
      <span className="metric-card__label">{label}</span>
      <div className="metric-card__aside">
        <span className="metric-card__value">{value}</span>
        {onDrillDown && (
          <button
            type="button"
            className="metric-card__link"
            data-testid="metric-card-link"
            onClick={onDrillDown}
            aria-label={`View all ${label}`}
          >
            View all
          </button>
        )}
      </div>
    </div>
  );
}
