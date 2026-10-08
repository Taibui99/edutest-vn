import { Spinner } from "@/app/components/spinner";

/**
 * MOB-4 — Skeleton tải cho trang chi tiết đề. Xem ghi chú ở
 * `app/bang-dieu-khien/loading.tsx`: file này render bên trong layout khu điều
 * khiển nên không được tự vẽ header/min-h-screen.
 */
export default function ExamDetailLoading() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 h-8 w-40 animate-pulse rounded bg-[var(--gray-200)]" />

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--gray-100)]" />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 py-10 text-[var(--text-muted)]">
        <Spinner className="h-5 w-5" />
        <span className="text-sm">Đang tải đề thi...</span>
      </div>
    </div>
  );
}