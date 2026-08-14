"use client";

import { useEffect } from "react";

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
        <div className="text-4xl mb-3">😵</div>
        <h1 className="text-xl font-black text-[var(--text-primary)] mb-2">Đã có lỗi xảy ra</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Có vẻ hệ thống đang gặp trục trặc. Hãy thử lại hoặc quay lại trang chủ.
        </p>
        <button
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-white hover:bg-[var(--primary-hover)]"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}