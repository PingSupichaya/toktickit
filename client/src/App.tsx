import { useState } from "react";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { RequesterSelector } from "./components/features/RequesterSelector.js";
import { AppHeader } from "./components/layout/AppHeader.js";
import { Card } from "./components/ui/Card.js";

function Shell() {
  const { requester, clearRequester } = useRequester();
  const [switching, setSwitching] = useState(false);

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
        onChangeRequester={() => {
          clearRequester();
          setSwitching(true);
        }}
      />
      <main className="container" style={{ padding: "var(--space-8) 0" }}>
        <Card title="Welcome">
          <p>
            Logged in as <strong>{requester.name}</strong> ({requester.email}).
          </p>
          <p>
            My Tickets and Create Ticket screens will appear here in a later
            sprint.
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
