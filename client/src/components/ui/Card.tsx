import { ReactNode } from "react";

interface CardProps {
  title?: string;
  className?: string;
  hover?: boolean;
  children: ReactNode;
}

export function Card({ title, className = "", hover = false, children }: CardProps) {
  return (
    <div className={`card${hover ? " card--hover" : ""} ${className}`.trim()}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </div>
  );
}
