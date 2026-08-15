"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface NumberInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  className?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  hint,
  className,
}: NumberInputProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const handleRaw = (raw: string) => {
    const parsed = Number(raw);
    if (raw === "" || Number.isNaN(parsed)) return;
    onChange(clamp(parsed));
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label="Giảm"
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:text-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => handleRaw(e.target.value)}
          className="w-full h-9 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-input)] px-2 text-center text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--primary)]"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label="Tăng"
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--gray-100)] hover:text-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}