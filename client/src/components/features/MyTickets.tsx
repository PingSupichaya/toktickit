import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Category,
  RelatedSystem,
  RequestedPriority,
  TicketSummary,
  fetchCategories,
  fetchRelatedSystems,
  fetchTickets,
} from "../../api.js";
import { useRequester } from "../../context/RequesterContext.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Select } from "../ui/Select.js";
import { TicketCard } from "./TicketCard.js";
import { TicketCardSkeleton } from "./TicketCardSkeleton.js";
import { Pagination } from "./Pagination.js";

const STATUS_CHOICES = ["NEW"] as const;

const SORT_CHOICES = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "number-asc", label: "Ticket number A–Z" },
  { value: "number-desc", label: "Ticket number Z–A" },
] as const;

interface ToolbarState {
  search: string;
  categoryId: number | "";
  relatedSystemId: number | "";
  status: string;
  priority: RequestedPriority | "";
  sort: string;
}

function applyFilters(initial: Partial<ToolbarState>): ToolbarState {
  return {
    search: "",
    categoryId: "",
    relatedSystemId: "",
    status: "",
    priority: "",
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
    f.priority !== ""
  );
}

function toSort(querySort: string): { sortBy: "ticketDate" | "ticketNumber"; sortOrder: "asc" | "desc" } {
  switch (querySort) {
    case "date-asc":
      return { sortBy: "ticketDate", sortOrder: "asc" };
    case "number-asc":
      return { sortBy: "ticketNumber", sortOrder: "asc" };
    case "number-desc":
      return { sortBy: "ticketNumber", sortOrder: "desc" };
    default:
      return { sortBy: "ticketDate", sortOrder: "desc" };
  }
}

interface MyTicketsProps {
  onCreateTicket: () => void;
  onOpenTicket?: (ticket: TicketSummary) => void;
}

export function MyTickets({ onCreateTicket, onOpenTicket }: MyTicketsProps) {
  const { requester } = useRequester();
  const [filters, setFilters] = useState<ToolbarState>(() => applyFilters({}));
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
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

  // Debounce the search input (300 ms per ui-spec 12.3).
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
    if (!requester) return;
    setLoading(true);
    setError(null);
    const { sortBy, sortOrder } = toSort(filters.sort);

    let cancelled = false;
    fetchTickets({
      requesterId: requester.id,
      search: debouncedSearch || undefined,
      categoryId: filters.categoryId === "" ? undefined : Number(filters.categoryId),
      relatedSystemId:
        filters.relatedSystemId === "" ? undefined : Number(filters.relatedSystemId),
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize,
    })
      .then((result) => {
        if (cancelled) return;
        setTickets(result.items);
        setPagination(result.pagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tickets.");
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
    filters.sort,
    page,
    pageSize,
    requester,
  ]);

  const isFiltering = useMemo(() => anyFilterActive(filters), [filters]);

  function clearFilters() {
    setFilters(applyFilters({}));
    setPage(1);
  }

  function updateFilter(patch: Partial<ToolbarState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  const showNoResults = !loading && tickets.length === 0 && (isFiltering || debouncedSearch !== "");

  return (
    <div className="my-tickets">
      <h1 className="screen-title my-tickets__title">My Tickets</h1>

      {/* Controls row 1 (ui-spec 12.3): search left, Create Ticket right */}
      <div className="my-tickets__row1">
        <input
          className="input my-tickets__search"
          data-testid="search-input"
          type="search"
          placeholder="Search tickets…"
          value={filters.search}
          onChange={(e) => updateFilter({ search: e.target.value })}
        />
        <Button data-testid="create-ticket-btn" onClick={onCreateTicket}>
          Create Ticket
        </Button>
      </div>

      {/* Controls row 2 (ui-spec 12.3): filters + sort + Clear Filters */}
      <div className="my-tickets__row2">
        <Select
          label="Category"
          data-testid="filter-category"
          placeholder="All Categories"
          value={filters.categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(v) => updateFilter({ categoryId: v })}
        />
        <Select
          label="Related System"
          data-testid="filter-related-system"
          placeholder="All Systems"
          value={filters.relatedSystemId}
          options={relatedSystems.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => updateFilter({ relatedSystemId: v })}
        />
        <Select
          label="Status"
          data-testid="filter-status"
          placeholder="All Statuses"
          value={filters.status}
          options={STATUS_CHOICES.map((s) => ({ value: s, label: s }))}
          onChange={(v) => updateFilter({ status: v })}
        />
        <Select
          label="Priority"
          data-testid="filter-priority"
          placeholder="All Priorities"
          value={filters.priority}
          options={(["LOW", "MEDIUM", "HIGH"] as const).map((p) => ({
            value: p,
            label: p,
          }))}
          onChange={(v) => updateFilter({ priority: v })}
        />
        <Select
          label="Sort"
          data-testid="sort-control"
          value={filters.sort}
          options={SORT_CHOICES.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => updateFilter({ sort: String(v) })}
        />
        {isFiltering && (
          <Button
            variant="ghost"
            data-testid="clear-filters-btn"
            className="my-tickets__clear"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <p className="my-tickets__count" data-testid="ticket-count">
        Showing {pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}–
        {pagination.totalCount === 0
          ? 0
          : Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}{" "}
        of {pagination.totalCount} tickets
      </p>

      {loading ? (
        <div className="ticket-list" data-testid="ticket-list-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <TicketCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Something went wrong" message={error} />
      ) : tickets.length === 0 && !showNoResults ? (
        <EmptyState
          title="No Tickets Yet"
          message="You haven't created any tickets."
          action={
            <Button data-testid="empty-create-btn" onClick={onCreateTicket}>
              Create Your First Ticket
            </Button>
          }
        />
      ) : showNoResults ? (
        <EmptyState
          title="No Results"
          message="No tickets match your search or filters."
          action={
            <Button
              variant="ghost"
              data-testid="empty-clear-btn"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="ticket-list" data-testid="ticket-list">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={
                onOpenTicket ? () => onOpenTicket(ticket) : undefined
              }
            />
          ))}
        </div>
      )}

      {!loading && !error && pagination.totalCount > 0 && (
        <Pagination
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          disabled={loading}
        />
      )}
    </div>
  );
}