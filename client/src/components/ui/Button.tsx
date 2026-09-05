import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  busy = false,
  block = false,
  className = "",
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    block ? "btn--block" : "",
    busy ? "btn--busy" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={busy ? `${typeof children === "string" ? children : "Submitting"} …loading` : undefined}
      {...rest}
    >
      {busy && <span className="spinner" aria-hidden="true" />}
      {busy ? "Submitting…" : children}
    </button>
  );
}
