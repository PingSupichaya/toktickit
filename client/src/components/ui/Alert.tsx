import { ReactNode } from "react";

type Variant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant?: Variant;
  children: ReactNode;
}

export function Alert({ variant = "info", children }: AlertProps) {
  return <div className={`alert alert--${variant}`}>{children}</div>;
}
