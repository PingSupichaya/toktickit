import { useCallback, useContext, useEffect, useState } from "react";
import {
  StaffDashboardData,
  fetchStaffDashboard,
  formatTicketDate,
} from "../../api.js";
import { AuthContext } from "../../context/AuthContext.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { MetricCard } from "../ui/MetricCard.js";

// Queue drill-down presets (api-spec §4.6): each key maps to the filter the
// Ticket Queue must open with.
export type StaffDrillDown =
  | { kind: "status"; status: string }
  | { kind: "assignment"; assignment: "unassigned" | "assignedToMe" }
  | { kind: "priority"; priority: "LOW" | "MEDIUM" | "HIGH" };

interface StaffDashboardProps {
  onDrillDown: (drill: StaffDrillDown) => void;
  onBrowseQueue: () => void;
  onSearchTickets: () => void;
  onOpenTicket: (ticketId: number) => void;
  onManageUsers: (role: "REQUESTER" | "IT_STAFF" | "ADMIN") => void;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function StaffDashboard({
  onDrillDown,
  onBrowseQueue,
  onSearchTickets,
  onOpenTicket,
  onManageUsers,
}: StaffDashboardProps) {
  const user = useContext(AuthContext)?.user;
  const isAdmin = user?.role === "ADMIN";
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    setError(null);
    try {
      setData((await fetchStaffDashboard()) ?? null);
    } catch (err) {
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetchStaffDashboard();
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
      <div className="dashboard" data-testid="staff-dashboard-loading">
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

  const { metrics, recentTickets, userCounts } = data;

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="screen-title">
            Welcome back, {user ? firstName(user.name) : "there"}!
          </h1>
          <p className="dashboard__subtitle">
            Here&apos;s what&apos;s happening with your queue today.
          </p>
        </div>
        <Button
          variant="ghost"
          data-testid="dashboard-refresh-btn"
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      <div className="dashboard__cards dashboard__cards--staff" data-testid="staff-metric-cards">
        <MetricCard
          label="New"
          value={metrics.new}
          onDrillDown={() => onDrillDown({ kind: "status", status: "NEW" })}
        />
        <MetricCard
          label="Open"
          value={metrics.open}
          onDrillDown={() => onDrillDown({ kind: "status", status: "OPEN" })}
        />
        <MetricCard
          label="In Progress"
          value={metrics.inProgress}
          onDrillDown={() => onDrillDown({ kind: "status", status: "IN_PROGRESS" })}
        />
        <MetricCard
          label="Waiting for Requester"
          value={metrics.waitingForRequester}
          onDrillDown={() => onDrillDown({ kind: "status", status: "WAITING_FOR_REQUESTER" })}
        />
        <MetricCard
          label="Unassigned"
          value={metrics.unassigned}
          onDrillDown={() => onDrillDown({ kind: "assignment", assignment: "unassigned" })}
        />
        <MetricCard
          label="My Assigned"
          value={metrics.myAssigned}
          onDrillDown={() => onDrillDown({ kind: "assignment", assignment: "assignedToMe" })}
        />
      </div>

      <div
        className="dashboard__priority-strip"
        data-testid="staff-priority-breakdown"
      >
        <button
          type="button"
          className="metric-card__link"
          data-testid="priority-breakdown-low"
          onClick={() => onDrillDown({ kind: "priority", priority: "LOW" })}
        >
          Low {metrics.byPriority.low}
        </button>
        <span> · </span>
        <button
          type="button"
          className="metric-card__link"
          data-testid="priority-breakdown-medium"
          onClick={() => onDrillDown({ kind: "priority", priority: "MEDIUM" })}
        >
          Medium {metrics.byPriority.medium}
        </button>
        <span> · </span>
        <button
          type="button"
          className="metric-card__link"
          data-testid="priority-breakdown-high"
          onClick={() => onDrillDown({ kind: "priority", priority: "HIGH" })}
        >
          High {metrics.byPriority.high}
        </button>
      </div>

      {isAdmin && userCounts && (
        <div className="dashboard__user-strip" data-testid="staff-user-counts">
          <button
            type="button"
            className="metric-card__link"
            onClick={() => onManageUsers("REQUESTER")}
          >
            Requesters {userCounts.requesters}
          </button>
          <span> · </span>
          <button
            type="button"
            className="metric-card__link"
            onClick={() => onManageUsers("IT_STAFF")}
          >
            IT Staff {userCounts.itStaff}
          </button>
          <span> · </span>
          <button
            type="button"
            className="metric-card__link"
            onClick={() => onManageUsers("ADMIN")}
          >
            Admins {userCounts.admins}
          </button>
        </div>
      )}

      <div className="dashboard__row">
        <div className="card" data-testid="staff-recent-tickets">
          <div className="card__header">
            <h2 className="card__title">My Recent Tickets</h2>
            <button
              type="button"
              className="metric-card__link"
              data-testid="recent-view-all-link"
              onClick={() => onDrillDown({ kind: "assignment", assignment: "assignedToMe" })}
            >
              View all
            </button>
          </div>
          {recentTickets.length === 0 ? (
            <EmptyState
              title="No assigned Tickets yet."
              message="Tickets assigned to you will appear here."
              action={<Button variant="primary" onClick={onBrowseQueue}>Browse Queue</Button>}
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

        <div className="card" data-testid="staff-quick-actions">
          <h2 className="card__title">Quick Actions</h2>
          <Button variant="secondary" onClick={onBrowseQueue}>
            Browse Unassigned
          </Button>
          <p className="dashboard__hint">Tickets waiting for an owner</p>
          <Button variant="secondary" onClick={onSearchTickets}>
            Search Tickets
          </Button>
          <p className="dashboard__hint">Find any ticket in the queue</p>
          <Button
            variant="secondary"
            onClick={() => onDrillDown({ kind: "assignment", assignment: "assignedToMe" })}
          >
            My Queue
          </Button>
          <p className="dashboard__hint">Tickets assigned to you</p>
        </div>
      </div>
    </div>
  );
}
