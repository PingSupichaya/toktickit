import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Category,
  RelatedSystem,
  RequestedPriority,
  QueueTicket,
  QueueSortKey,
  QueueQuery,
  fetchCategories,
  fetchQueue,
  fetchRelatedSystems,
  formatTicketDate,
} from "../../api.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Select } from "../ui/Select.js";
import { Pagination } from "./Pagination.js";

const STATUS_CHOICES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

const PRIORITY_CHOICES = ["LOW", "MEDIUM", "HIGH"] as const;

const ASSIGNMENT_CHOICES = [
  { value: "all", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assignedToMe", label: "Assigned to me" },
] as const;

const SORT_CHOICES = [
  { value: "itPriority-desc", label: "IT Priority (high first)" },
  { value: "itPriority-asc", label: "IT Priority (low first)" },
  { value: "ticketDate-asc", label: "Oldest first" },
  { value: "ticketDate-desc", label: "Newest first" },
  { value: "updatedAt-desc", label: "Recently updated" },
  { value: "requestedPriority-desc", label: "Requested priority (high first)" },
  { value: "ticketNumber-asc", label: "Ticket number A–Z" },
  { value: "ticketNumber-desc", label: "Ticket number Z–A" },
  { value: "currentStatus-asc", label: "Status A–Z" },
] as const;

interface ToolbarState {
  search: string;
  categoryId: number | "";
  relatedSystemId: number | "";
  status: string;
  priority: RequestedPriority | "";
  assignment: string;
  sort: string;
}

function applyFilters(initial: Partial<ToolbarState>): ToolbarState {
  return {
    search: "",
    categoryId: "",
    relatedSystemId: "",
    status: "",
    priority: "",
    assignment: "all",
    sort: SORT_CHOICES[0].value,
    ...initial,
  };
}

function anyFilterActive(f: ToolbarState): boolean {
  return (
    f.search.trim() !== "" ||
    f.categoryId !== "" ||
    f.relatedSystemId !== "" ||
    f.status !== "" ||
    f.priority !== "" ||
    f.assignment !== "all"
  );
}

function toSort(querySort: string): {
  sortBy?: QueueSortKey;
  sortOrder?: "asc" | "desc";
} {
  switch (querySort) {
    case "itPriority-asc":
      return { sortBy: "itPriority", sortOrder: "asc" };
    case "ticketDate-asc":
      return { sortBy: "ticketDate", sortOrder: "asc" };
    case "ticketDate-desc":
      return { sortBy: "ticketDate", sortOrder: "desc" };
    case "updatedAt-desc":
      return { sortBy: "updatedAt", sortOrder: "desc" };
    case "requestedPriority-desc":
      return { sortBy: "requestedPriority", sortOrder: "desc" };
    case "ticketNumber-asc":
      return { sortBy: "ticketNumber", sortOrder: "asc" };
    case "ticketNumber-desc":
      return { sortBy: "ticketNumber", sortOrder: "desc" };
    case "currentStatus-asc":
      return { sortBy: "currentStatus", sortOrder: "asc" };
    default:
      // Default ordering matches the queue default (itPriority DESC,
      // ticketDate ASC — D-10 / api-spec §4.8).
      return {};
  }
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

export function StaffTicketQueue({
  onOpenTicket,
}: {
  onOpenTicket?: (ticket: QueueTicket) => void;
} = {}) {
  const [filters, setFilters] = useState<ToolbarState>(() => applyFilters({}));
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Debounce the search input (300 ms per ui-spec 6.2).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Load the filter reference data (active categories + related systems).
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([cats, systems]) => {
        if (cancelled) return;
        setCategories(cats);
        setRelatedSystems(systems);
      })
      .catch(() => {
        // Filters fall back to "All" if reference data fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch whenever debounced search, filters, page, or page size change.
  useEffect(() => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    const { sortBy, sortOrder } = toSort(filters.sort);

    const query: QueueQuery = {
      search: debouncedSearch || undefined,
      status: filters.status || undefined,
      itPriority: filters.priority || undefined,
      categoryId:
        filters.categoryId === "" ? undefined : Number(filters.categoryId),
      relatedSystemId:
        filters.relatedSystemId === "" ? undefined : Number(filters.relatedSystemId),
      assignment:
        filters.assignment === "all" ? undefined : (filters.assignment as QueueQuery["assignment"]),
      sortBy,
      sortOrder,
      page,
      pageSize,
    };

    let cancelled = false;
    fetchQueue(query)
      .then((result) => {
        if (cancelled) return;
        setTickets(result.items);
        setPagination(result.pagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 403) {
          setForbidden(true);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load the ticket queue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    filters.categoryId,
    filters.relatedSystemId,
    filters.status,
    filters.priority,
    filters.assignment,
    filters.sort,
    page,
    pageSize,
  ]);

  const isFiltering = useMemo(() => anyFilterActive(filters), [filters]);

  const clearFilters = useCallback(() => {
    setFilters(applyFilters({}));
    setPage(1);
  }, []);

  const updateFilter = useCallback((patch: Partial<ToolbarState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const showNoResults =
    !loading && tickets.length === 0 && (isFiltering || debouncedSearch !== "");

  const countFrom =
    pagination.totalCount === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const countTo =
    pagination.totalCount === 0
      ? 0
      : Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <div className="queue">
      <h1 className="screen-title queue__title">Ticket Queue</h1>

      {/* Controls row 1: search left, count right */}
      <div className="queue__row1">
        <input
          className="input queue__search"
          data-testid="queue-search-input"
          type="search"
          placeholder="Search tickets…"
          value={filters.search}
          onChange={(e) => updateFilter({ search: e.target.value })}
        />
        <p className="queue__count" data-testid="queue-count">
          Showing {countFrom}–{countTo} of {pagination.totalCount} tickets
        </p>
      </div>

      {/* Controls row 2: filters + sort + Clear Filters */}
      <div className="queue__row2">
        <Select
          label="Status"
          data-testid="queue-filter-status"
          placeholder="All Statuses"
          value={filters.status}
          options={STATUS_CHOICES.map((s) => ({ value: s, label: s }))}
          onChange={(v) => updateFilter({ status: v })}
        />
        <Select
          label="IT Priority"
          data-testid="queue-filter-priority"
          placeholder="All Priorities"
          value={filters.priority}
          options={PRIORITY_CHOICES.map((p) => ({ value: p, label: p }))}
          onChange={(v) => updateFilter({ priority: v })}
        />
        <Select
          label="Category"
          data-testid="queue-filter-category"
          placeholder="All Categories"
          value={filters.categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(v) => updateFilter({ categoryId: v })}
        />
        <Select
          label="Related System"
          data-testid="queue-filter-system"
          placeholder="All Systems"
          value={filters.relatedSystemId}
          options={relatedSystems.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => updateFilter({ relatedSystemId: v })}
        />
        <Select
          label="Assignment"
          data-testid="queue-filter-assignment"
          placeholder="All Tickets"
          value={filters.assignment}
          options={ASSIGNMENT_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => updateFilter({ assignment: String(v) })}
        />
        <Select
          label="Sort"
          data-testid="queue-sort-control"
          value={filters.sort}
          options={SORT_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => updateFilter({ sort: String(v) })}
        />
        {isFiltering && (
          <Button
            variant="ghost"
            data-testid="queue-clear-filters-btn"
            className="queue__clear"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {loading ? (
        <div data-testid="queue-loading" className="queue__loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="queue-skeleton" role="status" aria-label="Loading queue">
              <div className="skeleton skeleton-line skeleton-line--number" />
              <div className="skeleton skeleton-line skeleton-line--summary" />
              <div className="queue-skeleton__meta">
                <span className="skeleton skeleton-pill" />
                <span className="skeleton skeleton-line skeleton-line--system" />
                <span className="skeleton skeleton-pill" />
              </div>
            </div>
          ))}
        </div>
      ) : forbidden ? (
        <ErrorState
          title="Not Authorized"
          message="You are not authorized to view the ticket queue."
        />
      ) : error ? (
        <ErrorState
          title="Something went wrong"
          message={error}
          retry={() => setPage((p) => p)}
        />
      ) : tickets.length === 0 && !showNoResults ? (
        <EmptyState title="No Tickets in Queue" />
      ) : showNoResults ? (
        <EmptyState
          title="No Results"
          message="No tickets match your current filters."
          action={
            <Button
              variant="ghost"
              data-testid="queue-empty-clear-btn"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table (>= 1024px) */}
          <table className="queue-table" data-testid="queue-table">
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Summary</th>
                <th scope="col">Requester</th>
                <th scope="col">Req. Priority</th>
                <th scope="col">IT Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="queue-table__row"
                  onClick={onOpenTicket ? () => onOpenTicket(ticket) : undefined}
                  onKeyDown={
                    onOpenTicket
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenTicket(ticket);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onOpenTicket ? 0 : undefined}
                  aria-label={
                    onOpenTicket
                      ? `Open ticket ${ticket.ticketNumber}`
                      : undefined
                  }
                >
                  <td>
                    <span className="queue-table__number">{ticket.ticketNumber}</span>
                    <span className="queue-table__date">
                      {formatTicketDate(ticket.ticketDate)}
                    </span>
                  </td>
                  <td>
                    <span className="queue-table__summary">{ticket.summary}</span>
                    <span className="queue-table__meta">
                      {ticket.category.name} · {ticket.relatedSystem.name}
                    </span>
                  </td>
                  <td>
                    <span className="queue-table__name">{ticket.requester.name}</span>
                    <span className="queue-table__email">{ticket.requester.email}</span>
                  </td>
                  <td>
                    <PriorityBadge priority={ticket.requestedPriority} />
                  </td>
                  <td>
                    {ticket.itPriority ? (
                      <PriorityBadge priority={ticket.itPriority} />
                    ) : (
                      <span className="queue-table__muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={ticket.currentStatus} />
                  </td>
                  <td>
                    {ticket.owner ? (
                      <span className="queue-table__owner">
                        <span className="queue-table__name">{ticket.owner.name}</span>
                        <span className="queue-table__role-badge">{ticket.owner.role}</span>
                      </span>
                    ) : (
                      <span className="queue-table__muted">Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span className="queue-table__date">
                      {formatTicketDate(ticket.updatedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile / tablet (< 1024px): card list */}
          <ul className="queue-cards" data-testid="queue-card">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className="queue-card"
                  aria-label={`Open ticket ${ticket.ticketNumber}`}
                  onClick={onOpenTicket ? () => onOpenTicket(ticket) : undefined}
                >
                  <span className="queue-card__row">
                    <span className="queue-card__number">{ticket.ticketNumber}</span>
                    <StatusBadge status={ticket.currentStatus} />
                  </span>
                  <span className="queue-card__summary">{ticket.summary}</span>
                  <span className="queue-card__meta">
                    <span className="queue-card__requester">{ticket.requester.name}</span>
                    {ticket.itPriority ? (
                      <PriorityBadge priority={ticket.itPriority} />
                    ) : null}
                    <span className="queue-card__date">
                      {formatTicketDate(ticket.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && !error && pagination.totalCount > 0 && (
        <div data-testid="queue-pagination" className="queue__pagination">
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}