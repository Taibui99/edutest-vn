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
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary-light)] text-[var(--primary)] [&>svg]:h-7 [&>svg]:w-7">{icon}</div>
      )}
      <p className="text-sm font-black tracking-tight text-[var(--text-primary)]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
