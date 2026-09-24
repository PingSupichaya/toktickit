interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  hint?: string;
  className?: string;
  "data-testid"?: string;
}

export function Toggle({
  checked,
  onChange,
  label = "Active",
  disabled = false,
  hint,
  className = "",
  "data-testid": testId,
}: ToggleProps) {
  return (
    <div className={`toggle${disabled ? " toggle--disabled" : ""} ${className}`.trim()}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        className={`toggle__switch${checked ? " toggle__switch--on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__thumb" aria-hidden="true" />
      </button>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
    </div>
  );
}