import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Requester, fetchRequesters } from "../api.js";

const STORAGE_KEY = "toktickit.requester";

interface RequesterContextValue {
  requester: Requester | null;
  requesters: Requester[];
  loading: boolean;
  error: string | null;
  loadRequesters: () => Promise<void>;
  selectRequester: (r: Requester) => void;
  clearRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [requester, setRequester] = useState<Requester | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as Requester;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequesters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reqs = await fetchRequesters();
      setRequesters(reqs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requesters");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectRequester = useCallback((r: Requester) => {
    setRequester(r);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  }, []);

  const clearRequester = useCallback(() => {
    setRequester(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    loadRequesters();
  }, [loadRequesters]);

  const value = useMemo(
    () => ({
      requester,
      requesters,
      loading,
      error,
      loadRequesters,
      selectRequester,
      clearRequester,
    }),
    [requester, requesters, loading, error, loadRequesters, selectRequester, clearRequester]
  );

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
