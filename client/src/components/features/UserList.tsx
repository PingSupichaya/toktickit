import { useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  CreateUserInput,
  UpdateUserInput,
  UserRole,
  fetchUsers as apiFetchUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  resetUserInitialPassword as apiResetUserInitialPassword,
} from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { RoleBadge } from "../ui/RoleBadge.js";
import { Select } from "../ui/Select.js";
import { UserFormPanel } from "./UserFormPanel.js";

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Roles" },
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMIN", label: "Administrator" },
];

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`user-status${active ? " user-status--active" : ""}`}
      data-testid="user-status-badge"
      data-value={active ? "Active" : "Inactive"}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

interface PanelState {
  key: string;
  mode: "create" | "edit";
  user: AdminUser | null;
}

export function UserList() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);

  // Debounce the search input (300 ms per ui-spec 6.4).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);
    apiFetchUsers({
      search: debouncedSearch || undefined,
      role: (roleFilter || undefined) as UserRole | undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setUsers(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 403) {
          setForbidden(true);
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load users."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, roleFilter, reloadToken]);

  const isFiltering = debouncedSearch !== "" || roleFilter !== "";
  const showNoResults = !loading && users.length === 0 && isFiltering;

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === "ADMIN" && u.isActive).length,
    [users]
  );

  function clearFilters() {
    setSearch("");
    setRoleFilter("");
  }

  async function handleCreate(input: CreateUserInput) {
    await apiCreateUser(input);
    setPanel(null);
    setSuccess(`User ${input.name} was created.`);
    setReloadToken((t) => t + 1);
  }

  async function handleUpdate(userId: number, input: UpdateUserInput) {
    await apiUpdateUser(userId, input);
    setPanel(null);
    setSuccess(`User was updated.`);
    setReloadToken((t) => t + 1);
  }

  async function handleResetPassword(userId: number, newPassword: string) {
    await apiResetUserInitialPassword(userId, newPassword);
    setSuccess(`Initial password issued.`);
    setReloadToken((t) => t + 1);
  }

  return (
    <div className="user-mgmt">
      <h1 className="screen-title user-mgmt__title">User Management</h1>

      {/* Controls row 1: search left, Create right */}
      <div className="user-mgmt__controls">
        <input
          className="input user-mgmt__search"
          data-testid="user-search-input"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          data-testid="create-user-btn"
          onClick={() =>
            setPanel({ key: "create", mode: "create", user: null })
          }
        >
          Create User
        </Button>
      </div>

      {/* Controls row 2: role filter + Clear Filters */}
      <div className="user-mgmt__filters">
        <Select
          label="Role"
          labelText="Filter by role"
          data-testid="user-filter-role"
          placeholder="All Roles"
          value={roleFilter}
          options={ROLE_FILTER_OPTIONS}
          onChange={(v) => setRoleFilter(String(v))}
        />
        {isFiltering && (
          <Button
            variant="ghost"
            data-testid="user-clear-filters-btn"
            className="user-mgmt__clear"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {success && (
        <Alert
          variant="success"
          role="status"
          data-testid="users-success-banner"
          className="user-mgmt__banner"
        >
          {success}
        </Alert>
      )}

      {loading ? (
        <div data-testid="users-loading" className="user-mgmt__loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="queue-skeleton"
              role="status"
              aria-label="Loading users"
            >
              <span
                className="skeleton skeleton-line skeleton-line--number"
                style={{ width: "30%" }}
              />
              <span
                className="skeleton skeleton-line skeleton-line--summary"
                style={{ width: "60%" }}
              />
              <div className="queue-skeleton__meta">
                <span className="skeleton skeleton-pill" />
                <span className="skeleton skeleton-pill" />
              </div>
            </div>
          ))}
        </div>
      ) : forbidden ? (
        <ErrorState
          title="Not Authorized"
          message="You are not authorized to manage users."
        />
      ) : error ? (
        <ErrorState
          title="Something went wrong"
          message={error}
          retry={() => setReloadToken((t) => t + 1)}
        />
      ) : users.length === 0 && !showNoResults ? (
        <EmptyState title="No users found" />
      ) : showNoResults ? (
        <EmptyState
          title="No results match your search or filter."
          action={
            <Button
              variant="ghost"
              data-testid="user-empty-clear-btn"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop / tablet table (>= 1024px) */}
          <table className="user-table" data-testid="users-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="user-table__name">{u.name}</span>
                    <span className="user-table__created">
                      Created {formatCreatedAt(u.createdAt)}
                    </span>
                  </td>
                  <td>
                    <span className="user-table__email">{u.email}</span>
                  </td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td>
                    <StatusPill active={u.isActive} />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      data-testid="edit-user-btn"
                      onClick={() =>
                        setPanel({
                          key: `edit-${u.id}`,
                          mode: "edit",
                          user: u,
                        })
                      }
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile / tablet (< 1024px): card list */}
          <ul className="user-cards" data-testid="user-card">
            {users.map((u) => (
              <li key={u.id} className="user-card">
                <div className="user-card__head">
                  <span className="user-card__name">{u.name}</span>
                  <StatusPill active={u.isActive} />
                </div>
                <span className="user-card__email">{u.email}</span>
                <div className="user-card__meta">
                  <RoleBadge role={u.role} />
                  <span className="user-card__created">
                    Created {formatCreatedAt(u.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  data-testid="edit-user-btn"
                  onClick={() =>
                    setPanel({
                      key: `edit-${u.id}`,
                      mode: "edit",
                      user: u,
                    })
                  }
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {panel && (
        <UserFormPanel
          key={panel.key}
          open
          mode={panel.mode}
          user={panel.user}
          currentUserId={me?.id ?? 0}
          activeAdminCount={activeAdminCount}
          onSubmitCreate={handleCreate}
          onSubmitUpdate={handleUpdate}
          onResetPassword={handleResetPassword}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}