import { useEffect, useState } from "react";
import { RequesterProvider } from "../../context/RequesterContext.js";
import { useAuth } from "../../context/AuthContext.js";
import { UserRole } from "../../api.js";
import { Button } from "../ui/Button.js";
import { RoleBadge } from "../ui/RoleBadge.js";
import { Card } from "../ui/Card.js";
import { TicketForm } from "../features/TicketForm.js";
import { MyTickets } from "../features/MyTickets.js";
import { RequesterDashboard } from "../features/RequesterDashboard.js";
import {
  StaffDashboard,
  StaffDrillDown,
} from "../features/StaffDashboard.js";
import { QueuePreset } from "../features/StaffTicketQueue.js";
import { StaffTicketQueue } from "../features/StaffTicketQueue.js";
import { StaffTicketDetail } from "../features/StaffTicketDetail.js";
import { TicketDetail } from "../features/TicketDetail.js";
import { UserList } from "../features/UserList.js";

type ShellView =
  | "dashboard"
  | "my-tickets"
  | "create-ticket"
  | "ticket-detail"
  | "queue"
  | "staff-ticket-detail"
  | "users";

const NAV_ITEMS_BY_ROLE: Record<UserRole, { id: ShellView; label: string }[]> = {
  // Lab 4 (ui-spec §3): Dashboard leads every role's nav and is the landing
  // view after login.
  REQUESTER: [
    { id: "dashboard", label: "Dashboard" },
    { id: "my-tickets", label: "My Tickets" },
    { id: "create-ticket", label: "Create Ticket" },
  ],
  IT_STAFF: [
    { id: "dashboard", label: "Dashboard" },
    { id: "queue", label: "Ticket Queue" },
  ],
  ADMIN: [
    { id: "dashboard", label: "Dashboard" },
    { id: "queue", label: "Ticket Queue" },
    { id: "users", label: "User Management" },
  ],
};

