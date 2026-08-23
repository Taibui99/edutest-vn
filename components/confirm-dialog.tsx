"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
  requireText,
  onConfirm,
  onCancel,
  busy = false,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 50);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onCancel();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = !requireText || typed === requireText;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-6 shadow-2xl">
        <button
          onClick={onCancel}
          disabled={busy}
          className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--gray-100)] disabled:opacity-40"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>
        <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center mb-3", danger ? "bg-red-50 text-red-500" : "bg-[#F1EDFD] text-[#6C4CF1]")}>
          <AlertTriangle size={20} />
        </div>
        <h3 className="text-base font-black text-[var(--text-primary)] mb-1.5">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{message}</p>
        {requireText && (
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Gõ "${requireText}" để xác nhận`}
            disabled={busy}
            className={cn(
              "mb-4 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:opacity-50",
              typed === requireText && typed !== ""
                ? "border-red-400 focus:border-red-500"
                : "border-[var(--surface-border)] focus:border-[#6C4CF1]",
            )}
          />
        )}
        {children}
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[var(--surface-border)] px-3.5 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--gray-100)] disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || busy}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40",
              danger ? "bg-red-500 hover:bg-red-600" : "bg-[#6C4CF1] hover:bg-[#5A3BD8]",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}