"use client";

import { cn } from "@/lib/cn";

interface CheckboxProps {
  label?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ label, checked, onChange, disabled, className }: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2.5 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--surface-border-strong)] text-[var(--primary)] focus:ring-[var(--focus-ring)]"
      />
      {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </label>
  );
}