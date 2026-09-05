import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  maxLength?: number;
  id?: string;
  "data-testid"?: string;
  errorTestId?: string;
  counterTestId?: string;
}

export function Textarea({
  label,
  required = false,
  error,
  hint,
  maxLength,
  id,
  "data-testid": testId,
  errorTestId,
  counterTestId,
  value,
  className = "",
  ...rest
}: TextareaProps) {
  const fieldId = id ?? `textarea-${label.replace(/\s+/g, "-").toLowerCase()}`;
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
    <div className={`field${error ? " field--error" : ""}`}>
      <label
        className={`field__label${required ? " field__label--required" : ""}`}
        htmlFor={fieldId}
      >
        {label}
      </label>
      <textarea
        id={fieldId}
        className={`textarea ${className}`}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        maxLength={maxLength}
        value={value}
        data-testid={testId}
        {...rest}
      />
      <div className="field__status">
        {hint && <span className="field__hint">{hint}</span>}
        {maxLength !== undefined && (
          <span
            className={`field__status-counter${counterClass}`}
            data-testid={counterTestId}
          >
            {currentLength} / {maxLength} characters
          </span>
        )}
      </div>
      {error && (
        <span className="field__error" role="alert" data-testid={errorTestId}>
          {error}
        </span>
      )}
    </div>
  );
}