import { SelectHTMLAttributes, ReactNode } from "react";

interface Option<T> {
  value: T;
  label: string;
}

interface SelectProps<T extends string | number>
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  required?: boolean;
  error?: string;
  options: Option<T>[];
  placeholder?: string;
  id?: string;
  children?: ReactNode;
}

export function Select<T extends string | number>({
  label,
  required = false,
  error,
  options,
  placeholder,
  id,
  children,
  className = "",
  ...rest
}: SelectProps<T>) {
  const fieldId = id ?? `select-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label className={`field__label${required ? " field__label--required" : ""}`} htmlFor={fieldId}>
        {label}
      </label>
      <select
        id={fieldId}
        className={`select ${className}`}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}
