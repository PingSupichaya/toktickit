import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  size?: "sm" | "md";
}

export function AuthLayout({ children, size = "sm" }: AuthLayoutProps) {
  return (
    <div className="auth-screen">
      <div className={`auth-card${size === "md" ? " auth-card--md" : ""}`}>
        {children}
      </div>
    </div>
  );
}