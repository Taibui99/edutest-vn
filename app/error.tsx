"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <AlertTriangle size={40} className="mx-auto mb-3 text-[var(--warning)]" strokeWidth={1.5} />
        <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)] mb-2">Đã có lỗi xảy ra</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Có vẻ hệ thống đang gặp trục trặc. Hãy thử lại hoặc quay lại trang chủ.
        </p>
        <button
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(15,76,129,0.55)] transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98]"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}