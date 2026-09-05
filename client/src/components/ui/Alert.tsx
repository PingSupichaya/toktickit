import { HTMLAttributes, ReactNode } from "react";

type Variant = "success" | "error" | "warning" | "info";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Alert({
  variant = "info",
  children,
  className = "",
  ...rest
}: AlertProps) {
  return (
    <div className={`alert alert--${variant} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}