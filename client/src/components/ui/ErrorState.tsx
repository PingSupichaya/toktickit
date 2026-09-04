import { ReactNode } from "react";

interface ErrorStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
  retry?: () => void;
}

export function ErrorState({ title, message, action, retry }: ErrorStateProps) {
  return (
    <div className="state state--error">
      <h3 className="state__title">{title}</h3>
      {message && <p className="state__message">{message}</p>}
      {action}
      {retry && <button onClick={retry}>Retry</button>}
    </div>
  );
}
