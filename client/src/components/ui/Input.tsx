import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  readonly?: boolean;
  id?: string;
  children?: ReactNode;
}

export function Input({
  label,
  required = false,
  error,
  hint,
  readonly = false,
  id,
  children,
  className = "",
  ...rest
}: InputProps) {
  const fieldId = id ?? `input-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const wrapperClass = [
    "field",
    error ? "field--error" : "",
    readonly ? "field--readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      <label className={`field__label${required ? " field__label--required" : ""}`} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className={`input ${className}`}
        readOnly={readonly}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {hint && <span className="field__hint">{hint}</span>}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}