function ShellContent() {
  const { user, logout } = useAuth();
  // Lab 4 (ui-spec §3): Dashboard is the landing view after login for every
  // role.
  const [activeView, setActiveView] = useState<ShellView>("dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Dashboard drill-down preset for My Tickets (statuses applied on arrival).
  // Bumped alongside every drill-down so the list remounts with the preset.
  const [ticketPresetKey, setTicketPresetKey] = useState(0);
  const [ticketPreset, setTicketPreset] = useState<string[] | null>(null);
  // Same pattern for the Ticket Queue (drill-down filters + search focus) and
  // User Management (role filter from the admin user strip).
  const [queuePresetKey, setQueuePresetKey] = useState(0);
  const [queuePreset, setQueuePreset] = useState<QueuePreset | null>(null);
  const [queueFocusSearch, setQueueFocusSearch] = useState(false);
  const [usersPresetKey, setUsersPresetKey] = useState(0);
  const [usersRole, setUsersRole] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  if (!user) return null;

  const navItems = NAV_ITEMS_BY_ROLE[user.role];

  function navigate(view: ShellView) {
    setSelectedTicketId(null);
    if (view === "my-tickets") {
      // Plain navigation opens the unfiltered list.
      setTicketPreset(null);
      setTicketPresetKey((k) => k + 1);
    }
    if (view === "queue") {
      // Plain navigation opens the unfiltered queue without search focus.
      setQueuePreset(null);
      setQueueFocusSearch(false);
      setQueuePresetKey((k) => k + 1);
    }
    if (view === "users") {
      setUsersRole(undefined);
      setUsersPresetKey((k) => k + 1);
    }
    setActiveView(view);
    setMenuOpen(false);
  }

  function openFilteredTickets(statuses: string[] | null) {
    setSelectedTicketId(null);
    setTicketPreset(statuses);
    setTicketPresetKey((k) => k + 1);
    setActiveView("my-tickets");
    setMenuOpen(false);
  }

  function openFilteredQueue(preset: QueuePreset, focusSearch = false) {
    setSelectedTicketId(null);
    setQueuePreset(preset);
    setQueueFocusSearch(focusSearch);
    setQueuePresetKey((k) => k + 1);
    setActiveView("queue");
    setMenuOpen(false);
  }

  function openStaffDrillDown(drill: StaffDrillDown) {
    if (drill.kind === "status") {
      openFilteredQueue({ status: drill.status });
    } else if (drill.kind === "assignment") {
      openFilteredQueue({ assignment: drill.assignment });
    } else {
      openFilteredQueue({ priority: drill.priority });
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-header__brand">TokTickIT</span>
          <nav className="app-header__nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`app-header__nav-link${
                  activeView === item.id ? " app-header__nav-link--active" : ""
                }`}
                data-active={activeView === item.id}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="app-header__right">
          <div className="app-header__user">
            <span className="app-header__user-line">
              <span className="app-header__user-label">Logged in as:</span>
              <span className="app-header__user-name">{user.name}</span>
              <RoleBadge role={user.role} />
            </span>
            <span className="app-header__user-email">{user.email}</span>
          </div>
          <Button variant="ghost" className="app-header__logout" data-testid="logout-btn" onClick={() => logout()}>
            Logout
          </Button>
          {/* Mobile (< 768px): the inline nav is hidden, so this opens the
              full-screen navigation overlay (ui-spec §4). */}
          <button
            type="button"
            className="app-header__hamburger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            data-testid="menu-btn"
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="container" style={{ padding: "var(--space-8) var(--space-6)" }}>
        {activeView === "dashboard" ? (
          user.role === "REQUESTER" ? (
            <RequesterDashboard
              onDrillDown={openFilteredTickets}
              onCreateTicket={() => navigate("create-ticket")}
              onOpenTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setActiveView("ticket-detail");
              }}
            />
          ) : (
            <StaffDashboard
              onDrillDown={openStaffDrillDown}
              onBrowseQueue={() => openFilteredQueue({ assignment: "unassigned" })}
              onSearchTickets={() => openFilteredQueue({}, true)}
              onOpenTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setActiveView("staff-ticket-detail");
              }}
              onManageUsers={(role) => {
                setUsersRole(role);
                setUsersPresetKey((k) => k + 1);
                setActiveView("users");
                setMenuOpen(false);
              }}
            />
          )
        ) : activeView === "queue" ? (
          <StaffTicketQueue
            key={queuePresetKey}
            initialFilters={queuePreset ?? undefined}
            focusSearch={queueFocusSearch}
            onOpenTicket={(ticket) => {
              setSelectedTicketId(ticket.id);
              setActiveView("staff-ticket-detail");
            }}
          />
        ) : activeView === "staff-ticket-detail" && selectedTicketId !== null ? (
          <StaffTicketDetail
            ticketId={selectedTicketId}
            onBack={() => navigate("queue")}
          />
        ) : activeView === "users" ? (
          <UserList key={usersPresetKey} initialRole={usersRole} />
        ) : activeView === "create-ticket" ? (
          <div className="create-ticket-page">
            <h1 className="screen-title">Create Ticket</h1>
            <Card>
              <TicketForm onCancel={() => navigate("my-tickets")} />
            </Card>
          </div>
        ) : activeView === "ticket-detail" && selectedTicketId !== null ? (
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={() => navigate("my-tickets")}
          />
        ) : (
          <MyTickets
            key={ticketPresetKey}
            initialStatuses={ticketPreset ?? undefined}
            onCreateTicket={() => navigate("create-ticket")}
            onOpenTicket={(ticket) => {
              setSelectedTicketId(ticket.id);
              setActiveView("ticket-detail");
            }}
          />
        )}
      </main>

      {menuOpen && (
        <div
          className="app-header__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
        >
          <button
            type="button"
            className="app-header__overlay-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>

          <nav className="app-header__overlay-nav" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`app-header__overlay-link${
                  activeView === item.id ? " app-header__overlay-link--active" : ""
                }`}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="app-header__overlay-footer">
            <div className="app-header__user app-header__user--overlay">
              <span className="app-header__user-line">
                <span className="app-header__user-label">Logged in as:</span>
                <span className="app-header__user-name">{user.name}</span>
                <RoleBadge role={user.role} />
              </span>
              <span className="app-header__user-email">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              className="app-header__logout"
              block
              data-testid="logout-btn"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell() {
  return (
    <RequesterProvider>
      <ShellContent />
    </RequesterProvider>
  );
}