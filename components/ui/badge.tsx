import { cn } from "@/lib/cn";

type Variant = "default" | "primary" | "success" | "warning" | "danger" | "secondary";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-[var(--gray-100)] text-[var(--gray-600)]",
  primary: "bg-[var(--primary-light)] text-[var(--primary)]",
  success: "bg-[var(--success-light)] text-[var(--success)]",
  warning: "bg-[var(--warning-light)] text-[#D97706]",
  danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  secondary: "bg-[var(--blue-light)] text-[var(--blue)]",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}