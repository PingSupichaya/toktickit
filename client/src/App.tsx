import { useState } from "react";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { RequesterSelector } from "./components/features/RequesterSelector.js";
import { AppHeader, HeaderView } from "./components/layout/AppHeader.js";
import { Card } from "./components/ui/Card.js";

function Shell() {
  const { requester, clearRequester } = useRequester();
  const [switching, setSwitching] = useState(false);
  const [activeView, setActiveView] = useState<HeaderView>("my-tickets");

  if (!requester || switching) {
    return (
      <RequesterSelector
        onSelected={() => {
          setSwitching(false);
        }}
      />
    );
  }

  return (
    <>
      <AppHeader
        activeView={activeView}
        onNavigate={setActiveView}
        onChangeRequester={() => {
          clearRequester();
          setSwitching(true);
        }}
      />
      <main className="container" style={{ padding: "var(--space-8) 0" }}>
        <Card title={activeView === "create-ticket" ? "Create Ticket" : "My Tickets"}>
          <p>
            Logged in as <strong>{requester.name}</strong> ({requester.email}).
          </p>
          <p>
            The {activeView === "create-ticket" ? "Create Ticket" : "My Tickets"}{" "}
            screen will appear here in a later sprint.
          </p>
        </Card>
      </main>
    </>
  );
}

export default function App() {
  return (
    <RequesterProvider>
      <Shell />
    </RequesterProvider>
  );
}
