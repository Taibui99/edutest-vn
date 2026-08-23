"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
    window.setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const icon = (type: ToastType) =>
    type === "success" ? <CheckCircle2 size={16} className="text-[var(--mint)] shrink-0" /> : type === "error" ? <AlertCircle size={16} className="text-[var(--danger)] shrink-0" /> : <Info size={16} className="text-[#2F80D8] shrink-0" />;

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-3 shadow-lg animate-fade-in-up"
            role="status"
          >
            {icon(t.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)]">{t.title}</p>
              {t.description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className={cn("rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--gray-100)]")} aria-label="Đóng thông báo">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}