import { ReactNode, useEffect, useId } from "react";

interface SidePanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({ open, title, onClose, children }: SidePanelProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="side-panel-overlay"
      data-testid="side-panel-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="side-panel"
      >
        <div className="side-panel__header">
          <h2 className="side-panel__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="side-panel__close"
            aria-label="Close"
            data-testid="side-panel-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="side-panel__body">{children}</div>
      </div>
    </div>
  );
}