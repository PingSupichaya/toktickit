import { useEffect, useState } from "react";
import { RequesterProvider } from "../../context/RequesterContext.js";
import { useAuth } from "../../context/AuthContext.js";
import { UserRole } from "../../api.js";
import { Button } from "../ui/Button.js";
import { RoleBadge } from "../ui/RoleBadge.js";
import { Card } from "../ui/Card.js";
import { TicketForm } from "../features/TicketForm.js";
import { MyTickets } from "../features/MyTickets.js";
import { StaffTicketQueue } from "../features/StaffTicketQueue.js";
import { StaffTicketDetail } from "../features/StaffTicketDetail.js";
import { TicketDetail } from "../features/TicketDetail.js";
import { UserList } from "../features/UserList.js";

type ShellView =
  | "my-tickets"
  | "create-ticket"
  | "ticket-detail"
  | "queue"
  | "staff-ticket-detail"
  | "users";

const NAV_ITEMS_BY_ROLE: Record<UserRole, { id: ShellView; label: string }[]> = {
  REQUESTER: [
    { id: "my-tickets", label: "My Tickets" },
    { id: "create-ticket", label: "Create Ticket" },
  ],
  IT_STAFF: [{ id: "queue", label: "Ticket Queue" }],
  ADMIN: [
    { id: "queue", label: "Ticket Queue" },
    { id: "users", label: "User Management" },
  ],
};

function ShellContent() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState<ShellView>(() =>
    user?.role === "REQUESTER" ? "my-tickets" : "queue"
  );
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    setActiveView(view);
    setMenuOpen(false);
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
        </div>
      </header>

      <main className="container" style={{ padding: "var(--space-8) var(--space-6)" }}>
        {activeView === "queue" ? (
          <StaffTicketQueue
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
          <UserList />
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