import { cn } from "@/lib/cn";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  color?: "primary" | "success" | "warning" | "danger" | "secondary";
  size?: "sm" | "md";
}

const colorStyles = {
  primary: "bg-[#2563EB]",
  success: "bg-[#22C55E]",
  warning: "bg-[#F59E0B]",
  danger: "bg-[#EF4444]",
  secondary: "bg-[#14B8A6]",
};

const sizeStyles = {
  sm: "h-1.5",
  md: "h-2",
};

export function Progress({ value, className, color = "primary", size = "md" }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full bg-[#F1F5F9] rounded-full overflow-hidden", sizeStyles[size], className)}>
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
