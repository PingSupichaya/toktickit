import { useState } from "react";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { RequesterSelector } from "./components/features/RequesterSelector.js";
import { TicketForm } from "./components/features/TicketForm.js";
import { MyTickets } from "./components/features/MyTickets.js";
import { TicketDetail } from "./components/features/TicketDetail.js";
import { AppHeader, HeaderView } from "./components/layout/AppHeader.js";
import { Card } from "./components/ui/Card.js";

function Shell() {
  const { requester, clearRequester } = useRequester();
  const [switching, setSwitching] = useState(false);
  const [activeView, setActiveView] = useState<HeaderView>("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

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
        onNavigate={(view) => {
          setSelectedTicketId(null);
          setActiveView(view);
        }}
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
        ) : activeView === "ticket-detail" && selectedTicketId !== null ? (
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={() => setActiveView("my-tickets")}
          />
        ) : (
          <MyTickets
            onCreateTicket={() => setActiveView("create-ticket")}
            onOpenTicket={(ticket) => {
              setSelectedTicketId(ticket.id);
              setActiveView("ticket-detail");
            }}
          />
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