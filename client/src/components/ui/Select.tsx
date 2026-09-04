import {
  useEffect,
  useRef,
  useState,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";

interface Option<T> {
  value: T;
  label: string;
}

interface SelectProps<T extends string | number> {
  label: string;
  required?: boolean;
  error?: string;
  options: Option<T>[];
  placeholder?: string;
  value: T | "";
  onChange: (value: T) => void;
  id?: string;
  "data-testid"?: string;
}

export function Select<T extends string | number>({
  label,
  required = false,
  error,
  options,
  placeholder = "Select…",
  value,
  onChange,
  id,
  "data-testid": testId,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = id ?? `select-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onDocKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick as EventListener);
    document.addEventListener("keydown", onDocKey as EventListener);
    return () => {
      document.removeEventListener("mousedown", onDocClick as EventListener);
      document.removeEventListener("keydown", onDocKey as EventListener);
    };
  }, [open]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setHighlight(options.findIndex((o) => o.value === value));
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => (h + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => (h - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlight >= 0 && highlight < options.length) {
          onChange(options[highlight].value);
          setOpen(false);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div
      ref={rootRef}
      className={`field select-control${open ? " select-control--open" : ""}${
        error ? " field--error" : ""
      }`}
    >
      <label
        className={`field__label${required ? " field__label--required" : ""}`}
        htmlFor={fieldId}
      >
        {label}
      </label>
      <div
        className="select-control__wrap"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${fieldId}-listbox`}
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          id={fieldId}
          className="select-control__trigger"
          data-testid={testId}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            if (!open) setHighlight(options.findIndex((o) => o.value === value));
          }}
        >
          <span
            className={`select-control__value${selected ? "" : " is-placeholder"}`}
          >
            {selected ? selected.label : placeholder}
          </span>
          <svg
            className="select-control__chevron"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <ul
            className="select-control__menu"
            id={`${fieldId}-listbox`}
            role="listbox"
            aria-label={label}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <li key={String(opt.value)} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`select-control__item${
                      isSelected ? " select-control__item--selected" : ""
                    }${i === highlight ? " select-control__item--highlight" : ""}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    {isSelected && (
                      <svg
                        className="select-control__check"
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                      >
                        <path d="M2 7l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span>{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
