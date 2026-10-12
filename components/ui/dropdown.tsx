"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* Dropdown tự vẽ thay `<select>` native: popup của select native là OS vẽ nên
 * không style được (user chê xấu). Component này vẽ cả nút lẫn danh sách bằng
 * token brand, hỗ trợ phím (Enter/Space mở, mũi tên di chuyển, Esc đóng).
 *
 * Dùng controlled (`value` + `onChange(value)`) hoặc uncontrolled
 * (`defaultValue` + `name` qua hidden input cho form server-action như đăng ký).
 */

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** id của <label> ngoài — để getByLabel/click label focus đúng nút. */
  labelledBy?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Dropdown({
  value,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Chọn...",
  disabled,
  name,
  id,
  labelledBy,
  ariaLabel,
  size = "md",
  className,
}: DropdownProps) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = isControlled ? (value as string) : inner;
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === current);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open ]);

  const pick = (v: string) => {
    if (!isControlled) setInner(v);
    onChange?.(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && hi >= 0 && hi < options.length) pick(options[hi].value);
      else setOpen((o) => !o);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHi(Math.max(0, options.findIndex((o) => o.value === current)));
      } else setHi((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setHi((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        aria-label={!labelledBy ? (ariaLabel ?? selected?.label ?? placeholder) : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onButtonKey}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-input)] text-[var(--text-primary)] transition-colors",
          "hover:border-[var(--surface-border-strong)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "h-9 px-2.5 text-[13px]" : "h-11 px-3 text-base sm:h-9 sm:text-sm",
          !selected && "text-[var(--text-muted)]",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn("shrink-0 text-[var(--text-muted)] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-60 w-full min-w-[10rem] overflow-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-1.5 shadow-[0_20px_50px_-16px_rgba(15,76,129,0.4)]"
        >
          {options.map((o, i) => {
            const isSel = o.value === current;
            return (
              <li key={o.value} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setHi(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 text-left transition-colors",
                    size === "sm" ? "py-2 text-[13px]" : "py-2.5 text-sm",
                    isSel
                      ? "bg-[var(--primary-light)] font-bold text-[var(--primary)]"
                      : "font-medium text-[var(--text-secondary)]",
                    !isSel && hi === i && "bg-[var(--gray-100)] text-[var(--text-primary)]",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check size={15} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
