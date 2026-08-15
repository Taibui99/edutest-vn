"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/cn";

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          <CalendarClock
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            ref={ref}
            id={inputId}
            type="datetime-local"
            className={cn(
              "w-full h-9 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-input)] pl-9 pr-3 text-sm text-[var(--text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--primary)]",
              "disabled:bg-[var(--gray-100)] disabled:cursor-not-allowed",
              "motion-input",
              error && "border-[var(--danger)]",
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="animate-fade-in text-xs text-[var(--danger)]">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);

DateField.displayName = "DateField";