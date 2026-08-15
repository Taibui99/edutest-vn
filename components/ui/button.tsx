"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "coral" | "mint" | "gradient";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:   "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-sm hover:shadow-md disabled:bg-[var(--primary-muted)] disabled:shadow-none",
  secondary: "bg-[var(--mint)] text-white hover:brightness-95 disabled:opacity-60",
  ghost:     "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)]",
  danger:    "bg-[var(--danger)] text-white hover:brightness-95 disabled:opacity-60",
  outline:   "bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:border-[var(--primary-muted)]",
  coral:     "bg-[var(--coral-light)] text-[var(--coral)] hover:brightness-95",
  mint:      "bg-[var(--mint-light)] text-[var(--mint)] hover:brightness-95",
  gradient:  "bg-[var(--gradient-brand)] text-white shadow-md hover:brightness-105",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-10 px-5 text-sm gap-2 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-bold cursor-pointer",
          "motion-button ripple-host",
          "disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";