import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center px-4", className)}>
      {icon && (
        <div className="text-[var(--gray-300)] mb-3 [&>svg]:w-9 [&>svg]:h-9">{icon}</div>
      )}
      <p className="text-sm font-bold text-[var(--text-secondary)]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
