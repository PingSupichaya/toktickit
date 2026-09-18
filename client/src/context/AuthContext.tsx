import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  AuthUser,
  changePassword as apiChangePassword,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
} from "../api.js";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const applyResult = useCallback(
    (result: { user: AuthUser; mustChangePassword: boolean }) => {
      setUser(result.user);
      setMustChangePassword(result.mustChangePassword);
      setStatus("authenticated");
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const result = await fetchMe();
        if (cancelled) return;
        applyResult(result);
      } catch {
        if (cancelled) return;
        setUser(null);
        setMustChangePassword(false);
        setStatus("unauthenticated");
      }
    }
    initialize();
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiLogin(email, password);
      applyResult(result);
    },
    [applyResult]
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setMustChangePassword(false);
      setStatus("unauthenticated");
    }
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const result = await apiChangePassword(currentPassword, newPassword);
      applyResult(result);
    },
    [applyResult]
  );

  const value = useMemo(
    () => ({ status, user, mustChangePassword, login, logout, changePassword }),
    [status, user, mustChangePassword, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}