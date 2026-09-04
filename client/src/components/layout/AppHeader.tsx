import { useRequester } from "../../context/RequesterContext.js";
import { Button } from "../ui/Button.js";

interface AppHeaderProps {
  onChangeRequester: () => void;
}

export function AppHeader({ onChangeRequester }: AppHeaderProps) {
  const { requester } = useRequester();

  return (
    <header className="app-header">
      <div className="app-header__brand">TokTickIT</div>
      <div style={{ display: "flex", alignItems: "center" }}>
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
            className="btn--header-ghost"
            onClick={onChangeRequester}
          >
            Switch Requester
          </Button>
        </div>
      </div>
    </header>
  );
}
