"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#334155]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] [&>svg]:w-4 [&>svg]:h-4">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A]",
              "placeholder:text-[#94A3B8]",
              "focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]",
              "disabled:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:text-[#94A3B8]",
              "transition-colors",
              error && "border-[#EF4444] focus:ring-[#EF4444]/20 focus:border-[#EF4444]",
              icon && "pl-9",
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#94A3B8]">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
