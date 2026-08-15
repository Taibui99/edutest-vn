"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full h-9 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-input)] px-3 pr-8 text-sm text-[var(--text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--primary)]",
              "disabled:bg-[var(--gray-100)] disabled:cursor-not-allowed",
              "transition-colors appearance-none",
              error && "border-[var(--danger)]",
              className,
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
        </div>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  },
);

Select.displayName = "Select";