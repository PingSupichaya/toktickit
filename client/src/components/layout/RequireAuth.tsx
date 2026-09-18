import { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { UserRole } from "../../api.js";
import { ErrorState } from "../ui/ErrorState.js";

interface RequireAuthProps {
  roles?: UserRole[];
  children: ReactNode;
}

export function RequireAuth({ roles, children }: RequireAuthProps) {
  const { status, user, mustChangePassword } = useAuth();

  if (status !== "authenticated" || mustChangePassword) return null;

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="container" style={{ padding: "var(--space-8) var(--space-6)" }}>
        <ErrorState title="You are not authorized to view this page." />
      </div>
    );
  }

  return <>{children}</>;
}