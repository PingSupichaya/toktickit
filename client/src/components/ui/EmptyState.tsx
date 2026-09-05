import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="state" data-testid="empty-state">
      <h3 className="state__title">{title}</h3>
      {message && <p className="state__message">{message}</p>}
      {action}
    </div>
  );
}
