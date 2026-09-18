import { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext.js";

interface RequirePasswordChangeProps {
  children: ReactNode;
}

export function RequirePasswordChange({ children }: RequirePasswordChangeProps) {
  const { status, mustChangePassword } = useAuth();

  if (status !== "authenticated" || !mustChangePassword) return null;

  return <>{children}</>;
}