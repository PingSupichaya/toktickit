import { useState } from "react";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { RequesterSelector } from "./components/features/RequesterSelector.js";
import { TicketForm } from "./components/features/TicketForm.js";
import { MyTickets } from "./components/features/MyTickets.js";
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
      <div className="dev-banner" role="status">
        ⚠️ DEVELOPMENT MODE — Not Real Authentication
      </div>
      <main className="container" style={{ padding: "var(--space-8) 0" }}>
        {activeView === "create-ticket" ? (
          <div className="create-ticket-page">
            <h1 className="screen-title">Create Ticket</h1>
            <Card>
              <TicketForm onCancel={() => setActiveView("my-tickets")} />
            </Card>
          </div>
        ) : (
          <MyTickets onCreateTicket={() => setActiveView("create-ticket")} />
        )}
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