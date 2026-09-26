import { createContext, useContext, useMemo, ReactNode } from "react";
import { Requester } from "../api.js";
import { useAuth } from "./AuthContext.js";

interface RequesterContextValue {
  requester: Requester | null;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const requester = useMemo<Requester | null>(
    () => (user ? { id: user.id, name: user.name, email: user.email } : null),
    [user]
  );

  const value = useMemo(() => ({ requester }), [requester]);

  return (
    <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRequester(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return ctx;
}