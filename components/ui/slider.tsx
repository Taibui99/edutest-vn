"use client";

import { cn } from "@/lib/cn";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  valueLabel?: string;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueLabel,
  className,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>}
          {valueLabel && <span className="text-sm font-bold text-[var(--primary)]">{valueLabel}</span>}
        </div>
      )}
      <div className="relative">
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-2 rounded-full pointer-events-none"
          style={{
            width: `${pct}%`,
            background: "var(--gradient-brand)",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ui-range relative"
          aria-label={label}
        />
      </div>
    </div>
  );
}