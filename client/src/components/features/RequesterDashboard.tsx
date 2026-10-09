import { useCallback, useContext, useEffect, useState } from "react";
import {
  REQUESTER_OPEN_STATUSES,
  RequesterDashboardData,
  fetchRequesterDashboard,
  formatTicketDate,
} from "../../api.js";
import { AuthContext } from "../../context/AuthContext.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { MetricCard } from "../ui/MetricCard.js";

interface RequesterDashboardProps {
  // Drill-down into My Tickets with the filter already applied; `null`
  // opens the unfiltered view.
  onDrillDown: (statuses: string[] | null) => void;
  onCreateTicket: () => void;
  onOpenTicket: (ticketId: number) => void;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function RequesterDashboard({
  onDrillDown,
  onCreateTicket,
  onOpenTicket,
}: RequesterDashboardProps) {
  const user = useContext(AuthContext)?.user;
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    setError(null);
    try {
      setData((await fetchRequesterDashboard()) ?? null);
    } catch (err) {
      const status =
        typeof err === "object" && err !== null
          ? (err as { status?: number }).status
          : undefined;
      if (status === 403) {
        setForbidden(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load the dashboard."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetchRequesterDashboard();
        if (!cancelled) setData(result ?? null);
      } catch (err) {
        if (cancelled) return;
        const status =
          typeof err === "object" && err !== null
            ? (err as { status?: number }).status
            : undefined;
        if (status === 403) setForbidden(true);
        else
          setError(
            err instanceof Error ? err.message : "Failed to load the dashboard."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && data == null) {
    return (
      <div className="dashboard" data-testid="requester-dashboard-loading">
        <div role="status" aria-label="Loading dashboard">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--block" />
          <div className="skeleton skeleton--block" />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="dashboard">
        <ErrorState title="You are not authorized to view this dashboard." />
      </div>
    );
  }

  if (error || data == null) {
    return (
      <div className="dashboard">
        <Alert variant="error" role="alert" data-testid="dashboard-error">
          {error ?? "Failed to load the dashboard."}
        </Alert>
        <Button variant="secondary" data-testid="dashboard-retry" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  const { metrics, recentTickets } = data;

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="screen-title">
            Welcome, {user ? firstName(user.name) : "there"}!
          </h1>
          <p className="dashboard__subtitle">Here&apos;s the latest on your requests.</p>
        </div>
        <Button
          variant="ghost"
          data-testid="dashboard-refresh-btn"
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      <div className="dashboard__cards" data-testid="requester-metric-cards">
        <MetricCard
          label="My Open Tickets"
          value={metrics.myOpenTickets}
          onDrillDown={() => onDrillDown([...REQUESTER_OPEN_STATUSES])}
        />
        <MetricCard
          label="Waiting on You"
          value={metrics.waitingOnYou}
          onDrillDown={() => onDrillDown(["WAITING_FOR_REQUESTER"])}
        />
        <MetricCard
          label="Resolved"
          value={metrics.resolved}
          onDrillDown={() => onDrillDown(["RESOLVED"])}
        />
        <MetricCard
          label="Closed"
          value={metrics.closed}
          onDrillDown={() => onDrillDown(["CLOSED"])}
        />
      </div>

      <div className="dashboard__row">
        <div className="card" data-testid="requester-recent-tickets">
          <div className="card__header">
            <h2 className="card__title">My Recent Tickets</h2>
            <button
              type="button"
              className="metric-card__link"
              data-testid="recent-view-all-link"
              onClick={() => onDrillDown(null)}
            >
              View all
            </button>
          </div>
          {recentTickets.length === 0 ? (
            <EmptyState
              title="No tickets submitted yet."
              message="Create your first request to get started."
              action={
                <Button variant="primary" onClick={onCreateTicket}>
                  Create Ticket
                </Button>
              }
            />
          ) : (
            <ul className="dashboard__recent-list">
              {recentTickets.map((t) => (
                <li key={t.id} className="dashboard__recent-item">
                  <button
                    type="button"
                    className="dashboard__recent-number"
                    onClick={() => onOpenTicket(t.id)}
                  >
                    {t.ticketNumber}
                  </button>
                  <span className="dashboard__recent-summary">{t.summary}</span>
                  <span
                    className="badge badge--status"
                    data-testid="status-badge"
                    data-value={t.currentStatus}
                  >
                    {t.currentStatus}
                  </span>
                  <span className="dashboard__recent-date">
                    {formatTicketDate(t.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card" data-testid="requester-quick-actions">
          <h2 className="card__title">Quick Actions</h2>
          <Button variant="secondary" onClick={onCreateTicket}>
            Create Ticket
          </Button>
          <p className="dashboard__hint">Submit a new request</p>
          <Button variant="secondary" onClick={() => onDrillDown(null)}>
            View My Tickets
          </Button>
          <p className="dashboard__hint">Track existing requests</p>
        </div>
      </div>
    </div>
  );
}
