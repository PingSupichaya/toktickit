import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  readonly?: boolean;
  id?: string;
  errorTestId?: string;
  counterTestId?: string;
  children?: ReactNode;
}

export function Input({
  label,
  required = false,
  error,
  hint,
  readonly = false,
  id,
  errorTestId,
  counterTestId,
  children,
  className = "",
  value,
  maxLength,
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

  const currentLength = typeof value === "string" ? value.length : 0;

  let counterClass = "";
  if (maxLength !== undefined) {
    const ratio = maxLength === 0 ? 1 : currentLength / maxLength;
    if (currentLength > maxLength) {
      counterClass = " counter--over";
    } else if (ratio >= 0.9) {
      counterClass = " counter--near";
    }
  }

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
        value={value}
        maxLength={maxLength}
        {...rest}
      />
      {maxLength !== undefined && (
        <div className="field__status">
          <span
            className={`field__status-counter${counterClass}`}
            data-testid={counterTestId}
          >
            {currentLength} / {maxLength} characters
          </span>
        </div>
      )}
      {hint && <span className="field__hint">{hint}</span>}
      {error && (
        <span className="field__error" role="alert" data-testid={errorTestId}>
          {error}
        </span>
      )}
      {children}
    </div>
  );
}