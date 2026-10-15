"use client";

import { Spinner } from "@/app/components/spinner";

/* PRE-3 — Lớp phủ "đang xử lý" khi chuyển cảnh / nộp bài.
 *
 * Trước đây bấm "Bắt đầu làm bài" chỉ đổi chữ nút, bấm "Nộp bài" (có lúc chờ
 * 5–11s trên Supabase) hay "Làm lại" thì màn hình như đứng yên — người dùng
 * tưởng treo. Lớp phủ này cho phản hồi rõ ràng, mượt (fade + pop) trong lúc
 * chờ đợi/navigation, thay vì để trống.
 *
 * z-index 200: trên modal (100) và toast (120) nhưng dưới preloader (9999) —
 * khi điều hướng cứng, preloader của trang mới sẽ phủ lên lớp này. */
export function TransitionOverlay({
  show,
  label,
  hint = "Vui lòng chờ trong giây lát…",
}: {
  show: boolean;
  label: string;
  hint?: string;
}) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] grid animate-fade-in place-items-center p-4"
      style={{ background: "color-mix(in srgb, var(--surface-bg) 92%, transparent)" }}
    >
      <div className="flex w-full max-w-xs animate-pop-in flex-col items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-7 text-center shadow-xl">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Spinner className="h-7 w-7" />
        </span>
        <p className="text-base font-black text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      </div>
    </div>
  );
}
