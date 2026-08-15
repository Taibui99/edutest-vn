import { cn } from "@/lib/cn";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  color?: "primary" | "success" | "warning" | "danger" | "secondary";
  size?: "sm" | "md";
}

const colorStyles = {
  primary: "bg-[var(--primary)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  secondary: "bg-[var(--blue)]",
};

const sizeStyles = {
  sm: "h-1.5",
  md: "h-2",
};

export function Progress({ value, className, color = "primary", size = "md" }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full bg-[var(--gray-100)] rounded-full overflow-hidden", sizeStyles[size], className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", colorStyles[color])}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}