import { cn } from "@/lib/cn";

type Variant = "default" | "primary" | "success" | "warning" | "danger" | "secondary";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-[#F1F5F9] text-[#475569]",
  primary: "bg-[#EFF6FF] text-[#2563EB]",
  success: "bg-[#F0FDF4] text-[#16A34A]",
  warning: "bg-[#FFFBEB] text-[#D97706]",
  danger: "bg-[#FEF2F2] text-[#DC2626]",
  secondary: "bg-[#F0FDFA] text-[#0D9488]",
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
