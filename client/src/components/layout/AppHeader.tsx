import { useState } from "react";
import { useRequester } from "../../context/RequesterContext.js";
import { Button } from "../ui/Button.js";

export type HeaderView = "my-tickets" | "create-ticket";

interface AppHeaderProps {
  activeView: HeaderView;
  onNavigate: (view: HeaderView) => void;
  onChangeRequester: () => void;
}

const NAV_ITEMS: { id: HeaderView; label: string }[] = [
  { id: "my-tickets", label: "My Tickets" },
  { id: "create-ticket", label: "Create Ticket" },
];

export function AppHeader({
  activeView,
  onNavigate,
  onChangeRequester,
}: AppHeaderProps) {
  const { requester } = useRequester();
  const [menuOpen, setMenuOpen] = useState(false);

  function navigate(view: HeaderView) {
    onNavigate(view);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-header__brand">TokTickIT</span>
          <nav className="app-header__nav" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
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
          {requester && (
            <div className="app-header__user">
              <span className="app-header__user-label">Logged in as:</span>
              <span className="app-header__user-name">{requester.name}</span>
              <span className="app-header__user-email">{requester.email}</span>
            </div>
          )}
          <div className="app-header__user-switch">
            <Button
              variant="secondary"
              className="app-header__switch-btn"
              onClick={onChangeRequester}
            >
              Switch Requester
            </Button>
          </div>
          <button
            type="button"
            className="app-header__hamburger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="app-header__overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
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
            {NAV_ITEMS.map((item) => (
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
            {requester && (
              <div className="app-header__user app-header__user--overlay">
                <span className="app-header__user-label">Logged in as:</span>
                <span className="app-header__user-name">{requester.name}</span>
                <span className="app-header__user-email">{requester.email}</span>
              </div>
            )}
            <Button
              variant="secondary"
              className="app-header__switch-btn"
              block
              onClick={() => {
                setMenuOpen(false);
                onChangeRequester();
              }}
            >
              Switch Requester
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
