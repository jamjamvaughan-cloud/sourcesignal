import * as React from "react";
import { Briefcase } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactElement;
  className?: string;
}

export function EmptyState({
  icon = <Briefcase className="h-6 w-6" />,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className ?? ""}`}>
      <div className="empty-state-icon">{icon}</div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-description">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
